export interface ImageEditAnnotation {
    number: number;
    x: number;
    y: number;
    note: string;
}
interface ImageEditDraftOptions {
    prompt?: unknown;
    annotations?: unknown;
    translate?: (key: string) => string;
    width?: unknown;
    height?: unknown;
    sourceName?: unknown;
    referenceName?: unknown;
}
/**
 * Validate the annotation contract shared by the draft builder and the
 * reference-image renderer. Annotation numbers are their array positions so
 * that they stay aligned with the pins shown to the user.
 */
export declare function normalizeImageEditAnnotations(annotations: unknown, { requireNotes }?: {
    requireNotes?: boolean;
}): ImageEditAnnotation[];
export declare function buildImageEditDraft({ prompt, annotations, translate, width, height, sourceName, referenceName, }: ImageEditDraftOptions): string;
export {};
