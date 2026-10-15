import type { NetworkHistory, OperationHistory } from './diagnostic-types.js';
import type { AuthService } from './auth-types.js';
import type { CodexLoginCoordinator } from './login-coordinator.js';
import type { CodexNetworkTransport, NetworkAttempt } from './network-types.js';
import type { createOfficialModelCatalog } from './model-catalog.js';
interface DiagnosticsOptions { auth: Pick<AuthService, 'status'>; preferences: { status(): Record<string, unknown> }; login?: ReturnType<CodexLoginCoordinator['supportState']>; network?: Pick<CodexNetworkTransport, 'snapshot' | 'history'>; modelCatalog?: Pick<ReturnType<typeof createOfficialModelCatalog>, 'status' | 'capabilityGaps'>; connection?: { snapshot(): Record<string, number> }; compaction?: { snapshot(): Record<string, number> }; review?: { reviewCounters(): Record<string, number> }; inspectionOptions?: Parameters<typeof collectChecks>[1]; operations?: { snapshot(): OperationHistory }; runtimeManagement?: { status(): Promise<{ installed: boolean; available: boolean; restartRequired: boolean }> }; storage?: () => unknown; tools?: { get(name: string): unknown } }
import { hostDshVersion } from './subagent-runtime.js'
import { PACKAGE_VERSION } from './version.js'
import { collectChecks } from './diagnostic-checks.js'
import { capabilityCoverage } from './diagnostic-capabilities.js'
import { safeOperations } from './diagnostic-operations.js'

const requestAreas = new Set<unknown>(['login', 'model', 'catalog', 'quota', 'quota-reset', 'search', 'image'])
const statuses = new Set<unknown>(['ok', 'failed'])
const stages = new Set<unknown>(['transport', 'http'])
const codes = new Set<unknown>(['timeout', 'dns', 'tls', 'connection', 'network', 'http-error'])
const routes = new Set<unknown>(['direct', 'environment', 'system', 'bypass'])
const elapsedBuckets = new Set<unknown>(['under-1s', '1-5s', '5-15s', 'over-15s'])

function safeHistory(input: unknown) {
  const raw = input as NetworkHistory | undefined;
  if (!raw || !Array.isArray(raw.events)) return undefined
  const events = raw.events.slice(-32).flatMap(value => {
    if (!value || !requestAreas.has(value.area) || !statuses.has(value.status)
      || !Number.isSafeInteger(value.sequence) || value.sequence! < 1
      || !Number.isSafeInteger(value.observedAt) || value.observedAt < 0) return []
    return [{ area: value.area, status: value.status, sequence: value.sequence, observedAt: value.observedAt,
      ...(codes.has(value.code) ? { code: value.code } : {}),
      ...(Number.isInteger(value.httpStatus) && value.httpStatus! >= 100 && value.httpStatus! <= 599 ? { httpStatus: value.httpStatus } : {}),
    }]
  })
  return { scope: 'plugin-process', capacity: 32,
    dropped: (typeof raw.dropped === 'number' && Number.isSafeInteger(raw.dropped) && raw.dropped! >= 0 ? raw.dropped : 0) + Math.max(0, raw.events.length - 32), events }
}

function safeRequests(network: Pick<CodexNetworkTransport, 'snapshot'> | undefined) {
  const raw = network?.snapshot?.() ?? {}
  const result: Record<string, NetworkAttempt> = {}
  for (const [area, value] of Object.entries(raw)) {
    if (!requestAreas.has(area) || value === null || typeof value !== 'object') continue
    if (!statuses.has(value.status) || !routes.has(value.route) || !elapsedBuckets.has(value.elapsed)) continue
    result[area] = {
      status: value.status,
      ...(stages.has(value.stage) ? { stage: value.stage } : {}),
      ...(codes.has(value.code) ? { code: value.code } : {}),
      ...(Number.isInteger(value.httpStatus) && value.httpStatus! >= 100 && value.httpStatus! <= 599 ? { httpStatus: value.httpStatus } : {}),
      route: value.route,
      elapsed: value.elapsed,
    }
  }
  return result
}

/** Build a support report that deliberately excludes OAuth and account metadata. */
export async function createSubscriptionDiagnostics({ auth, preferences, login = { phase: 'idle' }, network, modelCatalog, connection, compaction, review, inspectionOptions, operations, runtimeManagement, storage, tools }: DiagnosticsOptions) {
  const collected: Record<string, unknown> = {}
  const checks = await collectChecks(([
    ['account', 'account', () => auth.status()],
    ['preferences', 'settings', () => preferences.status()],
    ['catalog', 'models', () => modelCatalog?.status?.()],
    ['gaps', 'models', () => modelCatalog?.capabilityGaps?.()],
    ['requests', 'transport', () => network?.snapshot ? safeRequests(network) : undefined],
    ['history', 'transport', () => safeHistory(network?.history?.())],
    ['websocket', 'transport', () => connection ? safeCounters(connection, ['requests', 'connectionsCreated', 'connectionsReused', 'deltaRequests', 'websocketFailures', 'sseFallbacks']) : undefined],
    ['compaction', 'compaction', () => compaction ? safeCounters(compaction, ['requests', 'checkpointsSaved', 'checkpointsReused']) : undefined],
    ['review', 'transport', () => typeof review?.reviewCounters === 'function' ? safeCounters({ snapshot: () => review.reviewCounters() }, ['requests', 'routed', 'sessionModel', 'retries']) : undefined],
    ['operations', 'transport', () => safeOperations(operations?.snapshot?.())],
    ['runtime', 'subagents', async () => {
      const value = await runtimeManagement?.status?.()
      return value ? Object.fromEntries(['available', 'installed', 'restartRequired'].filter(key => typeof value[key as keyof typeof value] === 'boolean').map(key => [key, value[key as keyof typeof value]])) : undefined
    }],
    ['storage', 'storage', async () => typeof storage === 'function' ? (await storage(), { readable: true }) : undefined],
    ['tools', 'host-ui', () => typeof tools?.get === 'function' ? {
      images: !!tools.get('codex_image_generate'), sketch: !!tools.get('codex_sketch'),
    } : undefined],
  ] as [string, string, () => unknown | Promise<unknown>][]).map(([id, capability, read]) => ({ id, capability, run: read ? async signal => {
    const value = await read()
    if (value === undefined) return { status: 'unknown', reason: 'not-instrumented' }
    if (!signal.aborted) collected[id] = value
    return { status: 'pass', reason: 'inspection-completed' }
  } : undefined })), inspectionOptions)
  const results = collected as { account?: Awaited<ReturnType<AuthService['status']>>; preferences?: Record<string, unknown>; catalog?: ReturnType<ReturnType<typeof createOfficialModelCatalog>['status']>; gaps?: ReturnType<ReturnType<typeof createOfficialModelCatalog>['capabilityGaps']>; runtime?: { installed: boolean; restartRequired: boolean }; tools?: Record<string, boolean>; storage?: { readable: boolean }; operations?: OperationHistory; history?: NetworkHistory; requests?: Record<string, NetworkAttempt>; websocket?: Record<string, number>; compaction?: Record<string, number>; review?: Record<string, number> };
  let account = { status: 'unknown' }
  const issues: { code: string }[] = []
  if (results.account) {
    const status = results.account
    account = { status: status.authenticated === true ? 'signed-in' : 'signed-out' }
  } else {
    issues.push({ code: 'account-status-unavailable' })
  }

  const preference = results.preferences ?? {}
  const catalog = results.catalog
  // Report only bounded capability identifiers, never the raw server catalog.
  const gaps = (Array.isArray(results.gaps) ? results.gaps : []).slice(0, 20).flatMap(value => {
    if (!value || typeof value.model !== 'string' || !/^[a-z][a-z0-9._-]{0,79}$/u.test(value.model)) return []
    const fields = Object.fromEntries(['reasoning', 'inputs', 'speeds'].flatMap(key => {
      const names = [...new Set((Array.isArray(value[key as keyof typeof value]) ? value[key as keyof typeof value] as unknown[] : [])
        .filter((name: unknown): name is string => typeof name === 'string' && /^[a-z][a-z0-9_-]{0,31}$/u.test(name)))].slice(0, 16)
      return names.length ? [[key, names]] : []
    }))
    return Object.keys(fields).length ? [{ model: value.model, ...fields }] : []
  })
  if (gaps.length) issues.push({ code: 'catalog-capabilities-not-adapted' })
  return {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    inspection: {
      schemaVersion: 1,
      meaning: 'collection-success-is-not-feature-success',
      checks,
      capabilities: capabilityCoverage({ account, preference, runtime: results.runtime, catalog, tools: results.tools, storage: results.storage, checks, operations: results.operations, history: results.history }),
    },
    package: 'dsh-codex-subscription',
    version: PACKAGE_VERSION,
    runtime: { node: process.version, platform: process.platform, arch: process.arch, ...(hostDshVersion() ? { dsh: hostDshVersion() } : {}) },
    account,
    login,
    requests: results.requests ?? {},
    ...(results.history ? { requestHistory: results.history } : {}),
    ...(results.operations ? { operations: results.operations } : {}),
    ...(results.websocket ? { websocket: results.websocket } : {}),
    ...(results.compaction ? { compaction: results.compaction } : {}),
    ...(results.review ? { review: results.review } : {}),
    ...(catalog && ['unavailable', 'online'].includes(catalog.source)
      && ['idle', 'refreshing', 'ok', 'failed'].includes(catalog.refresh)
      ? { catalog: { source: catalog.source, refresh: catalog.refresh, ...(gaps.length ? { unsupported: gaps } : {}) } } : {}),
    configuration: {
      ...(typeof preference.autoQuotaRetry === 'boolean' ? { autoQuotaRetry: preference.autoQuotaRetry } : {}),
      contextMode: preference.contextMode,
      quickQuotaMode: preference.quickQuotaMode,
      ...(typeof preference.outputVerbosity === 'string' ? { outputVerbosity: preference.outputVerbosity } : {}),
      searchProvider: preference.searchProvider,
      speedMode: preference.speedMode,
      ...(typeof preference.writable === 'boolean' ? { writable: preference.writable } : {}),
    },
    issues,
  }
}

function safeCounters(source: { snapshot(): Record<string, number> }, keys: readonly string[]) {
  const values = source.snapshot()
  return Object.fromEntries(keys.filter(key => Number.isSafeInteger(values?.[key]) && values[key] >= 0).map(key => [key, values[key]]))
}
