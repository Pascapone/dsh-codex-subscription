import type { DiagnosticReport } from './diagnostic-types.js';
export declare function compactDiagnostic(report: DiagnosticReport): {
    hostCollected?: boolean | undefined;
    platform: string | undefined;
    generatedAt: string | undefined;
    account: string | undefined;
    catalog: {
        source: string | undefined;
        refresh: string | undefined;
    } | undefined;
    configuration: Record<string, unknown> | undefined;
    findings: {
        failures?: {
            action: string;
            source: string;
            at: string;
        }[] | undefined;
        code: string;
        severity: string;
    }[];
    capabilities: {
        latest: string;
        id: string;
        reason: string;
    }[];
    pluginClient?: string | undefined;
    format: string;
    plugin: string | undefined;
    dsh: string | undefined;
};
