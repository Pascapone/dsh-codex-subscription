import assert from 'node:assert/strict'
import test from 'node:test'
import { createVoiceController } from '../src/voice-controller.js'

function setup() {
  const tracks = [{ stopped: false, stop() { this.stopped = true } }]
  const sent = []
  const retained = []
  const drafts = []
  const stream = { getTracks: () => tracks }
  const original = { navigator: globalThis.navigator, MediaRecorder: globalThis.MediaRecorder }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => stream } } })
  class Recorder extends EventTarget {
    static isTypeSupported() { return true }
    constructor() { super(); this.state = 'inactive'; this.mimeType = 'audio/webm' }
    start() { this.state = 'recording' }
    stop() {
      if (this.state !== 'recording') return
      this.state = 'inactive'
      this.ondataavailable?.({ data: new Blob(['recording'], { type: this.mimeType }) })
      this.dispatchEvent(new Event('stop'))
      this.onstop?.()
    }
  }
  globalThis.MediaRecorder = Recorder
  const rpc = { async call() { return { ok: true, value: { text: 'spoken words' } } } }
  const sessions = { retain(id) {
    const reference = { sessionId: id, released: false, release() { this.released = true }, binding: { session: { async prompt(parts) { sent.push({ id, parts }); return { ok: true, value: { accepted: true } } } } } }
    reference.ready = Promise.resolve(reference.binding)
    retained.push(reference)
    return reference
  } }
  const input = { captureInsertion: () => ({ draftRev: 0 }), insertText: text => { drafts.push(text); return true } }
  const controller = createVoiceController(sessions, rpc, key => key)
  return { controller, input, rpc, sent, retained, tracks, drafts, restore() {
    if (original.navigator === undefined) delete globalThis.navigator
    else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original.navigator })
    if (original.MediaRecorder === undefined) delete globalThis.MediaRecorder
    else globalThis.MediaRecorder = original.MediaRecorder
    controller.dispose()
  } }
}

test('recording survives a hidden page and another session; send is accepted only by its origin', async () => {
  const fixture = setup()
  try {
    const { controller, input, tracks, sent, retained, drafts } = fixture
    await controller.start('session-a', input)
    assert.equal(controller.getSnapshot().phase, 'recording')
    await controller.start('session-b', input)
    assert.equal(tracks[0].stopped, false)
    assert.equal(controller.getSnapshot().sessionId, 'session-a')
    await controller.finish(true)
    assert.deepEqual(sent, [{ id: 'session-a', parts: [{ type: 'text', text: 'spoken words' }] }])
    assert.deepEqual(drafts, [])
    assert.equal(tracks[0].stopped, true)
    assert.equal(retained[0].released, true)
  } finally { fixture.restore() }
})

test('failed send keeps transcript for retry and stop inserts into the original draft', async () => {
  const fixture = setup()
  try {
    const { controller, input, sent, drafts, retained } = fixture
    let attempts = 0
    // The retained session remains owned while an unsuccessful submission is retried.
    await controller.start('session-a', input)
    const prompt = retained[0].binding.session.prompt
    retained[0].binding.session.prompt = async (...args) => ++attempts === 1
      ? { ok: false, error: { message: 'offline' } } : prompt(...args)
    await controller.finish(true)
    assert.equal(controller.getSnapshot().phase, 'feedback')
    assert.equal(retained[0].released, false)
    controller.retry()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(attempts, 2)
    assert.equal(controller.getSnapshot().phase, 'idle')
    assert.equal(retained[0].released, true)
    await controller.start('session-b', input)
    await controller.finish(false)
    assert.deepEqual(drafts, ['spoken words'])
    assert.deepEqual(sent, [{ id: 'session-a', parts: [{ type: 'text', text: 'spoken words' }] }])
  } finally { fixture.restore() }
})

test('changed origin draft keeps the transcript for explicit insertion, not the new session', async () => {
  const fixture = setup()
  try {
    const { controller, input, drafts } = fixture
    let changed = true
    input.insertText = text => { if (changed) return false; drafts.push(text); return true }
    await controller.start('session-a', input)
    await controller.finish(false)
    assert.equal(controller.getSnapshot().phase, 'feedback')
    assert.equal(controller.getSnapshot().hasText, true)
    changed = false
    controller.insert()
    assert.deepEqual(drafts, ['spoken words'])
    assert.equal(controller.getSnapshot().phase, 'idle')
  } finally { fixture.restore() }
})

test('switching sessions during transcription cannot abort or misroute the pending send', async () => {
  const fixture = setup()
  try {
    let resolve
    fixture.rpc.call = () => new Promise(done => { resolve = done })
    await fixture.controller.start('session-a', fixture.input)
    const pending = fixture.controller.finish(true)
    await new Promise(done => setImmediate(done))
    assert.equal(fixture.controller.getSnapshot().phase, 'transcribing')
    assert.equal(fixture.retained[0].released, false)
    await fixture.controller.start('session-b', fixture.input)
    resolve({ ok: true, value: { text: 'spoken words' } })
    await pending
    assert.equal(fixture.sent[0].id, 'session-a')
    assert.equal(fixture.retained[0].released, true)
  } finally { fixture.restore() }
})

test('explicit cancellation releases microphone and the source session', async () => {
  const fixture = setup()
  try {
    await fixture.controller.start('session-a', fixture.input)
    fixture.controller.cancel()
    assert.equal(fixture.tracks[0].stopped, true)
    assert.equal(fixture.retained[0].released, true)
    assert.equal(fixture.controller.getSnapshot().phase, 'idle')
  } finally { fixture.restore() }
})
