import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client';
import type { IConversation, InputActions } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { SubscriptionRpcClient, Translate } from './client-types.js';
export type VoiceState = {
    phase: 'idle' | 'permission' | 'recording' | 'transcribing' | 'feedback';
    wave: number[];
    elapsed: number;
    error: string;
    sessionId: SessionId | null;
    hasText: boolean;
    inserted: boolean;
};
export declare function createVoiceController(sessions: Pick<ISessions, "retain">, rpc: SubscriptionRpcClient, t: Translate, conversation: Pick<IConversation, "input">): {
    getSnapshot: () => VoiceState;
    getRecordingSession: () => SessionId | null;
    subscribe: (listener: () => void) => () => boolean;
    start: (sessionId: SessionId, inputActions: InputActions, locked?: boolean) => Promise<void>;
    finish: (send: boolean) => Promise<void>;
    cancel: () => void;
    insert: () => void;
    retry: () => void;
    dispose: () => void;
};
