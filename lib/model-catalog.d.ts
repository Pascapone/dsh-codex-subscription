import type { AuthOperationOptions } from '@earendil-works/pi-ai';
import type { CodexModel, RemoteModel, ModelCatalogOptions } from './model-types.js';
export declare const CODEX_MODELS_URL: string;
export declare function parseOfficialModelCatalog(value: unknown): RemoteModel[];
export declare function addBundledCodexFallbacks(baseModels: readonly CodexModel[]): CodexModel[];
export declare function createOfficialModelCatalog(options?: ModelCatalogOptions): Readonly<{
    refresh: ({ signal }?: AuthOperationOptions) => Promise<boolean>;
    getModels: (fallback: readonly CodexModel[]) => CodexModel[];
    metadata: (modelId: string | undefined) => RemoteModel | undefined;
    basePrompt: (modelId: string) => string | undefined;
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
