import type { AgentContext, ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client';
type SessionPort = Pick<ISessions, 'scope'> & Partial<Pick<ISessions, 'retain'>> & {
    open?: (id: SessionId) => unknown;
};
type WorkspacePort = {
    openSession?: (id: SessionId) => unknown;
};
export type ComposerOpener = (mode: 'sketch', focus: Element | null, file?: File) => void;
export declare function withComposerSession<T>(sessions: SessionPort, id: SessionId, operation: (context: AgentContext) => T | Promise<T>): Promise<T>;
export declare function openComposerSession(sessions: SessionPort, workspace: WorkspacePort | null | undefined, id: SessionId): void;
export declare function createSessionOpeners(): {
    register(id: string, callback: ComposerOpener): () => void;
    has: (id: string) => boolean;
    get: (id: string) => ComposerOpener | undefined;
    clear: () => void;
};
export {};
