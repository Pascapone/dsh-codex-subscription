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
    network?: Pick<CodexNetworkTransport, 'snapshot'>;
    modelCatalog?: Pick<ReturnType<typeof createOfficialModelCatalog>, 'status' | 'capabilityGaps'>;
}
/** Build a support report that deliberately excludes OAuth and account metadata. */
export declare function createSubscriptionDiagnostics({ auth, preferences, login, network, modelCatalog }: DiagnosticsOptions): Promise<{
    configuration: {
        searchProvider: unknown;
        writable: boolean;
        outputVerbosity?: string | undefined;
        contextMode: unknown;
        quickQuotaMode: unknown;
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
    schemaVersion: number;
    package: string;
    version: string;
    runtime: {
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
