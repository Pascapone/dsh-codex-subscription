import type { NetworkHistory, OperationHistory } from './diagnostic-types.js';
import type { AuthService } from './auth-types.js';
import type { CodexLoginCoordinator } from './login-coordinator.js';
import type { CodexNetworkTransport, NetworkAttempt } from './network-types.js';
import type { createOfficialModelCatalog } from './model-catalog.js';
interface DiagnosticsOptions {
    auth: Pick<AuthService, 'status'>;
    preferences: {
        status(): Record<string, unknown>;
    };
    login?: ReturnType<CodexLoginCoordinator['supportState']>;
    network?: Pick<CodexNetworkTransport, 'snapshot' | 'history'>;
    modelCatalog?: Pick<ReturnType<typeof createOfficialModelCatalog>, 'status' | 'capabilityGaps'>;
    connection?: {
        snapshot(): Record<string, number>;
    };
    compaction?: {
        snapshot(): Record<string, number>;
    };
    review?: {
        reviewCounters(): Record<string, number>;
    };
    inspectionOptions?: Parameters<typeof collectChecks>[1];
    operations?: {
        snapshot(): OperationHistory;
    };
    runtimeManagement?: {
        status(): Promise<{
            installed: boolean;
            available: boolean;
            restartRequired: boolean;
        }>;
    };
    storage?: () => unknown;
    tools?: {
        get(name: string): unknown;
    };
}
import { collectChecks } from './diagnostic-checks.js';
/** Build a support report that deliberately excludes OAuth and account metadata. */
export declare function createSubscriptionDiagnostics({ auth, preferences, login, network, modelCatalog, connection, compaction, review, inspectionOptions, operations, runtimeManagement, storage, tools }: DiagnosticsOptions): Promise<{
    configuration: {
        writable?: boolean | undefined;
        searchProvider: unknown;
        speedMode: unknown;
        outputVerbosity?: string | undefined;
        contextMode: unknown;
        quickQuotaMode: unknown;
        autoQuotaRetry?: boolean | undefined;
    };
    issues: {
        code: string;
    }[];
    catalog?: {
        unsupported?: {
            model: string;
        }[] | undefined;
        source: string;
        refresh: "idle" | "refreshing" | "ok" | "failed";
    } | undefined;
    review?: Record<string, number> | undefined;
    compaction?: Record<string, number> | undefined;
    websocket?: Record<string, number> | undefined;
    operations?: OperationHistory | undefined;
    requestHistory?: NetworkHistory | undefined;
    schemaVersion: number;
    generatedAt: string;
    inspection: {
        schemaVersion: number;
        meaning: string;
        checks: import("./diagnostic-types.js").DiagnosticCheck[];
        capabilities: {
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
    };
    package: string;
    version: string;
    runtime: {
        dsh?: string | undefined;
        node: string;
        platform: NodeJS.Platform;
        arch: NodeJS.Architecture;
    };
    account: {
        status: string;
    };
    login: {
        phase: string;
    } | {
        failure?: string | undefined;
        method: import("./auth-types.js").LoginMethod;
        phase: import("./auth-types.js").LoginPhase;
    };
    requests: Record<string, NetworkAttempt>;
}>;
export {};
