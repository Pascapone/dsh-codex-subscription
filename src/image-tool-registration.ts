import { readImageFeatures } from './image-features.js'
import type { createSettingsAdapter } from './settings-adapter.js';

/** Removing the tool also removes its schema from subsequent model requests. */
export function watchImageTool(settings: Pick<ReturnType<typeof createSettingsAdapter>, 'get' | 'watch'>, register: () => () => void) {
  let disposeTool: (() => void) | undefined
  const sync = (value: Parameters<typeof readImageFeatures>[0]) => {
    const { imageGeneration, imageEditing } = readImageFeatures(value)
    if ((imageGeneration || imageEditing) && !disposeTool) disposeTool = register()
    else if (!imageGeneration && !imageEditing && disposeTool) {
      disposeTool()
      disposeTool = undefined
    }
  }
  sync(settings.get())
  const unwatch = settings.watch(sync)
  return () => { unwatch(); disposeTool?.(); disposeTool = undefined }
}
