import type { createSubscriptionRpcClient } from './rpc-contract.js';
import type { ContextModelDescriptor, PreferenceScope, PreferenceSnapshot, PreferenceValue, PreferenceWireView } from './preference-types.js';
import { CHANNEL, unwrap } from './rpc-contract.js'
import {
  clampModelContext,
  CONTEXT_MODE_FIELD,
  CUSTOM_CONTEXT_MODEL_CAPS,
  CUSTOM_CONTEXT_MODEL_DEFAULTS,
  CUSTOM_CONTEXT_MODEL_FIELDS,
  CUSTOM_CONTEXT_WINDOW_FIELD,
  LEGACY_QUICK_QUOTA_FIELD,
  normalizeContextMode,
  normalizeCustomContextWindow,
  normalizeOutputVerbosity,
  normalizeQuickQuotaMode,
  normalizeSearchProvider,
  normalizeSpeedMode,
  OUTPUT_VERBOSITY_FIELD,
  QUICK_QUOTA_MODE_FIELD,
  SEARCH_PROVIDER_FIELD,
  SPEED_MODE_FIELD,
  SESSION_SPEED_MODES_FIELD,
} from './settings-contract.js'
import { readCapabilitySettings, CUSTOM_CONTEXT_OVERRIDES_FIELD } from './capability-settings.js'



export function createPreferenceController(scope: PreferenceScope, rpc: Pick<ReturnType<typeof createSubscriptionRpcClient>, 'call'>) {
  let updating = false
  let error = false
  let fallbackStatus: PreferenceSnapshot['status'] = 'loading'
  let fallback: PreferenceSnapshot | undefined
  let pendingPatch: PreferenceValue | undefined
  let failedPatch: PreferenceValue | undefined
  const pendingSpeeds = new Map<string, unknown>()
  let generation = 0
  let contextModels: ContextModelDescriptor[] = []
  let verbosityModels: string[] = []
  let fastModels: string[] | undefined
  let catalogStatus: unknown
  let modelsLoading = false
  let modelError = false
  let modelRefreshGeneration = 0
  let modelRefreshStarted = false
  let disposed = false
  let subagentBackendAvailable = false
  let subagentRuntimeInstalled = false

  const sameModels = (left: readonly unknown[], right: readonly unknown[]) => left.length === right.length
    && left.every((model, index) => JSON.stringify(model) === JSON.stringify(right[index]))
  const nativeSnapshot = () => scope.getSnapshot()
  const read = () => {
    const native = nativeSnapshot()
    const current = native.status === 'ready'
      ? native
      : fallbackStatus === 'ready'
        ? fallback!
        : native
    const value = pendingPatch === undefined ? current.value : { ...current.value, ...pendingPatch }
    const capabilities = readCapabilitySettings(value)
    return Object.freeze({
      // Keep accepted ready surfaces mounted while a Host write is pending.
      status: current.status,
      ...capabilities,
      connectionMode: value?.connectionMode === 'websocket' ? 'websocket' : 'sse',
      compactionMode: value?.compactionMode === 'cloud' ? 'cloud' : 'dsh',
      codexBasePrompt: value?.codexBasePrompt === true,
      subagentBackend: value?.subagentBackend === 'codex' ? 'codex' : 'dsh',
      subagentBackendAvailable,
      subagentRuntimeInstalled,
      quickQuotaMode: normalizeQuickQuotaMode(
        value?.[QUICK_QUOTA_MODE_FIELD],
        value?.[LEGACY_QUICK_QUOTA_FIELD],
      ),
      searchProvider: normalizeSearchProvider(value?.[SEARCH_PROVIDER_FIELD]),
      speedMode: normalizeSpeedMode(value?.[SPEED_MODE_FIELD]),
      sessionSpeedModes: { ...value?.[SESSION_SPEED_MODES_FIELD], ...Object.fromEntries(pendingSpeeds) },
      outputVerbosity: normalizeOutputVerbosity(value?.[OUTPUT_VERBOSITY_FIELD]),
      contextMode: normalizeContextMode(value?.[CONTEXT_MODE_FIELD]),
      customContextWindow: normalizeCustomContextWindow(value?.[CUSTOM_CONTEXT_WINDOW_FIELD]),
      customContextWindows: {
        ...Object.fromEntries(Object.entries(CUSTOM_CONTEXT_MODEL_FIELDS).map(([modelKey, field]) => [modelKey, normalizeCustomContextWindow(value?.[field] ?? CUSTOM_CONTEXT_MODEL_DEFAULTS[modelKey as keyof typeof CUSTOM_CONTEXT_MODEL_DEFAULTS], CUSTOM_CONTEXT_MODEL_CAPS[modelKey as keyof typeof CUSTOM_CONTEXT_MODEL_CAPS])])),
        ...Object.fromEntries(contextModels.map(model => [model.key, clampModelContext(capabilities[CUSTOM_CONTEXT_OVERRIDES_FIELD][model.key] ?? value?.[(CUSTOM_CONTEXT_MODEL_FIELDS as Readonly<Record<string, string>>)[model.key]], model.maximum, model.default ?? (CUSTOM_CONTEXT_MODEL_DEFAULTS as Readonly<Record<string, number>>)[model.key])])),
      },
      contextModels,
      verbosityModels,
      fastModels,
      catalogStatus,
      modelsLoading,
      modelError,
      writable: !updating && current.status === 'ready' && current.writable === true,
      saving: updating,
      error,
    })
  }
  let snapshot = read()
  const listeners = new Set<() => void>()
  const publish = () => {
    snapshot = read()
    for (const listener of listeners) listener()
  }
  const disposeScope = scope.subscribe(() => {
    for (const [id, mode] of pendingSpeeds) {
      if (nativeSnapshot().value?.[SESSION_SPEED_MODES_FIELD]?.[id] === mode) pendingSpeeds.delete(id)
    }
    error = false
    if (!updating) failedPatch = undefined
    publish()
  })
  const acceptFallback = (value: PreferenceWireView | null | undefined) => {
    subagentBackendAvailable = value?.subagentBackendAvailable === true
    subagentRuntimeInstalled = value?.subagentRuntimeInstalled === true
    if (!modelRefreshStarted) {
      contextModels = Array.isArray(value?.contextModels) ? value.contextModels as ContextModelDescriptor[] : []
      verbosityModels = Array.isArray(value?.verbosityModels) ? value.verbosityModels as string[] : []
      fastModels = Array.isArray(value?.fastModels) ? value.fastModels as string[] : undefined
      catalogStatus = value?.catalogStatus
    }
    fallbackStatus = 'ready'
    fallback = {
      status: 'ready',
      value: {
        connectionMode: value?.connectionMode === 'websocket' ? 'websocket' : 'sse',
        compactionMode: value?.compactionMode === 'cloud' ? 'cloud' : 'dsh',
      codexBasePrompt: value?.codexBasePrompt === true,
        subagentBackend: value?.subagentBackend === 'codex' ? 'codex' : 'dsh',
        ...readCapabilitySettings(value!),
        [QUICK_QUOTA_MODE_FIELD]: normalizeQuickQuotaMode(
          value?.[QUICK_QUOTA_MODE_FIELD],
          value?.[LEGACY_QUICK_QUOTA_FIELD],
        ),
        [SEARCH_PROVIDER_FIELD]: normalizeSearchProvider(value?.[SEARCH_PROVIDER_FIELD]),
        [SPEED_MODE_FIELD]: normalizeSpeedMode(value?.[SPEED_MODE_FIELD]),
        [SESSION_SPEED_MODES_FIELD]: value?.[SESSION_SPEED_MODES_FIELD] ?? {},
        [OUTPUT_VERBOSITY_FIELD]: normalizeOutputVerbosity(value?.[OUTPUT_VERBOSITY_FIELD]),
        [CONTEXT_MODE_FIELD]: normalizeContextMode(value?.[CONTEXT_MODE_FIELD]),
        [CUSTOM_CONTEXT_WINDOW_FIELD]: normalizeCustomContextWindow(value?.[CUSTOM_CONTEXT_WINDOW_FIELD]),
        ...Object.fromEntries(Object.entries(CUSTOM_CONTEXT_MODEL_FIELDS).map(([modelKey, field]) => [field, normalizeCustomContextWindow(value?.[field] ?? CUSTOM_CONTEXT_MODEL_DEFAULTS[modelKey as keyof typeof CUSTOM_CONTEXT_MODEL_DEFAULTS], CUSTOM_CONTEXT_MODEL_CAPS[modelKey as keyof typeof CUSTOM_CONTEXT_MODEL_CAPS])])),
      },
      writable: value?.writable === true,
    }
  }
  const load = async () => {
    const current = ++generation
    updating = false
    pendingPatch = undefined
    fallbackStatus = 'loading'
    fallback = undefined
    error = false
    publish()
    try {
      const value = unwrap(await rpc.call(CHANNEL, 'preferences/status', {})) as PreferenceWireView | null | undefined
      if (current !== generation || disposed) return
      subagentBackendAvailable = value?.subagentBackendAvailable === true
      subagentRuntimeInstalled = value?.subagentRuntimeInstalled === true
      if (nativeSnapshot().status === 'ready') {
        if (!modelRefreshStarted) {
          contextModels = Array.isArray(value?.contextModels) ? value.contextModels as ContextModelDescriptor[] : []
          verbosityModels = Array.isArray(value?.verbosityModels) ? value.verbosityModels as string[] : []
          fastModels = Array.isArray(value?.fastModels) ? value.fastModels as string[] : undefined
          catalogStatus = value?.catalogStatus
        }
      }
      else acceptFallback(value)
      publish()
    } catch {
      if (current !== generation || disposed || nativeSnapshot().status === 'ready') return
      fallbackStatus = 'unavailable'
      publish()
    }
  }
  const refreshModels = async () => {
    const current = ++modelRefreshGeneration
    modelRefreshStarted = true
    modelError = false
    modelsLoading = true
    publish()
    try {
      const value = unwrap(await rpc.call(CHANNEL, 'preferences/models', {})) as PreferenceWireView | null | undefined
      if (disposed || current !== modelRefreshGeneration) return false
      const nextContextModels = Array.isArray(value?.contextModels) ? value.contextModels as ContextModelDescriptor[] : []
      const nextVerbosityModels = Array.isArray(value?.verbosityModels) ? value.verbosityModels as string[] : []
      const nextFastModels = Array.isArray(value?.fastModels) ? value.fastModels as string[] : undefined
      catalogStatus = value?.catalogStatus
      const changed = !sameModels(contextModels, nextContextModels)
        || !sameModels(verbosityModels, nextVerbosityModels)
        || JSON.stringify(fastModels) !== JSON.stringify(nextFastModels)
      if (changed) {
        contextModels = nextContextModels
        verbosityModels = nextVerbosityModels
        fastModels = nextFastModels
        publish()
      }
      return changed
    } catch {
      if (disposed || current !== modelRefreshGeneration) return false
      if (!modelError) {
        modelError = true
        publish()
      }
      return false
    } finally {
      if (!disposed && current === modelRefreshGeneration) { modelsLoading = false; publish() }
    }
  }
  const set = async (patch: PreferenceValue) => {
    if (disposed || snapshot.status !== 'ready' || snapshot.writable !== true) return
    const current = ++generation
    const entries = Object.entries(patch)
    updating = true
    pendingPatch = patch
    error = false
    failedPatch = undefined
    publish()
    try {
      const native = nativeSnapshot()
      if (native.status === 'ready' && !Object.hasOwn(patch, 'subagentBackend')) {
        for (const [field, value] of entries) {
          if (current !== generation) return
          await scope.set!(field, value)
        }
        if (current !== generation) return
        const accepted = nativeSnapshot().value
        error = entries.some(([field, value]) => JSON.stringify(accepted?.[field]) !== JSON.stringify(value))
        if (error) failedPatch = patch
        pendingPatch = undefined
      } else {
        const value = unwrap(await rpc.call(CHANNEL, 'preferences/update', patch)) as PreferenceWireView | null | undefined
        if (current !== generation) return
        acceptFallback(value)
        // The Host may normalize or reject a requested value; its response wins.
        pendingPatch = undefined
      }
    } catch {
      if (current === generation) {
        pendingPatch = undefined
        error = true
        failedPatch = patch
      }
    } finally {
      if (current === generation) {
        updating = false
        publish()
      }
    }
  }
  const setSpeed = async (sessionId: string, speedMode: unknown) => {
    if (disposed || snapshot.status !== 'ready' || snapshot.writable !== true) return
    updating = true
    error = false
    pendingSpeeds.set(sessionId, speedMode)
    publish()
    try {
      const value = unwrap(await rpc.call(CHANNEL, 'preferences/update', { sessionId, speedMode })) as PreferenceWireView | null | undefined
      if (nativeSnapshot().status !== 'ready') {
        acceptFallback(value)
        pendingSpeeds.delete(sessionId)
      }
    } catch {
      pendingSpeeds.delete(sessionId)
      error = true
    } finally {
      updating = false
      publish()
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    load,
    set,
    setSpeed,
    retry: () => failedPatch === undefined ? load() : set(failedPatch),
    refreshModels,
    dispose: () => {
      disposed = true
      generation += 1
      modelRefreshGeneration += 1
      disposeScope()
    },
  }
}
