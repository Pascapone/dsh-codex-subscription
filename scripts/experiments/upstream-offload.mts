import type { ImageBlock, TextBlock, MessageId } from '@deepseek-ai/dsh-llm';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { PiAiAdapterOptions, ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai';
import type { Context as PiContext } from '@earendil-works/pi-ai';
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {load} from './native-runtime.mts'

const {Context}=await load('@deepseek-ai/cordis')
const {SessionStore}=await load('@deepseek-ai/dsh-session')
const {default:Storage}=await load('@deepseek-ai/dsh-session-persistence-jsonl')
const ctx=new Context(), sessions=new SessionStore(ctx), handlers: Record<string, (request: {agent: {session: ReturnType<InstanceType<typeof SessionStore>['create']>}; failure: {code: string} | undefined}, next: () => never) => Promise<{kind: string}>>={}
const offload=await load('@deepseek-ai/dsh-compaction-image-offload')
offload.apply({sessions,on:(name: string,fn: typeof handlers[string])=>{handlers[name]=fn}} as unknown as Parameters<typeof offload.apply>[0])
const session=sessions.create('offload-acceptance' as SessionId,{meta:{cwd:path.resolve('.artifacts')}})
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')
const ref={attachmentId:'fixture-image',name:'fixture.png',mediaType:'image/png',bytes:bytes.length,width:1,height:1}
const image: ImageBlock={type:'image',attachment:ref as unknown as ImageBlock['attachment']}, text: TextBlock={type:'text',text:'Original image remains available.'}
session.append('user/message',{id:crypto.randomUUID() as MessageId,role:'user',source:{kind:'user'},content:[text,image,image]},{surfaceOp:'append'})

const {PiAiAdapter}=await load('@deepseek-ai/dsh-llm-pi-ai')
let reads=0
const attachments={readImageRequest:async()=>{reads++;return {...ref,data:bytes}},readImage:async(_ref: typeof ref)=>({...ref,data:bytes})}
const {openaiCodexSubscriptionProvider}=await import('../../src/pi-ai-runtime.js')
const original=openaiCodexSubscriptionProvider();let convertedContext: PiContext | undefined
const provider={...original,streamSimple:(_m: Parameters<typeof original.streamSimple>[0],context: PiContext)=>{convertedContext=context;return(async function*(){})()}}
const adapter=new PiAiAdapter({profiles:()=>new Map([['openai-codex',{provider:'openai-codex',piProvider:provider,configuredMaxTokens:new Map(),modelErrors:new Map(),maxRequestImageBytes:100,requestImagePixelBudget:4096,requestImageMaxBytes:1024,streamIdleTimeoutMs:1000} as unknown as ResolvedPiAiProviderProfile]]),resolveApiKey:async()=> 'synthetic-no-network',resolveAttachments:()=>attachments as unknown as ReturnType<NonNullable<PiAiAdapterOptions['resolveAttachments']>>} as unknown as ConstructorParameters<typeof PiAiAdapter>[0])
const convert=async (messages: Parameters<InstanceType<typeof PiAiAdapter>['stream']>[0]['messages'])=>{try{for await(const event of adapter.stream({provider:'openai-codex',model:'gpt-5.6-luna',messages})){} }catch(e){if((e as {code?: string}).code!=='STREAM_CLOSED'||!convertedContext)throw e}return convertedContext!}
let failure: {code: string} | undefined
try {await convert(session.deriveMessages())} catch(e) {failure=(e as {failure?: {code: string}}).failure}
assert.equal(failure?.code,'IMAGE_OFFLOAD_REQUIRED')
const action=await handlers['agent/request-error']({agent:{session},failure},()=>{throw Error('Unexpected fallback')})
assert.equal(action.kind,'retry')
const projected=session.deriveMessages()
assert.equal(projected[0].content.filter(b=>(b as ImageBlock).offloaded).length,1)
const converted=await convert(projected)
assert.equal((converted.messages[0].content as {type: string; text: string}[]).filter(b=>b.type==='image').length,1)
assert.ok((converted.messages[0].content as {type: string; text: string}[]).some(b=>b.type==='text'&&/offload|omitt/i.test(b.text)))
assert.deepEqual((await attachments.readImage(ref)).data,bytes)
const root=path.resolve('.artifacts/upstream-offload-jsonl-'+Date.now()),storage=new Storage(new Context(),{root,compression:'none'})
const handle=await storage.create(session.header)
try{await handle.append(session.snapshotEvents());await handle.flush()}finally{await handle.close()}
const reader=await storage.open(session.id,'read');let events
try{events=(await reader.read()).events}finally{await reader.close()}
const restored=sessions.create('restored-offload' as SessionId,{seed:events,meta:{cwd:path.resolve('.artifacts')}})
assert.deepEqual(restored.deriveMessages(),projected)
const fork=sessions.create('forked-offload' as SessionId,{seed:events,meta:{cwd:path.resolve('.artifacts'),parentSession:session.id}})
assert.deepEqual(fork.deriveMessages(),projected)
fork.append('user/message',{id:crypto.randomUUID() as MessageId,role:'user',source:{kind:'user'},content:[image]},{surfaceOp:'append'})
assert.equal((fork.deriveMessages().at(-1)!.content[0] as ImageBlock).offloaded,undefined)
await fs.writeFile('.artifacts/upstream-offload-result.json',JSON.stringify({passed:true,events:events.map(e=>e.type),imageReads:reads,restored:true,seededFork:true,newReferenceRetained:true,originalRetained:true},null,2))
console.log('Native offload, JSONL restore, seeded fork and fresh reference passed')
