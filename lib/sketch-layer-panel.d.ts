import type { SketchDocument } from './sketch-types.js';
import type { Translate } from './client-types.js';
export declare function SketchLayerPanel({ document, disabled, change, t }: {
    document: SketchDocument;
    disabled: boolean;
    change(action: string, id?: SketchDocument['active'], value?: string): void;
    t: Translate;
}): import("react/jsx-runtime").JSX.Element;
