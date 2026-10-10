import assert from 'node:assert/strict'
import test from 'node:test'
import { readSource } from './source-contract.js'

const source = await readSource(new URL('../src/subscription-image-viewer.jsx', import.meta.url))
const body = /const sendMask = (async \(\) => \{[\s\S]*?\n  \})\n/.exec(source)?.[1]
assert.ok(body, 'exercise the actual viewer mask sender')
const sender = new Function('env', `with (env) { return (${body}); }`) as (env: object) => () => Promise<void>

test('mask completion belongs to its original request and image, including failures', async () => {
  for (const fail of [false, true]) for (const change of ['none', 'request', 'image']) {
    let finish!: () => void, started!: () => void
    const pending = new Promise<void>(resolve => { finish = resolve })
    const invoked = new Promise<void>(resolve => { started = resolve })
    let revision = 1, closed = 0
    const sending: boolean[] = [], failed: boolean[] = [], cleared: unknown[] = []
    const imageRef = { current: { src: 'original', naturalWidth: 10, naturalHeight: 10 } }
    const env = {
      imageRef, sending: false, strokes: [{}], request: { revision }, item: { src: 'original' },
      erasing: { closeOnSuccess: true, async onInvoke() { started(); await pending; if (fail) throw Error('upload') } },
      service: { getSnapshot: () => ({ revision }), close: () => { closed++ } },
      setSending: (value: boolean) => sending.push(value), setSendFailed: (value: boolean) => failed.push(value),
      setErasing: (value: unknown) => cleared.push(value), setStrokes: (value: unknown) => cleared.push(value),
      paintEraseMask() {}, document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({}), toBlob: (done: (blob: Blob) => void) => done(new Blob(['mask'])) }) },
    }
    const work = sender(env)()
    await invoked
    if (change === 'request') revision++
    if (change === 'image') imageRef.current.src = 'replacement'
    finish()
    await work
    const owned = change === 'none'
    assert.deepEqual(sending, owned ? [true, false] : [true], `${change}, failure=${fail}`)
    assert.deepEqual(failed, owned && fail ? [false, true] : [false])
    assert.equal(closed, owned && !fail ? 1 : 0)
    assert.equal(cleared.length, owned && !fail ? 2 : 0, 'failed uploads preserve strokes; stale uploads never clear the new viewer')
  }
})
