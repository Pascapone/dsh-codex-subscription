import type { SketchStroke, SketchDocument, SketchTransform } from './sketch-types.js';
export declare const objectId: (stroke: SketchStroke, index: number) => string;
export declare const identifyObjects: (doc: SketchDocument) => SketchDocument;
export declare function objectBounds(stroke: SketchStroke): {
    x: number;
    y: number;
    width: number;
    height: number;
};
export declare function transformObject(stroke: SketchStroke, { dx, dy, scaleX, scaleY }: SketchTransform): {
    points: {
        x: number;
        y: number;
    }[];
    id?: string;
    shape?: string;
    color: string;
    width: number;
    opacity?: number;
    fill?: boolean;
    text?: string;
    brush?: string;
    brushVersion?: number;
    pressure?: number;
};
export declare function sketchObjectSummary(doc: SketchDocument): {
    text?: string | undefined;
    layer: number;
    id: string;
    shape: string | undefined;
    color: string;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}[];
