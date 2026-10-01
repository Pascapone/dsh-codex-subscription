/**
 * Reconcile saved context values with the inputs currently shown in Settings.
 * A draft survives a catalog refresh while its saved value is unchanged. New
 * rows and rows whose saved value changed start from the new saved value.
 */
export declare function reconcileContextDrafts({ modelRows, drafts, previousSavedValues, savedValues }: {
    modelRows: readonly {
        key: string;
    }[];
    drafts?: Record<string, string>;
    previousSavedValues?: Record<string, string>;
    savedValues?: Record<string, unknown>;
}): Record<string, string>;
