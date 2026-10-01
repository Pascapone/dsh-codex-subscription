import type { ClientConnectionRpc, ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection/client';
import type { RpcResponse } from './rpc-response-types.js';
export const CHANNEL = '/codex-subscription'
export const RPC_ENDPOINTS = Object.freeze([
  'status', 'login/start', 'login/status', 'login/submit', 'login/cancel', 'logout',
  'account/select', 'account/remove', 'usage', 'diagnostics',
  'preferences/status', 'preferences/models', 'preferences/update',
  'runtime/status', 'runtime/install', 'runtime/remove', 'runtime/cancel',
  'reset-credit/inspect', 'reset-credit/prepare', 'reset-credit/consume',
  'image/original/chunk', 'transcription/transcribe',
  'sketch/connect', 'sketch/poll', 'sketch/claim', 'sketch/result', 'sketch/disconnect',
])

// Components use a plugin-scoped client; DSH owns transport and authentication.
export function createSubscriptionRpcClient(transport: Pick<ClientConnectionRpc, 'call'>) {
  return Object.freeze({
    call<const E extends string>(channel: string, endpoint: E, payload: unknown, signal?: AbortSignal): Promise<ConnectionRpcResult<RpcResponse<E>>> {
      if (channel !== CHANNEL || !RPC_ENDPOINTS.includes(endpoint)) throw new Error('Invalid subscription RPC target')
      return transport.call('/api', `codex-subscription/${endpoint}`, payload, signal) as Promise<ConnectionRpcResult<RpcResponse<E>>>
    },
  })
}

export function unwrap<T>(response: ConnectionRpcResult<T> | null | undefined): T {
  if (!response?.ok) throw new Error(response?.error?.message ?? 'Codex RPC failed')
  return response.value
}
