import type { Translate, SubscriptionRpcClient } from './client-types.js';
import type { SketchSessionState } from './sketch-session-state.js';
export type SketchIncoming = {
    file: File;
};
export type SketchStudioProps = {
    open: boolean;
    agentEnabled: boolean;
    agentPreview: boolean;
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
export declare function SketchStudio({ open, agentEnabled, agentPreview, onOpen, onClose, attachSketch, enabled, t, incoming, sessionId, rpc, sessionState }: SketchStudioProps): import("react/jsx-runtime").JSX.Element;
export {};
