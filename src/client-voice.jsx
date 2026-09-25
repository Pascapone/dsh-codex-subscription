import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CHANNEL, unwrap } from './rpc-contract.js'
import { usePreferenceSnapshot } from './client-shared.js'

const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4']
// ponytail: 120-second capture caps in-memory audio; stream chunks if long dictation is needed.
const MAX_SECONDS = 120
const MAX_BYTES = 25 * 1024 * 1024

export function CodexVoiceInput({ sessionId, inputActions, onActiveChange, locked, preference, rpc, t }) {
  const { transcriptionEnabled } = usePreferenceSnapshot(preference)
  const [phase, setPhase] = useState('idle')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')
  const active = useRef(null)
  const generation = useRef(0)
  useLayoutEffect(() => { onActiveChange(phase !== 'idle' && transcriptionEnabled); return () => onActiveChange(false) }, [phase, transcriptionEnabled, onActiveChange])

  const release = recording => {
    clearInterval(recording.waveTimer)
    clearTimeout(recording.limitTimer)
    recording.stream?.getTracks().forEach(track => track.stop())
    if (recording.recorder?.state === 'recording') recording.recorder.stop()
    void recording.audioContext?.close().catch(() => {})
  }
  const cancel = (update = true) => {
    generation.current++
    const recording = active.current
    active.current = null
    if (recording) { recording.abort.abort(); release(recording) }
    if (update) { setPhase('idle'); setPending(''); setError('') }
  }
  useEffect(() => {
    if (!transcriptionEnabled) cancel()
    else setPhase('idle')
    const visibility = () => { if (document.hidden) cancel() }
    const escape = event => { if (event.key === 'Escape' && active.current) { event.preventDefault(); cancel() } }
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('visibilitychange', visibility); document.removeEventListener('keydown', escape); cancel(false) }
  }, [sessionId, transcriptionEnabled])

  const finish = async send => {
    const recording = active.current
    if (!recording || recording.recorder?.state !== 'recording') return
    const run = generation.current
    setPhase('transcribing')
    try {
      const recorder = recording.recorder
      recording.finishing = true
      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener('stop', resolve, { once: true })
        recorder.addEventListener('error', reject, { once: true })
      })
      recorder.stop()
      await stopped
      release(recording)
      recording.abort.signal.throwIfAborted()
      const blob = new Blob(recording.chunks, { type: recorder.mimeType })
      if (!blob.size) throw new Error(t('voiceEmpty'))
      if (blob.size > MAX_BYTES) throw new Error(t('voiceLarge'))
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ''
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
      const value = unwrap(await rpc.call(CHANNEL, 'transcription/transcribe', { audioBase64: btoa(binary), mimeType: blob.type }, recording.abort.signal))
      if (run !== generation.current) return
      if (!inputActions.insertText(value.text, recording.span)) {
        setPending(value.text)
        setError(t('voiceChanged'))
        setPhase('feedback')
      } else {
        active.current = null
        setPhase('idle')
        if (send) inputActions.submit()
      }
    } catch (failure) {
      if (run !== generation.current) return
      active.current = null
      release(recording)
      setError(failure?.message === 'ChatGPT subscription is not signed in' ? t('voiceSignedOut')
        : failure?.message === 'ChatGPT sign-in needs to be renewed' ? t('voiceRenew')
          : [t('voiceEmpty'), t('voiceLarge')].includes(failure?.message) ? failure.message : t('voiceFailed'))
      setPhase('idle')
    }
  }
  const start = async () => {
    if (locked || active.current) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError(t('voiceUnavailable')); return }
    const run = ++generation.current
    const recording = { abort: new AbortController(), span: inputActions.captureInsertion(), chunks: [] }
    active.current = recording
    setError(''); setPending(''); setPhase('permission')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (run !== generation.current) { stream.getTracks().forEach(track => track.stop()); return }
      recording.stream = stream
      const mimeType = MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recording.recorder = recorder
      recorder.ondataavailable = event => { if (event.data.size) recording.chunks.push(event.data) }
      recorder.onerror = () => { if (run === generation.current) { cancel(); setError(t('voiceFailed')) } }
      recorder.onstop = () => { if (run === generation.current && !recording.finishing) { cancel(); setError(t('voiceFailed')) } }
      if (typeof AudioContext !== 'undefined') {
        try {
          const context = new AudioContext()
          recording.audioContext = context
          const analyser = context.createAnalyser()
          analyser.fftSize = 256
          context.createMediaStreamSource(stream).connect(analyser)
          const samples = new Uint8Array(analyser.fftSize)
          recording.waveTimer = setInterval(() => {
            analyser.getByteTimeDomainData(samples)
            setLevel(Math.sqrt(samples.reduce((sum, sample) => sum + (sample - 128) ** 2, 0) / samples.length) / 64)
          }, 80)
        } catch { /* waveform remains idle; microphone capture still works */ }
      }
      recorder.start(250)
      recording.limitTimer = setTimeout(() => { void finish(false) }, MAX_SECONDS * 1000)
      setPhase('recording')
    } catch (failure) {
      if (run !== generation.current) return
      active.current = null
      release(recording)
      setPhase('idle')
      setError(failure?.name === 'NotAllowedError' ? t('voiceDenied') : t('voiceFailed'))
    }
  }
  if (!transcriptionEnabled) return null
  if (phase === 'idle') return <span className="codexVoiceTrigger"><button type="button" className="codexVoiceButton" disabled={locked} title={t('voiceStart')} aria-label={t('voiceStart')} onMouseDown={event => event.preventDefault()} onClick={() => { void start() }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4m-4 0h8"/></svg></button>{error && <span role="alert" className="codexVoiceError">{error}</span>}</span>
  return <div className="codexVoiceControls">
    <div className="codexVoiceWave" role="status" aria-label={t(phase === 'recording' ? 'voiceRecording' : phase === 'permission' ? 'voicePermission' : 'voiceTranscribing')}>
      {phase === 'feedback' ? <span>{error} <button type="button" onClick={() => { if (inputActions.insertText(pending, inputActions.captureInsertion())) cancel() }}>{t('voiceInsert')}</button></span>
        : phase === 'recording' ? Array.from({ length: 74 }, (_, i) => <i key={i} style={{ height: `${Math.max(2, 3 + Math.abs(Math.sin(i * 2.43)) * Math.min(25, level * 35))}px` }} />)
          : <span>{t(phase === 'permission' ? 'voicePermission' : 'voiceTranscribing')}</span>}
    </div>
    <button type="button" className="codexVoiceButton codexVoiceCancel" aria-label={t('voiceCancel')} title={t('voiceCancel')} onClick={() => cancel()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
    <span className="codexVoiceSpacer" />
    <button type="button" className="codexVoiceButton" disabled={phase !== 'recording'} aria-label={t('voiceStop')} title={t('voiceStop')} onClick={() => { void finish(false) }}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="3"/></svg></button>
    <button type="button" className="codexVoiceButton codexVoiceSend" disabled={phase !== 'recording'} aria-label={t('voiceSend')} title={t('voiceSend')} onClick={() => { void finish(true) }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button>
  </div>
}
