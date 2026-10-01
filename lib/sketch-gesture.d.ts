import type { SketchDocument, SketchGesture } from './sketch-types.js';
import { sketchPoint } from './sketch-document.js';
export declare function updateSketchGesture(doc: SketchDocument, gesture: SketchGesture, samples: readonly Pick<PointerEvent, "clientX" | "clientY">[], rect: Parameters<typeof sketchPoint>[2], width: number, shiftKey?: boolean): SketchDocument;
