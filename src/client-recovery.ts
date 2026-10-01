import type { createSubscriptionRpcClient } from './rpc-contract.js';
import { CHANNEL, unwrap } from './rpc-contract.js'
import { classifyAccountStatusError } from './account-status-controller.js'
import { PACKAGE_VERSION } from './version.js'

export async function recoveryCall<const E extends string>(rpc: ReturnType<typeof createSubscriptionRpcClient>, endpoint: E, payload: unknown = {}, timeoutMs = 10_000) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const controller = new AbortController()
  try {
    return await Promise.race([
      Promise.resolve().then(() => rpc.call(CHANNEL, endpoint, payload, controller.signal)).then(unwrap),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { const error = Object.assign(new Error('Request timed out'), { code: 'timeout' }); reject(error); controller.abort(error) }, timeoutMs) }),
    ])
  } finally { clearTimeout(timer) }
}

// Deliberately exclude server messages, page URLs, credentials and account identity.
export function clientDiagnostic(error: unknown, now = Date.now()) {
  return { source: 'client-fallback', pluginVersion: PACKAGE_VERSION, generatedAt: new Date(now).toISOString(), serverDiagnostics: 'unavailable', error: classifyAccountStatusError(error) }
}
