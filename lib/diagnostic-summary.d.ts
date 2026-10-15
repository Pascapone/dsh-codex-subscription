import type { DiagnosticReport, DiagnosticFinding } from './diagnostic-types.js';
export declare function diagnosticSummary(report: DiagnosticReport, now?: number): {
    scope: string;
    findings: DiagnosticFinding[];
    unverified: number;
};
