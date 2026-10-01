import type { RefObject, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Translate } from './client-types.js';
export declare const DEFAULT_KEYS: {
    pen: string;
    eraser: string;
    line: string;
    rectangle: string;
    circle: string;
    pan: string;
    zoomIn: string;
    zoomOut: string;
    fit: string;
};
export declare function useSketchView(canvas: RefObject<HTMLCanvasElement>, open: boolean): {
    view: {
        scale: number;
        x: number;
        y: number;
    };
    keys: {
        pen: string;
        eraser: string;
        line: string;
        rectangle: string;
        circle: string;
        pan: string;
        zoomIn: string;
        zoomOut: string;
        fit: string;
    };
    shortcuts: boolean;
    space: boolean;
    zoom: (factor: number) => void;
    reset: () => void;
    setKey: (action: string, key: string) => void;
    toggle: () => void;
    keyDown: (e: ReactKeyboardEvent) => boolean;
    keyUp: (e: ReactKeyboardEvent) => void;
    down: (e: ReactPointerEvent) => boolean;
    move: (e: ReactPointerEvent) => boolean;
    end: (e: ReactPointerEvent) => boolean;
};
export declare function SketchViewControls({ navigation, t }: {
    navigation: ReturnType<typeof useSketchView>;
    t: Translate;
}): import("react/jsx-runtime").JSX.Element;
