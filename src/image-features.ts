import type { ImageModel, ImageQuality, ImageFeatures, ImageDefaults } from './settings-types.js';
import { DEFAULT_IMAGE_MODEL, IMAGE_MODELS, resolveImageModel } from './image-models.js'
export const IMAGE_FEATURE_DEFAULTS = Object.freeze({
  imageGeneration: true,
  imageShortcut: true,
  imageEditing: true,
  imageViewer: true,
  imageAnnotations: true,
  imageSketch: false,
  imageSketchAgent: false,
  imageSketchAgentPreview: false,
})

export function readImageFeatures(value: Record<string, unknown> | null = {}): ImageFeatures {
  return Object.fromEntries(Object.entries(IMAGE_FEATURE_DEFAULTS).map(([key, fallback]) => [key,
    typeof value?.[key] === 'boolean' ? value![key] : fallback])) as ImageFeatures
}

export function readImageDefaults(value: Record<string, unknown> | null = {}): ImageDefaults {
  const imageModel = Object.hasOwn(IMAGE_MODELS, value?.imageModel as PropertyKey) ? value!.imageModel as ImageModel : DEFAULT_IMAGE_MODEL
  return { imageModel, imageQuality: (IMAGE_MODELS[imageModel] as readonly ImageQuality[]).includes(value?.imageQuality as ImageQuality) ? value!.imageQuality as ImageQuality : 'auto' }
}

export function imageFeaturePatch(value: Record<string, unknown> = {}): Partial<ImageFeatures & ImageDefaults> {
  const patch: Record<string, unknown> = {}
  if (Object.hasOwn(value, 'imageModel')) patch.imageModel = resolveImageModel(value.imageModel)
  if (Object.hasOwn(value, 'imageQuality')) {
    if (!(['auto','low','medium','high','xhigh','max'] as readonly unknown[]).includes(value.imageQuality)) throw new Error('Invalid image quality')
    patch.imageQuality = value.imageQuality
  }
  for (const key of Object.keys(IMAGE_FEATURE_DEFAULTS)) {
    if (!Object.hasOwn(value, key)) continue
    if (typeof value[key] !== 'boolean') throw new Error('Invalid image feature preference')
    patch[key] = value[key]
  }
  return patch as Partial<ImageFeatures & ImageDefaults>
}

export function assertImageOperation(features: Record<string, unknown> | null | undefined, editing: boolean): void {
  const current = readImageFeatures(features)
  if (!(editing ? current.imageEditing : current.imageGeneration)) {
    throw new Error(editing ? 'Image editing is disabled in subscription settings' : 'Image generation is disabled in subscription settings')
  }
}
