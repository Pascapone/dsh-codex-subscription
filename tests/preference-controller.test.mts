
type FixtureRpcCall = (channel: string, method: string, payload?: unknown) => Promise<unknown>;
import assert from 'node:assert/strict'
import test from 'node:test'
import { createPreferenceController } from '../src/preference-controller.js'
import { AUTO_QUOTA_RETRY_FIELD, CONTEXT_MODE_EXTENDED, CONTEXT_MODE_FIELD, CONTEXT_MODE_STANDARD, DISABLED_MODELS_FIELD } from '../src/settings-contract.js'

function harness({ fail = false, rpcCall }: {fail?: boolean; rpcCall?: FixtureRpcCall} = {}) {
  let native = {
    status: 'ready',
    writable: true,
    value: {
      contextMode: CONTEXT_MODE_STANDARD,
      searchProvider: 'auto',
      quickQuotaMode: 'off',
      speedMode: 'standard',
      outputVerbosity: 'default',
    },
  }
  const listeners = new Set<() => void>()
  let settle: (() => void) | undefined
  const scope = {
    getSnapshot: () => native,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(field: string, value: unknown) {
      return new Promise<void>((resolve, reject) => {
        settle = () => {
          if (fail) {
            reject(new Error('write failed'))
            return
          }
          native = { ...native, value: { ...native.value, [field]: value } }
          for (const listener of listeners) listener()
          resolve()
        }
      })
    },
  }
  const rpc = { call: rpcCall ?? (async () => ({ ok: true, value: native.value })) }
  return { controller: createPreferenceController(((scope) as unknown as Parameters<typeof createPreferenceController>[0]), ((rpc) as unknown as Parameters<typeof createPreferenceController>[1])), settle: () => settle?.() }
}

const fallbackModels = [{ key: 'gpt-5.5', label: 'GPT-5.5', maximum: 1_000_000 }]

test('per-model inputs start at current defaults and preserve saved overrides', async () => {
  const models = [...fallbackModels, { key: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', maximum: 872_000, default: 500_000 }]
  const { controller, settle } = harness({ rpcCall: async () => ({ ok: true, value: { contextModels: models } }) })
  await controller.load()
  assert.equal(controller.getSnapshot().customContextWindows['gpt-5.5'], 272_000)
  assert.equal(controller.getSnapshot().customContextWindows['gpt-6.1-sol'], 500_000)
  const write = controller.set({ customContextModels: { 'gpt-6.1-sol': 350_000, 'gpt-5.5': 400_000 } })
  settle()
  await write
  await controller.refreshModels()
  assert.equal(controller.getSnapshot().customContextWindows['gpt-6.1-sol'], 350_000)
  assert.equal(controller.getSnapshot().customContextWindows['gpt-5.5'], 400_000)
  controller.dispose()
})

test('missing Codex runtime leaves ordinary preferences and the DSH backend usable', async () => {
  let installed = false
  const { controller } = harness({ rpcCall: async () => ({ ok: true, value: {
    subagentBackendAvailable: true, subagentRuntimeInstalled: installed,
  } }) })
  await controller.load()
  assert.equal(controller.getSnapshot().subagentRuntimeInstalled, false)
  assert.equal(controller.getSnapshot().subagentBackend, 'dsh')
  assert.equal(controller.getSnapshot().writable, true)
  installed = true
  await controller.load()
  assert.equal(controller.getSnapshot().subagentRuntimeInstalled, true)
  controller.dispose()
})
const astraModels = [...fallbackModels, { key: 'gpt-6-astra', label: 'GPT-6 Astra', maximum: 872_000 }]
const fallbackValue = {
  contextMode: CONTEXT_MODE_STANDARD,
  searchProvider: 'auto',
  quickQuotaMode: 'off',
  speedMode: 'standard',
  outputVerbosity: 'default',
  contextModels: fallbackModels,
  verbosityModels: ['gpt-5.5'],
  writable: true,
}

function deferredModelHarness() {
  const pendingModels: {resolve(value: unknown): void; reject(reason: unknown): void}[] = []
  const listeners = new Set<() => void>()
  const scope = {
    getSnapshot: () => ({ status: 'loading', writable: false, value: undefined }),
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set: async () => {},
  }
  const rpc = {
    call: async (_channel: string, method: string) => {
      if (method === 'preferences/status') return { ok: true, value: fallbackValue }
      if (method === 'preferences/models') {
        return new Promise<unknown>((resolve, reject) => pendingModels.push({ resolve, reject }))
      }
      return { ok: true, value: fallbackValue }
    },
  }
  return { controller: createPreferenceController(((scope) as unknown as Parameters<typeof createPreferenceController>[0]), ((rpc) as unknown as Parameters<typeof createPreferenceController>[1])), pendingModels, listeners }
}

test('session speed does not leak into another session and rolls back failed saves', async () => {
  let rejectWrite!: (reason: unknown) => void
  const { controller } = harness({ rpcCall: (_channel, method, payload) => {
    if (method !== 'preferences/update') return Promise.resolve({ ok: true, value: {} })
    assert.deepEqual(payload, { sessionId: 'session-a', speedMode: 'fast' })
    return new Promise((_resolve, reject) => { rejectWrite = reject })
  } })
  const pending = controller.setSpeed('session-a', 'fast')
  assert.equal(controller.getSnapshot().sessionSpeedModes['session-a'], 'fast')
  assert.equal(controller.getSnapshot().writable, false)
  assert.equal(controller.getSnapshot().saving, true)
  assert.equal(controller.getSnapshot().sessionSpeedModes['session-b'], undefined)
  rejectWrite(new Error('failed'))
  await pending
  assert.equal(controller.getSnapshot().sessionSpeedModes['session-a'], undefined)
  assert.equal(controller.getSnapshot().error, true)
  controller.dispose()
})


test('the full model list stays visible while a disabled choice is saved', async () => {
  const availableModels = [{ id: 'gpt-5.5', name: 'GPT-5.5' }, { id: 'gpt-6-astra', name: 'GPT-6 Astra' }]
  const { controller, settle } = harness({ rpcCall: async () => ({ ok: true, value: { availableModels } }) })
  await controller.load()
  assert.deepEqual(controller.getSnapshot().availableModels, availableModels)
  const saving = controller.set({ [DISABLED_MODELS_FIELD]: ['gpt-5.5'] })
  assert.deepEqual(controller.getSnapshot().disabledModels, ['gpt-5.5'])
  assert.deepEqual(controller.getSnapshot().availableModels, availableModels)
  settle()
  await saving
  assert.deepEqual(controller.getSnapshot().disabledModels, ['gpt-5.5'])
})

test('preference save reflects the chosen value while keeping ready surfaces mounted', async () => {
  const { controller, settle } = harness()
  const pending = controller.set({ [CONTEXT_MODE_FIELD]: CONTEXT_MODE_EXTENDED })

  assert.equal(controller.getSnapshot().status, 'ready')
  assert.equal(controller.getSnapshot().contextMode, CONTEXT_MODE_EXTENDED)
  assert.equal(controller.getSnapshot().writable, false)
  assert.equal(controller.getSnapshot().saving, true)

  settle()
  await pending
  assert.equal(controller.getSnapshot().contextMode, CONTEXT_MODE_EXTENDED)
  assert.equal(controller.getSnapshot().writable, true)
  assert.equal(controller.getSnapshot().saving, false)
})

test('failed preference save rolls back the optimistic value and keeps retry state', async () => {
  const { controller, settle } = harness({ fail: true })
  const pending = controller.set({ [CONTEXT_MODE_FIELD]: CONTEXT_MODE_EXTENDED })

  assert.equal(controller.getSnapshot().contextMode, CONTEXT_MODE_EXTENDED)
  settle()
  await pending
  assert.equal(controller.getSnapshot().contextMode, CONTEXT_MODE_STANDARD)
  assert.equal(controller.getSnapshot().status, 'ready')
  assert.equal(controller.getSnapshot().error, true)
})

test('fallback preference save adopts the Host accepted value instead of the optimistic patch', async () => {
  let state = {
    status: 'loading',
    writable: false,
    value: undefined,
  }
  const accepted = {
    contextMode: CONTEXT_MODE_STANDARD,
    searchProvider: 'auto',
    quickQuotaMode: 'off',
    speedMode: 'standard',
    outputVerbosity: 'default',
    writable: true,
  }
  const rpc = {
    call: async (_channel: string, method: string) => method === 'preferences/status'
      ? { ok: true, value: accepted }
      : { ok: true, value: accepted },
  }
  const scope = {
    getSnapshot: () => state,
    subscribe: () => () => {},
    set: async () => {},
  }
  const controller = createPreferenceController(((scope) as unknown as Parameters<typeof createPreferenceController>[0]), ((rpc) as unknown as Parameters<typeof createPreferenceController>[1]))
  await controller.load()
  assert.equal(controller.getSnapshot().contextMode, CONTEXT_MODE_STANDARD)

  await controller.set({ [CONTEXT_MODE_FIELD]: CONTEXT_MODE_EXTENDED })

  assert.equal(controller.getSnapshot().contextMode, CONTEXT_MODE_STANDARD)
  assert.equal(controller.getSnapshot().writable, true)
})

test('deferred model refresh replaces the fallback directory with Astra', async () => {
  const { controller, pendingModels } = deferredModelHarness()
  await controller.load()
  assert.deepEqual(controller.getSnapshot().contextModels, fallbackModels)

  const refreshing = controller.refreshModels()
  pendingModels[0].resolve({ ok: true, value: { contextModels: astraModels, verbosityModels: ['gpt-5.5', 'gpt-6-astra'] } })
  assert.equal(await refreshing, true)
  assert.deepEqual(controller.getSnapshot().contextModels, astraModels)
  assert.deepEqual(controller.getSnapshot().verbosityModels, ['gpt-5.5', 'gpt-6-astra'])
  assert.equal(controller.getSnapshot().modelError, false)
})

test('model refresh reports failure and a later retry can recover the directory', async () => {
  const { controller, pendingModels } = deferredModelHarness()
  await controller.load()

  const failed = controller.refreshModels()
  pendingModels[0].reject(new Error('catalog unavailable'))
  assert.equal(await failed, false)
  assert.equal(controller.getSnapshot().modelError, true)

  const retried = controller.refreshModels()
  pendingModels[1].resolve({ ok: true, value: { contextModels: astraModels, verbosityModels: ['gpt-6-astra'] } })
  assert.equal(await retried, true)
  assert.equal(controller.getSnapshot().modelError, false)
  assert.deepEqual(controller.getSnapshot().contextModels, astraModels)
})

test('a no-op model refresh keeps the model arrays and reports loading transitions', async () => {
  const { controller, pendingModels } = deferredModelHarness()
  await controller.load()
  let notifications = 0
  const unsubscribe = controller.subscribe(() => { notifications += 1 })

  const refreshing = controller.refreshModels()
  assert.equal(controller.getSnapshot().modelsLoading, true)
  pendingModels[0].resolve({ ok: true, value: { contextModels: [...fallbackModels], verbosityModels: ['gpt-5.5'] } })
  assert.equal(await refreshing, false)
  assert.equal(notifications, 2)
  assert.equal(controller.getSnapshot().modelsLoading, false)
  unsubscribe()
})

test('model metadata refresh does not interrupt a pending preference save', async () => {
  let resolveModels!: (value: unknown) => void
  const { controller, settle } = harness({
    rpcCall: async (_channel: string, method: string) => method === 'preferences/models'
      ? new Promise<unknown>(resolve => { resolveModels = resolve })
      : { ok: true, value: {} },
  })
  const saving = controller.set({ [CONTEXT_MODE_FIELD]: CONTEXT_MODE_EXTENDED })
  const refreshing = controller.refreshModels()
  resolveModels({ ok: true, value: { contextModels: astraModels, verbosityModels: ['gpt-6-astra'] } })
  await refreshing
  assert.equal(controller.getSnapshot().contextMode, CONTEXT_MODE_EXTENDED)
  assert.equal(controller.getSnapshot().saving, true)
  settle()
  await saving
  assert.equal(controller.getSnapshot().contextMode, CONTEXT_MODE_EXTENDED)
  assert.deepEqual(controller.getSnapshot().contextModels, astraModels)
})

test('a stale account model response cannot replace the newer directory', async () => {
  const { controller, pendingModels } = deferredModelHarness()
  await controller.load()

  const oldRefresh = controller.refreshModels()
  const newRefresh = controller.refreshModels()
  pendingModels[1].resolve({ ok: true, value: { contextModels: astraModels, verbosityModels: ['gpt-6-astra'] } })
  assert.equal(await newRefresh, true)
  pendingModels[0].resolve({ ok: true, value: { contextModels: fallbackModels, verbosityModels: ['gpt-5.5'] } })
  assert.equal(await oldRefresh, false)
  assert.deepEqual(controller.getSnapshot().contextModels, astraModels)
  assert.deepEqual(controller.getSnapshot().verbosityModels, ['gpt-6-astra'])
})

test('a write the host publishes a moment late is accepted, not reverted', async () => {
  let native: ReturnType<Parameters<typeof createPreferenceController>[0]['getSnapshot']> = { status: 'ready', writable: true, value: { quickQuotaMode: 'forecast' } }
  const listeners = new Set<() => void>()
  const scope = {
    getSnapshot: () => native,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) },
    async set(field: string, value: unknown) {
      setTimeout(() => { native = { ...native, value: { ...native.value, [field]: value } }; for (const listener of listeners) listener() }, 60)
    },
  }
  const controller = createPreferenceController(scope, { call: async () => ({ ok: true, value: {} }) } as unknown as NonNullable<Parameters<typeof createPreferenceController>[1]>)
  await controller.set({ quickQuotaMode: 'percent' })
  assert.equal(controller.getSnapshot().quickQuotaMode, 'percent')
  assert.equal(controller.getSnapshot().error, false)
  controller.dispose()
})

test('a write the host never applies still reports failure and restores the shown value', async () => {
  const native: ReturnType<Parameters<typeof createPreferenceController>[0]['getSnapshot']> = { status: 'ready', writable: true, value: { quickQuotaMode: 'forecast' } }
  const scope = { getSnapshot: () => native, subscribe: () => () => {}, async set() {} }
  const controller = createPreferenceController(scope, { call: async () => ({ ok: true, value: {} }) } as unknown as NonNullable<Parameters<typeof createPreferenceController>[1]>)
  const started = Date.now()
  await controller.set({ quickQuotaMode: 'percent' })
  assert.equal(controller.getSnapshot().error, true)
  assert.equal(controller.getSnapshot().quickQuotaMode, 'forecast')
  assert.ok(Date.now() - started < 3000)
  controller.dispose()
})

test('automatic quota retry defaults off and persists an explicit enable', async () => {
  const { controller, settle } = harness()
  assert.equal(controller.getSnapshot().autoQuotaRetry, false)

  const pending = controller.set({ [AUTO_QUOTA_RETRY_FIELD]: true })
  assert.equal(controller.getSnapshot().autoQuotaRetry, true)
  settle()
  await pending
  assert.equal(controller.getSnapshot().autoQuotaRetry, true)
})
