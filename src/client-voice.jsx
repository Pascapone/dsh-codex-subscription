import { useLayoutEffect, useSyncExternalStore } from 'react'
import { usePreferenceSnapshot } from './client-shared.js'

export function CodexVoiceInput({ sessionId, inputActions, onActiveChange, locked, preference, voice, t }) {
  const { transcriptionEnabled } = usePreferenceSnapshot(preference)
  const { phase, wave, elapsed, error, hasText } = useSyncExternalStore(voice.subscribe, voice.getSnapshot)
  useLayoutEffect(() => { onActiveChange(phase !== 'idle' && transcriptionEnabled); return () => onActiveChange(false) }, [phase, transcriptionEnabled, onActiveChange])
  if (!transcriptionEnabled) return null
  if (phase === 'idle') return <span className="codexVoiceTrigger"><button type="button" className="codexVoiceButton" disabled={locked} title={t('voiceStart')} aria-label={t('voiceStart')} onMouseDown={event => event.preventDefault()} onClick={() => { void voice.start(sessionId, inputActions, locked) }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4m-4 0h8"/></svg></button>{error && <span role="alert" className="codexVoiceError">{error}</span>}</span>
  return <div className="codexVoiceControls">
    <div className="codexVoiceWave" role="status" aria-label={phase === 'feedback' ? error : t(phase === 'recording' ? 'voiceRecording' : phase === 'permission' ? 'voicePermission' : 'voiceTranscribing')}>
      {phase === 'feedback' ? <span className="codexVoiceFeedback"><span>{error}</span><button type="button" onClick={voice.retry}>{t('voiceRetry')}</button>{hasText && <button type="button" onClick={voice.insert}>{t('voiceInsert')}</button>}</span>
        : phase === 'recording' ? <>
          <span className="codexVoiceLive" aria-hidden="true"><i /></span>
          <div className="codexVoiceTrace" aria-hidden="true">{wave.map((amplitude, i) => <i key={i} style={{ height: `${Math.round(3 + amplitude * 33)}px`, opacity: 0.35 + amplitude * 0.65 }} />)}</div>
          <span className="codexVoiceTime" aria-hidden="true">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
        </> : <span>{t(phase === 'permission' ? 'voicePermission' : 'voiceTranscribing')}</span>}
    </div>
    <button type="button" className="codexVoiceButton codexVoiceCancel" aria-label={t('voiceCancel')} title={t('voiceCancel')} onClick={voice.cancel}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
    <span className="codexVoiceSpacer" />
    <button type="button" className="codexVoiceButton" disabled={phase !== 'recording'} aria-label={t('voiceStop')} title={t('voiceStop')} onClick={() => { void voice.finish(false) }}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="3"/></svg></button>
    <button type="button" className="codexVoiceButton codexVoiceSend" disabled={phase !== 'recording'} aria-label={t('voiceSend')} title={t('voiceSend')} onClick={() => { void voice.finish(true) }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button>
  </div>
}
