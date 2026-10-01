import type { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai';
import type { WebSearchProvider } from '@deepseek-ai/dsh-web';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
type FixtureAdapter = Pick<PiAiAdapter, 'listModels' | 'resolveModel' | 'prepareCall'> & {current: PiAiAdapter['current']; providerRetryPolicy(): unknown};
type FixtureAssembly = {sections: {name: string; text: string; interpolate?: boolean}[]; contexts: unknown[]; tools: unknown[]; variables: Record<string, string>};
type FixtureListener = (assembly: unknown, context: unknown, next: () => Promise<FixtureAssembly>) => Promise<FixtureAssembly>;
type FixtureRoute = {path: string; methods: string[]; fetch(request: Request): Response | Promise<Response>};
type FixtureValue = Record<string, unknown> & {contextModels: ReturnType<typeof contextModelGroups>; verbosityModels: string[]; catalog: {source: string; refresh: string}};
type FixtureReply = {ok: boolean; value: FixtureValue; error: {message: string}};
import assert from 'node:assert/strict'
import { RPC_ENDPOINTS } from '../src/rpc-contract.js'
import { IMAGE_FEATURE_DEFAULTS } from '../src/image-features.js'
import { DSH_MODEL_PROMPTS } from '../src/codex-base-prompts.js'
import test from 'node:test'
import Schema from '@deepseek-ai/schemastery'

test('settings schema survives the native browser JSON round trip', () => {
  const host = fakeContext()
  applyPlugin(((host.ctx) as unknown as Parameters<typeof applyPlugin>[0]))
  const schema = host.settings[0].schema
  const value = schema({ imageSketch: true, imageSketchAgent: true, searchDomains: ['EXAMPLE.com', 'example.com'] })
  const browserSchema = new Schema(JSON.parse(JSON.stringify(schema)))
  assert.deepEqual(browserSchema(JSON.parse(JSON.stringify(value))), value)
  assert.deepEqual(value.searchDomains, ['example.com'])
  assert.throws(() => browserSchema({ searchDomains: ['https://example.com/path'] }), /Invalid search domain/)
})

import * as plugin from '../src/index.js'
import { PACKAGE_VERSION } from '../src/version.js'
import {
  CONTEXT_MODE_CUSTOM,
  CONTEXT_MODE_EXTENDED,
  CONTEXT_MODE_STANDARD,
  CUSTOM_CONTEXT_MODEL_DEFAULTS,
  contextModelGroups,
  CUSTOM_CONTEXT_WINDOW_FIELD,
  CONTEXT_MODE_FIELD,
  formatContextWindow,
  normalizeQuickQuotaMode,
  normalizeSearchProvider,
  parseContextWindow,
  QUICK_QUOTA_MODE_BAR,
  QUICK_QUOTA_MODE_FORECAST,
  QUICK_QUOTA_MODE_OFF,
  QUICK_QUOTA_MODE_PERCENT,
  OUTPUT_VERBOSITY_DEFAULT,
  OUTPUT_VERBOSITY_FIELD,
  SEARCH_PROVIDER_AUTO,
  SEARCH_PROVIDER_CODEX,
  SEARCH_PROVIDER_DSH,
  SPEED_MODE_FAST,
  SPEED_MODE_STANDARD,
} from '../src/settings-contract.js'

const { apply: applyPlugin } = plugin

test('composer quota mode normalizes formal values and legacy booleans', () => {
  assert.equal(normalizeQuickQuotaMode(QUICK_QUOTA_MODE_OFF), QUICK_QUOTA_MODE_OFF)
  assert.equal(normalizeQuickQuotaMode(QUICK_QUOTA_MODE_PERCENT), QUICK_QUOTA_MODE_PERCENT)
  assert.equal(normalizeQuickQuotaMode(QUICK_QUOTA_MODE_BAR), QUICK_QUOTA_MODE_BAR)
  assert.equal(normalizeQuickQuotaMode(QUICK_QUOTA_MODE_FORECAST), QUICK_QUOTA_MODE_FORECAST)
  assert.equal(normalizeQuickQuotaMode(undefined, true), QUICK_QUOTA_MODE_PERCENT)
  assert.equal(normalizeQuickQuotaMode(undefined, false), QUICK_QUOTA_MODE_OFF)
  assert.equal(normalizeQuickQuotaMode('invalid', true), QUICK_QUOTA_MODE_PERCENT)
})

test('context settings expose safe presets and bounded custom values', async () => {
  assert.equal(plugin.normalizeContextMode(CONTEXT_MODE_STANDARD), CONTEXT_MODE_STANDARD)
  assert.equal(plugin.normalizeContextMode(CONTEXT_MODE_EXTENDED), CONTEXT_MODE_EXTENDED)
  assert.equal(plugin.normalizeContextMode(CONTEXT_MODE_CUSTOM), CONTEXT_MODE_CUSTOM)
  assert.equal(plugin.normalizeContextMode('unknown'), CONTEXT_MODE_STANDARD)
  assert.equal(plugin.normalizeCustomContextWindow(500_000), 500_000)
  assert.equal(plugin.normalizeCustomContextWindow(99), 128_000)
  assert.equal(plugin.normalizeCustomContextWindow(2_000_000), 1_000_000)
})

test('custom context starts from the audited Codex default and accepts plain token counts', () => {
  assert.deepEqual(CUSTOM_CONTEXT_MODEL_DEFAULTS, {
    'gpt-5.4': 272_000,
    'gpt-5.4-mini': 272_000,
    'gpt-5.5': 272_000,
    'gpt-5.6': 272_000,
    'gpt-6-astra': 272_000,
  })
  assert.equal(formatContextWindow(1_000_000), '1M')
  assert.equal(formatContextWindow(400_000), '400K')
  assert.equal(parseContextWindow('750000'), 750_000)
  assert.equal(parseContextWindow('272000'), 272_000)
  assert.ok(Number.isNaN(parseContextWindow('750K')))
  assert.ok(Number.isNaN(parseContextWindow('0.5M')))
})

test('custom context rows follow the active upstream model catalog', () => {
  assert.deepEqual(contextModelGroups([
    { id: 'gpt-5.4', name: 'GPT-5.4' },
    { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' },
    { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra' },
    { id: 'gpt-6-astra', name: 'GPT-6 Astra' },
    { id: 'gpt-5.3-codex-spark', name: 'GPT-5.3 Codex Spark' },
  ]), [
    { key: 'gpt-5.4', label: 'GPT-5.4', maximum: 1_000_000 },
    { key: 'gpt-5.6', label: 'GPT-5.6 Sol / Terra', maximum: 1_000_000 },
    { key: 'gpt-6-astra', label: 'GPT-6 Astra', maximum: 872_000 },
    { key: 'gpt-5.3-codex-spark', label: 'GPT-5.3 Codex Spark', maximum: 128_000, fixed: true },
  ])
})

function fakeContext({ connection = true, webServer = true, prompt = false } = {}) {
  const promptHooks: {listener: FixtureListener; options: {prepend: boolean}}[] = []
  const registered: {providers: string[]; adapter: FixtureAdapter}[] = []
  const handled: FixtureRoute[] = []
  const searchProviders: WebSearchProvider[] = []
  const tools: ToolDefinition[] = []
  const settings: {namespace: string; schema: typeof plugin.Config}[] = []
  const webUpdates: {config: {searchProvider: string; fetchProvider: string}; noSave: boolean}[] = []
  const provided = new Map<string, unknown>()
  let preference: Record<string, unknown> = { quickQuotaVisible: false, searchProvider: SEARCH_PROVIDER_AUTO, outputVerbosity: OUTPUT_VERBOSITY_DEFAULT, speedMode: SPEED_MODE_STANDARD, contextMode: CONTEXT_MODE_STANDARD, customContextWindow: 272_000, customContextGpt54: 1_000_000, customContextGpt54Mini: 400_000, customContextGpt55: 1_000_000, customContextGpt56: 1_000_000 }
  const preferenceWatchers = new Set<(value: Record<string, unknown>, previous: Record<string, unknown>) => unknown>()
  let credential: string | undefined
  const webEntry = {
    options: { id: 'web', config: { searchProvider: 'deepseek-official', fetchProvider: 'local' } },
    fiber: {
      config: { searchProvider: 'deepseek-official', fetchProvider: 'local' },
      async update(config: {searchProvider: string; fetchProvider: string}, noSave: boolean) {
        webUpdates.push({ config, noSave })
        this.config = config
      },
    },
  }
  const searchProviderMap = new Map<string, WebSearchProvider>([['deepseek-official', { id: 'deepseek-official', available: () => true, async search() { return { sources: [], truncated: false } } }]])
  const ctx = {
    systemPrompt: prompt ? {} : undefined,
    on(event: string, listener: FixtureListener, options: {prepend: boolean}) { if (event === 'system-prompt/assemble') promptHooks.push({ listener, options }); return () => {} },
    credentials: {
      async resolve() { return credential === undefined ? undefined : { value: credential } },
      async set(_ref: unknown, value: string) { credential = value },
      async unset() { credential = undefined },
    },
    llm: {
      registerAdapter(providers: string[], adapter: FixtureAdapter) {
        registered.push({ providers, adapter })
        return () => {}
      },
    },
    attachments: {
      imageLimits: {
        maxImageBytes: 10 * 1024 * 1024,
        maxMessageImageBytes: 10 * 1024 * 1024,
        mediaTypes: ['image/png'],
      },
      async saveImage() { throw new Error('not used') },
    },
    tools: {
      register(tool: ToolDefinition) {
        tools.push(tool)
        return () => { const index=tools.indexOf(tool);if(index>=0)tools.splice(index,1) }
      },
    },
    web: {
      searchProviders: searchProviderMap,
      registerSearchProvider(provider: WebSearchProvider) {
        searchProviders.push(provider)
        searchProviderMap.set(provider.id, provider)
        return () => {}
      },
    },
    webServer: webServer ? {} : undefined,
    connection: connection ? {
      fetch: {
        register(route: FixtureRoute) {
          handled.push(route)
          return () => {}
        },
      },
    } : undefined,
    settings: {
      writable: true,
      register(namespace: string, schema: typeof plugin.Config) {
        settings.push({ namespace, schema })
         return {
           get: () => preference,
           async update(patch: Record<string, unknown>) {
             const previous = preference
             preference = { ...preference, ...patch }
             await Promise.all([...preferenceWatchers].map(callback => callback(preference, previous)))
           },
           watch(callback: (value: Record<string, unknown>, previous: Record<string, unknown>) => unknown) {
             preferenceWatchers.add(callback)
             return () => preferenceWatchers.delete(callback)
           },
         }
      },
    },
    loader: {
      * entries() { yield webEntry },
    },
    inject(services: string[], callback: (value: unknown) => void) {
      if (services.every(service => (ctx as Record<string, unknown>)[service] !== undefined)) callback(ctx)
    },
    get(name: string) { return provided.get(name) },
    provide(name: string, value: unknown) { provided.set(name, value) },
    effect(register: () => unknown) { return register() },
  }
  return {
    ctx, registered, handled, provided, searchProviders, settings, tools, webUpdates, promptHooks,
    async request(endpoint: string, payload: unknown, signal: AbortSignal) {
      const method = 'codex-subscription/' + endpoint
      const route = handled.find(route => route.path === '/api/' + method)!
      const response = await route.fetch(new Request('http://localhost' + route.path, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({type:'client-request',rpcId:'test-rpc',method,payload}), signal}))
      return (await response.json()).result as FixtureReply
    },
    async updateSettings(patch: Record<string, unknown>) {
      const previous = preference
      preference = { ...preference, ...patch }
      await Promise.all([...preferenceWatchers].map(callback => callback(preference, previous)))
    },
  }
}

test('session speed writes keep other sessions and reject invalid requests', async () => {
  const host = fakeContext()
  applyPlugin(((host.ctx) as unknown as Parameters<typeof applyPlugin>[0]))
  const signal = new AbortController().signal
  const [first, second] = await Promise.all([
    host.request('preferences/update', { sessionId: 'session-a', speedMode: 'fast' }, signal),
    host.request('preferences/update', { sessionId: 'session-b', speedMode: 'fast' }, signal),
  ])
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  assert.deepEqual((await host.request('preferences/status', {}, signal)).value.sessionSpeedModes, {
    'session-a': 'fast', 'session-b': 'fast',
  })
  await host.request('preferences/update', { sessionId: 'session-b', speedMode: 'standard' }, signal)
  assert.deepEqual((await host.request('preferences/status', {}, signal)).value.sessionSpeedModes, {
    'session-a': 'fast', 'session-b': 'standard',
  })
  assert.equal((await host.request('preferences/update', { sessionId: 'session-c', speedMode: 'turbo' }, signal)).ok, false)
})

test('account routes register without directly accessing the web server', () => {
  const host = fakeContext({ webServer: false })
  assert.doesNotThrow(() => applyPlugin(((host.ctx) as unknown as Parameters<typeof applyPlugin>[0])))
  assert.equal(host.handled.length, RPC_ENDPOINTS.length + 1)
  assert.equal(host.tools.length, 1)
})

test('plugin activates without the web connection service in Headless mode', () => {
  const host = fakeContext({ connection: false })

  assert.doesNotThrow(() => applyPlugin(((host.ctx) as unknown as Parameters<typeof applyPlugin>[0])))
  assert.deepEqual(host.registered.map(item => item.providers), [['openai-codex']])
  assert.equal(host.handled.length, 0)
})

test('every advertised Codex model resolves and prepares without reading credentials', async () => {
  const host = fakeContext()
  applyPlugin(((host.ctx) as unknown as Parameters<typeof applyPlugin>[0]))
  // Activation may inspect account state; model metadata must not require it.
  host.ctx.credentials.resolve = async () => assert.fail('model metadata must not read credentials')
  const adapter = host.registered[0].adapter
  const models = await adapter.listModels('openai-codex')
  assert.ok(models.length > 0)
  for (const model of models) {
    const resolved = await adapter.resolveModel('openai-codex', model.id)!
    assert.equal(resolved.provider, 'openai-codex')
    assert.equal(resolved.id, model.id)
    assert.ok(resolved.context!.contextWindow > 0)
    const prepared = await adapter.prepareCall('openai-codex', model.id)
    assert.deepEqual(prepared.model, resolved)
    assert.equal(typeof prepared.stream, 'function')
  }
})

test('plugin registers one Codex route, subscription image tool, and DSH-trusted redacted RPC', async () => {
  const host = fakeContext()
  applyPlugin(((host.ctx) as unknown as Parameters<typeof applyPlugin>[0]))

  assert.equal('CODEX_PROVIDER_POLICY' in plugin, false, 'do not replace the removed boundary with cosmetic metadata')
  assert.deepEqual(host.registered.map(item => item.providers), [['openai-codex']])
  const profile = host.registered[0].adapter.current().profiles.get('openai-codex')!
  assert.deepEqual({
    maxRequestImageBytes: profile.maxRequestImageBytes,
    requestImagePixelBudget: profile.requestImagePixelBudget,
    requestImageMaxBytes: profile.requestImageMaxBytes,
  }, {
    maxRequestImageBytes: 20 * 1024 * 1024,
    requestImagePixelBudget: 2048 * 2048,
    requestImageMaxBytes: 1024 * 1024,
  })
  assert.ok(profile.modelErrors instanceof Map, 'the host adapter reads model diagnostics from the profile on resolution')
  assert.equal(profile.modelErrors.get('gpt-5.5'), undefined, 'a serviceable model records no diagnostic')
  assert.deepEqual(host.searchProviders.map(provider => provider.id), ['codex-subscription', 'codex-subscription-auto'])
  assert.deepEqual(host.tools.map(tool => tool.name), ['codex_image_generate'])
  assert.equal(host.registered[0].adapter.providerRetryPolicy(), undefined)
  const models = await host.registered[0].adapter.listModels('openai-codex')
  assert.ok(models.length > 0, 'the supported DSH adapter must receive auth before creating its model registry')
  assert.equal((await host.registered[0].adapter.resolveModel('openai-codex', 'gpt-5.5')!)!.context!.contextWindow, 272_000)
  await host.updateSettings({ [CONTEXT_MODE_FIELD]: CONTEXT_MODE_EXTENDED })
  assert.equal((await host.registered[0].adapter.resolveModel('openai-codex', 'gpt-5.5')!)!.context!.contextWindow, 1_000_000)
  await host.updateSettings({ [CONTEXT_MODE_FIELD]: CONTEXT_MODE_CUSTOM, customContextGpt54Mini: 400_000, customContextGpt55: 500_000 })
  assert.equal((await host.registered[0].adapter.resolveModel('openai-codex', 'gpt-5.4-mini')!)!.context!.contextWindow, 400_000)
  assert.equal((await host.registered[0].adapter.resolveModel('openai-codex', 'gpt-5.5')!)!.context!.contextWindow, 500_000)
  await host.updateSettings({ [CONTEXT_MODE_FIELD]: CONTEXT_MODE_STANDARD, [CUSTOM_CONTEXT_WINDOW_FIELD]: 272_000, customContextGpt54: 272_000, customContextGpt54Mini: 272_000, customContextGpt55: 272_000, customContextGpt56: 272_000 })
  assert.equal(host.handled.length, RPC_ENDPOINTS.length + 1)
  assert.equal(host.handled[0].path, '/api/codex-subscription/status')
  assert.ok(host.handled.filter(route => route.path !== '/api/codex-subscription/sketch-psd-worker').every(route => route.methods.length === 1 && route.methods[0] === 'POST'))
  assert.deepEqual(host.handled.find(route => route.path === '/api/codex-subscription/sketch-psd-worker')!.methods, ['GET'])
  assert.equal(host.settings.length, 1)
  assert.equal(host.provided.size, 0, 'the plugin should not publish undocumented host services')
  assert.equal('CodexCacheTelemetry' in plugin, false, 'cache diagnostics are outside the subscription route boundary')

  const signal = new AbortController().signal
  const status = await host.request('status', {}, signal)
  assert.deepEqual(status, {
    ok: true,
    value: { authenticated: false, provider: 'openai-codex' },
  })
  assert.doesNotMatch(JSON.stringify(status), /access|refresh|accountId/)

  const diagnostics = await host.request('diagnostics', {}, signal)
  assert.equal(diagnostics.value.catalog.source, 'fallback')
  assert.ok(['idle', 'refreshing'].includes(diagnostics.value.catalog.refresh))
  assert.deepEqual(diagnostics, {
    ok: true,
    value: {
      schemaVersion: 3,
      package: '@pascapone/dsh-codex-subscription',
      version: PACKAGE_VERSION,
      runtime: { node: process.version, platform: process.platform, arch: process.arch },
      account: { status: 'signed-out' },
      login: { phase: 'idle' },
      requests: {},
      catalog: diagnostics.value.catalog,
      configuration: {
        contextMode: CONTEXT_MODE_STANDARD,
        quickQuotaMode: QUICK_QUOTA_MODE_OFF,
        outputVerbosity: OUTPUT_VERBOSITY_DEFAULT,
        searchProvider: SEARCH_PROVIDER_AUTO,
        writable: true,
      },
      issues: [],
    },
  })
  assert.doesNotMatch(JSON.stringify(diagnostics), /access_token|refresh_token|accountId|expiresAt/)

  await host.updateSettings({ quickQuotaVisible: true })
  assert.deepEqual(host.webUpdates, [{
    config: { searchProvider: 'codex-subscription-auto', fetchProvider: 'local' },
    noSave: true,
  }], 'quota-only settings must not touch the web provider after automatic routing is selected')
  await host.updateSettings({ searchProvider: 'codex' })
  assert.deepEqual(host.webUpdates, [{
    config: { searchProvider: 'codex-subscription-auto', fetchProvider: 'local' },
    noSave: true,
  }, {
    config: { searchProvider: 'codex-subscription', fetchProvider: 'local' },
    noSave: true,
  }])

  const preferenceStatus = await host.request('preferences/status', {}, signal)
  const activeContextModels = preferenceStatus.value.contextModels
  assert.partialDeepStrictEqual(activeContextModels, [
    { key: 'gpt-5.4', label: 'GPT-5.4', maximum: 1_000_000 },
    { key: 'gpt-5.4-mini', label: 'GPT-5.4 mini', maximum: 400_000 },
    { key: 'gpt-5.5', label: 'GPT-5.5', maximum: 1_000_000 },
    { key: 'gpt-5.6', label: 'GPT-5.6 Luna / Sol / Terra', maximum: 1_000_000 },
  ])
  for (const model of activeContextModels) {
    assert.equal(typeof model.label, 'string')
    assert.ok(model.maximum > 0 && model.maximum <= 1_000_000)
  }
  const verbosityModels = preferenceStatus.value.verbosityModels
  assert.partialDeepStrictEqual(verbosityModels, ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.5', 'gpt-5.6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra'])
  assert.equal(verbosityModels.includes('gpt-5.3-codex-spark'), false)
  assert.equal(typeof preferenceStatus.value.subagentRuntimeInstalled, 'boolean')
  assert.deepEqual(preferenceStatus, {
    ok: true,
    value: { compactionMode: 'dsh', connectionMode: 'sse', subagentBackend: 'dsh', subagentBackendAvailable: false, subagentRuntimeInstalled: preferenceStatus.value.subagentRuntimeInstalled, transcriptionEnabled: false, codexBasePrompt: false, ...IMAGE_FEATURE_DEFAULTS, imageModel: 'gpt-image-2', imageQuality: 'auto', quickQuotaMode: QUICK_QUOTA_MODE_PERCENT, searchProvider: 'codex', speedMode: SPEED_MODE_STANDARD, sessionSpeedModes: {}, outputVerbosity: OUTPUT_VERBOSITY_DEFAULT, contextMode: CONTEXT_MODE_STANDARD, customContextWindow: 272_000, customContextGpt54: 272_000, customContextGpt54Mini: 272_000, customContextGpt55: 272_000, customContextGpt56: 272_000, customContextGpt6Astra: 272_000, contextModels: activeContextModels, verbosityModels, fastModels: preferenceStatus.value.fastModels, catalogStatus: preferenceStatus.value.catalogStatus, customContextModels: {}, searchMode: 'live', searchDomains: [], quotaAlerts: 'important', quotaShortThreshold: 20, quotaLongThreshold: 20, writable: true },
  })
  const preferenceUpdate = await host.request('preferences/update', {
    quickQuotaMode: QUICK_QUOTA_MODE_BAR,
    searchProvider: 'dsh',
    speedMode: SPEED_MODE_FAST,
    contextMode: CONTEXT_MODE_EXTENDED,
    customContextWindow: 500_000,
    customContextGpt54Mini: 400_000,
  }, signal)
  assert.deepEqual(preferenceUpdate, {
    ok: true,
    value: { compactionMode: 'dsh', connectionMode: 'sse', subagentBackend: 'dsh', subagentBackendAvailable: false, subagentRuntimeInstalled: preferenceStatus.value.subagentRuntimeInstalled, transcriptionEnabled: false, codexBasePrompt: false, ...IMAGE_FEATURE_DEFAULTS, imageModel: 'gpt-image-2', imageQuality: 'auto', quickQuotaMode: QUICK_QUOTA_MODE_BAR, searchProvider: 'dsh', speedMode: SPEED_MODE_FAST, sessionSpeedModes: {}, outputVerbosity: OUTPUT_VERBOSITY_DEFAULT, contextMode: CONTEXT_MODE_EXTENDED, customContextWindow: 500_000, customContextGpt54: 272_000, customContextGpt54Mini: 400_000, customContextGpt55: 272_000, customContextGpt56: 272_000, customContextGpt6Astra: 272_000, contextModels: activeContextModels, verbosityModels, fastModels: preferenceStatus.value.fastModels, catalogStatus: preferenceStatus.value.catalogStatus, customContextModels: {}, searchMode: 'live', searchDomains: [], quotaAlerts: 'important', quotaShortThreshold: 20, quotaLongThreshold: 20, writable: true },
  })
  assert.deepEqual(host.webUpdates.at(-1), {
    config: { searchProvider: 'deepseek-official', fetchProvider: 'local' },
    noSave: true,
  })
  const invalidQuotaMode = await host.request('preferences/update', {
    quickQuotaMode: 'card',
  }, signal)
  assert.deepEqual(invalidQuotaMode, {
    ok: false,
    error: { code: 'internal', message: 'Invalid quick quota preference', details: { issues: [] } },
  })
})

test('Codex base prompt opt-in appends only the selected model and preserves DSH assembly', async () => {
  const host = fakeContext({ prompt: true })
  applyPlugin(((host.ctx) as unknown as Parameters<typeof applyPlugin>[0]))
  const rpc = (payload: unknown) => host.request('preferences/update', payload, new AbortController().signal)
  const { listener, options } = host.promptHooks[0]
  assert.equal(options.prepend, true)
  const original = { sections: [{ name: 'dsh', text: 'DSH instructions' }], contexts: [{ name: 'runtime', text: 'context' }], tools: [{ name: 'pwsh' }], variables: { provider: 'openai-codex', model: 'gpt-6-sol' } }
  const assemble = (value: FixtureAssembly) => listener(undefined, {}, async () => value)
  assert.equal(await assemble(original), original, 'off by default')
  assert.equal((await rpc({ codexBasePrompt: true })).value.codexBasePrompt, true)
  for (const model of ['gpt-6-astra', 'gpt-6-sol', 'gpt-6.1-sol', 'gpt-6-luna']) {
    const selected = { ...original, variables: { provider: 'openai-codex', model } }
    // The inner selection middleware may resolve a route different from the initial assembly.
    const result = await listener(original, {}, async () => selected)
    assert.equal(result.sections.length, 2)
    assert.equal(result.sections[0], original.sections[0])
    assert.equal(result.sections[1].name, 'codex-subscription/base-prompt')
    assert.equal(result.sections[1].text, DSH_MODEL_PROMPTS[model as keyof typeof DSH_MODEL_PROMPTS])
    assert.equal(result.sections[1].interpolate, false)
    assert.equal(result.contexts, original.contexts)
    assert.equal(result.tools, original.tools)
    assert.equal(result.variables, selected.variables)
    assert.equal(original.sections.length, 1, 'assembly input is not mutated')
  }
  assert.equal((await assemble({ ...original, variables: { provider: 'other', model: 'gpt-6-sol' } })).sections.length, 1)
  assert.equal((await assemble({ ...original, variables: { provider: 'openai-codex', model: 'unknown' } })).sections.length, 1)
  assert.equal((await rpc({ codexBasePrompt: 'yes' })).ok, false)
  assert.equal((await rpc({ codexBasePrompt: false })).value.codexBasePrompt, false)
  assert.equal(await assemble(original), original)
})

test('Astra custom context is persisted through settings RPC with its audited bounds', async () => {
  const host = fakeContext()
  applyPlugin(((host.ctx) as unknown as Parameters<typeof applyPlugin>[0]))
  const rpc = (method: string, payload: Record<string, unknown> = {}) => host.request(method, payload, new AbortController().signal)
  assert.equal((await rpc('preferences/status')).value.customContextGpt6Astra, 272_000)
  for (const value of [128_000, 500_000, 872_000]) {
    const result = await rpc('preferences/update', { contextMode: 'custom', customContextGpt6Astra: value })
    assert.equal(result.ok, true)
    assert.equal(result.value.customContextGpt6Astra, value)
    assert.equal((await rpc('preferences/status')).value.customContextGpt6Astra, value)
  }
  for (const value of [127_999, 872_001, 1_000_000, 500_000.5, '500000']) {
    const result = await rpc('preferences/update', { customContextGpt6Astra: value })
    assert.equal(result.ok, false)
    assert.equal(result.error.message, 'Invalid custom model context window')
    assert.equal((await rpc('preferences/status')).value.customContextGpt6Astra, 872_000)
  }
})

test('preferences/models refreshes the catalog before returning the current model surfaces', async () => {
  const calls: unknown[] = []
  let fail = false
  const handler = plugin.createSubscriptionRpcHandler((({
    modelCatalog: {
      async refresh() {
        calls.push('refresh')
        if (fail) throw new Error('credential details must stay private')
      },
    },
    preferences: {
      status() {
        calls.push('status')
        return { contextModels: [{ key: 'gpt-6-astra' }], verbosityModels: ['gpt-6-astra'] }
      },
    },
  }) as unknown as Parameters<typeof plugin.createSubscriptionRpcHandler>[0]))
  const signal = new AbortController().signal
  assert.deepEqual(await handler('preferences/models', {}, signal), {
    ok: true,
    value: { contextModels: [{ key: 'gpt-6-astra' }], verbosityModels: ['gpt-6-astra'], fastModels: [], catalogStatus: undefined },
  })
  assert.deepEqual(calls, ['refresh', 'status'])

  fail = true
  const failed = await handler('preferences/models', {}, signal)
  assert.deepEqual(failed, {
    ok: false,
    error: { code: 'internal', message: 'Could not refresh Codex model catalog', details: { issues: [] } },
  })
  assert.doesNotMatch(JSON.stringify(failed), /credential details/)
})

test('usage failures use a DSH-supported bounded RPC error', async () => {
  const handler = plugin.createSubscriptionRpcHandler((({
    async authHandler() { throw new Error('not used') },
    usageReader: { async read() { throw new Error('host secret') }, clear() {} },
    resetCreditService: { async inspect() {}, async prepare() {}, async consume() {}, clear() {} },
  }) as unknown as Parameters<typeof plugin.createSubscriptionRpcHandler>[0]))
  const result = await handler('usage', {}, new AbortController().signal)
  assert.deepEqual(result, {
    ok: false,
    error: { code: 'internal', message: 'Could not read ChatGPT usage', details: { issues: [] } },
  })
  assert.doesNotMatch(JSON.stringify(result), /host secret/)
})

test('original image RPC delegates only a bounded session-owned chunk request', async () => {
  const calls: unknown[] = []
  const inherited = { assetId: 'img_0123456789abcdef0123456789abcdef', sha256: 'a'.repeat(64) }
  const handler = plugin.createSubscriptionRpcHandler((({
    originalImages: {
      async chunk(sessionId: string, assetId: string, offset: number, access: unknown) {
        calls.push({ sessionId, assetId, offset, access })
        return sessionId === 'session-a' ? { ref: { assetId }, offset, encoded: 'AA==', done: true } : undefined
      },
    },
    resolveInheritedOriginal(sessionId: string, assetId: string) {
      return sessionId === 'session-a' && assetId === inherited.assetId ? inherited : undefined
    },
  }) as unknown as Parameters<typeof plugin.createSubscriptionRpcHandler>[0]))
  const signal = new AbortController().signal
  assert.deepEqual(await handler('image/original/chunk', {
    sessionId: 'session-a', assetId: 'img_0123456789abcdef0123456789abcdef', offset: 0,
  }, signal), {
    ok: true,
    value: { ref: { assetId: 'img_0123456789abcdef0123456789abcdef' }, offset: 0, encoded: 'AA==', done: true },
  })
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], {
    sessionId: 'session-a', assetId: inherited.assetId, offset: 0, access: inherited,
  })
  assert.deepEqual(await handler('image/original/chunk', { sessionId: 'session-b', assetId: 'img_0123456789abcdef0123456789abcdef', offset: 0 }, signal), {
    ok: false, error: { code: 'not-found', message: 'Original image is unavailable', details: { issues: [] } },
  })
  assert.deepEqual(await handler('image/original/chunk', { sessionId: 'session-a', assetId: 'same', offset: -1 }, signal), {
    ok: false, error: { code: 'invalid-input', message: 'Invalid original image request', details: { issues: [] } },
  })
})

test('quota reset RPC exposes bounded inspection, prepare, and consume results', async () => {
  const calls: unknown[] = []
  const handler = plugin.createSubscriptionRpcHandler((({
    async authHandler() { throw new Error('not used') },
    usageReader: { async read() {}, clear() {} },
    resetCreditService: {
      async inspect(value: unknown) { calls.push(['inspect', value]); return { availableCount: 1, nextExpiresAt: 9 } },
      async prepare(value: {creditRef?: string; creditId?: string}) { calls.push(['prepare', value]); return { challengeId: 'opaque', readyAt: 5 } },
      async consume(value: unknown) { calls.push(['consume', value]); return { code: 'reset', windowsReset: ['primary'] } },
      clear() {},
    },
  }) as unknown as Parameters<typeof plugin.createSubscriptionRpcHandler>[0]))
  const controller = new AbortController()
  assert.deepEqual(await handler('reset-credit/inspect', {}, controller.signal), {
    ok: true,
    value: { availableCount: 1, nextExpiresAt: 9 },
  })
  assert.deepEqual(await handler('reset-credit/prepare', {}, controller.signal), {
    ok: true,
    value: { challengeId: 'opaque', readyAt: 5 },
  })
  assert.deepEqual(await handler('reset-credit/consume', { challengeId: 'opaque', acknowledged: true }, controller.signal), {
    ok: true,
    value: { code: 'reset', windowsReset: ['primary'] },
  })
  assert.equal(calls.length, 3)
})

test('quota reset RPC forwards only the opaque credit reference to host prepare', async () => {
  let prepared!: {creditRef?: string; creditId?: string}
  const handler = plugin.createSubscriptionRpcHandler((({
    async authHandler() { throw new Error('not used') },
    usageReader: { async read() {}, clear() {} },
    resetCreditService: {
      async inspect() { return { availableCount: 2, credits: [] } },
      async prepare(value: {creditRef?: string; creditId?: string}) { prepared = value; return { challengeId: 'opaque', readyAt: 5 } },
      async consume() { return { code: 'reset', windowsReset: [] } },
      clear() {},
    },
  }) as unknown as Parameters<typeof plugin.createSubscriptionRpcHandler>[0]))
  const controller = new AbortController()
  await handler('reset-credit/prepare', { creditRef: 'opaque-ref' }, controller.signal)
  assert.equal(prepared.creditRef, 'opaque-ref')
  assert.equal(prepared.creditId, undefined)
})

test('quota reset RPC bounds host failures and logout invalidates pending challenges', async () => {
  let cleared = 0
  const handler = plugin.createSubscriptionRpcHandler((({
    async authHandler(endpoint: string) { return endpoint === 'logout' ? { ok: true, value: {} } : { ok: false } },
    usageReader: { async read() {}, clear() { cleared += 1 } },
    resetCreditService: {
      async inspect() { throw new Error('provider-secret credit-secret') },
      async prepare() { throw new Error('provider-secret credit-secret') },
      async consume() { throw new Error('provider-secret credit-secret') },
      clear() { cleared += 1 },
    },
  }) as unknown as Parameters<typeof plugin.createSubscriptionRpcHandler>[0]))
  const controller = new AbortController()
  const failed = await handler('reset-credit/prepare', {}, controller.signal)
  assert.deepEqual(failed, {
    ok: false,
    error: { code: 'internal', message: 'Could not prepare a quota reset', details: { issues: [] } },
  })
  assert.doesNotMatch(JSON.stringify(failed), /provider-secret|credit-secret/)
  await handler('logout', {}, controller.signal)
  assert.equal(cleared, 2)
})

test('diagnostics converts credential failures to a fixed public issue without leaking host errors', async () => {
  const report = await plugin.createSubscriptionDiagnostics((({
    auth: { async status() { throw new Error('refresh-secret account-local') } },
    preferences: { status: () => ({ quickQuotaVisible: false, searchProvider: 'dsh', speedMode: 'standard', writable: true }) },
  }) as unknown as Parameters<typeof plugin.createSubscriptionDiagnostics>[0]))

  assert.deepEqual(report.account, { status: 'unknown' })
  assert.deepEqual(report.issues, [{ code: 'account-status-unavailable' }])
  assert.doesNotMatch(JSON.stringify(report), /refresh-secret|account-local/)
})

test('diagnostics includes bounded request failures and excludes proxy or credential details', async () => {
  const report = await plugin.createSubscriptionDiagnostics((({
    auth: { async status() { return { authenticated: false } } },
    preferences: { status: () => ({ contextMode: 'standard', quickQuotaMode: 'off', searchProvider: 'dsh', speedMode: 'standard', writable: true, ignored: 'noise' }) },
    network: { snapshot: () => ({ login: { status: 'failed', stage: 'transport', code: 'dns', route: 'environment', elapsed: '1-5s' } }) },
  }) as unknown as Parameters<typeof plugin.createSubscriptionDiagnostics>[0]))
  assert.deepEqual(report.requests, { login: { status: 'failed', stage: 'transport', code: 'dns', route: 'environment', elapsed: '1-5s' } })
  assert.equal('ignored' in report.configuration, false)
  assert.doesNotMatch(JSON.stringify(report), /proxy|bearer|token|accountId/iu)
})

test('unknown browser search preferences fail safe to automatic routing', () => {
  assert.equal(normalizeSearchProvider(SEARCH_PROVIDER_AUTO), SEARCH_PROVIDER_AUTO)
  assert.equal(normalizeSearchProvider(SEARCH_PROVIDER_DSH), SEARCH_PROVIDER_DSH)
  assert.equal(normalizeSearchProvider(SEARCH_PROVIDER_CODEX), SEARCH_PROVIDER_CODEX)
  assert.equal(normalizeSearchProvider(undefined), SEARCH_PROVIDER_AUTO)
  assert.equal(normalizeSearchProvider('unexpected-provider'), SEARCH_PROVIDER_AUTO)
})

test('catalog diagnostics includes refresh failures without copying private metadata', async () => {
  const report = await plugin.createSubscriptionDiagnostics((({
    auth: { status: async () => ({ authenticated: false }) },
    preferences: { status: () => ({}) },
    network: { snapshot: () => ({ catalog: { status: 'failed', stage: 'http', code: 'http-error', httpStatus: 403, route: 'direct', elapsed: 'under-1s', url: 'private-url' } }) },
    modelCatalog: { status: () => ({ source: 'fallback', refresh: 'failed', accountId: 'private-account' }) },
  }) as unknown as Parameters<typeof plugin.createSubscriptionDiagnostics>[0]))
  assert.equal(report.requests.catalog!.httpStatus, 403)
  assert.deepEqual(report.catalog, { source: 'fallback', refresh: 'failed' })
  assert.doesNotMatch(JSON.stringify(report), /private-|accountId|url/)
})

test('sketch tool is absent until both Beta switches are enabled and removed when disabled',async()=>{
 const host=fakeContext();applyPlugin(((host.ctx) as unknown as Parameters<typeof applyPlugin>[0]))
 const registered=()=>host.tools.some(tool=>tool.name==='codex_sketch')
 assert.equal(registered(),false)
 await host.updateSettings({imageSketch:true,imageEditing:true})
 assert.equal(registered(),false)
 await host.updateSettings({imageSketchAgent:true})
 assert.equal(registered(),true)
 await host.updateSettings({imageSketchAgent:false})
 assert.equal(registered(),false)
})
