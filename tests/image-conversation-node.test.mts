import test from 'node:test'
import assert from 'node:assert/strict'
import { imageConversationNode as definition } from '../src/image-conversation-node.js'

const match = (event: unknown) => definition.match(event as Parameters<typeof definition.match>[0])
const result = (error = false) => ({ type: 'tool/result', seq: 10, data: {
  turn: 1, meta: { kind: 'codex-subscription-image' },
  message: { content: [{ type: 'tool-result', isError: error, content: [{ type: 'image', attachment: { id: 'a' } }] }] },
} })
const context = (events: unknown[]) => ({ key: 'images:1', id: '1', matches: events.map(event => ({ event,
  location: { kind: 'turn', turn: { steps: [{ data: new Map([['assistant-step', { finalNode: { seq: 12 } }]]) }] } },
})) } as unknown as Parameters<typeof definition.buildViewNode>[0])

test('completed images project after final answer, outside process fold, without mutating history', () => {
  const events = [result(), { type: 'turn/end', seq: 14, data: { turn: 1 } }]
  const before = structuredClone(events)
  const node = definition.buildViewNode(context(events))
  assert.equal(node!.anchorSeq, 12.025)
  assert.deepEqual(node!.location, { kind: 'session' }, 'completed output must not enter a collapsed Turn or Step group')
  assert.equal(node!.data.blocks[0].kind, 'tool-result')
  assert.equal((node!.data.blocks[0].meta as {kind: string}).kind, 'codex-subscription-image')
  assert.deepEqual(events, before)
  assert.deepEqual(definition.buildViewNode(context(events)), node)
})
test('unfinished, failed and unrelated tools do not create image nodes', () => {
  assert.equal(definition.buildViewNode(context([result()])), null)
  assert.equal(match(result(true)), null)
  assert.equal(match({ type: 'tool/result', data: { meta: { kind: 'other' } } }), null)
  assert.equal(definition.buildViewNode(context([{ type: 'turn/end', seq: 14, data: { turn: 1 } }])), null)
})

test('flat host results create an image node without mutating history', () => {
  const real = { type: 'tool/result', seq: 10, data: {
    turn: 1, step: 2, meta: { kind: 'codex-subscription-image' },
    message: { content: [{ type: 'text', text: 'Generated an image.' }, { type: 'image', attachment: { id: 'a' } }] },
  } }
  const events = [real, { type: 'turn/end', seq: 14, data: { turn: 1 } }]
  const before = structuredClone(events)
  assert.notEqual(definition.match(real as unknown as Parameters<typeof definition.match>[0]), null)
  const node = definition.buildViewNode(context(events))!
  assert.deepEqual(node.location, { kind: 'session' })
  assert.equal(node.data.blocks.length, 1)
  assert.equal(node.data.blocks[0].kind, 'tool-result')
  assert.equal(node.data.blocks[0].toolCallId, '1:2')
  assert.deepEqual(node.data.blocks[0].content, real.data.message.content)
  assert.deepEqual(node.data.blocks[0].meta, real.data.meta)
  assert.deepEqual(events, before)
  const textOnly = { ...real, data: { ...real.data, message: { content: [{ type: 'text', text: 'failed' }] } } }
  assert.equal(definition.match(textOnly as unknown as Parameters<typeof definition.match>[0]), null)
})
