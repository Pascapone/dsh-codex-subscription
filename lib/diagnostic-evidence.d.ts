import type { OperationHistory, NetworkHistory, DiagnosticEvent } from './diagnostic-types.js';
export declare const EVIDENCE_WINDOW_MS: number;
export declare function diagnosticEvidence({ operations, history }: {
    operations?: OperationHistory;
    history?: NetworkHistory;
}, now: number): DiagnosticEvent[];
export declare function unresolvedFailures(events: readonly DiagnosticEvent[]): DiagnosticEvent[];
