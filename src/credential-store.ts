import type { AuthOperationOptions, CredentialInfo, CredentialStore, Models, OAuthCredential } from '@earendil-works/pi-ai';
import type { CredentialProvider, CredentialRef, ResolvedCredential } from '@deepseek-ai/dsh-credentials';
import type { AccountStatus, AuthService, CodexAuthInteraction, CredentialMutation } from './auth-types.js';
import type { DshOAuthAccountVault } from './account-vault.js';
import { PendingOAuthCredentialStore } from './account-vault.js'

const PROVIDER = 'openai-codex'

const abortIfNeeded = (options: AuthOperationOptions | undefined) => options?.signal?.throwIfAborted()
const clone = <T>(value: T): T => (value === undefined ? undefined : structuredClone(value)) as T

function assertProvider(providerId: string): void {
  if (providerId !== PROVIDER) {
    throw new Error(`Codex credential store does not own provider ${JSON.stringify(providerId)}`)
  }
}

function assertOAuthCredential(input: unknown): OAuthCredential | undefined {
  const value = input as Partial<OAuthCredential> | null | undefined;
  if (value === undefined) return undefined
  if (value === null || typeof value !== 'object'
    || value.type !== 'oauth'
    || typeof value.access !== 'string' || value.access.length === 0
    || typeof value.refresh !== 'string' || value.refresh.length === 0
    || typeof value.expires !== 'number' || !Number.isFinite(value.expires)) {
    throw new Error('Codex credential store received a malformed OAuth credential')
  }
  return clone(value as OAuthCredential)
}

function parseOAuthCredential(value: string): OAuthCredential {
  try {
    return assertOAuthCredential(JSON.parse(value) as unknown)!
  } catch (error) {
    if ((error as { message?: unknown } | null | undefined)?.message === 'Codex credential store received a malformed OAuth credential') throw error
    throw new Error('Codex credential store contains malformed OAuth JSON', { cause: error })
  }
}

/**
 * Adapt DSH's managed string credential service to pi-ai's typed OAuth store.
 * Refresh/login/logout operations are serialized so an older refresh response
 * cannot overwrite a newer rotated token.
 */
export class DshOAuthCredentialStore {
  declare credentials: Pick<CredentialProvider, 'resolve' | 'set' | 'unset'>;
  declare ref: CredentialRef;
  declare legacyRefs: readonly CredentialRef[];
  declare expirySkewMs: number;
  declare vault: DshOAuthAccountVault | undefined;
  #chains = new Map<string, Promise<unknown>>()

  constructor(credentials: Pick<CredentialProvider, 'resolve' | 'set' | 'unset'> | null | undefined, ref: CredentialRef, legacyRefs: readonly CredentialRef[] = [], options: { expirySkewMs?: number; vault?: DshOAuthAccountVault } = {}) {
    if (credentials === undefined || credentials === null) {
      throw new Error('Codex OAuth requires the DSH credentials service')
    }
    const expirySkewMs = options.expirySkewMs ?? 0
    if (!Number.isFinite(expirySkewMs) || expirySkewMs < 0) {
      throw new Error('Codex OAuth expiry skew must be a non-negative finite number')
    }
    this.credentials = credentials
    this.ref = ref
    this.legacyRefs = Object.freeze([...legacyRefs])
    this.expirySkewMs = expirySkewMs
    this.vault = options.vault
  }

  #enqueue<T>(providerId: string, operation: () => Promise<T>, options?: AuthOperationOptions): Promise<T> {
    assertProvider(providerId)
    const previous = this.#chains.get(providerId) ?? Promise.resolve()
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        abortIfNeeded(options)
        return operation()
      })
    const tail = current.catch(() => undefined)
    this.#chains.set(providerId, tail)
    void tail.finally(() => {
      if (this.#chains.get(providerId) === tail) this.#chains.delete(providerId)
    })
    return current
  }

  async #read(providerId: string, options?: AuthOperationOptions): Promise<OAuthCredential | undefined> {
    assertProvider(providerId)
    abortIfNeeded(options)
    if (this.vault !== undefined) {
      const current = await this.vault.readActive()
      if (current === undefined) return undefined
      return this.expirySkewMs === 0 ? current : { ...current, expires: current.expires - this.expirySkewMs }
    }
    let hit: Pick<ResolvedCredential, 'value'> | undefined = await this.credentials.resolve(this.ref)
    if (hit?.value === undefined || hit.value === '') {
      for (const legacyRef of this.legacyRefs) {
        const legacy = await this.credentials.resolve(legacyRef)
        if (legacy?.value === undefined || legacy.value === '') continue
        const migrated = parseOAuthCredential(legacy.value)
        await this.credentials.set(this.ref, JSON.stringify(migrated))
        await this.credentials.unset(legacyRef)
        hit = { value: JSON.stringify(migrated) }
        break
      }
    }
    abortIfNeeded(options)
    if (hit?.value === undefined || hit.value === '') return undefined
    const credential = parseOAuthCredential(hit.value)
    return this.expirySkewMs === 0
      ? credential
      : { ...credential, expires: credential.expires - this.expirySkewMs }
  }

  read(providerId: string, options?: AuthOperationOptions): Promise<OAuthCredential | undefined> {
    return this.#enqueue(providerId, () => this.#read(providerId, options), options)
  }

  async list(options?: AuthOperationOptions): Promise<CredentialInfo[]> {
    abortIfNeeded(options)
    const current = await this.read(PROVIDER, options)
    return current === undefined ? [] : [{ providerId: PROVIDER, type: 'oauth' }]
  }

  modify(providerId: string, update: CredentialMutation, options?: AuthOperationOptions): Promise<OAuthCredential | undefined> {
    return this.#enqueue(providerId, async () => {
      if (this.vault !== undefined) {
        const next = await this.vault.modifyActive(async current => {
          const visible = current === undefined || this.expirySkewMs === 0
            ? current
            : { ...current, expires: current.expires - this.expirySkewMs }
          const updated = await update(clone(visible))
          return updated === undefined ? undefined : assertOAuthCredential(updated)
        })
        abortIfNeeded(options)
        return clone(next)
      }
      const current = await this.#read(providerId, options)
      const next = await update(clone(current))
      abortIfNeeded(options)
      if (next === undefined) return current
      const validated = assertOAuthCredential(next)
      await this.credentials.set(this.ref, JSON.stringify(validated))
      for (const legacyRef of this.legacyRefs) await this.credentials.unset(legacyRef)
      abortIfNeeded(options)
      return clone(validated)
    }, options)
  }

  delete(providerId: string, options?: AuthOperationOptions): Promise<void> {
    return this.#enqueue(providerId, async () => {
      if (this.vault !== undefined) {
        await this.vault.deleteAll()
        abortIfNeeded(options)
        return
      }
      await this.credentials.unset(this.ref)
      for (const legacyRef of this.legacyRefs) await this.credentials.unset(legacyRef)
      abortIfNeeded(options)
    }, options)
  }
}

/** Return only account state that is safe to expose to the browser client. */
export function createCodexAuthService(models: Pick<Models, 'login' | 'logout'>, store: Pick<DshOAuthCredentialStore, 'read'>, options: { runLogin?: <T>(run: () => Promise<T>) => Promise<T>; accountVault?: DshOAuthAccountVault; createLoginModels?: (store: PendingOAuthCredentialStore) => Pick<Models, 'login'>; createPendingStore?: () => PendingOAuthCredentialStore } = {}): AuthService {
  const runLogin = options.runLogin ?? (<T>(run: () => Promise<T>) => run())
  const accountVault = options.accountVault
  const createLoginModels = options.createLoginModels
  const createPendingStore = options.createPendingStore ?? (() => new PendingOAuthCredentialStore())
  return Object.freeze({
    async status(options?: AuthOperationOptions): Promise<AccountStatus> {
      const current = await store.read(PROVIDER, options)
      const accounts = await accountVault?.list()
      if (current === undefined) return { authenticated: false, provider: PROVIDER, ...(accounts === undefined ? {} : { accounts }) }
      return {
        authenticated: true,
        provider: PROVIDER,
        type: 'oauth',
        expiresAt: current.expires,
        ...(accounts === undefined ? {} : { accounts }),
      }
    },
    login(interaction: CodexAuthInteraction, input: { label?: string } = {}) {
      if (input.label !== undefined) {
        if (accountVault === undefined || createLoginModels === undefined) throw new Error('Codex multi-account is unavailable')
        return runLogin(async () => {
          const pending = createPendingStore()
          const loginModels = createLoginModels(pending)
          await loginModels.login(PROVIDER, 'oauth', interaction)
          const credential = pending.credential()
          if (credential === undefined) throw new Error('Codex login did not return credentials')
          await accountVault.add(input.label, credential)
        })
      }
      return runLogin(() => models.login(PROVIDER, 'oauth', interaction))
    },
    async select(id: unknown) {
      if (accountVault === undefined) throw new Error('Codex multi-account is unavailable')
      await accountVault.select(id)
      return this.status()
    },
    async remove(id: unknown) {
      if (accountVault === undefined) throw new Error('Codex multi-account is unavailable')
      await accountVault.remove(id)
      return this.status()
    },
    logout(options?: AuthOperationOptions) {
      return models.logout(PROVIDER, options)
    },
  })
}
