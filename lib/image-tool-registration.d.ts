import type { createSettingsAdapter } from './settings-adapter.js';
/** Removing the tool also removes its schema from subsequent model requests. */
export declare function watchImageTool(settings: Pick<ReturnType<typeof createSettingsAdapter>, 'get' | 'watch'>, register: () => () => void): () => void;
