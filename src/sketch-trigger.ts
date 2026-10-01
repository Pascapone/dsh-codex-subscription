import type { InputTriggerSource, ClientSessionContext, TokenSpan } from '@deepseek-ai/dsh-client-ui-input-trigger/client';
type TriggerOptions = { enabled(): boolean; open?(sessionId: ClientSessionContext['sessionId']): void; consume(sessionId: ClientSessionContext['sessionId'], span: TokenSpan): boolean };
function createWorkspaceTrigger({ enabled, open, consume, name, aliases, description }: TriggerOptions & { name: string; aliases: readonly string[]; description: string }): InputTriggerSource {
  return {
    trigger: '@', name, showGroupTitle: false, order: -10,
    candidates: async (session, request) => enabled() && !request.quoted && aliases.some(alias => alias.startsWith(request.query.toLowerCase()))
      ? [{ name, description, value: aliases[0] }] : [],
    onPick: ({ session, span }) => {
      if (!enabled() || !consume(session.sessionId, span)) return undefined
      open!(session.sessionId)
      return 'handled'
    },
  }
}

// Picking an Agent entry edits the composer; only the tool opens the board.
export const createSketchTrigger = (options: TriggerOptions) => createWorkspaceTrigger({ ...options, open:()=>{}, name: 'Sketch · Beta', aliases: ['sketch', '草图'], description: 'Ask the Agent to draw or edit a sketch' })
export const createImageTrigger = (options: TriggerOptions) => createWorkspaceTrigger({ ...options, name: 'Image · 生图', aliases: ['image', '生图'], description: 'Describe an image to generate or edit' })
