import type { ImageFeatures, ImageDefaults } from './settings-types.js';
export declare const IMAGE_FEATURE_DEFAULTS: Readonly<{
    imageGeneration: true;
    imageShortcut: true;
    imageEditing: true;
    imageViewer: true;
    imageAnnotations: true;
    imageSketch: false;
    imageSketchAgent: false;
    imageSketchAgentPreview: false;
}>;
export declare function readImageFeatures(value?: Record<string, unknown> | null): ImageFeatures;
export declare function readImageDefaults(value?: Record<string, unknown> | null): ImageDefaults;
export declare function imageFeaturePatch(value?: Record<string, unknown>): Partial<ImageFeatures & ImageDefaults>;
export declare function assertImageOperation(features: Record<string, unknown> | null | undefined, editing: boolean): void;
