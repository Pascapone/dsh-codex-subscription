import type { ImageModel } from './settings-types.js';
export declare const DEFAULT_IMAGE_MODEL = "gpt-image-2";
export declare const IMAGE_MODELS: Readonly<{
    'gpt-image-2': readonly ["auto", "low", "medium", "high"];
    'gpt-image-2.5-flare': readonly ["auto", "low", "medium", "high", "xhigh", "max"];
    'gpt-image-2.5-sunburst': readonly ["auto", "low", "medium", "high", "xhigh", "max"];
}>;
export declare function resolveImageModel(model?: unknown): ImageModel;
export declare function validateImageQuality(model: unknown, quality: unknown): void;
