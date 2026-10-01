import type { StreamOptions } from '@earendil-works/pi-ai';
import type { NetworkOptions } from './network-types.js';
import { createHash, randomUUID } from 'node:crypto'
import { closeOpenAICodexWebSocketSessions, resetOpenAICodexWebSocketDebugStats } from '@earendil-works/pi-ai/api/openai-codex-responses'
import { headroomRouteUrl, resolveCodexOAuthProxy } from './oauth-network.js'

// Keep the native protocol, continuation and pre-stream fallback. Scope its
// cache even on older pi-ai hosts whose socket pool is keyed by session alone.
export function createSubscriptionConnection({ resolveMode = () => 'sse', resolveProxy = resolveCodexOAuthProxy }: { resolveMode?: () => 'sse' | 'websocket'; resolveProxy?: typeof resolveCodexOAuthProxy } = {}) {
  const namespace = randomUUID()
  const sessions = new Set<string>()
  return {
    async prepare(options: StreamOptions = {}, baseUrl?: string): Promise<{ options: StreamOptions & { websocketConnectTimeoutMs?: number }; network?: NetworkOptions }> {
      const local = headroomRouteUrl(baseUrl)
      if (resolveMode() !== 'websocket') return {
        options: { ...options, transport: 'sse' as const },
        ...(local ? { network: { headroomBaseUrl: local } } : {}),
      }
      const proxy = local ? undefined : await resolveProxy({ target: new URL(baseUrl ?? 'https://chatgpt.com/') })
      const sessionId = options.sessionId && `dsh-${createHash('sha256').update(JSON.stringify([namespace, options.sessionId, options.apiKey, proxy, baseUrl])).digest('hex').slice(0,56)}`
      if (sessionId) sessions.add(sessionId)
      return {
        options: { ...options, sessionId, transport: 'websocket-cached' as const, websocketConnectTimeoutMs: 10000, env: {} },
        network: { websocket: true, websocketProxy: proxy, ...(local ? { headroomBaseUrl: local } : {}) },
      }
    },
    dispose() {
      for (const session of sessions) {
        closeOpenAICodexWebSocketSessions(session)
        resetOpenAICodexWebSocketDebugStats(session)
      }
      sessions.clear()
    },
  }
}
