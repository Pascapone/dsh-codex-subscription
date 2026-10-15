import type { OperationHistory } from './diagnostic-types.js';
export declare function safeOperations(raw: OperationHistory | undefined): {
    scope: string;
    capacity: number;
    dropped: number;
    events: {
        capability: string;
        action: string;
        status: string;
        source: string;
        observedAt: number;
    }[];
} | undefined;
export declare function createDiagnosticOperations({ now }?: {
    now?: (() => number) | undefined;
}): {
    record: (action: string, status: string, source?: string) => void;
    wrap: <T extends {
        ok: boolean;
    }>(handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<T>) => (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<T>;
    tool: (exec: {
        name: string;
        signal?: AbortSignal;
    }, result: {
        isError?: boolean;
    }) => void;
    snapshot: () => {
        scope: string;
        capacity: number;
        dropped: number;
        events: {
            capability?: string;
            action: string;
            source: string;
            status: string;
            observedAt: number;
            sequence?: number;
        }[];
    };
};
