import type { ImageEditAnnotation } from './image-edit.js';
export type ViewerAnnotation = Omit<ImageEditAnnotation, 'number'> & { id: string };
export type ViewerDownloadContext = { item: ViewerItem; src: string; signal: AbortSignal; onProgress(progress: { loaded: number; total: number }): void };
export type ViewerActionContext = { item: ViewerItem; src: string; annotations: ViewerAnnotation[] };
export type ViewerDownload = { pendingLabel?: string; errorLabel?: string; onInvoke(context: ViewerDownloadContext): unknown | Promise<unknown> };
export type ViewerAction = Omit<ViewerDownload, 'onInvoke'> & { id: string; label: string; pendingLabel: string; errorLabel: string; closeOnSuccess: boolean; onInvoke(context: ViewerActionContext): unknown | Promise<unknown> };
export type ViewerItem = { id: string; src: string; name: string; width?: number; height?: number; bytes?: number; download?: ViewerDownload; actions: ViewerAction[] };
export type ViewerRequest = { items: ViewerItem[]; index: number; opener?: HTMLElement; source: string; annotations: boolean };
export type ViewerSnapshot = ViewerRequest & { revision: number };
type RawAction = { onInvoke?: ViewerAction['onInvoke']; label?: string; id?: string; pendingLabel?: string; errorLabel?: string; closeOnSuccess?: unknown };
type RawItem = { src?: string; id?: string; name?: string; width?: unknown; height?: unknown; bytes?: unknown; download?: unknown; actions?: unknown };
// Adapted from WSL043/dsh-image-viewer 0.1.0-beta.9, MIT; see THIRD_PARTY_NOTICES.md.

const boundedNumber = (value: unknown, fallback: undefined) => Number.isFinite(value) && (value as number) > 0 ? value as number : fallback

const downloadOf = (value: Partial<ViewerDownload> | null | undefined): ViewerDownload | undefined => typeof value?.onInvoke === 'function' ? {
  pendingLabel: typeof value.pendingLabel === 'string' && value.pendingLabel !== '' ? value.pendingLabel : undefined,
  errorLabel: typeof value.errorLabel === 'string' && value.errorLabel !== '' ? value.errorLabel : undefined,
  onInvoke: value.onInvoke,
} : undefined

const actionsOf = (value: unknown): ViewerAction[] => Array.isArray(value) ? (value as RawAction[]).flatMap((action, position) => {
  if (typeof action?.onInvoke !== 'function' || typeof action?.label !== 'string' || action.label.trim() === '') return []
  return [{
    id: typeof action.id === 'string' && action.id !== '' ? action.id : `action-${position + 1}`,
    label: action.label,
    pendingLabel: typeof action.pendingLabel === 'string' && action.pendingLabel !== '' ? action.pendingLabel : action.label,
    errorLabel: typeof action.errorLabel === 'string' && action.errorLabel !== '' ? action.errorLabel : action.label,
    closeOnSuccess: action.closeOnSuccess === true,
    onInvoke: action.onInvoke,
  }]
}) : []

export function normalizeSubscriptionViewerRequest(input: unknown): ViewerRequest | undefined {
  const request = input as { items?: unknown; index?: number; opener?: unknown; source?: unknown; annotations?: unknown } | null | undefined;
  const rawItems = Array.isArray(request?.items) ? request.items as RawItem[] : []
  const items = rawItems.flatMap((item, position) => {
    if (typeof item?.src !== 'string' || item.src === '') return []
    return [{
      id: typeof item.id === 'string' && item.id !== '' ? item.id : item.src,
      src: item.src,
      name: typeof item.name === 'string' && item.name !== '' ? item.name : `Image ${position + 1}`,
      width: boundedNumber(item.width, undefined),
      height: boundedNumber(item.height, undefined),
      bytes: boundedNumber(item.bytes, undefined),
      download: downloadOf(item.download as Partial<ViewerDownload> | null | undefined),
      actions: actionsOf(item.actions),
    }]
  })
  if (items.length === 0) return undefined
  const requestedIndex = Number.isInteger(request?.index) ? request!.index! : 0
  return {
    items,
    index: Math.max(0, Math.min(items.length - 1, requestedIndex)),
    opener: typeof HTMLElement !== 'undefined' && request?.opener instanceof HTMLElement ? request.opener : undefined,
    source: typeof request?.source === 'string' ? request.source : 'dsh-codex-subscription',
    annotations: request?.annotations !== false,
  }
}

const copyAnnotations = (annotations: readonly ViewerAnnotation[]) => annotations.map(annotation => ({ ...annotation }))

/**
 * Local image viewer state for subscription-generated images.
 *
 * This stays private to subscription image cards, which need annotation and
 * edit actions that a host's generic native viewer may not implement.
 */
export class SubscriptionImageViewerService {
  #listeners = new Set<() => void>()
  #revision = 0
  #snapshot: ViewerSnapshot | undefined
  #annotationsByImage = new Map<string, ViewerAnnotation[]>()

  declare subscribe: (listener: () => void) => () => void;
  declare getSnapshot: () => ViewerSnapshot | undefined;
  declare getAnnotationsSnapshot: () => Record<string, ViewerAnnotation[]>;
  constructor() {
    this.subscribe = listener => {
      this.#listeners.add(listener)
      return () => { this.#listeners.delete(listener) }
    }
    this.getSnapshot = () => this.#snapshot
    this.getAnnotationsSnapshot = () => Object.fromEntries(
      [...this.#annotationsByImage].map(([id, annotations]) => [id, copyAnnotations(annotations)]),
    )
  }

  setAnnotations(imageId: unknown, annotations: unknown) {
    if (typeof imageId !== 'string' || imageId === '' || !Array.isArray(annotations)) return
    if (annotations.length === 0) this.#annotationsByImage.delete(imageId)
    else this.#annotationsByImage.set(imageId, copyAnnotations(annotations as ViewerAnnotation[]))
  }

  open(request: unknown) {
    const normalized = normalizeSubscriptionViewerRequest(request)
    if (normalized === undefined) return false
    this.#revision += 1
    this.#snapshot = { ...normalized, revision: this.#revision }
    this.#emit()
    return true
  }

  close() {
    if (this.#snapshot === undefined) return
    const opener = this.#snapshot.opener
    this.#snapshot = undefined
    this.#emit()
    if (typeof window === 'undefined') opener?.focus()
    else {
      const focus = () => { opener?.focus() }
      if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(focus)
      else focus()
    }
  }

  #emit() {
    for (const listener of this.#listeners) listener()
  }
}
