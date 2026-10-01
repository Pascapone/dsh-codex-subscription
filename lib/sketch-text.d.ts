import type { SketchPoint, SketchStroke } from './sketch-types.js';
export declare function layoutSketchText(stroke: Pick<SketchStroke, 'points' | 'text' | 'width'>, context: Pick<CanvasRenderingContext2D, "font" | "measureText">, width: number, height: number): {
    x: number;
    y: number;
    size: number;
    lines: string[];
};
export declare function newTextBounds(point: SketchPoint): {
    x: number;
    y: number;
}[];
