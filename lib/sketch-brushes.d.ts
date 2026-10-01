import type { SketchStroke } from './sketch-types.js';
export declare function configureSketchBrush(context: CanvasRenderingContext2D, stroke: Pick<SketchStroke, 'color' | 'width' | 'shape' | 'brush' | 'brushVersion' | 'opacity' | 'pressure'>): void;
