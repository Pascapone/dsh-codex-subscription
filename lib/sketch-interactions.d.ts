import type { RefObject } from 'react';
type CursorPointer = Pick<PointerEvent, 'clientX' | 'clientY' | 'pointerId' | 'pointerType' | 'pressure'>;
export declare function useSketchDismiss(open: boolean, close: (open: boolean) => void, host: RefObject<HTMLElement>, selectors: readonly string[]): void;
export declare function useSketchCursor(canvas: RefObject<HTMLCanvasElement>, ring: RefObject<HTMLElement>, width: number, brush: string, zoom: number, hidden: boolean): {
    down: (event: CursorPointer) => void;
    move: (event: CursorPointer, bounds?: DOMRect) => void;
    leave: () => void;
};
export {};
