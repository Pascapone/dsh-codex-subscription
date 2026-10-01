type CanvasFactory = (width: number, height: number) => HTMLCanvasElement | Promise<HTMLCanvasElement>;
export interface ImageEditReferenceOptions {
    createImageBitmap?: typeof globalThis.createImageBitmap;
    bitmapFactory?: typeof globalThis.createImageBitmap;
    createCanvas?: CanvasFactory;
    canvasFactory?: CanvasFactory;
}
/**
 * Create the second image sent with an annotated edit. It contains the clean
 * source plus numbered pins, with no note text. `options` is intentionally
 * injectable so the rendering path can be exercised without a browser:
 * `{ createImageBitmap, createCanvas }`.
 */
export declare function createAnnotatedImageReference(blob: Blob, annotations: unknown, options?: ImageEditReferenceOptions): Promise<Blob>;
export {};
