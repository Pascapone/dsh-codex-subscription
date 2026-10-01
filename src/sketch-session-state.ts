import type { SketchDocument, SketchDraft, SketchCommandAdapter } from './sketch-types.js';
import type { createSketchAgentRun } from './sketch-agent-run.js';
import type { createSketchCommandSession } from './sketch-commands.js';
export type SketchStudioAdapter = SketchCommandAdapter & { open(): void; changed?(state: string): void; previewEnabled(): boolean; export(format: string): Promise<{ blob: Blob; extension: string }> };
type Ref<T> = { current: T };
export type SketchSessionState = { doc: Ref<SketchDocument>; undo: Ref<SketchDocument[]>; redo: Ref<SketchDocument[]>; images: Ref<Map<string, HTMLImageElement>>; saved: Ref<Pick<SketchDraft, 'id' | 'name'> | null>; dirty: Ref<boolean>; documentId: Ref<string>; documentRevision: Ref<number>; restoreId: Ref<string | null>; mounts: number; agentAdapter: Ref<Partial<SketchStudioAdapter>>; agentSession: Ref<ReturnType<typeof createSketchCommandSession> | null>; agentRun: Ref<ReturnType<typeof createSketchAgentRun> | null>; retain?: () => () => void };
import { createSketchLayers } from './sketch-layers.js'

// Owned by the plugin session, not the input slot. A slot can remount between tools.
export function createSketchSessionState(): SketchSessionState {
  const ref = <T>(current: T): Ref<T> => ({current})
  return {
    doc:ref(createSketchLayers()), undo:ref([]), redo:ref([]), images:ref(new Map()),
    saved:ref(null), dirty:ref(false), documentId:ref(crypto.randomUUID()), documentRevision:ref(0), restoreId:ref(null), mounts:0,
    agentAdapter:ref({}), agentSession:ref(null), agentRun:ref(null),
  }
}

export function createSketchSessionRegistry({ maxIdle = 8 } = {}) {
  const sessions = new Map<string, SketchSessionState>(), archived = new Map<string, string>()
  const prune = () => {
    const idle = [...sessions].filter(([,s])=>!s.mounts&&!s.dirty.current&&!s.agentRun.current?.locked&&s.agentRun.current?.state!=='stopped')
    for(const [id,state] of idle.slice(0,Math.max(0,idle.length-maxIdle))) {
      // Saved documents can be loaded by ID; unsaved documents are never evicted.
      if(!state.saved.current && state.doc.current.layers.some(l=>l.image||l.strokes.length))continue
      const restoreId=state.saved.current?.id??state.restoreId.current
      if(restoreId)archived.set(id,restoreId)
      state.agentRun.current?.dispose();state.images.current.clear();sessions.delete(id)
    }
  }
  return {
    get(id: string) {
      let state=sessions.get(id)
      if(!state){state=createSketchSessionState();state.restoreId.current=archived.get(id)??null;archived.delete(id);sessions.set(id,state)}
      state.retain=()=>{state.mounts++;return ()=>{state.mounts--;prune()}}
      // Refresh insertion order for least-recently-used idle eviction.
      sessions.delete(id);sessions.set(id,state)
      return state as SketchSessionState & { retain: NonNullable<SketchSessionState['retain']> }
    },
    prune,
    stats:()=>({resident:sessions.size,archived:archived.size}),
    dispose() { for(const value of sessions.values())value.agentRun.current?.dispose();sessions.clear();archived.clear() },
  }
}
