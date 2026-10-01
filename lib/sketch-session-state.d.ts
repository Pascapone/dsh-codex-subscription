import type { SketchDocument, SketchDraft, SketchCommandAdapter } from './sketch-types.js';
import type { createSketchAgentRun } from './sketch-agent-run.js';
import type { createSketchCommandSession } from './sketch-commands.js';
export type SketchStudioAdapter = SketchCommandAdapter & {
    open(): void;
    changed?(state: string): void;
    previewEnabled(): boolean;
    export(format: string): Promise<{
        blob: Blob;
        extension: string;
    }>;
};
type Ref<T> = {
    current: T;
};
export type SketchSessionState = {
    doc: Ref<SketchDocument>;
    undo: Ref<SketchDocument[]>;
    redo: Ref<SketchDocument[]>;
    images: Ref<Map<string, HTMLImageElement>>;
    saved: Ref<Pick<SketchDraft, 'id' | 'name'> | null>;
    dirty: Ref<boolean>;
    documentId: Ref<string>;
    documentRevision: Ref<number>;
    restoreId: Ref<string | null>;
    mounts: number;
    agentAdapter: Ref<Partial<SketchStudioAdapter>>;
    agentSession: Ref<ReturnType<typeof createSketchCommandSession> | null>;
    agentRun: Ref<ReturnType<typeof createSketchAgentRun> | null>;
    retain?: () => () => void;
};
export declare function createSketchSessionState(): SketchSessionState;
export declare function createSketchSessionRegistry({ maxIdle }?: {
    maxIdle?: number | undefined;
}): {
    get(id: string): SketchSessionState & {
        retain: NonNullable<SketchSessionState["retain"]>;
    };
    prune: () => void;
    stats: () => {
        resident: number;
        archived: number;
    };
    dispose(): void;
};
export {};
