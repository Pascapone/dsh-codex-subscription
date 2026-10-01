import type { WebSearchProvider } from '@deepseek-ai/dsh-web';
import type { AuthReaders } from './model-types.js';
interface SearchOptions extends AuthReaders {
    fetch?: typeof fetch;
    resolvePreferences?: () => Parameters<typeof readCapabilitySettings>[0];
    resolveModel?: () => unknown;
    resolveSessionId?: () => unknown;
}
interface AutoSearchOptions {
    codex: WebSearchProvider;
    resolveModelProvider?: () => unknown;
    resolveDshProvider?: () => WebSearchProvider | undefined;
}
import { readCapabilitySettings } from './capability-settings.js';
export declare const CODEX_SEARCH_PROVIDER_ID = "codex-subscription";
export declare const CODEX_AUTO_SEARCH_PROVIDER_ID = "codex-subscription-auto";
export declare const CODEX_SEARCH_URL = "https://chatgpt.com/backend-api/codex/alpha/search";
/** Create the DSH web provider backed only by the ChatGPT subscription search endpoint. */
export declare function createCodexSearchProvider(options: SearchOptions): WebSearchProvider;
/** Route each request by its initiating model without changing the user's explicit overrides. */
export declare function createCodexAutoSearchProvider(options: AutoSearchOptions): WebSearchProvider;
export {};
