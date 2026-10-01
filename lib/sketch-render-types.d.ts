import type { SketchStroke, SketchImage } from './sketch-types.js';
export type SketchRenderEntry = {
    surface: HTMLCanvasElement;
    base: HTMLCanvasElement;
    count?: number;
    prefix?: SketchStroke;
    image?: SketchImage;
    strokes?: SketchStroke[];
};
