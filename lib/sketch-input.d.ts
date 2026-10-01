import type { SketchPoint } from './sketch-types.js';
export declare function snapLine(start: SketchPoint, end: SketchPoint): {
    x: number;
    y: number;
};
export declare function smoothStrokePoints(points: SketchPoint[], strength?: number): SketchPoint[];
