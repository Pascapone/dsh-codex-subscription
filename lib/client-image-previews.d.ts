import type { ComposerAttachmentsProps, MessageImagesOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots';
import type { ImageClientProps } from './image-client-types.js';
import type { SubscriptionImageViewerService as SubscriptionImageViewer } from './subscription-image-viewer.js';
type PreviewProps = Pick<ImageClientProps, 'preference' | 't' | 'attachForEdit' | 'openSketchImage'> & {
    service: SubscriptionImageViewer;
};
type ComposerPreviewProps = Omit<ComposerAttachmentsProps, 't'> & PreviewProps & {
    nativeAttachments(): StoredEntry | undefined;
    watchNativeAttachments(listener: () => void): () => void;
    nativeTranslate: ComposerAttachmentsProps['t'];
};
export declare function ComposerImagePreviews(props: ComposerPreviewProps): import("react/jsx-runtime").JSX.Element | null;
export declare function MessageImagePreviews({ images, align, compact, thumbnail, ...props }: PreviewProps & MessageImagesOwnerProps): import("react/jsx-runtime").JSX.Element;
export declare const IMAGE_PREVIEWS_CSS = "\n.codexMessageImages{display:flex;gap:10px;max-width:100%;padding:8px 0;overflow-x:auto}\n.codexImageThumb{display:grid;place-items:center;width:64px;height:64px;padding:0;border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:14px;background:var(--dsw-alias-interactive-bg-hover);color:inherit;overflow:hidden;cursor:zoom-in;flex:none}\n.codexImageThumb img{width:100%;height:100%;object-fit:cover}\n.codexImageThumb:focus-visible{outline:2px solid #4598ed;outline-offset:2px}\n.codexMessageImages{flex-wrap:wrap}.codexMessageImages[data-align=end]{justify-content:flex-end}\n.codexMessageImages[data-single=true] .codexImageThumb{width:240px;height:auto;max-width:100%}\n.codexMessageImages[data-single=true] img{height:auto;max-height:320px;object-fit:contain}\n.codexMessageImages[data-thumbnail=true]{padding:0}.codexMessageImages[data-thumbnail=true] img{object-fit:contain}\n";
export {};
