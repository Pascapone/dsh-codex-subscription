import type { OperationHistory, DiagnosticEvent } from './diagnostic-types.js';
// Observes only owned operation names and outcomes, never parameters or output.
const actions: Readonly<Record<string, string>> = Object.freeze({
  'login/start': 'account', 'login/submit': 'account', 'login/cancel': 'account', logout: 'account',
  'account/select': 'accounts', 'account/remove': 'accounts', 'preferences/update': 'settings',
  'account/cleanup': 'accounts',
  usage: 'quota', 'preferences/models': 'models', 'storage/status': 'storage', 'storage/clear-forecast': 'storage',
  'runtime/install': 'subagents', 'runtime/remove': 'subagents', 'runtime/cancel': 'subagents',
  codex_image_generate: 'images', codex_sketch: 'sketch',
})
export function safeOperations(raw: OperationHistory | undefined) {
  if (!Array.isArray(raw?.events)) return undefined
  return { scope: 'plugin-process', capacity: 32,
    dropped: (typeof raw.dropped === 'number' && Number.isSafeInteger(raw.dropped) && raw.dropped >= 0 ? raw.dropped : 0) + Math.max(0, raw.events.length - 32),
    events: raw.events.slice(-32).flatMap(value => {
      if (!Object.hasOwn(actions, value?.action ?? '') || !['completed', 'failed', 'cancelled'].includes(value.status)
        || !['rpc', 'tool'].includes(value.source) || !Number.isSafeInteger(value.observedAt) || value.observedAt < 0) return []
      return [{ capability: actions[value.action], action: value.action, status: value.status, source: value.source, observedAt: value.observedAt }]
    }),
  }
}
export function createDiagnosticOperations({ now = Date.now } = {}) {
  const events: DiagnosticEvent[] = []
  let sequence = 0, dropped = 0
  const record = (action: string, status: string, source = 'rpc') => {
    if (!Object.hasOwn(actions, action) || !['completed', 'failed', 'cancelled'].includes(status) || !['rpc', 'tool'].includes(source)) return
    events.push({ sequence: ++sequence, capability: actions[action], action, source, status, observedAt: now() })
    if (events.length > 32) { events.shift(); dropped++ }
  }
  return {
    record,
    wrap: <T extends { ok: boolean }>(handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<T>) => async (endpoint: string, payload: unknown, signal: AbortSignal) => {
      try {
        const result = await handler(endpoint, payload, signal)
        record(endpoint, result?.ok === true ? 'completed' : 'failed')
        return result
      } catch (error) { record(endpoint, signal?.aborted ? 'cancelled' : 'failed'); throw error }
    },
    tool: (exec: { name: string; signal?: AbortSignal }, result: { isError?: boolean }) => {
      if (!['codex_image_generate', 'codex_sketch'].includes(exec?.name)) return
      record(exec.name, exec.signal?.aborted ? 'cancelled' : result?.isError === true ? 'failed' : result?.isError === false ? 'completed' : 'failed', 'tool')
    },
    snapshot: () => ({ scope: 'plugin-process', capacity: 32, dropped, events: events.map(value => ({ ...value })) }),
  }
}
