import type { ExecFileOptions } from 'node:child_process';
import type * as OfficialRuntime from '@deepseek-ai/dsh-subagent-codex';
import type * as Protocol from '@deepseek-ai/dsh-sdk-protocol';
type ModuleResolver = (specifier: Parameters<NodeRequire['resolve']>[0]) => ReturnType<NodeRequire['resolve']>;
interface RuntimeLoaderOptions {
    resolve?: ModuleResolver;
    run?: (command: string, args: readonly string[], options: Pick<ExecFileOptions, 'timeout' | 'maxBuffer' | 'windowsHide'>) => Promise<{
        stdout: string;
    }>;
    importModule?: (url: string) => Promise<unknown>;
}
export declare const SUBAGENT_RUNTIME_PACKAGE = "@deepseek-ai/dsh-subagent-codex";
export declare const SUBAGENT_RUNTIME_VERSION = "0.1.7-rc.2";
export declare function matchingSubagentRuntimeVersion(resolve?: ModuleResolver): string | undefined;
export declare function inspectSubagentRuntime(resolve?: ModuleResolver): {
    installed: boolean;
    present: boolean;
} | {
    installed: boolean;
    present?: undefined;
};
export declare function loadSubagentRuntime({ resolve, run, importModule }?: RuntimeLoaderOptions): Promise<{
    official: typeof OfficialRuntime;
    Transport: typeof Protocol.JsonRpcLineTransport;
}>;
export {};
