import type { ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection';
interface SketchTask { request: unknown; expiresAt: number; delivered: boolean; resolve(value: unknown): void; reject(error: unknown): void }
interface SketchSession { token: string; seen: number; tasks: Map<string, SketchTask>; cancelled: string[] }
type SketchPayload = { sessionId?: unknown; token?: unknown; id?: unknown; error?: unknown; value?: unknown };
import { randomUUID } from 'node:crypto'

// Ephemeral session-scoped delivery only. The browser retains the document.
export function createSketchAgentBridge({ enabled, now = Date.now, timeoutMs = 20_000 }: { enabled: () => boolean; now?: () => number; timeoutMs?: number }) {
  const sessions = new Map<string, SketchSession>()
  const fail = (entry: SketchSession, message: string) => { for(const task of entry.tasks.values())task.reject(Error(message));entry.tasks.clear() }
  const find = (payload: unknown) => {
    const entry = sessions.get(((payload as SketchPayload).sessionId as string))
    if (!entry || entry.token !== (payload as SketchPayload).token || now()-entry.seen > 10_000) throw Error('Sketch connection expired')
    entry.seen = now();return entry
  }
  return {
    async rpc(endpoint: string, payload: unknown): Promise<ConnectionRpcResult<unknown>> {
      try {
        if (!enabled()) throw Error('Sketch is disabled')
        if (!payload || typeof ((payload as SketchPayload).sessionId as string) !== 'string' || !((payload as SketchPayload).sessionId as string).length || ((payload as SketchPayload).sessionId as string).length > 200) throw Error('Invalid session')
        if (endpoint === 'sketch/connect') {
          for(const [id,entry] of sessions)if(now()-entry.seen>=10_000){fail(entry,'Sketch connection expired');sessions.delete(id)}
          const previous = sessions.get(((payload as SketchPayload).sessionId as string))
          if(previous && now()-previous.seen < 10_000)throw Error('Another board is connected to this session')
          if(previous)fail(previous,'Sketch connection replaced')
          const entry: SketchSession={token:randomUUID(),seen:now(),tasks:new Map(),cancelled:[]};sessions.set(((payload as SketchPayload).sessionId as string),entry)
          return {ok:true,value:{token:entry.token}}
        }
        const entry=find(payload)
        if(endpoint==='sketch/poll')return {ok:true,value:[...entry.cancelled.splice(0).map(id=>({id,cancelled:true})),...[...entry.tasks].filter(([,t])=>!t.delivered).map(([id,t])=>{t.delivered=true;return {id,request:t.request,expiresAt:t.expiresAt}})]}
        if(endpoint==='sketch/claim'){const task=entry.tasks.get(((payload as SketchPayload).id as string));return {ok:true,value:Boolean(task && task.delivered && task.expiresAt>now())}}
        if(endpoint==='sketch/disconnect'){fail(entry,'Sketch board closed');sessions.delete(((payload as SketchPayload).sessionId as string));return {ok:true,value:null}}
        if(endpoint==='sketch/result'){
          const task=entry.tasks.get(((payload as SketchPayload).id as string))
          if(task){entry.tasks.delete(((payload as SketchPayload).id as string));(payload as SketchPayload).error?task.reject(Error(String((payload as SketchPayload).error).slice(0,500))):task.resolve((payload as SketchPayload).value)}
          return {ok:true,value:null}
        }
        throw Error('Unknown sketch route')
      }catch(error){return {ok:false,error:{code:'invalid-input',message:(error as Error).message,details:{issues:[]}}}}
    },
    request(sessionId: string, request: unknown, signal?: AbortSignal): Promise<unknown> {
      if(!enabled())return Promise.reject(Error('Sketch is disabled'))
      const entry=sessions.get(sessionId)
      if(!entry || now()-entry.seen>10_000)return Promise.reject(Error('Switch to this session in DSH with sketch editing enabled'))
      if(entry.tasks.size)return Promise.reject(Error('Another sketch operation is pending'))
      if(JSON.stringify(request)!.length>2_000_000)return Promise.reject(Error('Sketch batch is too large'))
      return new Promise<unknown>((resolve,reject)=>{
        const id=randomUUID()
        const finish=<T>(callback: (value: T) => void,value: T)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);entry.tasks.delete(id);callback(value)}
        const cancel=(message: string)=>{if(entry.tasks.get(id)?.delivered){entry.cancelled.push(id);if(entry.cancelled.length>32)entry.cancelled.shift()}finish(reject,Error(message))}
        const abort=()=>cancel('Sketch operation interrupted; inspect recentRequests before retrying')
        const timer=setTimeout(()=>cancel('Sketch response timed out; inspect recentRequests before retrying'),timeoutMs)
        entry.tasks.set(id,{request,expiresAt:now()+timeoutMs,delivered:false,resolve:value=>finish(resolve,value),reject:error=>finish(reject,error)})
        signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()
      })
    },
    dispose(){for(const entry of sessions.values())fail(entry,'Sketch service stopped');sessions.clear()},
  }
}
