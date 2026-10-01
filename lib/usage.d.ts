import type { CodexUsage, UsageSnapshot, UsageReaderOptions } from './model-types.js';
export declare const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
/** Reduce the provider payload to a browser-safe quota projection. */
export declare function parseCodexUsage(value: unknown): CodexUsage;
/**
 * Read quota through the same refreshable OAuth lifecycle used by model turns.
 * The browser receives only a parsed quota projection; bearer and account id
 * are request-local host values. Concurrent settings polls share one request.
 */
export declare function createCodexUsageReader(options: UsageReaderOptions): Readonly<{
    read({ force, signal }?: {
        force?: boolean;
        signal?: AbortSignal;
    }): Promise<UsageSnapshot>;
    clear(): void;
}>;
