export type WireItem = Record<string, unknown>;
export type Scope = { account: string; model: string };
export type Checkpoint = { version: number; scope: string; prefixLength: number; prefixDigest: string; items: WireItem[]; itemsDigest: string };
/** Experimental wire-state prototype; not imported by the shipped plugin. */
import { createHash } from 'node:crypto'
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const identity = (scope: Scope | null | undefined) => {
  if (!scope?.account || !scope?.model) throw new Error('Account and model scope are required')
  return digest([scope.account, scope.model])
}

/** Only completed responses can replace a checkpoint. Keep every trailing item. */
export function captureCheckpoint(input: readonly WireItem[] | undefined, response: { status?: string; output?: WireItem[] } | null | undefined, scope: Scope) {
  if (!Array.isArray(input)) throw new Error('Expected a wire input array')
  if (response?.status !== 'completed' || !Array.isArray(response.output)) return undefined
  const index = response.output.findLastIndex(item => item.type === 'compaction')
  if (index < 0) return undefined
  const items = clone(response.output.slice(index))
  if (typeof items[0].encrypted_content !== 'string' || !items[0].encrypted_content) throw new Error('Invalid compaction item')
  return {
    version: 1, scope: identity(scope),
    // Require the exact original wire history before pruning; edits and forks fall back.
    prefixLength: input.length + response.output.length,
    prefixDigest: digest([...input, ...response.output]),
    items, itemsDigest: digest(items),
  }
}

/** Return undefined on a stale/foreign/corrupt checkpoint; caller keeps full history. */
export function replayCheckpoint(history: readonly WireItem[] | undefined, checkpoint: Checkpoint | null | undefined, scope: Scope) {
  if (!checkpoint || checkpoint.version !== 1 || checkpoint.scope !== identity(scope)) return undefined
  if (!Array.isArray(history) || !Number.isSafeInteger(checkpoint.prefixLength) || checkpoint.prefixLength < 1 || checkpoint.prefixLength > history.length) return undefined
  if (!Array.isArray(checkpoint.items) || checkpoint.items[0]?.type !== 'compaction' || typeof checkpoint.items[0]?.encrypted_content !== 'string' || !checkpoint.items[0].encrypted_content) return undefined
  if (digest(checkpoint.items) !== checkpoint.itemsDigest || digest(history.slice(0, checkpoint.prefixLength)) !== checkpoint.prefixDigest) return undefined
  return clone([...checkpoint.items, ...history.slice(checkpoint.prefixLength)])
}
