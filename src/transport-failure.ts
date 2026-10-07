import type { AssistantMessageEvent } from '@earendil-works/pi-ai';
// pi-ai emits message-only errors for transient WebSocket closes and the
// gateway retry-buffer failure. Never relabel actual policy/size rejections.
export function normalizeTransportEvent(event: AssistantMessageEvent, signal?: AbortSignal): AssistantMessageEvent {
  if (signal?.aborted || event?.type !== 'error' || event.reason !== 'error') return event
  const message = event.error?.errorMessage
  if (typeof message !== 'string' || (message !== 'exceeded request buffer limit while retrying upstream'
    && !/^WebSocket closed (?:1006|1011|1012|1013)(?:\s|$)/.test(message))) return event
  return { ...event, error: { ...event.error, errorMessage: `Network transport failure: ${message}` } }
}
