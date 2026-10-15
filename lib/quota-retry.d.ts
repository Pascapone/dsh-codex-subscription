import type { Context } from '@deepseek-ai/cordis';
import type { LlmFailure } from '@deepseek-ai/dsh-llm';
import type { createCodexUsageReader } from './usage.js';
type Agent = NonNullable<ReturnType<Context['agents']['currentInitiator']>>;
type RetryPayload = {
    agent: Agent;
    turn: number;
    step: number;
    provider: string;
    failure: LlmFailure;
    signal?: AbortSignal;
};
type RetryAction = {
    kind: 'retry';
} | undefined;
type QuotaRetryHandler = ((payload: RetryPayload, next: () => Promise<RetryAction>) => Promise<RetryAction>) & {
    notifyAccountChanged(): void;
    notifyConfigurationChanged(): void;
};
declare function cancellableDelay(delayMs: number, signal?: AbortSignal): Promise<boolean>;
/**
 * Recover a Codex subscription RATE_LIMIT only when the backend confirms an
 * exhausted short quota window whose reset is close enough to wait out.
 *
 * The listener owns the authoritative wait from `/wham/usage` and publishes
 * the host's standard model-retry surface event so the turn shows the reason,
 * countdown, and normal turn cancellation affordance while it is parked.
 */
export declare function createCodexQuotaRetryHandler({ usageReader, provider, enabled, now, wait, maxWaitMs, resetMarginMs, }?: {
    usageReader?: Pick<ReturnType<typeof createCodexUsageReader>, 'read'> & {
        clearCache?(): unknown;
        clear?(): unknown;
    };
    provider?: string;
    enabled?: () => boolean;
    now?: () => number;
    wait?: typeof cancellableDelay;
    maxWaitMs?: number;
    resetMarginMs?: number;
}): QuotaRetryHandler;
export {};
