import type { SpeedMode, OutputVerbosity, ContextMode } from './settings-types.js';
import type { NetworkOptions } from './network-types.js';
import type { CompactionBridge } from './compaction-types.js';
import type { createOfficialModelCatalog } from './model-catalog.js';
import type { createSubscriptionConnection } from './subscription-connection.js';
export interface SubscriptionProviderOptions {
    resolveSpeedMode?: (sessionId?: string) => SpeedMode | undefined;
    resolveOutputVerbosity?: () => OutputVerbosity;
    resolveContextMode?: () => ContextMode | undefined;
    resolveCustomContextWindow?: (modelKey?: string) => unknown;
    resolveRoute?: (request: {
        provider: 'openai-codex';
        model: string;
        sessionId?: string;
    }) => {
        ready?: boolean;
        baseUrl?: unknown;
    } | undefined;
    catalog?: ReturnType<typeof createOfficialModelCatalog>;
    connection?: ReturnType<typeof createSubscriptionConnection>;
    compaction?: CompactionBridge;
    runNetwork?: <T>(area: string, operation: () => T | Promise<T>, options?: NetworkOptions) => T | Promise<T>;
}
