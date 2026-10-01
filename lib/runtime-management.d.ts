import type { PluginInstallProgress } from '@deepseek-ai/dsh-plugin-manager';
interface ManagementOptions {
    manager(): unknown;
    inspect(): {
        installed: boolean;
        present?: boolean;
    };
    active(): number;
    selectDsh(): Promise<unknown>;
    componentVersion?: () => string | undefined;
}
export declare function createRuntimeManagement({ manager, inspect, active, selectDsh, componentVersion }: ManagementOptions): {
    status: () => Promise<{
        available: boolean;
        installable: boolean;
        componentVersion: string | undefined;
        installed: boolean;
        present: boolean;
        removable: boolean;
        active: number;
        phase: "idle" | "installing" | "removing" | "applying" | "cancelled" | "done" | "failed";
        restartRequired: boolean;
        error?: string;
    }>;
    start: (action: string) => Promise<{
        available: boolean;
        installable: boolean;
        componentVersion: string | undefined;
        installed: boolean;
        present: boolean;
        removable: boolean;
        active: number;
        phase: "idle" | "installing" | "removing" | "applying" | "cancelled" | "done" | "failed";
        restartRequired: boolean;
        error?: string;
    }>;
    blocked: () => boolean;
    progress(value: Pick<PluginInstallProgress, "requestId" | "phase">): void;
    cancel(): Promise<{
        available: boolean;
        installable: boolean;
        componentVersion: string | undefined;
        installed: boolean;
        present: boolean;
        removable: boolean;
        active: number;
        phase: "idle" | "installing" | "removing" | "applying" | "cancelled" | "done" | "failed";
        restartRequired: boolean;
        error?: string;
    }>;
};
export {};
