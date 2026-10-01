import type { PointerEvent as ReactPointerEvent } from 'react';
export declare function useImageTransform(identity: unknown): {
    transform: {
        zoom: number;
        x: number;
        y: number;
    };
    transformRef: import("react").MutableRefObject<{
        zoom: number;
        x: number;
        y: number;
    }>;
    dragging: boolean;
    pixelScale: number;
    geometry: {
        width: number;
        height: number;
        stageWidth: number;
        stageHeight: number;
    };
    stageRef: import("react").RefObject<HTMLDivElement>;
    surfaceRef: import("react").RefObject<HTMLDivElement>;
    imageRef: import("react").RefObject<HTMLImageElement>;
    fit: () => void;
    actual: () => void;
    measure: () => void;
    setZoomAt: (zoom: number, clientX: number, clientY: number) => void;
    resetGesture: () => void;
    pointerHandlers: {
        onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
        onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
        onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
        onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
        onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
    };
};
