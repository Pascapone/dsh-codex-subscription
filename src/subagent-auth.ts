import type { OAuthCredential } from '@earendil-works/pi-ai';
import type { DshOAuthCredentialStore } from './credential-store.js';
import type { JsonRpcLineTransport } from '@deepseek-ai/dsh-sdk-protocol';
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess';
type TokenGetter = (previousAccountId?: unknown, forceRefresh?: boolean) => Promise<{ accessToken: string; chatgptAccountId: string }>;
type TransportPort = Pick<JsonRpcLineTransport, 'request' | 'notify' | 'start' | 'close' | 'onRequest' | 'onNotification'>;
interface TokenOptions { resolveAuth(): Promise<unknown>; store: Pick<DshOAuthCredentialStore, 'read' | 'modify'>; refresh(current: OAuthCredential): Promise<OAuthCredential>; signal: AbortSignal }
interface AuthenticatedChildOptions { Transport: new (...args: ConstructorParameters<typeof JsonRpcLineTransport>) => TransportPort; getTokens: TokenGetter; thread: Record<string, unknown>; signal: AbortSignal }
import { PassThrough } from 'node:stream'

const AUTH_ERROR = 'Codex subscription authorization failed; check the selected account'

/** Keep refresh rotation in the plugin's existing serialized credential store. */
export async function createSubagentTokens({ resolveAuth, store, refresh, signal }: TokenOptions): Promise<TokenGetter> {
  signal.throwIfAborted()
  await resolveAuth()
  const initial = await store.read('openai-codex', { signal })
  if (initial?.type !== 'oauth' || !initial.accountId || !initial.access) throw new Error(AUTH_ERROR)
  const accountId = initial.accountId as string
  let access = initial.access
  return async (previousAccountId?: unknown, forceRefresh = false) => {
    signal.throwIfAborted()
    if (previousAccountId !== undefined && previousAccountId !== accountId) throw new Error(AUTH_ERROR)
    let credential: Awaited<ReturnType<TokenOptions['store']['read']>>
    if (previousAccountId !== undefined || forceRefresh) {
      const rejectedAccess = access
      credential = await store.modify('openai-codex', async current => {
        if ((current as OAuthCredential | undefined)?.accountId !== accountId) throw new Error(AUTH_ERROR)
        if ((current as OAuthCredential).access !== rejectedAccess) return current
        const next = await refresh(current as OAuthCredential)
        if (next?.accountId !== accountId) throw new Error(AUTH_ERROR)
        return next
      }, { signal })
    } else credential = await store.read('openai-codex', { signal })
    signal.throwIfAborted()
    if (credential?.accountId !== accountId || !credential.access) throw new Error(AUTH_ERROR)
    access = credential.access
    return { accessToken: access, chatgptAccountId: accountId }
  }
}

/**
 * Authenticate the official DSH provider's private app-server connection.
 * DSH still owns framing, process containment, turns, tool approvals and disposal.
 * Only the documented external-auth handshake and thread policy are adapted.
 * No token is passed in argv, environment, logs or a second auth.json.
 */
export function authenticatedSubagentChild<T extends Pick<SubprocessHandle, 'stdin' | 'stdout' | 'done'>>(child: T, { Transport, getTokens, thread, signal }: AuthenticatedChildOptions) {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const host = new Transport(stdin, stdout)
  const server = new Transport(child.stdout!, child.stdin!)
  let initialized = false
  let authenticated: Promise<unknown> | undefined
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    host.close()
    server.close()
    stdin.destroy()
    stdout.end()
  }
  const authorize = async (previousAccountId?: unknown, refresh = false) => {
    try { return await getTokens(previousAccountId, refresh) } catch { throw new Error(AUTH_ERROR) }
  }
  const login = () => authenticated ??= (async () => {
    const tokens = await authorize()
    signal.throwIfAborted()
    try {
      return await server.request('account/login/start', { type: 'chatgptAuthTokens', ...tokens },
        AbortSignal.any([signal, AbortSignal.timeout(10_000)]))
    } catch { throw new Error(AUTH_ERROR) }
  })()
  host.onRequest(async (method, params) => {
    if (method === 'initialize') {
      const result = await server.request(method, {
        ...params, capabilities: { ...(params.capabilities as Record<string, unknown> | undefined), experimentalApi: true },
      }, signal)
      initialized = true
      return result
    }
    if (method === 'thread/start') {
      if (!initialized) throw new Error('Codex initialization incomplete')
      await login()
      return server.request(method, { ...params, ...thread }, signal)
    }
    return server.request(method, params, signal)
  })
  host.onNotification((method, params) => server.notify(method, params))
  server.onRequest((method, params) => method === 'account/chatgptAuthTokens/refresh'
    ? authorize(params.previousAccountId ?? undefined, true)
    : host.request(method, params, signal))
  server.onNotification((method, params) => host.notify(method, params))
  host.start()
  server.start()
  child.done.then(close, close)
  return new Proxy(child, {
    get(target, key) {
      if (key === 'stdin') return stdin
      if (key === 'stdout') return stdout
      const value = Reflect.get(target, key, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}
