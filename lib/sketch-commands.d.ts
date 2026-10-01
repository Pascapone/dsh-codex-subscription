import type { SketchDocument, SketchRequest, SketchCommandAdapter, SketchCommandResult } from './sketch-types.js';
export declare const MAX_SKETCH_POINTS = 200000;
export declare const SKETCH_COMMAND_HELP: {
    coordinates: string;
    shapes: string;
    commands: {
        preset: string;
        stroke: string;
        layer: string;
        curve: string;
        object: string;
        resize: string;
    };
    limits: {
        strokes: number;
        pointsPerStroke: number;
        pointsTotal: number;
        commandsPerBatch: number;
    };
};
export declare function applySketchCommands(source: SketchDocument, commands: unknown): SketchDocument;
export declare function createSketchCommandSession(adapter: SketchCommandAdapter): (request: SketchRequest) => Promise<SketchCommandResult>;
