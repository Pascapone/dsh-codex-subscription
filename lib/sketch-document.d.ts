import type { SketchStroke } from './sketch-types.js';
export declare const SKETCH_SIZE = 1024;
export declare const MAX_SKETCH_STROKES = 2000;
export declare const MAX_STROKE_POINTS = 2000;
export declare function sketchPoint(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): {
    x: number;
    y: number;
} | undefined;
export declare function paintSketch(context: CanvasRenderingContext2D, strokes: readonly SketchStroke[], size?: number, transparent?: boolean, height?: number, start?: number, end?: number): void;
