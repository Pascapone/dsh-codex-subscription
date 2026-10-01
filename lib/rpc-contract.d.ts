import type { ClientConnectionRpc, ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection/client';
import type { RpcResponse } from './rpc-response-types.js';
export declare const CHANNEL = "/codex-subscription";
export declare const RPC_ENDPOINTS: readonly string[];
export declare function createSubscriptionRpcClient(transport: Pick<ClientConnectionRpc, 'call'>): Readonly<{
    call<const E extends string>(channel: string, endpoint: E, payload: unknown, signal?: AbortSignal): Promise<ConnectionRpcResult<RpcResponse<E>>>;
}>;
export declare function unwrap<T>(response: ConnectionRpcResult<T> | null | undefined): T;
