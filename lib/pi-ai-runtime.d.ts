import type { Provider } from '@earendil-works/pi-ai';
import type { SubscriptionProviderOptions } from './runtime-types.js';
import { openaiCodexProvider as createOpenAICodexProvider } from '@earendil-works/pi-ai/providers/openai-codex';
export { createModels } from '@earendil-works/pi-ai';
export { createOpenAICodexProvider as openaiCodexProvider };
/**
 * Preserve pi-ai's native Codex OAuth provider while allowing DSH's generic
 * PiAiAdapter to pass the access token resolved by the host credential store.
 *
 * PiAiAdapter owns a request-local Models collection backed by the same DSH
 * credential store as this provider. A pure OAuth provider ignores its
 * `apiKey` request override and otherwise fails before dispatch with "Provider
 * is not configured". This non-interactive bridge teaches that collection how
 * to consume only the already-refreshed token for this request; login, refresh,
 * persistence, headers, transport, and model behavior remain owned by the
 * original provider.
 */
export declare function openaiCodexSubscriptionProvider({ resolveSpeedMode, resolveOutputVerbosity, resolveContextMode, resolveCustomContextWindow, resolveRoute, catalog, connection, compaction, runNetwork, }?: SubscriptionProviderOptions): Provider<'openai-codex-responses'>;
export declare const PI_AI_RUNTIME_VERSIONS: readonly string[];
