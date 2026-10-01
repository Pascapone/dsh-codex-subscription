import type { Translate } from './client-types.js';
import type { Dispatch, SetStateAction } from 'react';
export declare function SketchToolPicker({ t, disabled, tool, brush, chooseBrush, chooseTool, shapesOpen, setShapesOpen }: {
    t: Translate;
    disabled: boolean;
    tool: string;
    brush: string;
    chooseBrush(brush: string): void;
    chooseTool(tool: string): void;
    shapesOpen: boolean;
    setShapesOpen: Dispatch<SetStateAction<boolean>>;
}): import("react/jsx-runtime").JSX.Element;
