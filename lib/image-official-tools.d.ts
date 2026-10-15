import type { ImageClientProps } from './image-client-types.js';
import type { ViewerAction } from './subscription-image-viewer.js';
export type EraseStroke = {
    size: number;
    points: {
        x: number;
        y: number;
    }[];
};
export declare const IMAGE_ASPECT_RATIOS: readonly string[][];
/**
 * Build viewer actions for one image.
 * @param {{ src: string, name: string, t: (key: string) => string,
 *   attachForEdit: (src: string, name: string, draft: string, annotations?: unknown[], referenceName?: string, sourceInDraft?: boolean, extraFiles?: File[]) => Promise<unknown>,
 *   sourceInDraft?: boolean }} options
 */
export declare function officialImageTools({ src, name, t, attachForEdit, sourceInDraft }: Pick<ImageClientProps, 't' | 'attachForEdit'> & {
    src: string;
    name: string;
    sourceInDraft?: boolean;
}): ViewerAction[];
/** Draw relative erase strokes in one color onto a canvas of the given size. */
export declare function paintEraseStrokes(context: CanvasRenderingContext2D, strokes: readonly EraseStroke[], width: number, height: number, color: string): void;
/** Codex's erase mask: the marked area white on black, at the image's own resolution. */
export declare function paintEraseMask(context: CanvasRenderingContext2D, strokes: readonly EraseStroke[], width: number, height: number): void;
