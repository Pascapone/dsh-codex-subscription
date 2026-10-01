import type { Translate } from './client-types.js';
export declare function SketchRunStatus({ state, t, floating, onOpen, onStop, onResume, onDismiss }: {
    state: string;
    t: Translate;
    floating?: boolean;
    onOpen?(): void;
    onStop(): void;
    onResume(): void;
    onDismiss(): void;
}): import("react/jsx-runtime").JSX.Element | null;
