import type { AddressInfo } from 'node:net';
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { WebSocketServer } from 'ws'
import { createSubscriptionConnection } from '../src/subscription-connection.js'
import { openaiCodexSubscriptionProvider } from '../src/pi-ai-runtime.js'
import { createCodexNetworkTransport, withCodexNetwork } from '../src/oauth-network.js'

test('SSE leaves the WebSocket constructor untouched; unrelated WebSocket subclasses retain their prototype', async () => {
  const original = globalThis.WebSocket
  class FixtureSocket { declare url: unknown; constructor(url: unknown) { this.url = url } }
  globalThis.WebSocket = FixtureSocket as unknown as typeof WebSocket
  try {
    await withCodexNetwork(async () => assert.equal(globalThis.WebSocket, FixtureSocket))
    await withCodexNetwork(async () => {
      class UnrelatedSocket extends globalThis.WebSocket {}
      const socket = new UnrelatedSocket('wss://example.test/')
      assert.ok(socket instanceof UnrelatedSocket)
      assert.ok(socket instanceof FixtureSocket)
    }, { websocket: true })
    assert.equal(globalThis.WebSocket, FixtureSocket)
  } finally { globalThis.WebSocket = original }
})

test('experimental connections keep default SSE and isolate session caches across credentials, proxies and plugin instances', async () => {
  let mode: 'sse' | 'websocket' = 'sse', proxy: string | undefined
  const policy = createSubscriptionConnection({ resolveMode: () => mode, resolveProxy: async () => proxy })
  const input: Parameters<ReturnType<typeof createSubscriptionConnection>['prepare']>[0] = { apiKey: 'token-one', sessionId: 'conversation', transport: 'auto' }
  try {
    assert.equal((await policy.prepare(input)).options.transport, 'sse')
    mode = 'websocket'
    const first = await policy.prepare(input)
    assert.equal(first.options.transport, 'websocket-cached')
    assert.equal(first.options.sessionId, (await policy.prepare(input)).options.sessionId)
    assert.ok(!first.options.sessionId!.includes(input.apiKey!))
    assert.notEqual(first.options.sessionId, (await policy.prepare({ ...input, apiKey: 'token-two' })).options.sessionId)
    proxy = 'http://localhost:1001'
    assert.notEqual(first.options.sessionId, (await policy.prepare(input)).options.sessionId)
    const second = createSubscriptionConnection({ resolveMode: () => mode, resolveProxy: async () => undefined })
    assert.notEqual(first.options.sessionId, (await second.prepare(input)).options.sessionId)
    second.dispose()
    const local = 'http://127.0.0.1:18781/backend-api'
    const routed = await policy.prepare(input, local)
    assert.equal(routed.network!.websocketProxy, undefined, 'local bearer must not traverse an external proxy')
    assert.equal(routed.options.sessionId, (await policy.prepare(input, local)).options.sessionId)
    assert.notEqual(routed.options.sessionId, (await policy.prepare(input, 'http://127.0.0.1:18782/backend-api')).options.sessionId)
    assert.notEqual(routed.options.sessionId, first.options.sessionId)
    mode = 'sse'
    assert.equal((await policy.prepare(input)).options.sessionId, 'conversation')
  } finally { policy.dispose() }
})

test('a trusted request-local route preserves Codex OAuth and leaves the shared model and direct requests unchanged', async () => {
  const originalFetch = globalThis.fetch, requests: {url: string; headers: Headers}[] = []
  const apiKey = `e30.${Buffer.from(JSON.stringify({ 'https://api.openai.com/auth': { chatgpt_account_id: 'account-1' } })).toString('base64url')}.fake`
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), headers: new Headers(init!.headers) })
    return new Response('data: {"type":"response.created","response":{"id":"fixture"}}\n\ndata: {"type":"response.done","response":{"id":"fixture","status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":0,"total_tokens":1}}}\n\n', { headers: { 'content-type': 'text/event-stream' } })
  }
  let route: {ready: boolean; baseUrl: string} | 'throw' = { ready: true, baseUrl: 'http://127.0.0.1:18781/backend-api' }
  const selections: unknown[] = []
  const provider = openaiCodexSubscriptionProvider({
    connection: createSubscriptionConnection(),
    resolveRoute: request => { selections.push(request); if (route === 'throw') throw Error('companion restarting'); return route },
  })
  const model = provider.getModels().find(value => value.id === 'gpt-5.6-luna')!
  const originalBaseUrl = model.baseUrl
  const context: Parameters<typeof provider.stream>[1] = { messages: [{ role: 'user', content: 'test', timestamp: Date.now() }] }
  const send = async (method: 'stream' | 'streamSimple') => { for await (const _event of provider[method](model, context, { apiKey, sessionId: 'same' })) {} }
  try {
    await send('stream'); await send('streamSimple')
    route = { ready: true, baseUrl: 'https://attacker.test/backend-api' }; await send('streamSimple')
    route = 'throw'; await send('streamSimple')
    assert.deepEqual(requests.map(request => request.url), [
      'http://127.0.0.1:18781/backend-api/codex/responses',
      'http://127.0.0.1:18781/backend-api/codex/responses',
      'https://chatgpt.com/backend-api/codex/responses',
      'https://chatgpt.com/backend-api/codex/responses',
    ])
    assert.deepEqual(selections[0], { provider: 'openai-codex', model: model.id, sessionId: 'same' })
    assert.equal(model.baseUrl, originalBaseUrl)
    for (const request of requests) {
      assert.equal(request.headers.get('authorization'), `Bearer ${apiKey}`)
      assert.equal(request.headers.get('chatgpt-account-id'), 'account-1')
    }
  } finally { globalThis.fetch = originalFetch }
})

test('the local Headroom WebSocket handshake forwards the Codex bearer and account headers', async () => {
  const server = http.createServer(), sockets = new WebSocketServer({ server })
  let handshake!: http.IncomingMessage
  sockets.on('connection', (socket, request) => { handshake = request; socket.close() })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/backend-api`
  try {
    await withCodexNetwork(() => new Promise<Event>((resolve, reject) => {
      const socket = new globalThis.WebSocket(`ws://127.0.0.1:${(server.address() as AddressInfo).port}/backend-api/codex/responses`, ({
        headers: { Authorization: 'Bearer fixture-token', 'ChatGPT-Account-ID': 'fixture-account' },
      } as unknown as ConstructorParameters<typeof WebSocket>[1]))
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', reject, { once: true })
    }), { websocket: true, headroomBaseUrl: baseUrl })
    assert.equal(handshake.url, '/backend-api/codex/responses')
    assert.equal(handshake.headers.authorization, 'Bearer fixture-token')
    assert.equal(handshake.headers['chatgpt-account-id'], 'fixture-account')
  } finally {
    await new Promise(resolve => sockets.close(resolve))
    await new Promise(resolve => server.close(resolve))
  }
})

test('a rejected WebSocket proxy CONNECT falls back through the existing SSE route, without changing global proxy settings', async () => {
  let connects = 0, fetches = 0
  const server = http.createServer()
  server.on('connect', (_request, socket) => { connects++; socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n') })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const proxy = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const originalWebSocket = globalThis.WebSocket, originalEnv = process.env.HTTPS_PROXY
  const connection = createSubscriptionConnection({ resolveMode: () => 'websocket', resolveProxy: async () => proxy })
  const network = createCodexNetworkTransport({ env: { HTTPS_PROXY: proxy }, fetchThroughProxy: async (_input, _init, route) => {
    assert.equal(route, `${proxy}/`)
    fetches++
    return new Response('data: {"type":"response.created","response":{"id":"fallback"}}\n\ndata: {"type":"response.done","response":{"id":"fallback","status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":0,"total_tokens":1}}}\n\n', { headers: { 'content-type': 'text/event-stream' } })
  } })
  const provider = openaiCodexSubscriptionProvider({ connection, runNetwork: network.run })
  const apiKey = `e30.${Buffer.from(JSON.stringify({ 'https://api.openai.com/auth': { chatgpt_account_id: 'fixture' } })).toString('base64url')}.fake`
  try {
    const model = provider.getModels().find(model => model.id === 'gpt-5.6-luna')!
    const stream = provider.streamSimple(model, { messages: [{ role: 'user', content: 'test', timestamp: Date.now() }] }, { apiKey, sessionId: 'proxy-failure', signal: AbortSignal.timeout(5000) })
    const events = []
    for await (const event of stream) events.push(event.type)
    assert.ok(events.includes('done'), events.join(','))
    assert.equal(connects, 1)
    assert.equal(fetches, 1)
    assert.equal(globalThis.WebSocket, originalWebSocket)
    assert.equal(process.env.HTTPS_PROXY, originalEnv)
  } finally { connection.dispose(); await new Promise(resolve => server.close(resolve)) }
})

test('a disconnect after response acceptance is surfaced without replaying the request over SSE', async () => {
  const originalSocket = globalThis.WebSocket, originalFetch = globalThis.fetch
  let fetches = 0, sends = 0
  class InterruptedSocket extends EventTarget {
    readyState = 1
    constructor() { super(); queueMicrotask(() => this.dispatchEvent(new Event('open'))) }
    send() {
      sends++
      queueMicrotask(() => {
        this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'response.created', response: { id: 'accepted' } }) }))
        setImmediate(() => this.close())
      })
    }
    close() { if(this.readyState===3)return; this.readyState=3; const event=new Event('close'); Object.assign(event,{code:1006,reason:'fixture disconnect',wasClean:false}); this.dispatchEvent(event) }
  }
  globalThis.WebSocket = InterruptedSocket as unknown as typeof WebSocket
  globalThis.fetch = async () => { fetches++; throw Error('must not replay') }
  const connection = createSubscriptionConnection({ resolveMode: () => 'websocket', resolveProxy: async () => undefined })
  const provider = openaiCodexSubscriptionProvider({ connection })
  const apiKey = `e30.${Buffer.from(JSON.stringify({ 'https://api.openai.com/auth': { chatgpt_account_id: 'fixture' } })).toString('base64url')}.fake`
  try {
    const model = provider.getModels().find(model => model.id === 'gpt-5.6-luna')!
    const events=[]
    for await(const event of provider.streamSimple(model,{messages:[{role:'user',content:'fixture',timestamp:Date.now()}]},{apiKey,sessionId:'interrupted',signal:AbortSignal.timeout(3000)})) events.push(event)
    assert.ok(events.some(event => event.type === 'start'))
    const failure = events.find(event => event.type === 'error')
    assert.match(failure?.error.errorMessage!, /^Network transport failure: WebSocket closed 1006/)
    assert.equal(sends,1)
    assert.equal(fetches,0)
  } finally { connection.dispose();globalThis.WebSocket=originalSocket;globalThis.fetch=originalFetch }
})
