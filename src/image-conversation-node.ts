import type { ConversationNodeDefinition, ConversationLocationDataStore, ConversationLocation, TurnLocation, StepLocation } from '@deepseek-ai/dsh-client-ui-conversation/client';
type ImageEvent = Parameters<ConversationNodeDefinition<undefined>['match']>[0];
type AssistantStepValue = { finalNode?: { seq?: number } };
type AssistantStepLocation = Omit<StepLocation, 'data'> & { data: ConversationLocationDataStore<{ 'assistant-step': AssistantStepValue }> };
// Historical tool-result wrappers remain part of the supported SDK cohorts.
type LegacyImageResultBlock = { type?: unknown; toolCallId?: string; attachment?: unknown; isError?: unknown; content?: readonly { type?: unknown; attachment?: unknown }[] };
type ImageResultBlock = LegacyImageResultBlock & { kind: 'tool-result'; meta: Extract<ImageEvent, { type: 'tool/result' }>['data']['meta'] };
const KIND = 'codex-image-output'
// Current hosts deliver rendered blocks directly; retain legacy wrappers too.
const resultsOf = (event: ImageEvent | null | undefined): LegacyImageResultBlock[] => {
  if (event?.type !== 'tool/result' || (event.data.meta as { kind?: unknown } | null | undefined)?.kind !== 'codex-subscription-image') return []
  const content = (event.data.message?.content ?? []) as readonly LegacyImageResultBlock[]
  const wrapped = content.filter(block => block.type === 'tool-result' && !block.isError
    && block.content?.some(part => part.type === 'image' && part.attachment))
  if (wrapped.length > 0) return wrapped
  return content.some(part => part.type === 'image' && part.attachment)
    ? [{ type: 'tool-result', toolCallId: `${event.data.turn}:${event.data.step ?? event.seq}`, isError: false, content }]
    : []
}

// Presentation only: project existing durable results, without inserting another
// message into the model's context or expanding unrelated tool calls.
export const imageConversationNode = {
  kind: KIND, target: 'chat',
  match(event) {
    if (event.type !== 'turn/end' && resultsOf(event).length === 0) return null
    return { id: String((event.data as { turn?: unknown }).turn), role: 'update' }
  },
  start: () => undefined,
  update: context => context.state,
  buildViewNode(context) {
    const end = context.matches.find(match => match.event.type === 'turn/end')
    if (!end) return null
    const blocks: ImageResultBlock[] = context.matches.flatMap(({ event }) => resultsOf(event).map(block => ({
      ...block, kind: 'tool-result' as const, meta: (event as Extract<ImageEvent, { type: 'tool/result' }>).data.meta,
    })))
    if (!blocks.length) return null
    const turn = (end.location as Partial<Extract<ConversationLocation, { turn: TurnLocation }>>).turn
    const answer = (turn?.steps as readonly AssistantStepLocation[] | undefined)?.at(-1)?.data.get('assistant-step')
    const lastResultSeq = Math.max(...context.matches.filter(match => resultsOf(match.event).length).map(match => match.event.seq))
    const answerSeq = answer?.finalNode?.seq
    // Session scope keeps this display node outside collapsed Turn/Step groups.
    const anchorSeq = answerSeq! > lastResultSeq ? answerSeq! + 0.025 : end.event.seq - 0.025
    return { key: context.key, id: context.id, kind: KIND, target: 'chat',
      location: { kind: 'session' }, anchorSeq, visibility: 'visible', data: { blocks } }
  },
} satisfies ConversationNodeDefinition<undefined>
