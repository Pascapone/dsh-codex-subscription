import assert from 'node:assert/strict'
import test from 'node:test'
import { zstdDecompressSync } from 'node:zlib'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { InMemoryCredentialStore } from '@earendil-works/pi-ai'
import { createUserMessage, createAssistantMessage, resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, RequestMessage, StreamChunk } from '@deepseek-ai/dsh-llm'
import { createCompactionBridge } from '../src/subscription-compaction.js'
import { openaiCodexSubscriptionProvider } from '../src/pi-ai-runtime.js'
import { createCodexNetworkTransport } from '../src/oauth-network.js'

const jwt = (account: string) => `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({'https://api.openai.com/auth':{chatgpt_account_id:account}})).toString('base64url')}.signature`
const user = (text: string): RequestMessage => createUserMessage({source:{kind:'user' as const}, content:[{type:'text',text}]})

test('native direct and prepared requests pin checkpoint scope and credential across account switches', async () => {
  const originalFetch = globalThis.fetch
  try {
    for (const prepared of [false, true]) {
      let selected = 'A', switchAfterScope = false, fallbackReads = 0
      const bridge = createCompactionBridge({enabled:()=>true, accountScope:async()=>{
        const snapshot = {accountId:selected, access:jwt(selected)}
        if (switchAfterScope) queueMicrotask(()=>{selected='B'})
        return snapshot
      }})
      const network = createCodexNetworkTransport({platform:'linux',env:{}})
      const provider = openaiCodexSubscriptionProvider({compaction:bridge,runNetwork:network.run})
      const model = provider.getModels()[0]
      const profiles = new Map<string, ResolvedPiAiProviderProfile>([['openai-codex',{provider:'openai-codex',displayName:'test',piProvider:provider,
        configuredMaxTokens:new Map(),modelErrors:new Map(),transport:'sse',streamIdleTimeoutMs:10000,
        maxRequestImageBytes:20*1024*1024,requestImagePixelBudget:2048*2048,requestImageMaxBytes:1024*1024,
        retryPolicy:resolveRetryPolicy(undefined,'test')}]])
      const adapter = bridge.wrapAdapter(new PiAiAdapter({profiles:()=>profiles,
        auth:{credentials:new InMemoryCredentialStore(),authContext:{env:async()=>undefined,fileExists:async()=>false}},
        resolveApiKey:()=>bridge.resolveApiKey(async()=>{fallbackReads++;return jwt(selected)})}))
      const stream = prepared ? (await adapter.prepareCall('openai-codex',model.id)).stream : (options: GenerateOptions)=>adapter.stream(options)
      const wires: {account: string | null; body: {input: {type?: string; encrypted_content?: string}[]}}[] = []
      globalThis.fetch = async (input,init) => {
        assert.equal(String(input),'https://chatgpt.com/backend-api/codex/responses')
        assert.ok(init?.body instanceof Uint8Array)
        wires.push({account:new Headers(init.headers).get('chatgpt-account-id'),body:JSON.parse(zstdDecompressSync(init.body).toString())})
        const events = [
          {type:'response.created',response:{id:'resp_test'}},
          {type:'response.output_item.added',output_index:0,item:{type:'message',id:'msg_test',role:'assistant',content:[]}},
          {type:'response.output_text.delta',output_index:0,content_index:0,delta:'READY'},
          {type:'response.output_item.done',output_index:0,item:{type:'message',id:'msg_test',role:'assistant',status:'completed',content:[{type:'output_text',text:'READY',annotations:[]}]}},
          {type:'response.output_item.done',output_index:1,item:{type:'compaction',encrypted_content:'SYNTHETIC_ONLY'}},
          {type:'response.completed',response:{id:'resp_test',status:'completed',output:[],usage:{input_tokens:10,output_tokens:1,total_tokens:11}}},
        ]
        return new Response(events.map(event=>`data: ${JSON.stringify(event)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}})
      }
      const run = async (messages: RequestMessage[]) => {
        const events: StreamChunk[] = []
        for await (const event of stream({provider:'openai-codex',model:model.id,messages})) events.push(event)
        return events
      }
      const history = user('history-A')
      const first = await run([history])
      const finish = first.find(event=>event.type==='finish')
      assert.ok(finish?.type==='finish' && finish.replayState)
      const saved = createAssistantMessage({source:{provider:'openai-codex',model:model.id,replayState:finish.replayState},
        content:first.flatMap(event=>event.type==='block-end'?[event.block]:[])})
      switchAfterScope = true
      await run([history,saved,user('next')])
      assert.equal(selected,'B')
      assert.equal(wires[1].account,'A','an in-flight checkpoint stays with its captured credential')
      assert.ok(wires[1].body.input.some(item=>item.type==='compaction'))
      switchAfterScope = false
      await run([history,saved,user('next-B')])
      assert.equal(wires[2].account,'B')
      assert.equal(wires[2].body.input.some(item=>item.type==='compaction'),false)
      assert.ok(JSON.stringify(wires[2].body).includes('history-A'),'a new account retains the original history')
      assert.equal(fallbackReads,0)
      assert.equal(await bridge.resolveApiKey(async()=>{fallbackReads++;return 'outside'}),'outside')
      assert.equal(fallbackReads,1,'credentials are not cached between operations')
    }
  } finally { globalThis.fetch = originalFetch }
})
