import type { Translate } from './client-types.js';
import type { createSketchDocumentLifecycle } from './sketch-document-lifecycle.js';
type FileProps = Pick<ReturnType<typeof createSketchDocumentLifecycle>, 'save' | 'load' | 'fresh' | 'importImage'> & {
    download(format: string): Promise<void>;
    hasContent: boolean;
    disabled: boolean;
    t: Translate;
    runOperation(operation: () => unknown | Promise<unknown>): Promise<unknown>;
};
export declare function SketchFiles({ save, load, fresh, importImage, download, hasContent, disabled, t, runOperation }: FileProps): import("react/jsx-runtime").JSX.Element;
export {};
