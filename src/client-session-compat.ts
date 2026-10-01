import type { AgentContext, ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client';
type SessionPort = Pick<ISessions, 'scope'> & Partial<Pick<ISessions, 'retain'>> & { open?: (id: SessionId) => unknown };
type WorkspacePort = { openSession?: (id: SessionId) => unknown };
export type ComposerOpener = (mode: 'sketch', focus: Element | null, file?: File) => void;
// Keep version-dependent navigation and lifetime ownership at one boundary.
export async function withComposerSession<T>(sessions: SessionPort, id: SessionId, operation: (context: AgentContext) => T | Promise<T>) {
  const reference = typeof sessions.retain === 'function'
    ? sessions.retain(id, { source: 'controllerOperation' }) : undefined
  try {
    if (reference) await reference.ready
    const context = reference ? reference.binding.ctx : sessions.scope(id)
    if (!context) throw new Error('Image composer is unavailable')
    return await operation(context)
  } finally { reference?.release() }
}

export function openComposerSession(sessions: SessionPort, workspace: WorkspacePort | null | undefined, id: SessionId) {
  if (typeof workspace?.openSession === 'function') workspace.openSession(id)
  else if (typeof sessions.open === 'function') sessions.open(id)
  else throw new Error('Session navigation is unavailable')
}

export function createSessionOpeners() {
  const entries = new Map<string, Set<ComposerOpener>>()
  return {
    register(id: string, callback: ComposerOpener) {
      const callbacks = entries.get(id) ?? new Set<ComposerOpener>()
      entries.set(id, callbacks)
      callbacks.add(callback)
      return () => {
        callbacks.delete(callback)
        if (!callbacks.size) entries.delete(id)
      }
    },
    has: (id: string) => entries.has(id),
    get: (id: string) => [...(entries.get(id) ?? [])].at(-1),
    clear: () => entries.clear(),
  }
}
