import type { Translate } from './client-types.js';
import type { SubscriptionImageViewerService as SubscriptionImageViewer } from './subscription-image-viewer.js';
import { SUBSCRIPTION_IMAGE_VIEWER_CSS } from './subscription-image-viewer-styles.js';
export declare function SubscriptionImageViewerOverlay({ service, t }: {
    service: SubscriptionImageViewer;
    t: Translate;
}): import("react/jsx-runtime").JSX.Element | null;
export { SUBSCRIPTION_IMAGE_VIEWER_CSS };
