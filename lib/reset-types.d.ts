import type { AuthReaders } from './model-types.js';
export interface ResetCredit {
    creditId: string;
    title?: string;
    description?: string;
    creditExpiresAt?: number;
    index: number;
}
export interface ResetDetails {
    availableCount: number;
    credits: ResetCredit[];
}
export interface ResetResult {
    code: 'reset' | 'nothing_to_reset' | 'no_credit' | 'already_redeemed';
    windowsReset: string[];
    windowsResetCount?: number;
}
export interface ResetChallenge extends Omit<ResetCredit, 'index'> {
    state: 'prepared' | 'pending';
    accountId: string;
    creditRef?: unknown;
    redeemRequestId: string;
    readyAt: number;
    expiresAt: number;
    availableCount: number;
    uncertain: boolean;
}
export interface ResetOptions extends AuthReaders {
    usageReader: {
        clear(): void;
    };
    fetch?: typeof fetch;
    now?: () => number;
    randomUUID?: () => string;
    confirmDelayMs?: number;
    challengeTtlMs?: number;
    timeoutMs?: number;
}
export type ResetService = ReturnType<typeof import('./reset-credits.js').createCodexResetCreditService>;
