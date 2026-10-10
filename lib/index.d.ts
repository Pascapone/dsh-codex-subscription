import type { Context } from '@deepseek-ai/cordis';
import type { Dict } from '@deepseek-ai/cosmokit';
import z from '@deepseek-ai/schemastery';
export declare const name = "codex-subscription";
export declare const inject: string[];
export { createSubscriptionRpcHandler } from './subscription-rpc.js';
export declare function createSearchProviderSwitcher(loader: Pick<Context['loader'], 'entries'>): Readonly<{
    dshProviderId: () => string;
    select(selection: unknown): Promise<void>;
}>;
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    [k: string]: z<string[], string[], "defined"> | z<boolean, boolean, "plain"> | z<string, string, "defined"> | z<"low" | "medium" | "high" | "xhigh" | "max" | "auto", "low" | "medium" | "high" | "xhigh" | "max" | "auto", "defined"> | z<Dict<"standard" | "fast" | "ultrafast", string>, Dict<"standard" | "fast" | "ultrafast", string>, "defined"> | z<Dict<number, string>, Dict<number, string>, "defined"> | z<"live" | "cached" | "disabled", "live" | "cached" | "disabled", "defined"> | z<number, number, "defined"> | z<"off" | "important" | "early" | "custom", "off" | "important" | "early" | "custom", "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    [k: string]: z<string[], string[], "defined"> | z<boolean, boolean, "plain"> | z<string, string, "defined"> | z<"low" | "medium" | "high" | "xhigh" | "max" | "auto", "low" | "medium" | "high" | "xhigh" | "max" | "auto", "defined"> | z<Dict<"standard" | "fast" | "ultrafast", string>, Dict<"standard" | "fast" | "ultrafast", string>, "defined"> | z<Dict<number, string>, Dict<number, string>, "defined"> | z<"live" | "cached" | "disabled", "live" | "cached" | "disabled", "defined"> | z<number, number, "defined"> | z<"off" | "important" | "early" | "custom", "off" | "important" | "early" | "custom", "defined">;
}>>, "plain">;
export declare function apply(ctx: Context, config?: Schemastery.TypeS<typeof Config>): void;
export { createCodexAuthService, DshOAuthCredentialStore } from './credential-store.js';
export { createSubscriptionDiagnostics } from './diagnostics.js';
export { normalizeContextMode, normalizeCustomContextWindow } from './settings-contract.js';
export { createDefaultModelController, DEFAULT_MODEL_PROVIDER } from './default-model.js';
export { assertCodexAuthUrl, commandForCodexAuthUrl, openCodexAuthUrl } from './external-url.js';
export { CodexLoginCoordinator, createCodexRpcHandler } from './login-coordinator.js';
export { CODEX_USAGE_URL, createCodexUsageReader, parseCodexUsage } from './usage.js';
export { CODEX_RESET_CONSUME_URL, CODEX_RESET_CREDITS_URL, createCodexResetCreditService, } from './reset-credits.js';
export { CODEX_IMAGE_GENERATION_URL, CODEX_IMAGE_TOOL_NAME, createCodexImageTool, decodeCodexPng, } from './codex-images.js';
