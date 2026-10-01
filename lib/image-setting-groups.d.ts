import type { ImageFeatures } from './settings-types.js';
export declare const IMAGE_SETTING_GROUPS: Readonly<{
    readonly imageCapability: readonly ["imageGeneration", "imageEditing"];
    readonly imageEntryPoints: readonly ["imageShortcut"];
    readonly sketchCanvas: readonly ["imageSketch"];
    readonly sketchAgent: readonly ["imageSketchAgent"];
    readonly sketchAgentPreview: readonly ["imageSketchAgentPreview"];
    readonly imageBrowsing: readonly ["imageViewer", "imageAnnotations"];
}>;
export declare function imageGroupValue(snapshot: Partial<ImageFeatures>, group: keyof typeof IMAGE_SETTING_GROUPS): "off" | "on" | "mixed";
export declare function imageGroupPatch(group: keyof typeof IMAGE_SETTING_GROUPS, enabled: boolean): Partial<ImageFeatures>;
