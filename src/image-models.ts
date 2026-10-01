import type { ImageModel, ImageQuality } from './settings-types.js';
// Public API identifiers are candidates, not a promise of subscription access.
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2'
export const IMAGE_MODELS = Object.freeze({
  'gpt-image-2': Object.freeze(['auto', 'low', 'medium', 'high'] as const),
  'gpt-image-2.5-flare': Object.freeze(['auto', 'low', 'medium', 'high', 'xhigh', 'max'] as const),
  'gpt-image-2.5-sunburst': Object.freeze(['auto', 'low', 'medium', 'high', 'xhigh', 'max'] as const),
})

export function resolveImageModel(model: unknown = DEFAULT_IMAGE_MODEL): ImageModel {
  if (typeof model !== 'string' || !Object.hasOwn(IMAGE_MODELS, model)) throw new Error('Unknown image model')
  return model as ImageModel
}

export function validateImageQuality(model: unknown, quality: unknown): void {
  if (!(IMAGE_MODELS[resolveImageModel(model)] as readonly ImageQuality[]).includes(quality as ImageQuality)) throw new Error(`Unsupported quality for ${model}`)
}
