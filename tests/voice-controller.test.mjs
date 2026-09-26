import assert from 'node:assert/strict'
import test from 'node:test'
import { createVoiceController } from '../src/voice-controller.js'

function setup() {
  const tracks = [{ stopped: false, stop() { this.stopped = true } }]
  const sent = [], retained = [], drafts = [], failures = []
  let draft = '', attachments = []
  const inputListeners = new Set()
  const inputState = {
    getSnapshot: () => ({ draft, phase: 'plain' }),
    subscribe: fn => { inputListeners.add(fn); return () => inputListeners.delete(fn) },
  }
  const original = { navigator: globalThis.navigator, MediaRecorder: globalThis.MediaRecorder }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => tracks }) } } })
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
    let snapshot = { pendingSubmissions: [], promptError: null }
    const listeners = new Set()
    const session = {
      getSnapshot: () => snapshot,
      subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) },
      publish: patch => { snapshot = { ...snapshot, ...patch }; listeners.forEach(fn => fn()) },
    }
    const reference = { sessionId: id, released: false, release() { this.released = true }, binding: { session, ctx: { sessionId: id } } }
    reference.ready = Promise.resolve(reference.binding)
    retained.push(reference)
    return reference
  } }
  const input = {
    captureInsertion: () => ({ draftRev: 0 }),
    insertText: text => { drafts.push(text); draft += text; return true },
    submit() {
      const reference = retained.at(-1)
      const session = reference.binding.session
      const requestId = `request-${drafts.length}-${sent.length}`
      const text = draft, files = [...attachments], failure = failures.shift()
      if (failure === 'upload') { queueMicrotask(() => inputListeners.forEach(fn => fn())); return }
      session.publish({ pendingSubmissions: [{ requestId }] })
      setImmediate(() => {
        if (failure) session.publish({ pendingSubmissions: [], promptError: { error: { message: failure } } })
        else {
          sent.push({ id: reference.sessionId, text, attachments: files })
          draft = ''; attachments = []
          session.publish({ pendingSubmissions: [], promptError: null })
        }
      })
    },
  }
  const controller = createVoiceController(sessions, rpc, key => key, { input: { for: () => ({ state: inputState }) } })
  return { controller, input, rpc, sent, retained, tracks, drafts, failures,
    setDraft: text => { draft = text }, setAttachments: value => { attachments = value },
    getDraft: () => draft, getAttachments: () => attachments,
    restore() {
      controller.dispose()
      if (original.navigator === undefined) delete globalThis.navigator
      else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original.navigator })
      if (original.MediaRecorder === undefined) delete globalThis.MediaRecorder
      else globalThis.MediaRecorder = original.MediaRecorder
    },
  }
}

test('recording survives session switch; native submission includes screenshots and existing text', async () => {
  const fixture = setup()
  try {
    const { controller, input, tracks, sent, retained } = fixture
    fixture.setDraft('Explain these screenshots: ')
    fixture.setAttachments(['screenshot-one', 'screenshot-two'])
    await controller.start('session-a', input)
    await controller.start('session-b', input)
    assert.equal(tracks[0].stopped, false)
    assert.equal(controller.getSnapshot().sessionId, 'session-a')
    assert.equal(controller.getRecordingSession(), 'session-a')
    await controller.finish(true)
    assert.equal(controller.getRecordingSession(), null)
    assert.deepEqual(sent, [{ id: 'session-a', text: 'Explain these screenshots: spoken words', attachments: ['screenshot-one', 'screenshot-two'] }])
    assert.equal(retained[0].released, true)
    assert.equal(tracks[0].stopped, true)
  } finally { fixture.restore() }
})

test('failed native send retains screenshots and transcript for retry without duplication', async () => {
  const fixture = setup()
  try {
    fixture.setAttachments(['screenshot'])
    fixture.failures.push('offline')
    await fixture.controller.start('session-a', fixture.input)
    await fixture.controller.finish(true)
    assert.equal(fixture.controller.getSnapshot().phase, 'feedback')
    assert.equal(fixture.retained[0].released, false)
    assert.equal(fixture.getDraft(), 'spoken words')
    assert.deepEqual(fixture.getAttachments(), ['screenshot'])
    fixture.controller.retry()
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(fixture.drafts, ['spoken words'])
    assert.deepEqual(fixture.sent, [{ id: 'session-a', text: 'spoken words', attachments: ['screenshot'] }])
    assert.equal(fixture.controller.getSnapshot().phase, 'idle')
    assert.equal(fixture.retained[0].released, true)
  } finally { fixture.restore() }
})

test('an unfinished screenshot upload leaves the draft intact and shows retry instead of hanging', async () => {
  const fixture = setup()
  try {
    fixture.setAttachments(['uploading-file'])
    fixture.failures.push('upload')
    await fixture.controller.start('session-a', fixture.input)
    await fixture.controller.finish(true)
    assert.equal(fixture.controller.getSnapshot().phase, 'feedback')
    assert.equal(fixture.getDraft(), 'spoken words')
    assert.deepEqual(fixture.getAttachments(), ['uploading-file'])
    fixture.controller.retry()
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(fixture.sent, [{ id: 'session-a', text: 'spoken words', attachments: ['uploading-file'] }])
  } finally { fixture.restore() }
})

test('stop only inserts into original draft; changed draft can explicitly insert later', async () => {
  const fixture = setup()
  try {
    let changed = true
    fixture.input.insertText = text => { if (changed) return false; fixture.drafts.push(text); return true }
    await fixture.controller.start('session-a', fixture.input)
    await fixture.controller.finish(false)
    assert.equal(fixture.controller.getSnapshot().phase, 'feedback')
    changed = false
    fixture.controller.insert()
    assert.deepEqual(fixture.drafts, ['spoken words'])
    assert.equal(fixture.controller.getSnapshot().phase, 'idle')
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
