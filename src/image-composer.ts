import type { ConversationController, SessionInput } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client';
type Drafts = ReturnType<ConversationController['createDrafts']>;
type ConversationPort = Partial<Pick<ConversationController, 'createDrafts' | 'releaseDraftAttachments'>> & { createDraftImages?: (files: readonly File[]) => Drafts; releaseDraftImages?: (items: Drafts) => void };
type AttachmentInput = Partial<Pick<SessionInput, 'addAttachments'>> & { addImages?: SessionInput['addAttachments'] };
// Shared admission and cleanup for sketches and existing-image edits.
export function attachImageFiles(conversation: ConversationPort, input: AttachmentInput, files: readonly File[], sessionId?: SessionId) {
  // DSH 0.1.5 generalizes image drafts into session-owned attachments.
  const modern = typeof conversation.createDrafts === 'function'
  const create = modern ? () => conversation.createDrafts!(sessionId!, files) : () => conversation.createDraftImages!(files)
  const release = modern ? (items: Drafts) => conversation.releaseDraftAttachments!(items) : (items: Drafts) => conversation.releaseDraftImages!(items)
  const add = modern ? input.addAttachments : input.addImages
  if (typeof add !== 'function' || (modern && !sessionId)) throw new Error('Image composer is unavailable')
  const created = create()
  try {
    if (!add.call(input, created.map(item => item.id))) throw new Error('The composer is busy')
  } catch (error) {
    release(created)
    throw error
  }
  return created
}

export function appendImagePrompt(input: Pick<SessionInput, 'state' | 'setDraft'>, text: string) {
  const current = input.state.getSnapshot()
  if (current.phase !== 'plain') throw new Error('The composer is busy')
  // Whole-draft writes would flatten reference chips. Leave them untouched.
  if (current.occurrences?.length) throw new Error('Keep existing references; add image instructions in the composer')
  input.setDraft([current.draft, text].filter(Boolean).join('\n\n'))
}
