import type { SketchDocument, SketchDraft, SketchDraftMetadata, SketchRecovery } from './sketch-types.js';
export declare function sketchDrafts(action: 'list', value?: undefined): Promise<SketchDraftMetadata[]>;
export declare function sketchDrafts(action: 'get', value: string): Promise<SketchDraft | undefined>;
export declare function sketchDrafts(action: 'recover', value: string): Promise<SketchRecovery | undefined>;
export declare function sketchDrafts(action: 'save', value: SketchDraft, recoverySession?: string): Promise<SketchDraft>;
export declare function sketchDrafts(action: 'checkpoint', value: SketchRecovery): Promise<SketchRecovery>;
export declare function sketchDrafts(action: 'delete' | 'clearRecovery', value: string): Promise<void>;
export declare function decodeSketchImages(doc: Pick<SketchDocument, 'layers'>, images: Map<string, HTMLImageElement>): Promise<void>;
export declare function importSketchImage(file: File): Promise<{
    src: string;
    width: number;
    height: number;
}>;
