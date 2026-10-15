
import type { ModelSelectInjected } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { CodexUiProps } from './client-types.js';
import type { ReactNode } from 'react';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
type ModelSelection = Parameters<ModelSelectInjected['select']>[0];
type ModelProps = Omit<ModelSelectInjected, 'select'> & Pick<CodexUiProps, 'preference' | 'rpc' | 't'> & Pick<PropsRuntime<'conversation.input.model'>, 'useSession'> & { locked: boolean; sessionId: string; runtime?: boolean; select(selection: ModelSelection): Promise<boolean> };
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ArrowPathIcon, BoltIcon, CheckIcon as IconCheckOutline16, ChevronDownIcon as IconChevronDownOutline14, ChevronLeftIcon as IconChevronLeftOutline14, ChevronRightIcon as IconChevronRightOutline14, XMarkIcon as IconCloseOutline16 } from '@heroicons/react/16/solid'
import { CHANNEL, unwrap } from './rpc-contract.js'
import { OUTPUT_VERBOSITY_DEFAULT, OUTPUT_VERBOSITY_FIELD, OUTPUT_VERBOSITY_HIGH, OUTPUT_VERBOSITY_LOW, OUTPUT_VERBOSITY_MEDIUM, SPEED_MODE_FAST, SPEED_MODE_ULTRAFAST, SPEED_MODE_STANDARD, supportsCodexFastMode } from './settings-contract.js'
import { fill, usePreferenceSnapshot } from './client-shared.js'
export function CodexModelSelect({ locked, available, directory, load, select, preference, rpc, sessionId, useSession, runtime = false, t }: ModelProps) {
  const running = useSession(snapshot => snapshot.running)
  const state = useSyncExternalStore(directory.subscribe, directory.getSnapshot)
  const preferenceSnapshot = usePreferenceSnapshot(preference)
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<'root' | 'model' | 'verbosity'>('root')
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width:700px)').matches)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const [draftEffort, setDraftEffort] = useState<number | null>(null)
  const [confirmation, setConfirmation] = useState<{ sessionId: string; selection: ModelSelection; speedMode: 'standard' | 'fast'; expectedModel: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [queued, setQueued] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const groups = useMemo(() => state.groups.filter(group => group.id === 'openai-codex'), [state.groups])
  const choices = useMemo(() => groups.flatMap(group => group.models.map(model => ({
    group,
    model,
    selection: {
      provider: group.id,
      model: model.id,
      ...(model.reasoning?.defaultEffort === undefined ? {} : { reasoningEffort: model.reasoning.defaultEffort }),
    },
  }))), [groups])
  const visibleGroups = useMemo(() => {
    const hidden = new Set(preferenceSnapshot.disabledModels)
    return groups.map(group => ({ ...group, models: group.models.filter(model => !hidden.has(model.id)), allHidden: group.models.length > 0 && group.models.every(model => hidden.has(model.id)) }))
      .filter(group => group.models.length > 0 || group.allHidden)
  }, [groups, preferenceSnapshot.disabledModels])
  const currentChoice = choices.find(choice => choice.selection.provider === state.current?.provider && choice.selection.model === state.current?.model)
  const reasoning = currentChoice?.model.reasoning
  const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort
  const effortName = (id: string, fallback: string) => { const label = t(`effort_${id}`); return label === `effort_${id}` ? fallback : label }
  const effortLabel = reasoning === undefined
    ? undefined
    : effectiveEffort === undefined
      ? t('providerDefault')
      : effortName(effectiveEffort, reasoning.efforts.find(level => level.id === effectiveEffort)?.name ?? effectiveEffort)
  const effortChoices = useMemo<{ key: string; effort?: ModelSelection['reasoningEffort']; label: string; description?: string }[]>(() => reasoning === undefined ? [] : [
    ...(reasoning.defaultEffort === undefined ? [{ key: 'provider-default', effort: undefined, label: t('providerDefault') }] : []),
    ...reasoning.efforts.map(effort => ({
      key: `effort:${effort.id}`,
      effort: effort.id,
      label: effortName(effort.id, effort.name),
      ...(effort.description === undefined ? {} : { description: effort.description }),
    })),
  ], [reasoning, t])
  const modelLabel = currentChoice?.model.name ?? t('selectModel')
  const speedSupported = state.current?.provider === 'openai-codex' && (preferenceSnapshot.fastModels?.includes(state.current?.model) ?? supportsCodexFastMode(state.current?.model))
  const speedWritable = preferenceSnapshot.status === 'ready' && preferenceSnapshot.writable === true
  const ultrafastSupported = state.current?.provider === 'openai-codex' && preferenceSnapshot.ultrafastModels.includes(state.current.model)
  const ultrafast = ultrafastSupported && preferenceSnapshot.sessionSpeedModes?.[sessionId] === SPEED_MODE_ULTRAFAST
  const speedAvailable = speedSupported || ultrafastSupported
  const fast = speedSupported && preferenceSnapshot.sessionSpeedModes?.[sessionId] === SPEED_MODE_FAST
  const verbositySupported = state.current?.provider === 'openai-codex' && preferenceSnapshot.verbosityModels.includes(state.current?.model)
  const verbosityWritable = preferenceSnapshot.status === 'ready' && preferenceSnapshot.writable === true
  const verbosityItems = [
    { id: OUTPUT_VERBOSITY_DEFAULT, label: t('verbosityDefault'), description: t('verbosityDefaultHint') },
    { id: OUTPUT_VERBOSITY_LOW, label: t('verbosityLow'), description: t('verbosityLowHint') },
    { id: OUTPUT_VERBOSITY_MEDIUM, label: t('verbosityMedium'), description: t('verbosityMediumHint') },
    { id: OUTPUT_VERBOSITY_HIGH, label: t('verbosityHigh'), description: t('verbosityHighHint') },
  ]
  const verbosityLabel = verbosityItems.find(item => item.id === preferenceSnapshot.outputVerbosity)?.label ?? t('verbosityDefault')
  const busy = state.status === 'selecting' || saving
  const effortIndex = Math.max(0, effortChoices.findIndex(level => level.effort === effectiveEffort))
  const sliderIndex = draftEffort ?? effortIndex
  const sliderLabel = effortChoices[sliderIndex]?.label ?? effortLabel
  useEffect(() => { setDraftEffort(null) }, [effectiveEffort, state.current?.model])
  useEffect(() => { setOpen(false); setPane('root'); setConfirmation(null); setQueued(false); setRunError(null) }, [running, sessionId, available, preferenceSnapshot.runtimeOptions, state.current?.provider])
  useEffect(() => {
    if (!confirmation) return
    dialogRef.current?.showModal()
    return () => dialogRef.current?.close()
  }, [confirmation])

  useEffect(() => {
    if (available) load()
  }, [available, load])
  useEffect(() => {
    const query = window.matchMedia('(max-width:700px)')
    const update = () => setMobile(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!open) return undefined
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setPane('root')
        if (mobile) triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open, mobile])
  useEffect(() => {
    if (!verbositySupported && pane === 'verbosity') setPane('root')
  }, [pane, verbositySupported])
  useEffect(() => {
    if (!open) return
    if (pane !== 'root') backRef.current?.focus()
    else if (mobile) menuRef.current?.querySelector<HTMLButtonElement>('.codexEffortTitle')?.focus()
  }, [open, pane, mobile])
  if (!available || (runtime && (!running || !preferenceSnapshot.runtimeOptions || state.current?.provider !== 'openai-codex'))
    || (!runtime && running && preferenceSnapshot.runtimeOptions && state.current?.provider === 'openai-codex')) return null

  const close = (restoreFocus = false) => {
    setOpen(false)
    setPane('root')
    if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus())
  }
  const settleSelection = (accepted: boolean) => {
    if (accepted) close(true)
  }
  const chooseModel = (selection: ModelSelection) => {
    if (state.current?.provider === selection.provider && state.current.model === selection.model) {
      close(true)
      return
    }
    if (runtime) { setRunError(null); setConfirmation({ sessionId, selection, expectedModel: state.current!.model, speedMode: fast && (preferenceSnapshot.fastModels?.includes(selection.model) ?? supportsCodexFastMode(selection.model)) ? 'fast' : 'standard' }); return }
    void select(selection).then(settleSelection)
  }
  const chooseEffort = (effort: ModelSelection["reasoningEffort"]) => {
    if (state.current === null) return
    if (effectiveEffort === effort) { setDraftEffort(null); return }
    const selection = {
      provider: state.current.provider,
      model: state.current.model,
      ...(effort === undefined ? {} : { reasoningEffort: effort }),
    }
    if (runtime) { setRunError(null); setConfirmation({ sessionId, selection, expectedModel: state.current!.model, speedMode: fast ? 'fast' : 'standard' }); return }
    void select(selection).then(accepted => { if (accepted) setDraftEffort(null) })
  }
  const chooseSpeed = (speedMode: 'standard' | 'fast') => {
    if (runtime && state.current) { setRunError(null); setConfirmation({ sessionId, selection: state.current, expectedModel: state.current.model, speedMode }); return }
    void preference.setSpeed(sessionId, speedMode)
  }
  const confirmRun = async () => {
    if (!confirmation || confirmation.sessionId !== sessionId || !state.current || saving) return
    setSaving(true)
    setRunError(null)
    try {
      unwrap(await rpc.call(CHANNEL, 'run-options/apply', { sessionId: confirmation.sessionId, model: confirmation.selection.model,
        ...(confirmation.selection.reasoningEffort === undefined ? {} : { reasoningEffort: confirmation.selection.reasoningEffort }),
        speedMode: confirmation.speedMode, expectedModel: confirmation.expectedModel, confirmed: true,
      }))
      setConfirmation(null)
      setDraftEffort(null)
      setQueued(true)
      close(true)
    } catch (error) { setRunError(error instanceof Error ? error.message : t('preferenceFailed')) }
    finally { setSaving(false) }
  }
  const chooseVerbosity = (outputVerbosity: string) => {
    close(true)
    void preference.set({ [OUTPUT_VERBOSITY_FIELD]: outputVerbosity })
  }
  const option = ({ key, label, description, selected, disabled, onClick }: { key: string; label: string; description?: string; selected: boolean; disabled: boolean; onClick(): void }) => <button
    key={key}
    type="button"
    role="menuitemradio"
    aria-checked={selected}
    className="codexModelSelectOption"
    disabled={disabled}
    onClick={onClick}
  >
    <span className="codexModelSelectOptionCopy"><span className="codexModelSelectOptionName">{label}</span>{description === undefined ? null : <span className="codexModelSelectOptionDescription">{description}</span>}</span>
    <span className="codexModelSelectCheck">{selected ? <IconCheckOutline16 /> : null}</span>
  </button>
  const backToRoot = () => {
    const target = pane
    setPane('root')
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>(`[data-pane="${target}"]`)?.focus())
  }
  const cell = (target: 'verbosity', label: ReactNode, value: ReactNode) => <button
    type="button"
    role="menuitem"
    className="codexModelSelectCell"
    data-pane={target}
    aria-haspopup="menu"
    onClick={() => setPane(target)}
  >
    <span className="codexModelSelectCellLabel">{label}</span>
    <span className="codexModelSelectCellValue">{value}</span>
    <IconChevronRightOutline14 className="codexModelSelectCellChevron" />
  </button>

  let submenu: ReactNode = null
  if (pane === 'model') {
    submenu = <div className="codexModelSelectPane">
      {state.status === 'loading' ? <div className="codexModelSelectStatus">{t('modelsLoading')}</div> : null}
      {state.error === null ? null : <div className="codexModelSelectError"><span>{fill(t('modelFailed'), { value: state.error })}</span><button className="codexModelSelectRetry" type="button" onClick={load}>{t('modelRetry')}</button></div>}
      {state.failures.filter(failure => failure.id === 'openai-codex').map(failure => <div className="codexModelSelectWarning" key={failure.id}>{fill(t('groupFailed'), { name: failure.name, value: failure.message })}</div>)}
      <div className="codexModelSelectGroups scrollable">{visibleGroups.map(group => <section className="codexModelSelectGroup" role="group" aria-labelledby={`${id}-${group.id}`} key={group.id}>
        <div className="codexModelSelectGroupTitle" id={`${id}-${group.id}`}>{group.name}</div>
        {group.allHidden === true ? <div className="codexModelSelectEmpty">{t('modelsHidden')}</div> : null}
        {group.models.map(model => option({
          key: model.id,
          label: model.name,
          description: model.description,
          selected: state.current?.provider === group.id && state.current.model === model.id,
          disabled: busy,
          onClick: () => chooseModel(choices.find(choice => choice.model.id === model.id)!.selection),
        }))}
      </section>)}</div>
      {state.status === 'ready' && visibleGroups.length === 0 ? <div className="codexModelSelectEmpty">{t(choices.length === 0 ? 'modelsEmpty' : 'modelsHidden')}</div> : null}
    </div>
  } else if (pane === 'verbosity') {
    submenu = <div className="codexModelSelectPane">
      {verbosityItems.map(item => option({ key: item.id, label: item.label, description: item.description, selected: preferenceSnapshot.outputVerbosity === item.id, disabled: !verbosityWritable, onClick: () => chooseVerbosity(item.id) }))}
    </div>
  }

  const paneTitle = pane === 'model' ? t('modelLabel') : pane === 'verbosity' ? t('verbosityTitle') : undefined
  const menu = open ? <div ref={menuRef} className="codexModelSelectMenu" data-runtime={runtime || undefined} id={`${id}-menu`} role={pane === 'root' ? 'dialog' : 'menu'} aria-label={paneTitle ?? t(runtime ? 'runOptions' : 'modelMenuAria')} aria-busy={state.status === 'loading' || busy}>
    {mobile && pane === 'root' ? <div className="codexModelSelectMobileHeader"><span>{t('modelLabel')}</span><button type="button" role="menuitem" aria-label={t('modelClose')} onClick={() => close(true)}><IconCloseOutline16 /></button></div> : null}
    {pane === 'root' ? <>
      <div className="codexEffortCard" data-runtime={runtime || undefined}>
        <div className="codexEffortHead">
          <button type="button" className="codexEffortFast" role="switch" aria-checked={fast} aria-label={t('speedTitle')} title={t(fast ? 'speedFastHint' : 'speedStandardHint')} disabled={!speedSupported || !speedWritable || busy || (!runtime && running)} onClick={() => chooseSpeed(fast ? 'standard' : 'fast')}><BoltIcon aria-hidden="true" /></button>
          <button type="button" className="codexEffortTitle" data-pane="model" onClick={() => setPane('model')} aria-label={`${t('modelLabel')}: ${modelLabel}; ${t('effortLabel')}: ${sliderLabel ?? t('providerDefault')}`}>
            <strong>{sliderLabel ?? t('providerDefault')}</strong><span>{modelLabel}<IconChevronRightOutline14 /></span>
          </button>
          <button type="button" className="codexEffortReset" aria-label={t('effortReset')} title={t('effortReset')} disabled={busy || !currentChoice || (!runtime && running)} onClick={() => chooseEffort(reasoning?.defaultEffort)}><ArrowPathIcon aria-hidden="true" /></button>
        </div>
        <div className="codexEffortTrack">
          <input type="range" className="codexEffortRange" min={0} max={Math.max(0, effortChoices.length - 1)} step={1} value={sliderIndex} aria-label={t('effortLabel')} aria-valuetext={sliderLabel ?? t('providerDefault')} disabled={busy || effortChoices.length < 2 || (!runtime && running)}
            style={{ background: `linear-gradient(to right, var(--codex-effort-accent) ${effortChoices.length > 1 ? sliderIndex / (effortChoices.length - 1) * 100 : 0}%, var(--dsw-alias-state-idle-primary) 0)` }}
            onChange={event => setDraftEffort(Number(event.currentTarget.value))}
            onPointerCancel={() => setDraftEffort(null)}
            onPointerUp={event => chooseEffort(effortChoices[Number(event.currentTarget.value)]?.effort)}
            onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) chooseEffort(effortChoices[Number(event.currentTarget.value)]?.effort) }} />
          <div className="codexEffortDots" aria-hidden="true">{effortChoices.map(level => <i key={level.key} />)}</div>
        </div>
        {runtime ? <span className="codexEffortRunHint">{t('runOptions')}</span> : null}
      </div>
      {ultrafastSupported && !runtime ? <button type="button" className="codexModelSelectCell" role="switch" aria-checked={ultrafast} disabled={!speedWritable || busy || running} onClick={() => { void preference.setSpeed(sessionId, ultrafast ? SPEED_MODE_STANDARD : SPEED_MODE_ULTRAFAST) }}>{t('speedUltrafast')}</button> : null}
      {verbositySupported && !runtime && cell('verbosity', t('verbosityTitle'), verbosityLabel)}
      {state.error || preferenceSnapshot.error ? <div className="codexModelSelectError" role="alert"><span>{state.error ?? t('preferenceFailed')}</span><button className="codexModelSelectRetry" type="button" onClick={load}>{t('modelRetry')}</button></div> : null}
    </> : <>
      <button ref={backRef} className="codexModelSelectBack" type="button" role="menuitem" onClick={backToRoot} aria-label={`${t('modelBack')}: ${paneTitle}`}><IconChevronLeftOutline14 />{paneTitle}</button>
      {submenu}
    </>}
  </div> : null
  return <div className="codexModelSelect" data-runtime={runtime || undefined} ref={rootRef} onKeyDown={event => {
    if (!open || confirmation) return
    if (event.key === 'Tab' && mobile) {
      const buttons = [...menuRef.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')]
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      if (event.shiftKey && index <= 0) { event.preventDefault(); buttons.at(-1)?.focus() }
      else if (!event.shiftKey && index === buttons.length - 1) { event.preventDefault(); buttons[0]?.focus() }
    }
    if (event.key !== 'Escape') return
    event.preventDefault()
    if (pane === 'root') close(true)
    else backToRoot()
  }}>
    <button
      ref={triggerRef}
      type="button"
      className="codexModelSelectTrigger"
      aria-label={runtime ? `${t('runOptions')}: ${modelLabel}` : modelLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? `${id}-menu` : undefined}
      title={modelLabel}
      disabled={runtime ? busy || !speedWritable : locked || running || busy}
      onClick={() => open ? close() : (setPane('root'), setOpen(true), load())}
    >
      {(fast || ultrafast) && <BoltIcon className="codexModelSelectBolt" aria-hidden="true" />}
      <span className="codexModelSelectLabel">{modelLabel}</span>
      {effortLabel === undefined ? null : <span className="codexModelSelectEffort">{effortLabel}</span>}
      <IconChevronDownOutline14 className="codexModelSelectChevron" />
    </button>
    {mobile && open ? createPortal(<div className="codexModelSelectMobileLayer" role="dialog" aria-modal="true" aria-label={t(runtime ? 'runOptions' : 'modelMenuAria')}>{menu}</div>, document.body) : menu}
    {queued ? <span className="codexVoiceAnnouncement" role="status">{t('runQueued')}</span> : null}
    {confirmation ? <dialog ref={dialogRef} className="codexRunConfirm" aria-labelledby={`${id}-confirm`} aria-describedby={`${id}-confirm-hint`} onCancel={event => { if (saving) event.preventDefault(); else { setConfirmation(null); setDraftEffort(null) } }}>
      <h3 id={`${id}-confirm`}>{t('runConfirmTitle')}</h3>
      <p id={`${id}-confirm-hint`}>{t('runConfirmHint')}</p>
      <dl><dt>{t('modelLabel')}</dt><dd>{choices.find(choice => choice.model.id === confirmation.selection.model)?.model.name ?? confirmation.selection.model}</dd>
        <dt>{t('effortLabel')}</dt><dd>{confirmation.selection.reasoningEffort === undefined ? t('providerDefault') : effortName(confirmation.selection.reasoningEffort, confirmation.selection.reasoningEffort)}</dd>
        <dt>{t('speedTitle')}</dt><dd>{t(confirmation.speedMode === 'fast' ? 'speedFast' : 'speedStandard')}</dd></dl>
      {confirmation.speedMode === 'fast' ? <p>{t('speedFastHint')}</p> : null}
      {runError ? <p role="alert">{fill(t('runFailed'), { value: runError })}</p> : null}
      <div className="codexRunConfirmActions"><button type="button" autoFocus disabled={saving} onClick={() => { setConfirmation(null); setDraftEffort(null) }}>{t('cancel')}</button><button type="button" disabled={saving} onClick={() => { void confirmRun() }}>{t(saving ? 'runSaving' : 'runConfirm')}</button></div>
    </dialog> : null}
  </div>
}
