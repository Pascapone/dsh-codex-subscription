import type { ApiKeyAuth, AssistantMessageEvent, AssistantMessageEventStream, Provider, Context as PiContext, StreamOptions, OpenAICodexResponsesOptions, SimpleStreamOptions } from '@earendil-works/pi-ai';
import type { SubscriptionProviderOptions } from './runtime-types.js';
import type { CodexModel } from './model-types.js';
import type { CodexPayload } from './compaction-types.js';
// Keep every dependency on pi-ai's Codex-specific public surface in one place.
// The exact peer version makes a DSH update fail visibly until this seam is
// re-audited instead of silently changing authentication or cache semantics.
import { openaiCodexProvider as createOpenAICodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import { normalizeTransportEvent } from './transport-failure.js'
import { headroomRouteUrl } from './oauth-network.js'
import {
  CONTEXT_MODE_CUSTOM,
  CONTEXT_MODE_EXTENDED,
  customContextModelKey,
  OUTPUT_VERBOSITY_DEFAULT,
  SPEED_MODE_FAST,
  supportsCodexFastMode,
  modelContextMaximum,
  clampModelContext,
} from './settings-contract.js'

const FAST_SERVICE_TIER = 'priority'

export { createModels } from '@earendil-works/pi-ai'
export { createOpenAICodexProvider as openaiCodexProvider }

/**
 * Preserve pi-ai's native Codex OAuth provider while allowing DSH's generic
 * PiAiAdapter to pass the access token resolved by the host credential store.
 *
 * PiAiAdapter owns a request-local Models collection backed by the same DSH
 * credential store as this provider. A pure OAuth provider ignores its
 * `apiKey` request override and otherwise fails before dispatch with "Provider
 * is not configured". This non-interactive bridge teaches that collection how
 * to consume only the already-refreshed token for this request; login, refresh,
 * persistence, headers, transport, and model behavior remain owned by the
 * original provider.
 */
export function openaiCodexSubscriptionProvider({
  resolveSpeedMode = () => undefined,
  resolveOutputVerbosity = () => OUTPUT_VERBOSITY_DEFAULT,
  resolveContextMode = () => undefined,
  resolveCustomContextWindow = () => undefined,
  resolveRoute,
  catalog,
  connection,
  compaction,
  runNetwork = (_area, operation) => operation(),
}: SubscriptionProviderOptions = {}): Provider<'openai-codex-responses'> {
  const provider = createOpenAICodexProvider()
  const requestToken: ApiKeyAuth = Object.freeze({
    name: 'DSH-managed Codex OAuth request token',
    async resolve({ credential }: Parameters<ApiKeyAuth['resolve']>[0]) {
      const token = credential?.type === 'api_key' ? credential.key : undefined
      if (typeof token !== 'string' || token.length === 0) return undefined
      return { auth: { apiKey: token }, source: 'DSH-managed OAuth request' }
    },
  })
  const modelMetadata = (model: CodexModel) => catalog?.metadata(model?.id)
  const supportsVerbosity = (model: CodexModel) => modelMetadata(model)?.supportVerbosity ?? model?.id !== 'gpt-5.3-codex-spark'
  const withPreferences = (model: CodexModel, options: StreamOptions = {}): StreamOptions => {
    const metadata = modelMetadata(model)
    const requestedVerbosity = resolveOutputVerbosity()
    const textVerbosity = supportsVerbosity(model)
      ? requestedVerbosity === OUTPUT_VERBOSITY_DEFAULT
        ? metadata?.defaultVerbosity ?? 'medium'
        : requestedVerbosity
      : undefined
    const fast = resolveSpeedMode(options.sessionId) === SPEED_MODE_FAST
      && (metadata?.supportsFast ?? supportsCodexFastMode(model?.id))
    const onPayload = options.onPayload
    return {
      ...options,
      ...(textVerbosity === undefined ? {} : { textVerbosity }),
      ...(fast ? { serviceTier: FAST_SERVICE_TIER } : {}),
      async onPayload(payload, requestModel) {
        const preferred = {
          ...(payload as CodexPayload),
          ...(textVerbosity === undefined ? {} : { text: { ...((payload as CodexPayload).text ?? {}), verbosity: textVerbosity } }),
          ...(fast ? { service_tier: FAST_SERVICE_TIER } : {}),
        }
        const managed = compaction?.preparePayload(preferred, model?.contextWindow) ?? preferred
        const next = await onPayload?.(managed, requestModel) as CodexPayload | null | undefined
        return {
          ...(next ?? managed),
          ...(textVerbosity === undefined ? {} : { text: { ...((next ?? managed).text ?? {}), verbosity: textVerbosity } }),
          ...(fast ? { service_tier: FAST_SERVICE_TIER } : {}),
        }
      },
    }
  }
  const getModels = () => (catalog?.getModels(provider.getModels()) ?? provider.getModels()).map(model => {
    const maximum = modelContextMaximum(model)
    const mode = resolveContextMode()
    if (model.id === 'gpt-5.3-codex-spark' || ![CONTEXT_MODE_EXTENDED, CONTEXT_MODE_CUSTOM].includes(mode!)) return model
    if (mode === CONTEXT_MODE_EXTENDED) {
      // Prefer the explicit catalog maximum; known offline models keep audited presets.
      const contextWindow = maximum
      return { ...model, contextWindow }
    }
    const requested = clampModelContext(resolveCustomContextWindow(customContextModelKey(model.id)), maximum, model.contextWindow)
    return { ...model, contextWindow: requested }
  })
  const requestModel = (model: CodexModel, options?: StreamOptions) => {
    let route: ReturnType<NonNullable<SubscriptionProviderOptions['resolveRoute']>>
    try { route = resolveRoute?.({ provider: 'openai-codex', model: model.id, sessionId: options?.sessionId }) } catch { return model }
    const baseUrl = route?.ready && headroomRouteUrl(route.baseUrl)
    return baseUrl ? { ...model, baseUrl } : model
  }
  const networkIterable = (factory: (options: StreamOptions) => AsyncIterable<AssistantMessageEvent>, options: StreamOptions, baseUrl?: string): AssistantMessageEventStream => {
    let iterator: AsyncIterator<AssistantMessageEvent, unknown, unknown> | undefined
    let prepared: ReturnType<NonNullable<SubscriptionProviderOptions['connection']>['prepare']> | undefined
    const step = async (method: 'next' | 'return' | 'throw', value?: unknown): Promise<IteratorResult<AssistantMessageEvent, unknown>> => {
      const request: Awaited<NonNullable<typeof prepared>> = await (prepared ??= connection?.prepare(options, baseUrl) ?? Promise.resolve({ options }))
      const result = await runNetwork('model', () => {
        iterator ??= factory(compaction?.requestOptions(request.options) ?? request.options)[Symbol.asyncIterator]()
        return iterator[method]?.(value) ?? (method === 'throw' ? Promise.reject(value) : Promise.resolve({ done: true as const, value }))
      }, compaction?.networkOptions(request.network) ?? request.network)
      return result.done ? result : { ...result, value: normalizeTransportEvent(result.value, request.options?.signal) }
    }
    return {
      [Symbol.asyncIterator]() { return this },
      next: (value?: unknown) => step('next', value),
      return: (value?: unknown) => iterator ? step('return', value) : Promise.resolve({ done: true as const, value }),
      throw: (error?: unknown) => iterator ? step('throw', error) : Promise.reject(error),
    } as unknown as AssistantMessageEventStream
  }
  return Object.freeze({
    ...provider,
    auth: Object.freeze({ ...provider.auth, apiKey: requestToken }),
    getModels,
    stream: (model: CodexModel, context: PiContext, options?: OpenAICodexResponsesOptions) => {
      const selected = requestModel(model, options)
      return networkIterable(prepared => provider.stream(selected, context, prepared), withPreferences(model, options), selected.baseUrl)
    },
    streamSimple: (model: CodexModel, context: PiContext, options?: SimpleStreamOptions) => {
      const selected = requestModel(model, options)
      return networkIterable(prepared => provider.streamSimple(selected, context, prepared), withPreferences(model, options), selected.baseUrl)
    },
  })
}

export const PI_AI_RUNTIME_VERSIONS = Object.freeze(['0.82.1', '0.85.1'])
