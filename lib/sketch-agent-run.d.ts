import type { SketchRequest, SketchCommandResult } from './sketch-types.js';
export declare function createSketchAgentRun({ execute, open, changed, busy, previewEnabled, idleMs }: {
    execute(request: SketchRequest): Promise<SketchCommandResult>;
    open(): void;
    changed(state: string): void;
    busy?: () => boolean;
    previewEnabled?: () => boolean;
    idleMs?: number;
}): {
    readonly state: string;
    readonly locked: boolean;
    stop(): void;
    resume(): void;
    fail: () => void;
    dispose(): void;
    execute(request: SketchRequest): Promise<import("./sketch-types.js").SketchSnapshot & {
        [key: string]: unknown;
    } & {
        runId: string | undefined;
    }>;
};
