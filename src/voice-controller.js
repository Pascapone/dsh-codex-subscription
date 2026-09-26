import { CHANNEL, unwrap } from './rpc-contract.js'
import { appendWave, WAVE_FRAME_MS, WAVE_POINTS } from './voice-waveform.js'

const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4']
const MAX_BYTES = 25 * 1024 * 1024
const silentWave = () => Array(WAVE_POINTS).fill(0)

export function createVoiceController(sessions, rpc, t, conversation) {
  let state = { phase: 'idle', wave: silentWave(), elapsed: 0, error: '', sessionId: null, hasText: false, inserted: false }
  let active = null
  const listeners = new Set()
  const publish = patch => { state = { ...state, ...patch }; listeners.forEach(listener => listener()) }
  const releaseMedia = recording => {
    clearInterval(recording.waveTimer)
    recording.stream?.getTracks().forEach(track => track.stop())
    if (recording.recorder?.state === 'recording') recording.recorder.stop()
    void recording.audioContext?.close().catch(() => {})
  }
  const cancel = () => {
    const recording = active
    active = null
    if (recording) { recording.abort.abort(); releaseMedia(recording); recording.reference.release() }
    publish({ phase: 'idle', error: '', sessionId: null, hasText: false, inserted: false })
  }
  const fail = (recording, failure) => {
    if (active !== recording) return
    const message = failure?.message === 'ChatGPT subscription is not signed in' ? t('voiceSignedOut')
      : failure?.message === 'ChatGPT sign-in needs to be renewed' ? t('voiceRenew')
        : [t('voiceEmpty'), t('voiceLarge')].includes(failure?.message) ? failure.message : t('voiceFailed')
    publish({ phase: 'feedback', error: message })
  }
  const submitDraft = recording => new Promise((resolve, reject) => {
    const session = recording.reference.binding.session
    const input = conversation.input.for(recording.reference.binding.ctx)
    const initial = session.getSnapshot()
    const before = new Set(initial.pendingSubmissions.map(item => item.requestId))
    let requestId, done = false, unsubscribe = () => {}, unwatch = () => {}
    const abort = () => settle(new Error(t('voiceFailed')))
    const settle = error => {
      if (done) return
      done = true
      unsubscribe()
      unwatch()
      recording.abort.signal.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve()
    }
    const check = () => {
      const snapshot = session.getSnapshot()
      requestId ??= snapshot.pendingSubmissions.find(item => !before.has(item.requestId))?.requestId
      if (requestId && !snapshot.pendingSubmissions.some(item => item.requestId === requestId)) {
        queueMicrotask(() => {
          const failure = session.getSnapshot().promptError
          settle(failure ? new Error(failure.error.message) : null)
        })
      } else if (!requestId && snapshot.promptError && snapshot.promptError !== initial.promptError) {
        settle(new Error(snapshot.promptError.error.message))
      } else if (!requestId && input.state.getSnapshot().phase === 'plain' && input.state.getSnapshot().draft.includes(recording.text)) {
        // A local serialization/upload failure restores the draft without ever opening a Host submission.
        queueMicrotask(() => { if (!done && !requestId && input.state.getSnapshot().phase === 'plain' && input.state.getSnapshot().draft.includes(recording.text)) settle(new Error(t('voiceFailed'))) })
      }
    }
    unsubscribe = session.subscribe(check)
    unwatch = input.state.subscribe(check)
    recording.abort.signal.addEventListener('abort', abort, { once: true })
    try { recording.inputActions.submit(); check() } catch (error) { settle(error) }
  })
  const deliver = async recording => {
    if (active !== recording) return
    publish({ phase: 'transcribing', error: '' })
    try {
      if (!recording.text) {
        if (!recording.audio?.size) throw new Error(t('voiceEmpty'))
        if (recording.audio.size > MAX_BYTES) throw new Error(t('voiceLarge'))
        const bytes = new Uint8Array(await recording.audio.arrayBuffer())
        let binary = ''
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
        const value = unwrap(await rpc.call(CHANNEL, 'transcription/transcribe', { audioBase64: btoa(binary), mimeType: recording.audio.type }, recording.abort.signal))
        recording.text = value.text
        recording.audio = null
        publish({ hasText: true })
      }
      if (active !== recording) return
      if (!recording.inserted) {
        const span = recording.send ? recording.inputActions.captureInsertion() : recording.span
        if (!recording.inputActions.insertText(recording.text, span)) {
          publish({ phase: 'feedback', error: t('voiceChanged') })
          return
        }
        recording.inserted = true
        publish({ inserted: true })
      }
      if (recording.send) await submitDraft(recording)
      if (active === recording) cancel()
    } catch (failure) { fail(recording, failure) }
  }
  const finish = async send => {
    const recording = active
    if (!recording || state.phase !== 'recording') return
    recording.send = send
    publish({ phase: 'transcribing' })
    try {
      const recorder = recording.recorder
      recording.finishing = true
      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener('stop', resolve, { once: true })
        recorder.addEventListener('error', reject, { once: true })
      })
      recorder.stop()
      await stopped
      releaseMedia(recording)
      if (active !== recording) return
      recording.audio = new Blob(recording.chunks, { type: recorder.mimeType })
      recording.chunks = []
      await deliver(recording)
    } catch (failure) { releaseMedia(recording); fail(recording, failure) }
  }
  const start = async (sessionId, inputActions, locked = false) => {
    if (locked || active) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { publish({ error: t('voiceUnavailable') }); return }
    const recording = { abort: new AbortController(), sessionId, inputActions, span: inputActions.captureInsertion(), chunks: [] }
    try { recording.reference = sessions.retain(sessionId, { source: 'controllerOperation' }) }
    catch { publish({ error: t('voiceFailed') }); return }
    active = recording
    publish({ phase: 'permission', sessionId, error: '', elapsed: 0, wave: silentWave(), hasText: false, inserted: false })
    try {
      await recording.reference.ready
      if (active !== recording) return
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (active !== recording) { stream.getTracks().forEach(track => track.stop()); return }
      recording.stream = stream
      const mimeType = MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recording.recorder = recorder
      recorder.ondataavailable = event => { if (event.data.size) recording.chunks.push(event.data) }
      const interrupted = () => {
        if (active !== recording || recording.finishing) return
        recording.finishing = true
        releaseMedia(recording)
        recording.audio = new Blob(recording.chunks, { type: recorder.mimeType })
        recording.chunks = []
        fail(recording)
      }
      recorder.onerror = interrupted
      recorder.onstop = interrupted
      if (typeof AudioContext !== 'undefined') {
        try {
          const context = new AudioContext()
          recording.audioContext = context
          const analyser = context.createAnalyser()
          analyser.fftSize = 2048
          context.createMediaStreamSource(stream).connect(analyser)
          const samples = new Uint8Array(analyser.fftSize)
          let peak = 6
          recording.waveTimer = setInterval(() => {
            analyser.getByteTimeDomainData(samples)
            const rms = Math.sqrt(samples.reduce((sum, sample) => sum + (sample - 128) ** 2, 0) / samples.length)
            peak = Math.max(6, peak * 0.98, rms)
            publish({ wave: appendWave(state.wave, (rms - 1.5) / peak * 1.3), elapsed: Math.floor((performance.now() - recording.startedAt) / 1000) })
          }, WAVE_FRAME_MS)
        } catch { /* microphone capture works without visualization */ }
      }
      recorder.start(250)
      recording.startedAt = performance.now()
      publish({ phase: 'recording' })
    } catch (failure) {
      if (active !== recording) return
      const message = failure?.name === 'NotAllowedError' ? t('voiceDenied') : t('voiceFailed')
      cancel()
      publish({ error: message })
    }
  }
  const insert = () => {
    const recording = active
    if (!recording?.text) return
    if (recording.inserted || recording.inputActions.insertText(recording.text, recording.inputActions.captureInsertion())) cancel()
  }
  return {
    getSnapshot: () => state, getRecordingSession: () => state.phase === 'recording' ? state.sessionId : null,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    start, finish, cancel, insert, retry: () => { if (active) void deliver(active) },
    dispose: () => { cancel(); listeners.clear() },
  }
}
