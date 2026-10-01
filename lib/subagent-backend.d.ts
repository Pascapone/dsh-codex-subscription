import type { Context, Fiber } from '@deepseek-ai/cordis';
import type { SubagentProvider, SubagentStartRequest } from '@deepseek-ai/dsh-subagent';
import type { SandboxPolicyService } from '@deepseek-ai/dsh-sandbox-policy';
import type { loadSubagentRuntime } from './subagent-runtime.js';
type TokenOptions = Parameters<typeof createSubagentTokens>[0];
type ProviderContext = {
    subprocess: Pick<Context['subprocess'], 'spawn'>;
    sandboxPolicy: Pick<SandboxPolicyService, 'resolve'>;
    logger?: Pick<Context['logger'], 'warn'>;
};
type ThreadParent = Pick<SubagentStartRequest['parent'], 'options'> & {
    session: Partial<Pick<SubagentStartRequest['parent']['session'], 'requestHeader'>>;
};
type Runtime = Awaited<ReturnType<typeof loadSubagentRuntime>>;
export type SubagentThreadPolicy = {
    model: string;
    modelProvider: 'openai';
    approvalPolicy: 'never';
    sandbox: ReturnType<SandboxPolicyService['resolve']>['mode'];
    config: {
        model_reasoning_effort?: NonNullable<SubagentStartRequest['agentOptions']>['reasoningEffort'];
    };
};
interface SubscriptionSubagentOptions {
    ctx: ProviderContext;
    nativeHome: string;
    resolveAuth: TokenOptions['resolveAuth'];
    store: TokenOptions['store'];
    refresh: TokenOptions['refresh'];
    loadRuntime(): Promise<Runtime>;
    maintenance?: () => boolean;
}
type ToolConfig = Record<string, unknown>;
type SwitchFiber = Pick<Fiber, 'update'> & {
    entry?: SwitchEntry;
    config: ToolConfig;
};
interface SwitchEntry {
    options?: {
        name?: string;
        config?: ToolConfig;
    };
    fiber?: SwitchFiber;
}
interface SwitcherOptions {
    entries(): Iterable<SwitchEntry>;
    prepare(): Promise<unknown>;
    persist?: (mode: string) => Promise<unknown>;
}
import { createSubagentTokens } from './subagent-auth.js';
export declare const SUBAGENT_BACKEND_FIELD = "subagentBackend";
export declare const SUBAGENT_PROVIDER = "codex-subscription-subagent";
export declare function subagentThreadPolicy(parent: ThreadParent, policy: Pick<ReturnType<SandboxPolicyService['resolve']>, 'mode'> | undefined, requested?: NonNullable<SubagentStartRequest['agentOptions']>): SubagentThreadPolicy;
/** Reuse the official DSH process/turn provider; keep only subscription auth here. */
export declare function createSubscriptionSubagent({ ctx, nativeHome, resolveAuth, store, refresh, loadRuntime, maintenance }: SubscriptionSubagentOptions): {
    provider: SubagentProvider;
    activeCount: () => number;
    prepare: () => Promise<{
        official: typeof import("@deepseek-ai/dsh-subagent-codex");
        Transport: typeof import("@deepseek-ai/dsh-sdk-protocol").JsonRpcLineTransport;
    }>;
    dispose(): void;
};
/** Change only standard independent spawn tools; leave fork/custom tools untouched. */
export declare function createSubagentBackendSwitcher({ entries, prepare, persist }: SwitcherOptions): {
    select: (mode: string) => Promise<void>;
    configure: (fiber: SwitchFiber, config: ToolConfig) => ToolConfig | {
        provider: string;
        modelSelectionSettings: boolean;
        backgroundMode: string;
        maxDepth: string;
    };
    dispose(): Promise<void>;
};
export { loadSubagentRuntime } from './subagent-runtime.js';
