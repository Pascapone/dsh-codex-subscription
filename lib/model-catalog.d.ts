import type { AuthOperationOptions } from '@earendil-works/pi-ai';
import type { CodexModel, RemoteModel, ModelCatalogOptions } from './model-types.js';
export declare const CODEX_MODELS_URL: string;
export declare function retirementNotice(value: unknown, now?: number, targetDisplayName?: unknown): {
    text: string;
    at: number;
    upgradeTo: string | undefined;
    dateText: string;
} | undefined;
/** Codex's dedicated approval reviewer when the account catalog advertises it. */
export declare const CODEX_REVIEW_MODEL = "codex-auto-review";
/**
 * Mirror Codex's reviewer selection: a parent model's override, else the
 * default reviewer, used only when the account catalog lists that slug (any
 * visibility), with low reasoning when the reviewer supports it.
 */
export declare function officialReviewModel(value: unknown, parentId?: string): {
    effort?: string | undefined;
    id: string;
} | undefined;
export declare function parseOfficialModelCatalog(value: unknown, now?: number): RemoteModel[];
export declare function addBundledCodexFallbacks(baseModels: readonly CodexModel[]): CodexModel[];
export declare function createOfficialModelCatalog(options?: ModelCatalogOptions): Readonly<{
    refresh: ({ signal }?: AuthOperationOptions) => Promise<boolean>;
    getModels: (fallback?: readonly CodexModel[]) => CodexModel[];
    basePrompt: (modelId: string) => string | undefined;
    metadata: (modelId: string | undefined) => RemoteModel | undefined;
    reviewModel: (parentId?: string) => {
        effort?: string | undefined;
        id: string;
    } | undefined;
    revision: () => number;
    capabilityGaps: () => {
        reasoning?: string[];
        inputs?: string[];
        speeds?: string[];
        model: string;
    }[];
    status: () => {
        source: string;
        refresh: "failed" | "idle" | "refreshing" | "ok";
    };
    clear(): void;
}>;
