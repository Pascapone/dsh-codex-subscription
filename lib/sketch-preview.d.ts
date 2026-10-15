import type { SketchDocument, SketchPreviewOptions } from './sketch-types.js';
import type { paintSketchLayers } from './sketch-layer-renderer.js';
export declare function composeSketchPreview({ doc, images, width, height, options, makeSurface, paintLayers }: {
    doc: SketchDocument;
    images: Map<string, HTMLImageElement>;
    width: number;
    height: number;
    options?: SketchPreviewOptions;
    makeSurface(width: number, height: number): HTMLCanvasElement;
    paintLayers: typeof paintSketchLayers;
}): string;
