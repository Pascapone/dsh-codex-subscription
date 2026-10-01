import type { ResetOptions, ResetResult } from './reset-types.js';
export declare const CODEX_RESET_CREDITS_URL = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";
export declare const CODEX_RESET_CONSUME_URL = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits/consume";
/**
 * Host-only reset redemption. The browser receives an opaque, short-lived
 * challenge; account ids, bearer tokens, credit ids, and idempotency keys stay
 * in memory on the host.
 */
export declare function createCodexResetCreditService(options: ResetOptions): Readonly<{
    inspect({ signal }?: {
        signal?: AbortSignal;
    }): Promise<{
        nextExpiresAt?: number | undefined;
        availableCount: number;
        credits: {
            expiresAt?: number | undefined;
            name?: string | undefined;
            ref: string;
        }[];
    }>;
    prepare({ creditRef, signal }?: {
        creditRef?: unknown;
        signal?: AbortSignal;
    }): Promise<{
        description?: string | undefined;
        title?: string | undefined;
        creditExpiresAt?: number | undefined;
        challengeId: string;
        availableCount: number;
        readyAt: number;
        expiresAt: number;
    }>;
    consume({ challengeId, acknowledged, signal }?: {
        challengeId?: unknown;
        acknowledged?: unknown;
        signal?: AbortSignal;
    }): Promise<ResetResult>;
    clear(): void;
}>;
