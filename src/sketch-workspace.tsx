import type { ComponentProps } from 'react';
import type { ComposerOpener } from './client-session-compat.js';
import type { CodexUiProps } from './client-types.js';
import type { SketchIncoming } from './sketch-studio.js';
export type SketchWorkspaceProps = Pick<ComponentProps<typeof SketchStudio>, 'attachSketch' | 'sessionId' | 'rpc' | 'sessionState'> & Pick<CodexUiProps, 'preference' | 't'> & { registerOpen(callback: ComposerOpener): () => void };
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { SketchStudio } from './sketch-studio.js'
export { SKETCH_CSS } from './sketch-styles.js'
export function SketchWorkspace({ preference, attachSketch, registerOpen, t, sessionId, rpc, sessionState }: SketchWorkspaceProps) {
  const settings = useSyncExternalStore(preference.subscribe, preference.getSnapshot)
  const [open, setOpen] = useState(false)
  const [incoming, setIncoming] = useState<SketchIncoming | null>(null)
  const opener = useRef<Element | null>(null)
  useEffect(() => registerOpen((mode = 'sketch', source = document.activeElement, file) => {
    opener.current = source
    if (mode === 'sketch') {if(file)setIncoming({file});setOpen(true)}
  }), [registerOpen])
  return <>
    <SketchStudio sessionState={sessionState} agentPreview={settings.imageSketchAgentPreview} agentEnabled={settings.imageSketchAgent} onOpen={() => { opener.current = document.activeElement; setOpen(true) }} sessionId={sessionId} rpc={rpc} incoming={incoming} open={open} onClose={() => { setOpen(false); (opener.current as HTMLElement | null)?.focus() }} attachSketch={attachSketch} enabled={settings.imageSketch && settings.imageEditing} t={t} />
  </>
}
