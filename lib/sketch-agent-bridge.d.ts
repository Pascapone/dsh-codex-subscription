import type { ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection';
export declare function createSketchAgentBridge({ enabled, now, timeoutMs }: {
    enabled: () => boolean;
    now?: () => number;
    timeoutMs?: number;
}): {
    rpc(endpoint: string, payload: unknown): Promise<ConnectionRpcResult<unknown>>;
    request(sessionId: string, request: unknown, signal?: AbortSignal): Promise<unknown>;
    dispose(): void;
};
