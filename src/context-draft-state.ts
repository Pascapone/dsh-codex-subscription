const hasOwn = (value: unknown, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value ?? {}, key)

/**
 * Reconcile saved context values with the inputs currently shown in Settings.
 * A draft survives a catalog refresh while its saved value is unchanged. New
 * rows and rows whose saved value changed start from the new saved value.
 */
export function reconcileContextDrafts({ modelRows, drafts, previousSavedValues, savedValues }: { modelRows: readonly { key: string }[]; drafts?: Record<string, string>; previousSavedValues?: Record<string, string>; savedValues?: Record<string, unknown> }) {
  const next: Record<string, string> = {}
  for (const model of modelRows) {
    const key = model.key
    const saved = String(savedValues?.[key] ?? '')
    const keepDraft = hasOwn(previousSavedValues, key)
      && previousSavedValues![key] === saved
      && hasOwn(drafts, key)
    next[key] = keepDraft ? drafts![key] : saved
  }
  return next
}
