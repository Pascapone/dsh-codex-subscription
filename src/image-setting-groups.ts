import type { ImageFeatures } from './settings-types.js';
// Preserve old per-feature values until the user deliberately changes a group.
export const IMAGE_SETTING_GROUPS = Object.freeze({
  imageCapability: ['imageGeneration', 'imageEditing'],
  imageEntryPoints: ['imageShortcut'],
  sketchCanvas: ['imageSketch'],
  sketchAgent: ['imageSketchAgent'],
  sketchAgentPreview: ['imageSketchAgentPreview'],
  imageBrowsing: ['imageViewer', 'imageAnnotations'],
} as const satisfies Readonly<Record<string, readonly (keyof ImageFeatures)[]>>)
export function imageGroupValue(snapshot: Partial<ImageFeatures>, group: keyof typeof IMAGE_SETTING_GROUPS) {
  const fields = IMAGE_SETTING_GROUPS[group]
  if (fields.every(field => snapshot[field] === true)) return 'on'
  if (fields.every(field => snapshot[field] === false)) return 'off'
  return 'mixed'
}
export function imageGroupPatch(group: keyof typeof IMAGE_SETTING_GROUPS, enabled: boolean): Partial<ImageFeatures> {
  return Object.fromEntries(IMAGE_SETTING_GROUPS[group].map(field => [field, enabled]))
}
