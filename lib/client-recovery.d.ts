import type { createSubscriptionRpcClient } from './rpc-contract.js';
export declare function recoveryCall<const E extends string>(rpc: ReturnType<typeof createSubscriptionRpcClient>, endpoint: E, payload?: unknown, timeoutMs?: number): Promise<import("./rpc-response-types.js").RpcResponse<E>>;
export declare function clientDiagnostic(error: unknown, now?: number): {
    source: string;
    pluginVersion: string;
    generatedAt: string;
    serverDiagnostics: string;
    error: "unknown" | "credential-unavailable" | "credential-malformed" | "transport" | "timeout";
};
