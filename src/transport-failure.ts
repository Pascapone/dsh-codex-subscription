import type { AssistantMessageEvent } from '@earendil-works/pi-ai';
// Normalize transient WebSocket closes; other errors stay owned by dsh-robust.
export function normalizeTransportEvent(event: AssistantMessageEvent, signal?: AbortSignal): AssistantMessageEvent {
  if (signal?.aborted || event?.type !== 'error' || event.reason !== 'error') return event
  const message = event.error?.errorMessage
  if (typeof message !== 'string' || !/^WebSocket closed (?:1006|1011|1012|1013)(?:\s|$)/.test(message)) return event
  return { ...event, error: { ...event.error, errorMessage: `Network transport failure: ${message}` } }
}
