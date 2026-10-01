import type { ImageEditAnnotation } from './image-edit.js';
export type ViewerAnnotation = Omit<ImageEditAnnotation, 'number'> & {
    id: string;
};
export type ViewerDownloadContext = {
    item: ViewerItem;
    src: string;
    signal: AbortSignal;
    onProgress(progress: {
        loaded: number;
        total: number;
    }): void;
};
export type ViewerActionContext = {
    item: ViewerItem;
    src: string;
    annotations: ViewerAnnotation[];
};
export type ViewerDownload = {
    pendingLabel?: string;
    errorLabel?: string;
    onInvoke(context: ViewerDownloadContext): unknown | Promise<unknown>;
};
export type ViewerAction = Omit<ViewerDownload, 'onInvoke'> & {
    id: string;
    label: string;
    pendingLabel: string;
    errorLabel: string;
    closeOnSuccess: boolean;
    onInvoke(context: ViewerActionContext): unknown | Promise<unknown>;
};
export type ViewerItem = {
    id: string;
    src: string;
    name: string;
    width?: number;
    height?: number;
    bytes?: number;
    download?: ViewerDownload;
    actions: ViewerAction[];
};
export type ViewerRequest = {
    items: ViewerItem[];
    index: number;
    opener?: HTMLElement;
    source: string;
    annotations: boolean;
};
export type ViewerSnapshot = ViewerRequest & {
    revision: number;
};
export declare function normalizeSubscriptionViewerRequest(input: unknown): ViewerRequest | undefined;
/**
 * Local image viewer state for subscription-generated images.
 *
 * This stays private to subscription image cards, which need annotation and
 * edit actions that a host's generic native viewer may not implement.
 */
export declare class SubscriptionImageViewerService {
    #private;
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => ViewerSnapshot | undefined;
    getAnnotationsSnapshot: () => Record<string, ViewerAnnotation[]>;
    constructor();
    setAnnotations(imageId: unknown, annotations: unknown): void;
    open(request: unknown): boolean;
    close(): void;
}
