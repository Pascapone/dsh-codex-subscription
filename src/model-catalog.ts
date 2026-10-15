import type { Api, Model, ModelThinkingLevel, ThinkingLevelMap, AuthOperationOptions } from '@earendil-works/pi-ai';
import type { CodexModel, RemoteModel, ModelCatalogOptions } from './model-types.js';
import { readSubscriptionCredentials } from './subscription-credentials.js'
import { PACKAGE_VERSION, USER_AGENT } from './version.js'
import { DSH_MODEL_PROMPTS } from './codex-base-prompts.js'

export const CODEX_MODELS_URL = `https://chatgpt.com/backend-api/codex/models?client_version=${encodeURIComponent(PACKAGE_VERSION)}`

const LEVELS: ModelThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
const DEFAULT_REFRESH_TIMEOUT_MS = 10_000
// Codex's announced default; account catalogs and installed pi-ai may lag behind.
// https://x.com/thsottiaux/status/2109430343346581527
const SOL61_DEFAULT_CONTEXT_WINDOW = 500_000
const BUNDLED_FALLBACK_MODELS: readonly Readonly<RemoteModel>[] = Object.freeze([
  Object.freeze({
    id: 'gpt-6-luna',
    name: 'GPT-6 Luna',
    description: 'Efficient model for focused, high-volume tasks.',
    priority: 3,
    input: ['text', 'image'] as Model<Api>['input'],
    contextWindow: 272_000,
    maxContextWindow: 872_000,
    reasoning: true,
    thinkingLevelMap: { off: null, minimal: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
    supportVerbosity: true,
    defaultVerbosity: 'low',
    supportsFast: true,
    templateId: 'gpt-5.6-luna',
  }),
  Object.freeze({
    id: 'gpt-6-sol',
    name: 'GPT-6 Sol',
    description: 'Workhorse model for complex coding and agentic workflows.',
    priority: 2,
    input: ['text', 'image'] as Model<Api>['input'],
    contextWindow: 272_000,
    maxContextWindow: 872_000,
    reasoning: true,
    thinkingLevelMap: { off: null, minimal: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
    supportVerbosity: true,
    defaultVerbosity: 'low',
    supportsFast: true,
    templateId: 'gpt-5.6-sol',
  }),
  Object.freeze({
    id: 'gpt-6.1-sol',
    name: 'GPT-6.1-Sol',
    description: 'Latest workhorse model for coding and everyday work.',
    priority: 1,
    input: ['text', 'image'] as Model<Api>['input'],
    contextWindow: SOL61_DEFAULT_CONTEXT_WINDOW,
    maxContextWindow: 872_000,
    reasoning: true,
    thinkingLevelMap: { off: null, minimal: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
    supportVerbosity: true,
    defaultVerbosity: 'low',
    supportsFast: true,
    templateId: 'gpt-5.6-sol',
  }),
])
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const nonEmpty = (value: unknown): string | undefined => typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
const positiveInteger = (value: unknown): number | undefined => Number.isSafeInteger(value) && (value as number) > 0 ? value as number : undefined

function upgradeModelId(value: Record<string, unknown>) {
  const direct = typeof value.upgrade === 'string'
    ? nonEmpty(value.upgrade)
    : record(value.upgrade) ? nonEmpty(value.upgrade.model) : undefined
  return direct
    ?? (record(value.upgrade_info) ? nonEmpty(value.upgrade_info.model) : undefined)
    ?? (record(value.upgradeInfo) ? nonEmpty(value.upgradeInfo.model) : undefined)
}

// The HTTP catalog nests the notice as `upgrade: { model, retirement_at: '<ISO date>' }`;
// the app-server shape uses `upgradeInfo.retirementAt` in Unix seconds. Accept both.
function retirementMillis(value: Record<string, unknown>) {
  for (const source of [value, value.upgrade, value.upgrade_info, value.upgradeInfo]) {
    if (!record(source)) continue
    for (const raw of [source.retirement_at, source.retirementAt]) {
      const seconds = positiveInteger(raw)
      if (seconds !== undefined && Number.isSafeInteger(seconds * 1000)) return seconds * 1000
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/u.test(raw)) {
        const parsed = Date.parse(raw)
        if (Number.isFinite(parsed) && parsed > 0) return parsed
      }
    }
  }
  return undefined
}

export function retirementNotice(value: unknown, now = Date.now(), targetDisplayName?: unknown) {
  if (!record(value) || !Number.isFinite(now)) return undefined
  const at = retirementMillis(value)
  if (at === undefined || at <= now) return undefined
  const date = new Date(at)
  if (!Number.isFinite(date.getTime())) return undefined
  const year = String(date.getUTCFullYear()).padStart(4, '0')
  const dateText = `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  const upgradeTo = upgradeModelId(value)
  const upgradeName = upgradeTo === undefined ? undefined : nonEmpty(targetDisplayName) ?? upgradeTo
  const text = `Retires on ${dateText} (UTC).${upgradeName === undefined ? '' : ` Switch to ${upgradeName} to keep working.`}`
  return { text, at, upgradeTo, dateText }
}

function reasoningMap(levels: unknown): ThinkingLevelMap {
  const supported = new Set((Array.isArray(levels) ? levels : [])
    .map(level => nonEmpty(record(level) ? level.effort : undefined))
    .filter(Boolean) as string[])
  const map: ThinkingLevelMap = Object.fromEntries(LEVELS.map(level => [level, null]))
  if (supported.has('none')) map.off = 'none'
  for (const level of LEVELS.slice(1)) {
    if (supported.has(level)) map[level] = level
  }
  return map
}

const capabilityNames = (values: readonly unknown[]): string[] => [...new Set(values.filter(value =>
  typeof value === 'string' && /^[a-z][a-z0-9_-]{0,31}$/u.test(value)))].sort().slice(0, 16) as string[]

const speedTierIds = (value: Record<string, unknown>) => [
  ...(Array.isArray(value.additional_speed_tiers) ? value.additional_speed_tiers : []),
  ...(Array.isArray(value.service_tiers) ? value.service_tiers.map(tier => record(tier) ? tier.id : undefined) : []),
]

function unsupportedCapabilities(value: Record<string, unknown> & { supported_reasoning_levels: unknown[] }) {
  const reasoning = capabilityNames((value.supported_reasoning_levels ?? []).map(item => record(item) ? item.effort : undefined))
    .filter(level => !['none', ...LEVELS.slice(1)].includes(level))
  const inputs = capabilityNames(Array.isArray(value.input_modalities) ? value.input_modalities : [])
    .filter(input => !['text', 'image'].includes(input))
  const speeds = capabilityNames([
    ...(Array.isArray(value.additional_speed_tiers) ? value.additional_speed_tiers : []),
    ...(Array.isArray(value.service_tiers) ? value.service_tiers.map(tier => tier?.id) : []),
  ]).filter(tier => !['auto', 'default', 'standard', 'fast', 'priority', 'ultrafast'].includes(tier))
  return {
    ...(reasoning.length ? { reasoning } : {}),
    ...(inputs.length ? { inputs } : {}),
    ...(speeds.length ? { speeds } : {}),
  }
}

function visibleModel(value: unknown, displayNames: ReadonlyMap<string, string>, now: number): RemoteModel | undefined {
  if (!record(value)) return undefined
  const id = nonEmpty(value.slug)
  // Reserve is a manually selected experiment, only when the account catalog
  // actually advertises it. Do not expose other hidden models or invent it offline.
  const reserve = id === 'gpt-reserve' && (['list', 'hide'] as readonly unknown[]).includes(value.visibility)
  if (id === undefined || (value.visibility !== 'list' && !reserve)) return undefined
  const supported = Array.isArray(value.supported_reasoning_levels) ? value.supported_reasoning_levels : []
  const input = Array.isArray(value.input_modalities)
    ? (value.input_modalities as unknown[]).filter(item => (['text', 'image'] as readonly unknown[]).includes(item))
    : ['text', 'image']
  const unsupported = unsupportedCapabilities({ ...value, supported_reasoning_levels: supported })
  const upgradeTo = upgradeModelId(value)
  const retirement = retirementNotice(value, now, upgradeTo === undefined ? undefined : displayNames.get(upgradeTo))
  const notice = retirement?.text
  const description = nonEmpty(value.description)
  return {
    ...(Object.keys(unsupported).length ? { unsupported } : {}),
    id,
    // The host's model menu only renders names for plugin models, so the date has
    // to live in the name to be visible. The id, and so any saved selection, is untouched.
    name: `${reserve ? 'GPT-Reserve (Experimental)' : nonEmpty(value.display_name) ?? id}${retirement === undefined ? '' : ` (retires ${retirement.dateText})`}`,
    description: notice === undefined ? description : description === undefined ? notice : `${description}\n${notice}`,
    ...(retirement === undefined ? {} : { retirement: { at: retirement.at, upgradeTo: retirement.upgradeTo } }),
    priority: Number.isFinite(value.priority) ? value.priority as number : 0,
    input: (input.length > 0 ? input : ['text']) as RemoteModel['input'],
    contextWindow: positiveInteger(value.context_window) ?? positiveInteger(value.max_context_window),
    ...(positiveInteger(value.max_context_window) === undefined ? {} : { maxContextWindow: value.max_context_window as number }),
    reasoning: supported.length > 0,
    thinkingLevelMap: reasoningMap(supported),
    supportVerbosity: value.support_verbosity === true,
    defaultVerbosity: (['low', 'medium', 'high'] as readonly unknown[]).includes(value.default_verbosity) ? value.default_verbosity as RemoteModel['defaultVerbosity'] : undefined,
    supportsFast: speedTierIds(value).some(tier => tier === 'fast' || tier === 'priority'),
    // Only offered when this account's catalog lists it for the model (Pro 500 today).
    supportsUltrafast: speedTierIds(value).includes('ultrafast'),
  }
}

/** Codex's dedicated approval reviewer when the account catalog advertises it. */
export const CODEX_REVIEW_MODEL = 'codex-auto-review'

/**
 * Mirror Codex's reviewer selection: a parent model's override, else the
 * default reviewer, used only when the account catalog lists that slug (any
 * visibility), with low reasoning when the reviewer supports it.
 */
export function officialReviewModel(value: unknown, parentId?: string) {
  if (!record(value) || !Array.isArray(value.models)) return undefined
  const entries = value.models.filter(record)
   const parent = entries.find(model => model.slug === parentId)
  const id = nonEmpty(parent?.auto_review_model_override) ?? CODEX_REVIEW_MODEL
  const preset = entries.find(model => model.slug === id)
  if (preset === undefined) return undefined
  const levels = Array.isArray(preset.supported_reasoning_levels) ? preset.supported_reasoning_levels : []
  const effort = levels.some(level => (record(level) ? level.effort : level) === 'low')
    ? 'low'
    : nonEmpty(preset.default_reasoning_level)
  return { id, ...(effort === undefined ? {} : { effort }) }
}

export function parseOfficialModelCatalog(value: unknown, now = Date.now()): RemoteModel[] {
  if (!record(value) || !Array.isArray(value.models)) throw new Error('Codex returned a malformed model catalog')
  const displayNames = new Map<string, string>()
  for (const model of value.models) {
    if (!record(model)) continue
    const id = nonEmpty(model.slug)
    const name = nonEmpty(model.display_name)
    if (id !== undefined && name !== undefined && !displayNames.has(id)) displayNames.set(id, name)
  }
  const seen = new Set<string>()
  return value.models
    .map(model => visibleModel(model, displayNames, now))
    .filter((model): model is RemoteModel => model !== undefined && !seen.has(model.id) && !!seen.add(model.id))
    .sort((left, right) => Number(left.id === 'gpt-reserve') - Number(right.id === 'gpt-reserve')
      || right.priority - left.priority)
}

function mergeModel(baseModels: readonly CodexModel[], remote: Readonly<RemoteModel>): CodexModel | undefined {
  const base = baseModels.find(model => model.id === remote.id)
    ?? baseModels.find(model => model.id === remote.templateId)
    ?? baseModels.find(model => model.id !== 'gpt-5.3-codex-spark')
    ?? baseModels[0]
  if (base === undefined) return undefined
  return {
    ...base,
    id: remote.id,
    name: remote.name,
    ...(remote.retirement === undefined || remote.description === undefined ? {} : { description: remote.description }),
    input: remote.input,
    reasoning: remote.reasoning,
    thinkingLevelMap: remote.thinkingLevelMap,
    ...(remote.contextWindow === undefined ? {} : { contextWindow: remote.contextWindow }),
    ...(remote.maxContextWindow === undefined ? {} : { maxContextWindow: remote.maxContextWindow }),
    // Subscription-backed models do not expose API billing to this plugin.
    ...(base.id === remote.id ? {} : { cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }),
  }
}


export function addBundledCodexFallbacks(baseModels: readonly CodexModel[]): CodexModel[] {
  const visible = baseModels.filter(model => model.id !== 'gpt-5.3-codex-spark')
  const existing = new Set(visible.map(model => model.id))
  const bundled = BUNDLED_FALLBACK_MODELS
    .filter(model => !existing.has(model.id))
    .map(model => mergeModel(baseModels, model))
    .filter(Boolean) as CodexModel[]
  return [...bundled, ...visible]
}

export function createOfficialModelCatalog(options: ModelCatalogOptions = {}) {
  const fetchCatalog = options.fetch ?? fetch
  const getNow = options.now ?? Date.now
  const scheduleTimeout = options.setTimeout ?? setTimeout
  const cancelTimeout = options.clearTimeout ?? clearTimeout
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs! > 0
    ? options.timeoutMs!
    : DEFAULT_REFRESH_TIMEOUT_MS
  let models: CodexModel[] | undefined
  let metadata = new Map<string, RemoteModel>()
  let etag: string | undefined
  let rawCatalog: unknown
  let revision = 0
  let refreshing: { generation: number; promise: Promise<boolean>; cancel(): void } | undefined
  let generation = 0
  let refreshStatus: 'idle' | 'refreshing' | 'ok' | 'failed' = 'idle'

  const refresh = ({ signal }: AuthOperationOptions = {}): Promise<boolean> => {
    if (signal?.aborted) return Promise.reject(signal.reason ?? new Error('Codex model catalog refresh aborted'))
    if (refreshing?.generation === generation) return refreshing.promise
    const currentGeneration = generation
    refreshStatus = 'refreshing'
    let outcome: 'idle' | 'ok' | 'failed' = 'idle'
    const controller = new AbortController()
    const abort = () => {
      if (!controller.signal.aborted) controller.abort(signal?.reason ?? new Error('Codex model catalog refresh aborted'))
    }
    signal?.addEventListener('abort', abort, { once: true })
    const requestSignal = controller.signal
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeoutError = new Error('Codex model catalog refresh timed out')
    const work = (async () => {
      const { access, accountId } = await readSubscriptionCredentials(options.getAuth, options.readCredential, requestSignal)
      if (currentGeneration !== generation || requestSignal.aborted) return false
      if (typeof access !== 'string' || access.length === 0 || typeof accountId !== 'string' || accountId.length === 0) {
        return false
      }
      const headers = {
        authorization: `Bearer ${access}`,
        'chatgpt-account-id': accountId,
        accept: 'application/json',
        originator: 'pi',
        'user-agent': USER_AGENT,
        ...(etag === undefined ? {} : { 'if-none-match': etag }),
      }
      const response = await fetchCatalog(CODEX_MODELS_URL, { method: 'GET', redirect: 'error', headers, signal: requestSignal })
      if (currentGeneration !== generation || requestSignal.aborted) return false
      if (response.status === 304) {
        outcome = 'ok'
        // An unchanged catalog can still have crossed a retirement date since it was parsed.
        if (rawCatalog === undefined) return false
        const remote = parseOfficialModelCatalog(rawCatalog, getNow())
        const next = remote.map(model => mergeModel(options.baseModels?.() ?? [], model)).filter((model): model is CodexModel => model !== undefined)
        if (next.length === 0 || JSON.stringify(next) === JSON.stringify(models)) return false
        models = next
        metadata = new Map(remote.map(model => [model.id, model]))
        revision += 1
        options.onUpdated?.()
        return true
      }
      if (!response.ok) throw new Error(`Codex model catalog failed (HTTP ${response.status})`)
      const raw = await response.json()
      const remote = parseOfficialModelCatalog(raw, getNow())
      if (currentGeneration !== generation || requestSignal.aborted) return false
      if (remote.length === 0) throw new Error('Codex returned an empty model catalog')
      const baseModels = options.baseModels?.() ?? []
      const next = remote.map(model => mergeModel(baseModels, model)).filter(Boolean) as CodexModel[] as CodexModel[]
      if (next.length === 0) throw new Error('Codex model catalog has no compatible models')
      if (currentGeneration !== generation || requestSignal.aborted) return false
      models = next
      rawCatalog = raw
      metadata = new Map(remote.map(model => [model.id, model]))
      etag = nonEmpty(response.headers.get('etag')) ?? etag
      revision += 1
      outcome = 'ok'
      options.onUpdated?.()
      return true
    })()
    let rejectAborted!: () => void
    const abortPromise = new Promise<never>((_, reject) => {
      rejectAborted = () => reject(requestSignal.reason ?? new Error('Codex model catalog refresh aborted'))
      if (requestSignal.aborted) rejectAborted()
      else requestSignal.addEventListener('abort', rejectAborted, { once: true })
    })
    timer = scheduleTimeout(() => controller.abort(timeoutError), timeoutMs)
    timer.unref?.()
    const promise = Promise.race([work, abortPromise]).catch(error => {
      outcome = 'failed'
      throw error
    }).finally(() => {
      cancelTimeout(timer)
      signal?.removeEventListener('abort', abort)
      requestSignal.removeEventListener('abort', rejectAborted)
      if (refreshing?.promise === promise) {
        refreshing = undefined
        refreshStatus = outcome
      }
    })
    refreshing = { generation: currentGeneration, promise, cancel: () => controller.abort() }
    return promise
  }

  return Object.freeze({
    refresh,
    // Keep current recommended models usable when the account catalog cannot be
    // refreshed. Account capabilities stay authoritative; apply the announced Sol default.
    getModels: (fallback: readonly CodexModel[] = options.baseModels?.() ?? []): CodexModel[] => (models ?? addBundledCodexFallbacks(fallback)).map(model => model.id === 'gpt-6.1-sol'
      ? { ...model, contextWindow: Math.min(SOL61_DEFAULT_CONTEXT_WINDOW, model.maxContextWindow ?? SOL61_DEFAULT_CONTEXT_WINDOW) }
      : model),
    // Remote model capabilities may change; reviewed DSH instructions must not.
    basePrompt: (modelId: string) => Object.hasOwn(DSH_MODEL_PROMPTS, modelId) ? (DSH_MODEL_PROMPTS as Readonly<Record<string, string>>)[modelId] : undefined,
    metadata: (modelId: string | undefined) => metadata.get(modelId!),
    reviewModel: (parentId?: string) => officialReviewModel(rawCatalog, parentId),
    revision: () => revision,
    capabilityGaps: () => [...metadata.values()]
      .filter(model => model.unsupported && /^[a-z][a-z0-9._-]{0,79}$/u.test(model.id))
      .slice(0, 20)
      .map(model => ({ model: model.id, ...structuredClone(model.unsupported) })),
    status: () => ({ source: models === undefined ? 'unavailable' : 'online', refresh: refreshStatus }),
    clear() {
      generation += 1
      const flight = refreshing
      refreshing = undefined
      flight?.cancel()
      models = undefined
      rawCatalog = undefined
      metadata = new Map()
      etag = undefined
      refreshStatus = 'idle'
      revision += 1
      options.onUpdated?.()
    },
  })
}
