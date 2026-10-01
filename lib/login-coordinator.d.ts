import type { AuthOperationOptions } from '@earendil-works/pi-ai';
import type { AuthService, LoginFlow, LoginMethod } from './auth-types.js';
/** Own one host-side login without exposing tokens to the browser client. */
export declare class CodexLoginCoordinator {
    #private;
    auth: AuthService;
    createId: () => string;
    constructor(auth: AuthService, options?: {
        createId?: () => string;
    });
    accountStatus(options?: AuthOperationOptions): Promise<import("./auth-types.js").AccountStatus>;
    supportState(): {
        phase: string;
    } | {
        failure?: string | undefined;
        method: LoginMethod;
        phase: import("./auth-types.js").LoginPhase;
    };
    start({ method, label }: {
        method: unknown;
        label?: unknown;
    }): Promise<LoginFlow>;
    read(id: unknown): LoginFlow;
    submit({ id, value }: {
        id: unknown;
        value: unknown;
    }): Promise<LoginFlow>;
    cancel(id: unknown): Promise<LoginFlow>;
    logout(options?: AuthOperationOptions): Promise<import("./auth-types.js").AccountStatus>;
    selectAccount(id: unknown): Promise<import("./auth-types.js").AccountStatus>;
    removeAccount(id: unknown): Promise<import("./auth-types.js").AccountStatus>;
}
/** Map the loopback-only DSH Connection channel onto the coordinator. */
export declare function createCodexRpcHandler(coordinator: CodexLoginCoordinator, options?: {
    openExternal?: (url: string) => Promise<void>;
}): (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<{
    ok: false;
    error: {
        code: string;
        message: string;
        details: {
            issues: never[];
        };
    };
} | {
    ok: true;
    value: import("./auth-types.js").AccountStatus;
} | {
    ok: true;
    value: LoginFlow;
}>;
export declare const createCodexAuthRpcHandler: typeof createCodexRpcHandler;
