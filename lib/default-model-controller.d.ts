import type { DefaultModelStatus } from './rpc-response-types.js';
import type { createSubscriptionRpcClient } from './rpc-contract.js';
type Snapshot = DefaultModelStatus & {
    status: 'loading' | 'ready' | 'error';
    saving: boolean;
    error: boolean;
};
/**
 * Read and update the DSH default model behind one settings control. The Host
 * owns the value, so a load always replaces the local projection; a rejected
 * write keeps the last known value and only raises the error flag.
 */
export declare function createDefaultModelController(rpc: Pick<ReturnType<typeof createSubscriptionRpcClient>, 'call'>): Readonly<{
    getSnapshot: () => Readonly<Snapshot>;
    subscribe: (listener: () => void) => () => boolean;
    load: () => Promise<void>;
    select: (model: string) => Promise<boolean>;
    dispose: () => void;
}>;
export {};
