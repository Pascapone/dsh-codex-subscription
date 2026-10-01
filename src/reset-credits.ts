import type { AuthResult, Credential } from '@earendil-works/pi-ai';
import type { ResetOptions, ResetCredit, ResetDetails, ResetResult, ResetChallenge } from './reset-types.js';
import { randomUUID as nodeRandomUUID } from 'node:crypto'

import { USER_AGENT } from './version.js'

export const CODEX_RESET_CREDITS_URL = 'https://chatgpt.com/backend-api/wham/rate-limit-reset-credits'
export const CODEX_RESET_CONSUME_URL = `${CODEX_RESET_CREDITS_URL}/consume`

const DEFAULT_CONFIRM_DELAY_MS = 5_000
const DEFAULT_CHALLENGE_TTL_MS = 60_000
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_COPY_LENGTH = 240
const UNCERTAIN_RESET_RESULT = 'Quota reset result is uncertain; retry this confirmation to check the same request'

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

const requestSignal = (signal: AbortSignal | undefined, timeoutMs: number) => {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal === undefined ? timeout : AbortSignal.any([signal, timeout])
}

function safeCopy(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0
    ? value.slice(0, MAX_COPY_LENGTH)
    : undefined
}

function credentialsOf(auth: AuthResult | undefined, credential: Credential | undefined): { access: string; accountId: string } {
  const access = auth?.auth?.apiKey
  const accountId = credential?.type === 'oauth' ? credential.accountId : undefined
  if (typeof access !== 'string' || access.length === 0
    || typeof accountId !== 'string' || accountId.length === 0) {
    throw new Error('ChatGPT subscription is not signed in')
  }
  return { access, accountId }
}

function expirationOf(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined
  if (Number.isSafeInteger(value) && (value as number) > 0) return (value as number) * 1_000
  if (typeof value === 'string' && value.length > 0 && value.length <= 64) {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  throw new Error('ChatGPT returned malformed quota reset details')
}

function parseDetails(value: unknown, now: number): ResetDetails {
  if (!record(value) || !Number.isSafeInteger(value.available_count) || (value.available_count as number) < 0
    || !Array.isArray(value.credits)) {
    throw new Error('ChatGPT returned malformed quota reset details')
  }
  if (value.available_count === 0) throw new Error('No quota reset is available')
  const available = (value.credits as unknown[])
    .filter((credit): credit is Record<string, unknown> & { id: string; status: string } => record(credit)
      && typeof credit.id === 'string' && credit.id.length > 0 && credit.id.length <= 256
      && typeof credit.status === 'string' && credit.status.toLowerCase() === 'available')
    .map(credit => {
      const expiresAt = expirationOf(credit.expires_at)
      return { credit, expiresAt }
    })
    .filter(({ expiresAt }) => expiresAt === undefined || expiresAt > now)
    .sort((a, b) => (a.expiresAt ?? Number.MAX_SAFE_INTEGER) - (b.expiresAt ?? Number.MAX_SAFE_INTEGER))
  if (available.length === 0) throw new Error('No usable quota reset is available')
  return {
    availableCount: value.available_count as number,
    credits: available.map(({ credit, expiresAt }, index) => ({
      creditId: credit.id,
      title: safeCopy(credit.title),
      description: safeCopy(credit.description),
      creditExpiresAt: expiresAt,
      index,
    })),
  }
}

function parseConsumeResult(value: unknown): ResetResult {
  if (!record(value) || !['reset', 'nothing_to_reset', 'no_credit', 'already_redeemed'].includes(value.code as string)) {
    throw new Error('ChatGPT returned an unreadable quota reset response')
  }
  const windowsReset = Array.isArray(value.windows_reset)
    ? (value.windows_reset as unknown[]).filter(item => typeof item === 'string').slice(0, 16)
    : []
  const windowsResetCount = Number.isSafeInteger(value.windows_reset)
    && (value.windows_reset as number) >= 0 && (value.windows_reset as number) <= 16
    ? value.windows_reset as number
    : undefined
  return { code: value.code as ResetResult['code'], windowsReset, ...(windowsResetCount === undefined ? {} : { windowsResetCount }) }
}

/**
 * Host-only reset redemption. The browser receives an opaque, short-lived
 * challenge; account ids, bearer tokens, credit ids, and idempotency keys stay
 * in memory on the host.
 */
export function createCodexResetCreditService(options: ResetOptions) {
  const getAuth = options.getAuth
  const readCredential = options.readCredential
  const usageReader = options.usageReader
  const fetchReset = options.fetch ?? fetch
  const now = options.now ?? Date.now
  const randomUUID = options.randomUUID ?? nodeRandomUUID
  const confirmDelayMs = options.confirmDelayMs ?? DEFAULT_CONFIRM_DELAY_MS
  const challengeTtlMs = options.challengeTtlMs ?? DEFAULT_CHALLENGE_TTL_MS
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const challenges = new Map<string, ResetChallenge>()
  const creditRefs = new Map<string, { accountId: string; creditId: string; index: number }>()
  let creditRefSequence = 0

  const rememberCreditRef = (accountId: string, credit: ResetCredit) => {
    const ref = `${randomUUID()}-${++creditRefSequence}`
    creditRefs.set(ref, {
      accountId,
      creditId: credit.creditId,
      index: credit.index,
    })
    while (creditRefs.size > 64) creditRefs.delete(creditRefs.keys().next().value!)
    return ref
  }

  const publicCredit = (accountId: string, credit: ResetCredit) => ({
    ref: rememberCreditRef(accountId, credit),
    ...(credit.title === undefined ? {} : { name: credit.title }),
    ...(credit.creditExpiresAt === undefined ? {} : { expiresAt: credit.creditExpiresAt }),
  })

  const resolveCredentials = async (signal?: AbortSignal) => credentialsOf(
    await getAuth({ signal }),
    await readCredential({ signal }),
  )

  const readDetails = async (signal: AbortSignal | undefined, credentials?: { access: string; accountId: string }) => {
    const { access, accountId } = credentials ?? await resolveCredentials(signal)
    const response = await fetchReset(CODEX_RESET_CREDITS_URL, {
      method: 'GET',
      redirect: 'error',
      headers: {
        authorization: `Bearer ${access}`,
        'chatgpt-account-id': accountId,
        accept: 'application/json',
        'cache-control': 'no-store',
        'user-agent': USER_AGENT,
      },
      signal: requestSignal(signal, timeoutMs),
    })
    if (!response.ok) {
      throw new Error(response.status === 401 || response.status === 403
        ? 'ChatGPT sign-in needs to be renewed'
        : `ChatGPT quota reset request failed (HTTP ${response.status})`)
    }
    let raw: unknown
    try { raw = await response.json() } catch { throw new Error('ChatGPT returned unreadable quota reset details') }
    return { accountId, details: parseDetails(raw, now()) }
  }

  return Object.freeze({
    async inspect({ signal }: { signal?: AbortSignal } = {}) {
      const { accountId, details } = await readDetails(signal)
      return {
        availableCount: details.availableCount,
        credits: details.credits.map(credit => publicCredit(accountId, credit)),
        ...(details.credits[0]?.creditExpiresAt === undefined ? {} : { nextExpiresAt: details.credits[0].creditExpiresAt }),
      }
    },

    async prepare({ creditRef, signal }: { creditRef?: unknown; signal?: AbortSignal } = {}) {
      const credentials = await resolveCredentials(signal)
      for (const [challengeId, challenge] of challenges) {
        if (challenge.accountId === credentials.accountId && challenge.uncertain === false
          && challenge.creditRef === creditRef) {
          if (now() > challenge.expiresAt) {
            challenges.delete(challengeId as string)
          } else {
            return {
              challengeId,
              availableCount: challenge.availableCount,
              readyAt: challenge.readyAt,
              expiresAt: challenge.expiresAt,
              ...(challenge.creditExpiresAt === undefined ? {} : { creditExpiresAt: challenge.creditExpiresAt }),
              ...(challenge.title === undefined ? {} : { title: challenge.title }),
              ...(challenge.description === undefined ? {} : { description: challenge.description }),
            }
          }
        }
        if (challenge.accountId !== credentials.accountId || challenge.uncertain !== true
          || (creditRef !== undefined && challenge.creditRef !== creditRef)) continue
        if (now() > challenge.expiresAt) {
          challenges.delete(challengeId as string)
          continue
        }
        return {
          challengeId,
          availableCount: challenge.availableCount,
          readyAt: challenge.readyAt,
          expiresAt: challenge.expiresAt,
          ...(challenge.creditExpiresAt === undefined ? {} : { creditExpiresAt: challenge.creditExpiresAt }),
          ...(challenge.title === undefined ? {} : { title: challenge.title }),
          ...(challenge.description === undefined ? {} : { description: challenge.description }),
        }
      }
      const { accountId, details } = await readDetails(signal, credentials)
      let selected: ResetCredit | undefined = details.credits[0]
      if (creditRef !== undefined) {
        const reference = typeof creditRef === 'string' ? creditRefs.get(creditRef) : undefined
        if (reference === undefined || reference.accountId !== accountId) {
          throw new Error('This quota reset confirmation is no longer valid')
        }
        selected = details.credits.find(credit => credit.creditId === reference.creditId
          && credit.index === reference.index)
        if (selected === undefined) throw new Error('This quota reset confirmation is no longer valid')
      }
      if (selected === undefined) throw new Error('No usable quota reset is available')
      const preparedAt = now()
      const readyAt = preparedAt + confirmDelayMs
      const expiresAt = Math.min(preparedAt + challengeTtlMs, selected.creditExpiresAt ?? Number.MAX_SAFE_INTEGER)
      if (expiresAt <= readyAt) throw new Error('The available quota reset expires too soon')
      const challengeId = randomUUID()
      challenges.set(challengeId, {
        state: 'prepared',
        accountId,
        creditRef,
        creditId: selected.creditId,
        redeemRequestId: randomUUID(),
        readyAt,
        expiresAt,
        availableCount: details.availableCount,
        creditExpiresAt: selected.creditExpiresAt,
        title: selected.title,
        description: selected.description,
        uncertain: false,
      })
      return {
        challengeId,
        availableCount: details.availableCount,
        readyAt,
        expiresAt,
        ...(selected.creditExpiresAt === undefined ? {} : { creditExpiresAt: selected.creditExpiresAt }),
        ...(selected.title === undefined ? {} : { title: selected.title }),
        ...(selected.description === undefined ? {} : { description: selected.description }),
      }
    },

    async consume({ challengeId, acknowledged, signal }: { challengeId?: unknown; acknowledged?: unknown; signal?: AbortSignal } = {}) {
      const challenge = typeof challengeId === 'string' ? challenges.get(challengeId) : undefined
      if (challenge === undefined) throw new Error('This quota reset confirmation is no longer valid')
      if (challenge.state === 'pending') throw new Error('This quota reset is already in progress')
      if (now() < challenge.readyAt) throw new Error('Wait before confirming this quota reset')
      if (now() > challenge.expiresAt) {
        challenges.delete(challengeId as string)
        throw new Error('This quota reset confirmation is no longer valid')
      }
      if (acknowledged !== true) throw new Error('You must acknowledge that this may consume one quota reset')

      // Set the gate synchronously before the first await so rapid clicks and
      // concurrent RPC calls can never create more than one provider POST.
      challenge.state = 'pending'
      let retryable = challenge.uncertain === true
      try {
        const { access, accountId } = await resolveCredentials(signal)
        if (accountId !== challenge.accountId) {
          retryable = false
          throw new Error('The signed-in ChatGPT account changed')
        }
        let response: Response
        try {
          response = await fetchReset(CODEX_RESET_CONSUME_URL, {
            method: 'POST',
            redirect: 'error',
            headers: {
              authorization: `Bearer ${access}`,
              'chatgpt-account-id': accountId,
              accept: 'application/json',
              'content-type': 'application/json',
              'cache-control': 'no-store',
              'user-agent': USER_AGENT,
            },
            body: JSON.stringify({
              redeem_request_id: challenge.redeemRequestId,
              credit_id: challenge.creditId,
            }),
            signal: requestSignal(signal, timeoutMs),
          })
        } catch {
          retryable = true
          throw new Error(UNCERTAIN_RESET_RESULT)
        }
        if (!response.ok) {
          if (response.status >= 500) {
            retryable = true
            throw new Error(UNCERTAIN_RESET_RESULT)
          }
          if (response.status !== 401 && response.status !== 403) retryable = false
          throw new Error(response.status === 401 || response.status === 403
            ? 'ChatGPT sign-in needs to be renewed'
            : `ChatGPT quota reset request failed (HTTP ${response.status})`)
        }
        let raw: unknown
        try { raw = await response.json() } catch {
          retryable = true
          throw new Error(UNCERTAIN_RESET_RESULT)
        }
        let result: ResetResult
        try { result = parseConsumeResult(raw) } catch {
          retryable = true
          throw new Error(UNCERTAIN_RESET_RESULT)
        }
        retryable = false
        usageReader.clear()
        return result
      } finally {
        if (retryable && now() <= challenge.expiresAt) {
          challenge.state = 'prepared'
          challenge.uncertain = true
        }
        else challenges.delete(challengeId as string)
      }
    },

    clear() {
      challenges.clear()
      creditRefs.clear()
    },
  })
}
