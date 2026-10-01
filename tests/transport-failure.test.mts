import type { TestContext } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { StreamChunk } from '@deepseek-ai/dsh-llm';
import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { once } from 'node:events'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import { transportError, transportResponseBody } from '../src/oauth-network.js'
import { normalizeTransportEvent } from '../src/transport-failure.js'
import { openaiCodexSubscriptionProvider } from '../src/pi-ai-runtime.js'

async function endpoint(t: TestContext, handler: http.RequestListener) {
  const server = http.createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

function response(url: string, signal?: AbortSignal | null) {
  return new Promise<Response>((resolve, reject) => {
    http.get(url, { signal: signal as AbortSignal | undefined }, incoming => resolve(new Response(transportResponseBody(incoming, signal as AbortSignal | undefined) as unknown as ConstructorParameters<typeof Response>[0])))
      .on('error', reject)
  })
}

test('real mid-body socket reset retains its code and cause through the web response', async t => {
  const url = await endpoint(t, (_request, reply) => {
    reply.write('partial')
    setTimeout(() => reply.socket?.destroy(), 30)
  })
  await assert.rejects((await response(url)).text(), error => {
    assert.equal((error as NodeJS.ErrnoException).code, 'ECONNRESET')
    assert.equal(((error as {cause: NodeJS.ErrnoException}).cause).code, 'ECONNRESET')
    assert.match((error as Error).message, /Network transport failure.*ECONNRESET/)
    return true
  })
})

test('normal streaming preserves every byte', async t => {
  const url = await endpoint(t, (_request, reply) => { reply.write('first'); reply.end('last') })
  assert.equal(await (await response(url)).text(), 'firstlast')
})

test('cancelling a reader releases an idle HTTP response', { timeout: 3000 }, async t => {
  let closed!: () => void
  const disconnected = new Promise<void>(resolve => { closed = resolve })
  const url = await endpoint(t, (_request, reply) => {
    reply.on('close', closed)
    reply.write('waiting')
  })
  const reader = (await response(url)).body!.getReader()
  await reader.read()
  await reader.cancel()
  await disconnected
})

test('user cancellation is not relabelled as a retryable network failure', { timeout: 3000 }, async t => {
  const controller = new AbortController()
  const url = await endpoint(t, (_request, reply) => reply.write('waiting'))
  const reader = (await response(url, controller.signal)).body!.getReader()
  await reader.read()
  controller.abort()
  await assert.rejects(reader.read(), error => !(error as Error).message.includes('Network transport failure'))
  for (const error of [new Error('aborted'), Object.assign(new Error('cancel'), { name: 'AbortError' }), new Error('401 unauthorized')]) {
    assert.equal(transportError(error), error)
  }
})

test('only transient WebSocket failures receive transport context', () => {
  for (const code of [1006, 1011, 1012, 1013]) {
    const event = { type: 'error', reason: 'error', error: { errorMessage: `WebSocket closed ${code} fixture` } }
    assert.match((normalizeTransportEvent((event as unknown as Parameters<typeof normalizeTransportEvent>[0])) as Extract<ReturnType<typeof normalizeTransportEvent>,{type: 'error'}>).error.errorMessage!, /^Network transport failure:/)
    assert.equal(normalizeTransportEvent((event as unknown as Parameters<typeof normalizeTransportEvent>[0]), AbortSignal.abort()), event)
  }
  for (const message of ['WebSocket closed 1008 policy', 'WebSocket closed 1009 size', 'aborted', '401 unauthorized']) {
    const event = { type: 'error', reason: 'error', error: { errorMessage: message } }
    assert.equal(normalizeTransportEvent((event as unknown as Parameters<typeof normalizeTransportEvent>[0])), event)
  }
})

test('actual DSH adapter classifies a real mid-stream reset as TRANSPORT without plugin replay', { timeout: 5000 }, async t => {
  let requests = 0
  const url = await endpoint(t, (_request, reply) => {
    requests++
    reply.write('data: {"type":"response.created","response":{"id":"cut"}}\n\n')
    setTimeout(() => reply.socket?.destroy(), 30)
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = (_url, init) => response(url, init!.signal)
  t.after(() => { globalThis.fetch = originalFetch })
  const provider = openaiCodexSubscriptionProvider()
  const profiles = new Map([['openai-codex', {
    provider: 'openai-codex', piProvider: provider, configuredMaxTokens: new Map(), modelErrors: new Map(),
    transport: 'sse', streamIdleTimeoutMs: 3000,
  }]])
  const token = `e30.${Buffer.from(JSON.stringify({ 'https://api.openai.com/auth': { chatgpt_account_id: 'fixture' } })).toString('base64url')}.fake`
  const adapter = new PiAiAdapter({ profiles: () => profiles, resolveApiKey: async () => token } as unknown as ConstructorParameters<typeof PiAiAdapter>[0])
  const chunks: StreamChunk[] = []
  for await (const chunk of adapter.stream({ provider: 'openai-codex', model: 'gpt-5.6-luna', messages: [{ role: 'user', content: [{ type: 'text', text: 'fixture' }] }] })) chunks.push(chunk)
  assert.ok(chunks.some(chunk => (chunk as {reason?: Partial<Extract<import('@deepseek-ai/dsh-llm').FinishReason,{kind: 'error'}>>}).reason?.failure?.code === 'TRANSPORT'), JSON.stringify(chunks))
  assert.equal(requests, 1)
})
