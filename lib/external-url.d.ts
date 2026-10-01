import { spawn } from 'node:child_process';
/** Validate the only external origin this plugin may launch. */
export declare function assertCodexAuthUrl(value: unknown): string;
/** Return a shell-free native opener command for the current desktop. */
export declare function commandForCodexAuthUrl(value: unknown, platform?: string): {
    file: string;
    args: string[];
    shell: boolean;
};
export declare function openCodexAuthUrl(value: unknown, options?: {
    platform?: string;
    spawn?: typeof spawn;
}): Promise<void>;
