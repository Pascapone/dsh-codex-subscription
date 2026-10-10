import type { Translate, SubscriptionRpcClient } from './client-types.js';
import type { SketchSessionState } from './sketch-session-state.js';
import type { SketchPoint } from './sketch-types.js';
export type SketchIncoming = {
    file: File;
};
export type Selection = {
    layer: number;
    id?: string;
};
export type TextEdit = {
    point?: SketchPoint;
    selection?: Selection | null;
    value: string;
};
export type SketchStudioProps = {
    open: boolean;
    agentEnabled: boolean;
    onOpen(): void;
    onClose(): void;
    attachSketch(blob: Blob): unknown | Promise<unknown>;
    enabled: boolean;
    t: Translate;
    incoming: SketchIncoming | null;
    sessionId: string;
    rpc?: SubscriptionRpcClient;
    sessionState?: SketchSessionState;
};
type AgentApi = {
    version: number;
    sessionId: string;
    execute: ReturnType<typeof createSketchAgentRun>['execute'];
    export(format: string): ReturnType<typeof exportSketchAgentFile>;
};
declare global {
    interface Window {
        dshSketchAgent?: AgentApi;
    }
}
import { exportSketchAgentFile } from './sketch-agent-export.js';
import { createSketchAgentRun } from './sketch-agent-run.js';
export declare function SketchStudio({ open, agentEnabled, onOpen, onClose, attachSketch, enabled, t, incoming, sessionId, rpc, sessionState }: SketchStudioProps): import("react/jsx-runtime").JSX.Element;
export {};
