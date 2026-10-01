import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { MessageImageLoader } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { ViewerAnnotation as ImageEditAnnotation } from './subscription-image-viewer.js';
import type { CodexUiProps } from './client-types.js';
import type { SubscriptionImageViewerService as SubscriptionImageViewer } from './subscription-image-viewer.js';
export type ImageClientProps = Pick<CodexUiProps, 'preference' | 't' | 'rpc'> & { sessionId: string; loadImage: MessageImageLoader; openSketchImage?(src: string, name: string): unknown | Promise<unknown>; attachForEdit(src: string, name: string, draft: string, annotations?: readonly ImageEditAnnotation[], referenceName?: string, sourceInDraft?: boolean): unknown | Promise<unknown>; getImageViewer?(): Pick<SubscriptionImageViewer, 'open'> | undefined; getInternalImageViewer?(): SubscriptionImageViewer | undefined };
export type ImagePresentationAttachment = ImageAttachmentRef & { bytes?: number };
