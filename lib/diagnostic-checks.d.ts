import type { CheckDefinition, DiagnosticCheck } from './diagnostic-types.js';
/** Adapters return bounded reason codes, never exceptions or raw service data. */
export declare function collectChecks(definitions: readonly CheckDefinition[], { timeoutMs, now, source, scope }?: {
    timeoutMs?: number;
    now?: () => number;
    source?: string;
    scope?: string;
}): Promise<DiagnosticCheck[]>;
export declare const diagnosticCapabilities: readonly string[];
