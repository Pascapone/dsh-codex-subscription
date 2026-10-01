import type { ComponentProps } from 'react';
import type { ComposerOpener } from './client-session-compat.js';
import type { CodexUiProps } from './client-types.js';
export type SketchWorkspaceProps = Pick<ComponentProps<typeof SketchStudio>, 'attachSketch' | 'sessionId' | 'rpc' | 'sessionState'> & Pick<CodexUiProps, 'preference' | 't'> & {
    registerOpen(callback: ComposerOpener): () => void;
};
import { SketchStudio } from './sketch-studio.js';
export { SKETCH_CSS } from './sketch-styles.js';
export declare function SketchWorkspace({ preference, attachSketch, registerOpen, t, sessionId, rpc, sessionState }: SketchWorkspaceProps): import("react/jsx-runtime").JSX.Element;
