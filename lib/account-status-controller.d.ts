import type { ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection/client';
import type { AccountStatusView } from './auth-types.js';
import type { createSubscriptionRpcClient } from './rpc-contract.js';
type SubscriptionRpcClient = ReturnType<typeof createSubscriptionRpcClient>;
type AccountStatusErrorCode = 'credential-unavailable' | 'credential-malformed' | 'transport' | 'timeout' | 'unknown';
interface AccountStatusSnapshot {
    status: 'loading' | 'ready' | 'error';
    account?: AccountStatusView;
    error?: {
        code: AccountStatusErrorCode;
    };
    retrying: boolean;
}
export declare function classifyAccountStatusError(input: unknown): AccountStatusErrorCode;
/** Own the account-status request lifecycle independently from account actions. */
export declare function createAccountStatusController(rpc: SubscriptionRpcClient | undefined, options?: {
    request?: (signal: AbortSignal) => Promise<ConnectionRpcResult<unknown>>;
    setTimeout?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
    clearTimeout?: (timer: ReturnType<typeof setTimeout> | undefined) => void;
    timeoutMs?: number;
}): Readonly<{
    getSnapshot: () => AccountStatusSnapshot;
    subscribe(listener: () => void): () => boolean;
    load: () => Promise<AccountStatusView | undefined>;
    retry: () => Promise<AccountStatusView | undefined>;
    reload: () => Promise<AccountStatusView | undefined>;
    acceptAccount: (account: AccountStatusView) => boolean;
    dispose: () => void;
}>;
export {};
