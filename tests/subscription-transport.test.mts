import type { ConnectionFetchRoute, ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection';
import type { RpcResponse } from '../src/rpc-response-types.js';
import assert from 'node:assert/strict'
import test from 'node:test'
import { registerSubscriptionTransport } from '../src/subscription-transport.js'
import { CHANNEL, createSubscriptionRpcClient, RPC_ENDPOINTS } from '../src/rpc-contract.js'
import { createSketchAgentBridge } from '../src/sketch-agent-bridge.js'

test('sketch connect/poll/claim/result traverse the actual scoped RPC route contract',async()=>{
  const routes=new Map<string, ConnectionFetchRoute>(),bridge=createSketchAgentBridge({enabled:()=>true})
  const dispose=registerSubscriptionTransport((({fetch:{register:(route: ConnectionFetchRoute)=>{routes.set(route.path,route);return()=>routes.delete(route.path)}}}) as unknown as Parameters<typeof registerSubscriptionTransport>[0]),(((endpoint: string,payload: unknown)=>bridge.rpc(endpoint,payload)) as unknown as Parameters<typeof registerSubscriptionTransport>[1]))
  const client=createSubscriptionRpcClient({call:async(_channel,method,payload)=>{
    const route=routes.get(`/api/${method}`);assert.ok(route,method)
    const response=await route.fetch(new Request(`http://localhost/api/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'sketch-test',method,payload})}))
    return (await response.json()).result
  }})
  const call=<const N extends string>(name: N,payload: unknown)=>client.call(CHANNEL,`sketch/${name}`,payload) as Promise<Extract<ConnectionRpcResult<RpcResponse<`sketch/${N}`>>,{ok: true}>>
  const {value:{token}}=await call('connect',{sessionId:'s'})
  const pending=bridge.request('s',{action:'inspect'})
  const {value:[task]}=await call('poll',{sessionId:'s',token})
  assert.equal((await call('claim',{sessionId:'s',token,id:task.id})).value,true)
  await call('result',{sessionId:'s',token,id:task.id,value:{revision:1}})
  assert.deepEqual(await pending,{revision:1})
  await call('disconnect',{sessionId:'s',token});dispose();bridge.dispose()
})

test('subscription transport validates envelopes and preserves correlation and cancellation', async () => {
  const routes = new Map<string, ConnectionFetchRoute>()
  let invoked = 0
  const dispose = registerSubscriptionTransport((({ fetch: { register(route: ConnectionFetchRoute) {
    routes.set(route.path, route)
    return () => routes.delete(route.path)
  } } }) as unknown as Parameters<typeof registerSubscriptionTransport>[0]), ((async (endpoint: string, payload: unknown, signal: AbortSignal) => {
    invoked++
    assert.equal(endpoint, 'status')
    assert.equal(signal.aborted, false)
    return { ok: true, value: payload }
  }) as unknown as Parameters<typeof registerSubscriptionTransport>[1]))
  const route = routes.get('/api/codex-subscription/status')!
  const request = (body: string, headers = { 'content-type': 'application/json' }) => new Request('http://localhost' + route.path, { method: 'POST', headers, body })
  const envelope = { type: 'client-request', rpcId: 'test-123', method: 'codex-subscription/status', payload: { force: true } }
  const response = await route.fetch(request(JSON.stringify(envelope)))
  assert.deepEqual(await response.json(), { type: 'server-response', rpcId: 'test-123', result: { ok: true, value: { force: true } } })
  assert.equal((await route.fetch(request('{'))).status, 400)
  assert.equal((await route.fetch(request(JSON.stringify({ ...envelope, method: 'codex-subscription/logout' })))).status, 400)
  assert.equal((await route.fetch(request('{}'))).status, 400)
  assert.equal((await route.fetch(request('{}', { 'content-type': 'text/plain' }))).status, 415)
  assert.equal(invoked, 1)
  assert.equal(routes.size, RPC_ENDPOINTS.length)
  dispose()
  assert.equal(routes.size, 0)
})

test('subscription transport redacts uncaught failures and rolls back partial registration', async () => {
  let route!: ConnectionFetchRoute
  registerSubscriptionTransport((({ fetch: { register(value: ConnectionFetchRoute) { route ??= value; return () => {} } } }) as unknown as Parameters<typeof registerSubscriptionTransport>[0]), ((() => { throw new Error('private credential') }) as unknown as Parameters<typeof registerSubscriptionTransport>[1]))
  const response = await route.fetch(new Request('http://localhost' + route.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'a', method: 'codex-subscription/status', payload: {} }) }))
  assert.doesNotMatch(await response.text(), /private credential/)
  let active = 0
  assert.throws(() => registerSubscriptionTransport((({ fetch: { register() {
    if (active === 2) throw new Error('duplicate route')
    active++
    return () => active--
  } } }) as unknown as Parameters<typeof registerSubscriptionTransport>[0]), ((() => {}) as unknown as Parameters<typeof registerSubscriptionTransport>[1])), /duplicate route/)
  assert.equal(active, 0)
})

test('client maps only subscription endpoints onto the authenticated DSH carrier', async () => {
  const signal = new AbortController().signal
  let actual: unknown
  const client = createSubscriptionRpcClient({ call: (...args: unknown[]) => { actual = args; return Promise.resolve({ ok: true, value: 1 }) } })
  assert.equal((await client.call(CHANNEL, 'usage', {}, signal) as Extract<ConnectionRpcResult<RpcResponse<'usage'>>,{ok: true}>).value, 1)
  assert.deepEqual(actual, ['/api', 'codex-subscription/usage', {}, signal])
  assert.throws(() => client.call('/other', 'usage', {}), /Invalid/)
  assert.throws(() => client.call(CHANNEL, '../logout', {}), /Invalid/)
})
