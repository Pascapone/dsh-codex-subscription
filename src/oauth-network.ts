import type { IncomingMessage } from 'node:http';
import type { FetchInput, FetchInit, NetworkScope, NetworkOptions, NetworkRoute, NetworkAttempt, ProxyOptions } from './network-types.js';
import { execFile } from 'node:child_process'
import { request as httpsRequest } from 'node:https'
import { AsyncLocalStorage } from 'node:async_hooks'
import { PassThrough, Readable } from 'node:stream'
import { promisify } from 'node:util'

import { HttpsProxyAgent } from 'https-proxy-agent'
import WebSocket from 'ws'

const execFileAsync = promisify(execFile)
const CODEX_AUTH_HOST = 'auth.openai.com'
const CODEX_SUBSCRIPTION_HOST = 'chatgpt.com'
const CODEX_HOSTS = new Set([CODEX_AUTH_HOST, CODEX_SUBSCRIPTION_HOST])

// A subscription bearer may only be routed to the companion's local Codex proxy.
export function headroomRouteUrl(value: unknown): string | undefined {
  const match = typeof value === 'string' && /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/backend-api$/u.exec(value)
  return match && Number(match[1]) <= 65535 ? value : undefined
}

function isHeadroomResponseTarget(value: URL, options?: NetworkOptions): boolean {
  const base = headroomRouteUrl(options?.headroomBaseUrl)
  if (!base || value.host !== new URL(base).host) return false
  const match = /^(?:http|ws):\/\/127\.0\.0\.1:([1-9]\d{0,4})\/backend-api\/codex\/responses$/u.exec(value.toString())
  return !!match && Number(match[1]) <= 65535
}

const networkScope = new AsyncLocalStorage<NetworkScope>()
let activeScopes = 0
let baseFetch: typeof fetch | undefined
let scopedFetch: typeof fetch | undefined
let baseWebSocket: typeof globalThis.WebSocket | undefined
let scopedWebSocket: typeof globalThis.WebSocket | undefined
let activeWebSocketScopes = 0

function normalizeProxy(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  const value = raw.trim().includes('://') ? raw.trim() : `http://${raw.trim()}`
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname === '') return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

function bypassesProxy(hostname: string, port: string, rawNoProxy: unknown): boolean {
  if (typeof rawNoProxy !== 'string' || rawNoProxy.trim() === '') return false
  return rawNoProxy.split(/[\s,]+/u).some(raw => {
    const entry = raw.trim().toLowerCase()
    if (entry === '*') return true
    if (entry === '') return false
    const match = /^(.*?)(?::(\d+))?$/u.exec(entry)
    const host = match?.[1]?.replace(/^\./u, '')
    const entryPort = match?.[2]
    if (!host || (entryPort && entryPort !== port)) return false
    return hostname === host || hostname.endsWith(`.${host}`)
  })
}

export function proxyFromEnvironment(env: NodeJS.ProcessEnv = process.env, target = new URL(`https://${CODEX_AUTH_HOST}/`)) {
  if (bypassesProxy(target.hostname.toLowerCase(), target.port || '443', env.NO_PROXY ?? env.no_proxy)) return undefined
  return normalizeProxy(env.HTTPS_PROXY ?? env.https_proxy ?? env.ALL_PROXY ?? env.all_proxy)
}

function selectWindowsProxy(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const entries = value.split(';').map(item => item.trim()).filter(Boolean)
  const https = entries.find(item => /^https=/iu.test(item))
  const http = entries.find(item => /^http=/iu.test(item))
  const selected = (https ?? http ?? entries.find(item => !item.includes('=')))?.replace(/^[^=]+=/u, '')
  return normalizeProxy(selected)
}

async function windowsSystemProxy(options: ProxyOptions = {}): Promise<string | undefined> {
  const run = options.execFile ?? execFileAsync
  const reg = `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\reg.exe`
  const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
  try {
    const enabled = await run(reg, ['query', key, '/v', 'ProxyEnable'], { windowsHide: true, encoding: 'utf8' })
    if (!/REG_DWORD\s+0x1\b/iu.test(enabled.stdout)) return undefined
    const configured = await run(reg, ['query', key, '/v', 'ProxyServer'], { windowsHide: true, encoding: 'utf8' })
    const match = /^\s*ProxyServer\s+REG_\w+\s+(.+)$/imu.exec(configured.stdout)
    return selectWindowsProxy(match?.[1])
  } catch {
    return undefined
  }
}

async function macSystemProxy(options: ProxyOptions = {}): Promise<string | undefined> {
  const run = options.execFile ?? execFileAsync
  try {
    const result = await run('/usr/sbin/scutil', ['--proxy'], { encoding: 'utf8' })
    if (!/^\s*HTTPSEnable\s*:\s*1\s*$/imu.test(result.stdout)) return undefined
    const host = /^\s*HTTPSProxy\s*:\s*(\S+)\s*$/imu.exec(result.stdout)?.[1]
    const port = /^\s*HTTPSPort\s*:\s*(\d+)\s*$/imu.exec(result.stdout)?.[1]
    return normalizeProxy(host && port ? `${host}:${port}` : undefined)
  } catch {
    return undefined
  }
}

export async function resolveCodexOAuthProxy(options: ProxyOptions = {}): Promise<string | undefined> {
  return (await resolveCodexProxy(options)).url
}

async function resolveCodexProxy(options: ProxyOptions = {}): Promise<{ url: string | undefined; source: NetworkRoute }> {
  const target = options.target ?? new URL(`https://${CODEX_AUTH_HOST}/`)
  const env = options.env ?? process.env
  if (bypassesProxy(target.hostname.toLowerCase(), target.port || '443', env.NO_PROXY ?? env.no_proxy)) {
    return { url: undefined, source: 'bypass' }
  }
  const envProxy = proxyFromEnvironment(env, target)
  if (envProxy) return { url: envProxy, source: 'environment' }
  const platform = options.platform ?? process.platform
  const system = platform === 'win32'
    ? await windowsSystemProxy(options)
    : platform === 'darwin'
      ? await macSystemProxy(options)
      : undefined
  return system ? { url: system, source: 'system' } : { url: undefined, source: 'direct' }
}

function bodyBytes(body: unknown): Buffer | undefined {
  if (body === undefined || body === null) return undefined
  if (typeof body === 'string') return Buffer.from(body)
  if (body instanceof URLSearchParams) return Buffer.from(body.toString())
  if (body instanceof Uint8Array) return Buffer.from(body)
  throw new TypeError('Unsupported Codex OAuth request body')
}

export function transportError<T>(input: T, signal?: AbortSignal | null): T | Error {
  const error = input as T & { name?: string; code?: string; message?: string } | null | undefined;
  if (signal?.aborted || error?.name === 'AbortError' || error?.code === 'ABORT_ERR') return input
  if (!/^(?:ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|EAI_AGAIN|ERR_STREAM_PREMATURE_CLOSE)$/.test(error?.code ?? '')) return input
  // pi-ai currently flattens Error to its message. Preserve both the original
  // typed cause and a stable transport signature for older host classifiers.
  return Object.assign(new Error(`Network transport failure (${error!.code}): ${error!.message}`, { cause: error }), { code: error!.code })
}

export function transportResponseBody(response: IncomingMessage, signal?: AbortSignal | null) {
  const body = new PassThrough()
  response.on('error', error => body.destroy(transportError(error, signal)))
  // Cancelling the web reader must also release an idle underlying connection.
  body.on('close', () => response.destroy())
  const stream = Readable.toWeb(body)
  response.pipe(body)
  return stream
}

export function fetchThroughProxy(input: FetchInput, init: FetchInit, proxyUrl: string): Promise<Response> {
  const target = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  const body = bodyBytes(init?.body)
  const headers = new Headers(init?.headers)
  if (body && !headers.has('content-length')) headers.set('content-length', String(body.byteLength))
  return new Promise<Response>((resolve, reject) => {
    const request = httpsRequest(target, {
      method: init?.method ?? 'GET',
      headers: Object.fromEntries(headers.entries()),
      agent: new HttpsProxyAgent(proxyUrl),
      signal: init?.signal as AbortSignal | undefined,
    }, response => {
      const responseHeaders = new Headers()
      for (const [name, value] of Object.entries(response.headers)) {
        if (Array.isArray(value)) value.forEach(item => responseHeaders.append(name, item))
        else if (value !== undefined) responseHeaders.set(name, value)
      }
      const status = response.statusCode ?? 500
      const empty = init?.method === 'HEAD' || [204, 205, 304].includes(status)
      if (empty) response.resume()
      resolve(new Response(empty ? null : transportResponseBody(response, init?.signal) as unknown as ConstructorParameters<typeof Response>[0], {
        status,
        statusText: response.statusMessage,
        headers: responseHeaders,
      }))
    })
    request.on('error', error => reject(transportError(error, init?.signal)))
    if (body) request.write(body)
    request.end()
  })
}

export async function withCodexNetwork<T>(run: () => T | Promise<T>, options: NetworkOptions = {}): Promise<T> {
  if (options.websocket && activeWebSocketScopes === 0) {
    baseWebSocket = globalThis.WebSocket
    const original = baseWebSocket
    scopedWebSocket = new Proxy(original ?? WebSocket, {
      construct(target, args, newTarget) {
        const scope = networkScope.getStore()
        const url = new URL(String(args[0]))
        const local = isHeadroomResponseTarget(url, scope?.options) && url.protocol === 'ws:'
        if (!scope?.options.websocket || (!local && (url.protocol !== 'wss:' || url.hostname !== CODEX_SUBSCRIPTION_HOST))) return Reflect.construct(target, args, newTarget)
        const proxy = local ? undefined : scope.options.websocketProxy
        return new WebSocket(args[0] as string, { ...(args[1] as WebSocket.ClientOptions | undefined), ...(proxy ? { agent: new HttpsProxyAgent(proxy) } : {}) })
      },
    }) as typeof globalThis.WebSocket
    globalThis.WebSocket = scopedWebSocket
  }
  if (options.websocket) activeWebSocketScopes += 1
  if (activeScopes === 0) {
    baseFetch = globalThis.fetch
    scopedFetch = async (input, init) => {
      const scope = networkScope.getStore()
      if (scope === undefined) return baseFetch!(input, init)
      const { options: scopedOptions, allowedHosts, resolved } = scope
      const proxyFetch = scopedOptions.fetchThroughProxy ?? fetchThroughProxy
      const target = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
      if (target.protocol === 'http:' && isHeadroomResponseTarget(target, scopedOptions)) {
        const response = await baseFetch!(input, init)
        return scopedOptions.transformResponse?.(response, target) ?? response
      }
      if (target.protocol !== 'https:' || !allowedHosts.has(target.hostname)) return baseFetch!(input, init)
      let proxy = resolved.get(target.hostname)
      if (proxy === undefined) {
        proxy = resolveCodexProxy({ ...scopedOptions, target })
        resolved.set(target.hostname, proxy)
      }
      const route = await proxy
      scopedOptions.onRoute?.(route.source)
      const response = await (route.url === undefined ? baseFetch!(input, init) : proxyFetch(input, init, route.url))
      return scopedOptions.transformResponse?.(response, target) ?? response
    }
    globalThis.fetch = scopedFetch
  }
  activeScopes += 1
  const scope: NetworkScope = {
    options,
    allowedHosts: options.hosts ?? CODEX_HOSTS,
    resolved: new Map(),
  }
  try {
    return await networkScope.run(scope, run)
  } finally {
    if (options.websocket && --activeWebSocketScopes === 0) {
      if (globalThis.WebSocket === scopedWebSocket) globalThis.WebSocket = baseWebSocket!
      baseWebSocket = undefined
      scopedWebSocket = undefined
    }
    activeScopes -= 1
    if (activeScopes === 0) {
      if (globalThis.fetch === scopedFetch) globalThis.fetch = baseFetch!
      baseFetch = undefined
      scopedFetch = undefined
    }
  }
}

export const withCodexOAuthNetwork = <T>(run: () => T | Promise<T>, options: NetworkOptions = {}) => withCodexNetwork(run, {
  ...options,
  hosts: new Set([CODEX_AUTH_HOST]),
})

function classifyTransportError(input: unknown): NonNullable<NetworkAttempt['code']> {
  const error = input as { name?: unknown; code?: unknown; cause?: { code?: unknown } | null } | null | undefined;
  const name = error?.name
  const code = String(error?.code ?? error?.cause?.code ?? '')
  if (name === 'AbortError' || name === 'TimeoutError' || /ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/u.test(code)) return 'timeout'
  if (/ENOTFOUND|EAI_AGAIN/u.test(code)) return 'dns'
  if (/CERT_|TLS|SSL/u.test(code)) return 'tls'
  if (/ECONN|EPIPE|UND_ERR_SOCKET/u.test(code)) return 'connection'
  return 'network'
}

const elapsedBucket = (elapsed: number): NetworkAttempt['elapsed'] => elapsed < 1_000 ? 'under-1s' : elapsed < 5_000 ? '1-5s' : elapsed < 15_000 ? '5-15s' : 'over-15s'

export function createCodexNetworkTransport(options: NetworkOptions = {}) {
  const attempts = new Map<string, NetworkAttempt>()
  const now = options.now ?? Date.now
  const run = async <T>(area: string, operation: () => T | Promise<T>, connection: NetworkOptions = {}): Promise<T> => {
    const startedAt = now()
    let route: NetworkRoute = attempts.get(area)?.route ?? 'direct'
    let routed = false
    try {
      const value = await withCodexNetwork(operation, { ...options, ...connection, onRoute: source => { route = source; routed = true } })
      if (value instanceof Response && !value.ok) {
        attempts.set(area, { status: 'failed', stage: 'http', code: 'http-error', httpStatus: value.status, route, elapsed: elapsedBucket(now() - startedAt) })
      } else if (routed || value instanceof Response) {
        attempts.set(area, { status: 'ok', route, elapsed: elapsedBucket(now() - startedAt) })
      }
      return value
    } catch (error) {
      if (routed) attempts.set(area, { status: 'failed', stage: 'transport', code: classifyTransportError(error), route, elapsed: elapsedBucket(now() - startedAt) })
      throw error
    }
  }
  return Object.freeze({
    run,
    fetch: (area: string, input: FetchInput, init?: FetchInit) => run(area, () => globalThis.fetch(input, init)),
    snapshot: () => Object.fromEntries([...attempts].map(([area, value]) => [area, { ...value }])),
  })
}
