import type { SketchPoint, SketchStroke } from './sketch-types.js';
export declare function flattenSketchCurve(stroke: Pick<SketchStroke, 'points'>, width: number, height: number): SketchPoint[];
