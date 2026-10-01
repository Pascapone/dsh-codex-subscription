import type { CodexUiProps, Translate } from './client-types.js';
import type { PublicResetCredit } from './rpc-response-types.js';
export declare function ResetTime({ resetsAt, t }: {
    resetsAt?: number;
    t: Translate;
}): import("react/jsx-runtime").JSX.Element;
export declare function ResetCreditExpiry({ expiresAt, t }: {
    expiresAt?: number;
    t: Translate;
}): import("react/jsx-runtime").JSX.Element;
export declare function ResetCreditList({ rpc, t, count, nextExpiresAt, initialCredits, refreshKey, hasExhaustedQuota, onConsumed }: Pick<CodexUiProps, 'rpc' | 't'> & {
    count: number;
    nextExpiresAt?: number;
    initialCredits?: PublicResetCredit[];
    refreshKey: string;
    hasExhaustedQuota: boolean;
    onConsumed(): void;
}): import("react/jsx-runtime").JSX.Element;
export declare function ResetCreditControl({ rpc, t, credit, hasExhaustedQuota, onConsumed }: Pick<CodexUiProps, 'rpc' | 't'> & {
    credit: PublicResetCredit;
    hasExhaustedQuota: boolean;
    onConsumed(): void;
}): import("react/jsx-runtime").JSX.Element;
export declare function resetCreditErrorText(error: unknown, t: Translate): string;
export declare function UsageCard({ rpc, t, signedIn, resetKey, preference }: Pick<CodexUiProps, 'rpc' | 't' | 'preference'> & {
    signedIn: boolean;
    resetKey: number;
}): import("react/jsx-runtime").JSX.Element;
