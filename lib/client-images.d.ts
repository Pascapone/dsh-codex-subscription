import type { ToolResultNode } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { ImageClientProps } from './image-client-types.js';
type ImageBlock = Partial<Pick<ToolResultNode, 'content' | 'isError' | 'meta'>> & {
    kind?: string;
    toolCallId?: string;
};
declare module '@deepseek-ai/dsh-client-ui-chat/client' {
    interface ChatNodeDataMap {
        'codex-image-output': {
            blocks: ImageBlock[];
        };
    }
}
export declare function CodexImageToolRow({ presentation, block, sessionId, rpc, loadImage, openSketchImage, attachForEdit, getImageViewer, getInternalImageViewer, t, preference }: ImageClientProps & {
    presentation?: string;
    block?: ImageBlock;
}): import("react/jsx-runtime").JSX.Element;
export declare function CodexImageOutput({ node, ...props }: ImageClientProps & {
    node: {
        data: {
            blocks: ImageBlock[];
        };
    };
}): import("react/jsx-runtime").JSX.Element;
export {};
