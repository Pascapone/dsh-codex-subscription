import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { AuthReaders } from './model-types.js';
import type { OriginalImageStore } from './image-original-store.js';
type AttachmentPort = Pick<AttachmentStore, 'imageLimits' | 'readImage' | 'saveImage'>;
type SessionMessages = readonly {
    content?: unknown;
}[];
interface ImageToolOptions extends AuthReaders {
    fetch?: typeof fetch;
    attachments: AttachmentPort;
    originalImages: Pick<OriginalImageStore, 'save' | 'remove' | 'originalPath'>;
    getFeatures?: () => Parameters<typeof readImageDefaults>[0];
    getSessionMessages?: (id: NonNullable<ToolRunContext['agent']>['id'] | undefined) => SessionMessages | undefined | Promise<SessionMessages | undefined>;
}
import { readImageDefaults } from './image-features.js';
export declare const CODEX_IMAGE_TOOL_NAME = "codex_image_generate";
export declare const CODEX_IMAGE_GENERATION_URL = "https://chatgpt.com/backend-api/codex/images/generations";
export declare const CODEX_IMAGE_EDIT_URL = "https://chatgpt.com/backend-api/codex/images/edits";
export declare function normalizeImageOptions(args: {
    quality?: unknown;
    background?: unknown;
    size?: unknown;
    model?: unknown;
} | null | undefined): {
    quality: string;
    background: string;
    size: string;
};
/** Strictly decode one PNG returned by the subscription backend. */
export declare function decodeCodexPng(value: unknown, maximumBytes: number): Uint8Array<ArrayBuffer>;
/** Create the DSH-native image-generation tool backed only by the ChatGPT subscription. */
export declare function createCodexImageTool(options: ImageToolOptions): ToolDefinition;
export {};
