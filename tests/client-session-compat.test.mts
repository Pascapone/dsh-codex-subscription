import test from 'node:test'
import assert from 'node:assert/strict'
import { withComposerSession, openComposerSession, createSessionOpeners } from '../src/client-session-compat.js'

test('async image work holds the exact retained session until success or failure', async () => {
  let released = 0
  const ctx = { id: 'original' }
  const sessions: {retain(id: string, options: {source: string}): {ready: Promise<void>; binding?: {ctx: typeof ctx}; release(): void}} = { retain(id, options) {
    assert.equal(id, 'original'); assert.equal(options.source, 'controllerOperation')
    return { ready: Promise.resolve(), binding: { ctx }, release() { released++ } }
  } }
  assert.equal(await withComposerSession((sessions as unknown as Parameters<typeof withComposerSession>[0]), ('original' as unknown as Parameters<typeof withComposerSession>[1]), async current => {
    await Promise.resolve(); assert.equal(released, 0); return (current as unknown as typeof ctx).id
  }), 'original')
  await assert.rejects(withComposerSession((sessions as unknown as Parameters<typeof withComposerSession>[0]), ('original' as unknown as Parameters<typeof withComposerSession>[1]), () => { throw Error('upload failed') }), /upload failed/)
  assert.equal(released, 2)
  sessions.retain = () => ({ ready: Promise.reject(Error('closed')), release() { released++ } })
  await assert.rejects(withComposerSession((sessions as unknown as Parameters<typeof withComposerSession>[0]), ('original' as unknown as Parameters<typeof withComposerSession>[1]), () => assert.fail()), /closed/)
  assert.equal(released, 3)
})

test('legacy scope remains supported; navigation follows the available host API', async () => {
  assert.equal(await withComposerSession(({ scope: () => ({ id: 1 }) } as unknown as Parameters<typeof withComposerSession>[0]), ('s' as unknown as Parameters<typeof withComposerSession>[1]), (ctx: unknown) => (ctx as {id: number}).id), 1)
  const calls: string[] = []
  const sessions = { open: (id: string) => calls.push('legacy:' + id) }
  openComposerSession((sessions as unknown as Parameters<typeof openComposerSession>[0]), (undefined as unknown as Parameters<typeof openComposerSession>[1]), ('a' as unknown as Parameters<typeof openComposerSession>[2]))
  openComposerSession((sessions as unknown as Parameters<typeof openComposerSession>[0]), ({ openSession: (id: string) => calls.push('modern:' + id) } as unknown as Parameters<typeof openComposerSession>[1]), ('b' as unknown as Parameters<typeof openComposerSession>[2]))
  assert.deepEqual(calls, ['legacy:a', 'modern:b'])
  assert.throws(() => openComposerSession(({} as unknown as Parameters<typeof openComposerSession>[0]), ({} as unknown as Parameters<typeof openComposerSession>[1]), ('s' as unknown as Parameters<typeof openComposerSession>[2])), /unavailable/)
})

test('closing one of two session views restores the remaining sketch opener', () => {
  const openers = createSessionOpeners(), main = () => {}, side = () => {}
  const removeMain = openers.register('s', main), removeSide = openers.register('s', side)
  assert.equal(openers.get('s'), side)
  removeSide(); assert.equal(openers.get('s'), main)
  removeSide(); assert.equal(openers.get('s'), main)
  removeMain(); assert.equal(openers.has('s'), false)
})
