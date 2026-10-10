import type { DiagnosticCheck, OperationHistory, NetworkHistory } from './diagnostic-types.js';
export declare function capabilityCoverage({ account, preference, runtime, catalog, tools, storage, checks, operations, history, now }: {
    account: {
        status: string;
    };
    preference: Record<string, unknown>;
    runtime?: {
        installed?: boolean;
        restartRequired?: boolean;
    };
    catalog?: {
        source?: string;
    };
    tools?: Record<string, boolean>;
    storage?: {
        readable?: boolean;
    };
    checks: DiagnosticCheck[];
    operations?: OperationHistory;
    history?: NetworkHistory;
    now?: number;
}): {
    latest?: {
        action: string;
        source: string;
        status: string;
        observedAt: number;
    } | undefined;
    unresolved?: import("./diagnostic-types.js").DiagnosticEvent[] | undefined;
    checks: string[];
    execution: string;
    blockedBy?: string | undefined;
    id: string;
    readiness: string;
    reason: string;
}[];
