export declare const toggleModelId: (draft: readonly string[], modelId: string) => string[];
/**
 * What to do with the draft after a render.
 * - adopt: nothing pending, follow the saved value
 * - wait: a change is pending but a write is still in flight
 * - save: send the draft
 * - settled: the pending change already equals the saved value
 */
export declare function draftStep({ dirty, writable, draft, saved }: {
    dirty: boolean;
    writable: boolean;
    draft: unknown;
    saved: unknown;
}): "adopt" | "wait" | "settled" | "save";
