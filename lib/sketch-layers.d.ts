import type { SketchPoint, SketchStroke, SketchDocument } from './sketch-types.js';
export declare const MAX_SKETCH_LAYERS = 8;
export declare const createSketchLayers: () => SketchDocument;
export declare const strokeCount: (doc: SketchDocument) => number;
export declare function changeSketchLayer(doc: SketchDocument, action: string, id?: number, value?: unknown): SketchDocument;
export declare function strokeHit(stroke: Pick<SketchStroke, 'points' | 'width' | 'shape' | 'fill'>, point: SketchPoint, radius: number, width?: number, height?: number): boolean;
export declare const SKETCH_RATIOS: Readonly<{
    '1:1': number[];
    '4:3': number[];
    '3:4': number[];
    '16:9': number[];
    '9:16': number[];
}>;
export declare function resizeSketch(doc: SketchDocument, ratio: string): SketchDocument;
