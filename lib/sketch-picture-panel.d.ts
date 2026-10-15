import type { RefObject } from 'react';
import type { SketchDocument } from './sketch-types.js';
import type { Translate } from './client-types.js';
import type { createSketchDocumentLifecycle } from './sketch-document-lifecycle.js';
export declare function SketchPicturePanel({ document, disabled, pictureInput, importImage, runFile, change, t }: {
    document: SketchDocument;
    disabled: boolean;
    pictureInput: RefObject<HTMLInputElement>;
    importImage: ReturnType<typeof createSketchDocumentLifecycle>['importImage'];
    runFile(work: () => unknown | Promise<unknown>): unknown;
    change(action: string, id: number): unknown;
    t: Translate;
}): import("react/jsx-runtime").JSX.Element;
