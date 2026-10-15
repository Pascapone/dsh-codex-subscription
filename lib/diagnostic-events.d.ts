/** Process-local bounded evidence. No bodies, URLs, exception strings or identities. */
export declare function createDiagnosticEvents({ limit, now }?: {
    limit?: number | undefined;
    now?: (() => number) | undefined;
}): {
    record(area: string, value: {
        status: string;
        code?: string;
        httpStatus?: number;
    }): void;
    snapshot: () => {
        scope: string;
        capacity: number;
        dropped: number;
        events: {
            area: string;
            status: string;
            observedAt: number;
            sequence: number;
            code?: string;
            httpStatus?: number;
        }[];
    };
};
