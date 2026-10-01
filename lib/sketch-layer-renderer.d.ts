import type { SketchRenderEntry } from './sketch-render-types.js';
import type { SketchDocument } from './sketch-types.js';
export declare function paintSketchLayers(context: CanvasRenderingContext2D, doc: SketchDocument, cache: Map<number, SketchRenderEntry>, size?: number, height?: number, activeLayer?: number, images?: Map<string, CanvasImageSource>): void;
