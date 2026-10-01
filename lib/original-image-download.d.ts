import type { createSubscriptionRpcClient } from './rpc-contract.js';
/** Keep only the destination and current chunk, while verifying every reply. */
export declare function readOriginalImage(rpc: Pick<ReturnType<typeof createSubscriptionRpcClient>, 'call'>, sessionId: string, input: unknown, { signal, onProgress }?: {
    signal?: AbortSignal;
    onProgress?: (progress: {
        loaded: number;
        total: number;
    }) => void;
}): Promise<Uint8Array<ArrayBuffer>>;
