import type { SketchRenderEntry } from './sketch-render-types.js';
import type { SketchDocument, SketchDraft } from './sketch-types.js';
import type { SketchSessionState } from './sketch-session-state.js';
type LifecycleOptions = {
    sessionId: string;
    t(key: string): string;
    schedule(): void;
    checkpoint(): void;
    cache: {
        current: Map<number, SketchRenderEntry>;
    };
    setSelection(value: null): void;
    setTextEdit(value: null): void;
    setRecovered(value: boolean): void;
    store?: typeof sketchDrafts;
    decodeImages?: typeof decodeSketchImages;
    readImage?: typeof importSketchImage;
};
import { sketchDrafts, decodeSketchImages, importSketchImage } from './sketch-drafts.js';
export declare function createSketchDocumentLifecycle(state: SketchSessionState, { sessionId, t, schedule, checkpoint, cache, setSelection, setTextEdit, setRecovered, store, decodeImages, readImage }: LifecycleOptions): {
    hasContent: () => boolean;
    save: (name?: string) => Promise<void>;
    saveChanges: () => Promise<void>;
    replace: (next: SketchDocument, decoded: Map<string, HTMLImageElement>, identity: Pick<SketchDraft, "id" | "name"> | null) => void;
    fresh: () => Promise<void>;
    load: (row: Pick<SketchDraft, "id"> | undefined) => Promise<void>;
    importImage: (file: File) => Promise<void>;
    restore: (isCurrent?: () => boolean) => Promise<void>;
};
export {};
