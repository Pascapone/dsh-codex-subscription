import type { createSketchOperationGate } from './sketch-operation-gate.js';
export declare function exportSketchAgentFile(format: string, { gate, blocked, working, report, exportFile }: Parameters<ReturnType<typeof createSketchOperationGate>['run']>[1] & {
    gate: ReturnType<typeof createSketchOperationGate>;
    exportFile(format: string): Promise<{
        blob: Blob;
        extension: string;
    }>;
}): Promise<{
    extension: string;
    mediaType: string;
    base64: string;
}>;
