/**
 * DSH owns the model a freshly created agent starts on. This module is the
 * subscription plugin's read/write surface over that service: the settings
 * surface edits the single live selection instead of keeping a second copy, so
 * what the user sees is exactly what the next conversation will use.
 */
export declare const DEFAULT_MODEL_PROVIDER = "openai-codex";
/** A rejected default-model request carrying its stable public reason. */
export declare class DefaultModelError extends Error {
    code: string;
    constructor(code: string, message: string);
}
export declare const validDefaultModelId: (value: unknown) => value is string;
/** Project a live selection onto the settings-safe shape; unknown values drop out. */
export declare function normalizeDefaultSelection(input: unknown): {
    provider: string | undefined;
    model: string | undefined;
    reasoningEffort: string | undefined;
};
/**
 * Sample the default-model service per call: the service can mount after this
 * plugin. A write verifies its own read-back, because a deployment without a
 * configuration editor ignores `saveSelection`; the user must see that instead
 * of a selection that will never apply.
 * @param resolveService - reads the optional DSH `agentDefaultModel` service.
 * @param listModels - optional account catalog used to reject unknown models.
 */
export declare function createDefaultModelController({ resolveService, listModels }?: {
    resolveService?: () => {
        currentSelection(): unknown;
        saveSelection(next: {
            provider: string;
            model: string;
            reasoningEffort?: string;
        }): Promise<void>;
    } | undefined;
    listModels?: () => readonly string[];
}): Readonly<{
    status: () => {
        provider?: string | undefined;
        model?: string | undefined;
        reasoningEffort?: string | undefined;
        available: boolean;
        managed: boolean;
    };
    select: (request: {
        model?: unknown;
    } | undefined) => Promise<{
        provider?: string | undefined;
        model?: string | undefined;
        reasoningEffort?: string | undefined;
        available: boolean;
        managed: boolean;
    }>;
}>;
