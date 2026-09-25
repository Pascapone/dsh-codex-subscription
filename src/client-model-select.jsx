import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { BoltIcon } from '@heroicons/react/16/solid'
import { IconCheckOutline16, IconChevronDownOutline14, IconChevronLeftOutline14, IconChevronRightOutline14, IconCloseOutline16 } from './client-primitives.js'
import { OUTPUT_VERBOSITY_DEFAULT, OUTPUT_VERBOSITY_FIELD, OUTPUT_VERBOSITY_HIGH, OUTPUT_VERBOSITY_LOW, OUTPUT_VERBOSITY_MEDIUM, SPEED_MODE_FAST, SPEED_MODE_FIELD, SPEED_MODE_STANDARD, supportsCodexFastMode } from './settings-contract.js'
import { fill, usePreferenceSnapshot } from './client-shared.js'
export function CodexModelSelect({ locked, available, directory, load, select, preference, t }) {
  const state = useSyncExternalStore(directory.subscribe, directory.getSnapshot)
  const preferenceSnapshot = usePreferenceSnapshot(preference)
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState('root')
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width:700px)').matches)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const backRef = useRef(null)
  const menuRef = useRef(null)
  const id = useId()
  const choices = useMemo(() => state.groups.flatMap(group => group.models.map(model => ({
    group,
    model,
    selection: {
      provider: group.id,
      model: model.id,
      ...(model.reasoning?.defaultEffort === undefined ? {} : { reasoningEffort: model.reasoning.defaultEffort }),
    },
  }))), [state.groups])
  const currentChoice = choices.find(choice => choice.selection.provider === state.current?.provider && choice.selection.model === state.current?.model)
  const reasoning = currentChoice?.model.reasoning
  const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort
  const effortLabel = reasoning === undefined
    ? undefined
    : effectiveEffort === undefined
      ? t('providerDefault')
      : reasoning.efforts.find(level => level.id === effectiveEffort)?.name ?? effectiveEffort
  const effortChoices = useMemo(() => reasoning === undefined ? [] : [
    ...(reasoning.defaultEffort === undefined ? [{ key: 'provider-default', effort: undefined, label: t('providerDefault') }] : []),
    ...reasoning.efforts.map(effort => ({
      key: `effort:${effort.id}`,
      effort: effort.id,
      label: effort.name,
      ...(effort.description === undefined ? {} : { description: effort.description }),
    })),
  ], [reasoning, t])
  const modelLabel = currentChoice?.model.name ?? t('selectModel')
  const speedSupported = state.current?.provider === 'openai-codex' && (preferenceSnapshot.fastModels?.includes(state.current?.model) ?? supportsCodexFastMode(state.current?.model))
  const speedWritable = preferenceSnapshot.status === 'ready' && preferenceSnapshot.writable === true
  const fast = speedSupported && preferenceSnapshot.speedMode === SPEED_MODE_FAST
  const verbositySupported = state.current?.provider === 'openai-codex' && preferenceSnapshot.verbosityModels.includes(state.current?.model)
  const verbosityWritable = preferenceSnapshot.status === 'ready' && preferenceSnapshot.writable === true
  const verbosityItems = [
    { id: OUTPUT_VERBOSITY_DEFAULT, label: t('verbosityDefault'), description: t('verbosityDefaultHint') },
    { id: OUTPUT_VERBOSITY_LOW, label: t('verbosityLow'), description: t('verbosityLowHint') },
    { id: OUTPUT_VERBOSITY_MEDIUM, label: t('verbosityMedium'), description: t('verbosityMediumHint') },
    { id: OUTPUT_VERBOSITY_HIGH, label: t('verbosityHigh'), description: t('verbosityHighHint') },
  ]
  const verbosityLabel = verbosityItems.find(item => item.id === preferenceSnapshot.outputVerbosity)?.label ?? t('verbosityDefault')
  const busy = state.status === 'selecting'

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
    const closeOutside = event => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setOpen(false)
        setPane('root')
        if (mobile) triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open, mobile])
  useEffect(() => {
    if (!speedSupported && pane === 'speed') setPane('root')
    if (!verbositySupported && pane === 'verbosity') setPane('root')
  }, [pane, speedSupported, verbositySupported])
  useEffect(() => {
    if (!open) return
    if (pane !== 'root') backRef.current?.focus()
    else if (mobile) menuRef.current?.querySelector('.codexModelSelectCell')?.focus()
  }, [open, pane, mobile])
  if (!available) return null

  const close = (restoreFocus = false) => {
    setOpen(false)
    setPane('root')
    if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus())
  }
  const settleSelection = accepted => {
    if (accepted) close(true)
  }
  const chooseModel = selection => {
    if (state.current?.provider === selection.provider && state.current.model === selection.model) {
      close(true)
      return
    }
    void select(selection).then(settleSelection)
  }
  const chooseEffort = effort => {
    if (state.current === null) return
    if (effectiveEffort === effort) {
      close(true)
      return
    }
    void select({
      provider: state.current.provider,
      model: state.current.model,
      ...(effort === undefined ? {} : { reasoningEffort: effort }),
    }).then(settleSelection)
  }
  const chooseSpeed = speedMode => {
    close(true)
    void preference.set({ [SPEED_MODE_FIELD]: speedMode })
  }
  const chooseVerbosity = outputVerbosity => {
    close(true)
    void preference.set({ [OUTPUT_VERBOSITY_FIELD]: outputVerbosity })
  }
  const option = ({ key, label, description, selected, disabled, onClick }) => <button
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
    requestAnimationFrame(() => menuRef.current?.querySelector(`[data-pane="${target}"]`)?.focus())
  }
  const cell = (target, label, value) => <button
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

  let submenu = null
  if (pane === 'model') {
    submenu = <div className="codexModelSelectPane">
      {state.status === 'loading' ? <div className="codexModelSelectStatus">{t('modelsLoading')}</div> : null}
      {state.error === null ? null : <div className="codexModelSelectError"><span>{fill(t('modelFailed'), { value: state.error })}</span><button className="codexModelSelectRetry" type="button" onClick={load}>{t('modelRetry')}</button></div>}
      {state.failures.map(failure => <div className="codexModelSelectWarning" key={failure.id}>{fill(t('groupFailed'), { name: failure.name, value: failure.message })}</div>)}
      <div className="codexModelSelectGroups scrollable">{state.groups.map(group => <section className="codexModelSelectGroup" role="group" aria-labelledby={`${id}-${group.id}`} key={group.id}>
        <div className="codexModelSelectGroupTitle" id={`${id}-${group.id}`}>{group.name}</div>
        {group.models.map(model => option({
          key: model.id,
          label: model.name,
          description: model.description,
          selected: state.current?.provider === group.id && state.current.model === model.id,
          disabled: busy,
          onClick: () => chooseModel({ provider: group.id, model: model.id }),
        }))}
      </section>)}</div>
      {state.status === 'ready' && choices.length === 0 ? <div className="codexModelSelectEmpty">{t('modelsEmpty')}</div> : null}
    </div>
  } else if (pane === 'effort') {
    submenu = <div className="codexModelSelectPane">
      {effortChoices.length === 0 ? <div className="codexModelSelectEmpty">{t('effortsEmpty')}</div> : effortChoices.map(level => option({
        key: level.key,
        label: level.label,
        description: level.description,
        selected: effectiveEffort === level.effort,
        disabled: busy,
        onClick: () => chooseEffort(level.effort),
      }))}
    </div>
  } else if (pane === 'speed') {
    submenu = <div className="codexModelSelectPane">
      {option({ key: SPEED_MODE_STANDARD, label: t('speedStandard'), description: t('speedStandardHint'), selected: !fast, disabled: !speedWritable, onClick: () => chooseSpeed(SPEED_MODE_STANDARD) })}
      {option({ key: SPEED_MODE_FAST, label: t('speedFast'), description: t(state.current?.model === 'gpt-6-astra' ? 'speedFastAstraHint' : 'speedFastHint'), selected: fast, disabled: !speedWritable, onClick: () => chooseSpeed(SPEED_MODE_FAST) })}
    </div>
  } else if (pane === 'verbosity') {
    submenu = <div className="codexModelSelectPane">
      {verbosityItems.map(item => option({ key: item.id, label: item.label, description: item.description, selected: preferenceSnapshot.outputVerbosity === item.id, disabled: !verbosityWritable, onClick: () => chooseVerbosity(item.id) }))}
    </div>
  }

  const paneTitle = { model: t('modelLabel'), effort: t('effortLabel'), speed: t('speedTitle'), verbosity: t('verbosityTitle') }[pane]
  const menu = open ? <div ref={menuRef} className="codexModelSelectMenu" id={`${id}-menu`} role="menu" aria-label={paneTitle ?? t('modelMenuAria')} aria-busy={state.status === 'loading' || busy}>
    {mobile && pane === 'root' ? <div className="codexModelSelectMobileHeader"><span>{t('modelLabel')}</span><button type="button" role="menuitem" aria-label={t('modelClose')} onClick={() => close(true)}><IconCloseOutline16 /></button></div> : null}
    {pane === 'root' ? <>
      {cell('model', t('modelLabel'), modelLabel)}
      {reasoning === undefined ? null : cell('effort', t('effortLabel'), effortLabel)}
      {speedSupported && cell('speed', t('speedTitle'), t(fast ? 'speedFast' : 'speedStandard'))}
      {verbositySupported && cell('verbosity', t('verbosityTitle'), verbosityLabel)}
    </> : <>
      <button ref={backRef} className="codexModelSelectBack" type="button" role="menuitem" onClick={backToRoot} aria-label={`${t('modelBack')}: ${paneTitle}`}><IconChevronLeftOutline14 />{paneTitle}</button>
      {submenu}
    </>}
  </div> : null
  return <div className="codexModelSelect" ref={rootRef} onKeyDown={event => {
    if (!open) return
    if (event.key === 'Tab' && mobile) {
      const buttons = [...menuRef.current.querySelectorAll('button:not(:disabled)')]
      const index = buttons.indexOf(document.activeElement)
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
      aria-label={modelLabel}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? `${id}-menu` : undefined}
      title={modelLabel}
      disabled={locked}
      onClick={() => open ? close() : (setPane('root'), setOpen(true), load())}
    >
      {fast && <BoltIcon className="codexModelSelectBolt" aria-hidden="true" />}
      <span className="codexModelSelectLabel">{modelLabel}</span>
      {effortLabel === undefined ? null : <span className="codexModelSelectEffort">{effortLabel}</span>}
      <IconChevronDownOutline14 className="codexModelSelectChevron" />
    </button>
    {mobile && open ? createPortal(<div className="codexModelSelectMobileLayer" role="dialog" aria-modal="true" aria-label={t('modelMenuAria')}>{menu}</div>, document.body) : menu}
  </div>
}

