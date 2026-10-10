import type { SketchCommand, SketchDocument, SketchCommandReport } from './sketch-types.js';
export declare const MAX_SVG_CHARACTERS = 200000;
export declare function svgToSketchCommands(text: unknown, { width, height, layer, existingIds }: {
    width: number;
    height: number;
    layer?: number;
    existingIds?: Iterable<string | number | undefined>;
}): {
    commands: SketchCommand[];
    warnings: string[];
    clamped: number;
};
export declare function expandSvgCommands(commands: SketchCommand[], doc: SketchDocument, report?: SketchCommandReport): SketchCommand[];
