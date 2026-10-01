import type { ConversationController, SessionInput } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client';
type Drafts = ReturnType<ConversationController['createDrafts']>;
type ConversationPort = Partial<Pick<ConversationController, 'createDrafts' | 'releaseDraftAttachments'>> & {
    createDraftImages?: (files: readonly File[]) => Drafts;
    releaseDraftImages?: (items: Drafts) => void;
};
type AttachmentInput = Partial<Pick<SessionInput, 'addAttachments'>> & {
    addImages?: SessionInput['addAttachments'];
};
export declare function attachImageFiles(conversation: ConversationPort, input: AttachmentInput, files: readonly File[], sessionId?: SessionId): readonly import("@deepseek-ai/dsh-client-ui-conversation/client").ComposerAttachment[];
export declare function appendImagePrompt(input: Pick<SessionInput, 'state' | 'setDraft'>, text: string): void;
export {};
