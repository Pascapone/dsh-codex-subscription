import type { GenerateOptions, RequestMessage, StreamChunk, LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { StreamOptions } from '@earendil-works/pi-ai';
import type { NetworkOptions } from './network-types.js';
import type { CompactionOptions, CompactionState, RawCheckpoint, CompactionAdapter, CodexPayload } from './compaction-types.js';
/** Experimental SSE bridge; callers must explicitly opt in. */
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'
import { headroomRouteUrl } from './oauth-network.js'
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const key = 'codexCompactionV1'
const historyHash = (messages: readonly RequestMessage[]) => hash(messages.map(({ source, ...message }) => ({ ...message, source: source && { kind: source.kind, provider: (source as { provider?: string }).provider, model: (source as { model?: string }).model } })))
const MAX_BYTES = 2 * 1024 * 1024
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function createCompactionBridge({ enabled = () => false, threshold = () => 100000, accountScope, diagnostic = () => {}, now = Date.now }: CompactionOptions) {
 const scope = new AsyncLocalStorage<CompactionState>()
 const wrapStream = (factory: (options: GenerateOptions) => AsyncIterable<StreamChunk>, options: GenerateOptions) => (async function* () {
  if (!enabled() || options.provider !== 'openai-codex') { yield* factory(options); return }
  const identity = await accountScope(options)
  if (!identity) throw new Error('Compaction requires a stable account identity')
  const state: CompactionState = { identity: hash([identity, options.model]), original: options.messages, blocks: [], suffix: undefined, completed: false }
  let messages = options.messages
  for (let i = messages.length - 1; i >= 0; i--) {
   const candidate = (messages[i].source as { replayState?: { response?: Record<string, unknown> | null } | null } | undefined)?.replayState?.response?.[key] as RawCheckpoint | null | undefined
   if (!candidate) continue
   if (Number.isFinite(candidate.createdAt) && (candidate.createdAt as number) <= now() && now() - (candidate.createdAt as number) <= MAX_AGE_MS
    && candidate.scope === state.identity && candidate.prefix === historyHash(messages.slice(0, i)) && candidate.content === hash(messages[i].content)
    && Array.isArray(candidate.items) && (candidate.items[0] as { type?: unknown } | null | undefined)?.type === 'compaction' && typeof (candidate.items[0] as { encrypted_content?: unknown }).encrypted_content === 'string'
    && candidate.digest === hash(candidate.items) && JSON.stringify(candidate.items).length <= MAX_BYTES) {
    state.suffix = clone(candidate.items as unknown[])
    messages = [...messages.slice(0, i + 1).filter(m => m.role === 'system'), ...messages.slice(i + 1)]
   }
   break
  }
  const iterator = scope.run(state, () => factory({ ...options, messages })[Symbol.asyncIterator]())
  try {
   while (true) {
    const result = await scope.run(state, () => iterator.next())
    if (result.done) break
    let event = result.value
    if (event.type === 'block-end') state.blocks[event.index] = clone(event.block)
    if (event.type === 'finish') diagnostic({ completed: state.completed, captured: state.captured?.length ?? 0, replay: !!event.replayState })
    if (event.type === 'finish' && ['stop', 'tool-calls'].includes(event.reason?.kind) && !options.signal?.aborted && state.completed && state.captured?.length && event.replayState) {
     const items = state.captured
     const checkpoint = { createdAt: now(), scope: state.identity, prefix: historyHash(state.original), content: hash(state.blocks.filter(Boolean)), items, digest: hash(items) }
     event = { ...event, replayState: { ...event.replayState, response: { ...(event.replayState.response as Record<string, unknown> | null | undefined), [key]: checkpoint } } }
    }
    yield event
   }
  } finally { await scope.run(state, () => iterator.return?.()) }
 })()
 return {
  wrapAdapter<T extends CompactionAdapter>(adapter: T): T {
   return new Proxy(adapter, { get(target, property) {
    if (property === 'stream') return (options: GenerateOptions) => wrapStream(o => target.stream(o), options)
    if (property === 'prepareCall') return async (...args: Parameters<LlmAdapter['prepareCall']>) => { const call = await target.prepareCall(...args); return { ...call, stream: (options: GenerateOptions) => wrapStream(o => call.stream(o), options) } }
    const value = Reflect.get(target, property, target)
    return typeof value === 'function' ? value.bind(target) : value
   } })
  },
  preparePayload(payload: CodexPayload, contextWindow?: number): CodexPayload {
   const state = scope.getStore()
   if (!state) return payload
   const configured = threshold()
   if (!Number.isSafeInteger(configured) || configured < 1000) throw new Error('Invalid compaction threshold')
   const limit = Number.isFinite(contextWindow) && contextWindow! >= 2000
    ? Math.min(configured, Math.floor(contextWindow! / 2)) : configured
   if (!Number.isSafeInteger(limit) || limit < 1000) throw new Error('Invalid compaction threshold')
   return { ...payload, input: [...(state.suffix ?? []), ...payload.input], context_management: [{ type: 'compaction', compact_threshold: limit }] }
  },
  requestOptions(options: StreamOptions): StreamOptions { return scope.getStore() ? { ...options, transport: 'sse' } : options },
  networkOptions(options: NetworkOptions | undefined): NetworkOptions | undefined {
   const state = scope.getStore()
   if (!state) return options
   return { ...options, websocket: false, transformResponse: (response: Response, target: URL) => {
    const local = headroomRouteUrl(options?.headroomBaseUrl) && target.href === `${options!.headroomBaseUrl}/codex/responses`
    if ((!local && (target.hostname !== 'chatgpt.com' || target.pathname !== '/backend-api/codex/responses')) || !response.ok || !response.body) return response
    state.completed = false; state.captured = undefined
    let buffer = '', oversized = false
    const decoder = new TextDecoder()
    const observe = (line: string) => {
     if (!line.startsWith('data:')) return
     const data = line.slice(5).trim(); if (data === '[DONE]') return
     let value: unknown; try { value = JSON.parse(data) as unknown } catch { return }
            const event = value as { type?: unknown; item?: { type?: unknown } | null; response?: { status?: unknown } | null };
     if (event.type === 'response.output_item.done') {
      if (event.item?.type === 'compaction') state.captured = [clone(event.item)]
      else if (state.captured) state.captured.push(clone(event.item))
      if (state.captured && JSON.stringify(state.captured).length > MAX_BYTES) { state.captured = undefined; oversized = true }
     }
     if (event.type === 'response.completed' && event.response?.status === 'completed') state.completed = !oversized
    }
    const stream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
     transform(bytes, controller) {
      controller.enqueue(bytes)
      if (oversized) return
      buffer += decoder.decode(bytes, { stream: true })
      let index; while ((index = buffer.indexOf('\n')) >= 0) { observe(buffer.slice(0, index).trimEnd()); buffer = buffer.slice(index + 1) }
      if (buffer.length > MAX_BYTES) { buffer = ''; oversized = true; state.captured = undefined }
     },
     flush() { buffer += decoder.decode(); if (!oversized && buffer) observe(buffer.trimEnd()) },
    }))
    return new Response(stream, { status: response.status, statusText: response.statusText, headers: response.headers })
   } }
  },
 }
}
