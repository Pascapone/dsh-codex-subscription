import type { HostConnectionHandle, ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection';
/** Exact routes stay inside DSH's authenticated /api bridge and body limit. */
export declare function registerSubscriptionTransport(connection: Pick<HostConnectionHandle, 'fetch'>, handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<ConnectionRpcResult<unknown>>): () => void;
