
import type { CodexModel } from '../src/model-types.js';
type FixtureTimer = {at: number; callback(): void; cleared: boolean};
import assert from 'node:assert/strict'
import test from 'node:test'

import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'

import { CODEX_MODELS_URL, createOfficialModelCatalog, parseOfficialModelCatalog, retirementNotice } from '../src/model-catalog.js'
import { openaiCodexProvider, openaiCodexSubscriptionProvider } from '../src/pi-ai-runtime.js'
import { contextModelGroups, supportsCodexFastMode } from '../src/settings-contract.js'
import { DSH_MODEL_PROMPTS } from '../src/codex-base-prompts.js'

const base: CodexModel[] = [{
  id: 'gpt-base', name: 'GPT Base', api: 'openai-codex-responses', provider: 'openai-codex',
  baseUrl: 'https://chatgpt.com/backend-api', reasoning: true, input: ['text'],
  cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128_000, maxTokens: 128_000,
}]

test('offline catalog adds GPT-6 fallbacks without resurrecting retired Spark', () => {
  const catalog = createOfficialModelCatalog()
  const native = openaiCodexProvider().getModels()
  const fallback = native.filter(model => !['gpt-6-luna', 'gpt-6-sol', 'gpt-6.1-sol'].includes(model.id))
  const models = catalog.getModels(fallback)
  assert.deepEqual(catalog.getModels(native).find(model => model.id === 'gpt-6-luna'), native.find(model => model.id === 'gpt-6-luna'))
  assert.deepEqual(models.slice(0, 3).map(model => model.id), ['gpt-6-luna', 'gpt-6-sol', 'gpt-6.1-sol'])
  assert.equal(models.some(model => model.id === 'gpt-5.3-codex-spark'), false)
  assert.equal(models[2].contextWindow, 500_000)
  assert.equal(models[2].maxContextWindow, 872_000)
  assert.equal(supportsCodexFastMode('gpt-6.1-sol'), true)
  assert.equal(models.some(model => model.id === 'gpt-5.5'), true)
  assert.deepEqual(models[0].thinkingLevelMap, {
    off: null, minimal: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max',
  })
  assert.equal(models[0].contextWindow, 272_000)
  assert.equal(models[0].maxContextWindow, 872_000)
  assert.equal(models[0].compat!.supportsAdditionalTools, true)
  const existingSol = { ...models[2], contextWindow: 272_000 }
  assert.equal(catalog.getModels([existingSol]).find(model => model.id === 'gpt-6.1-sol')!.contextWindow, 500_000)
  assert.equal(existingSol.contextWindow, 272_000, 'do not mutate pi-ai models')
  assert.equal(catalog.getModels([{ ...existingSol, maxContextWindow: 400_000 }]).find(model => model.id === 'gpt-6.1-sol')!.contextWindow, 400_000, 'respect an explicit lower account limit')
})

const remote = (overrides = {}) => ({
  slug: 'gpt-next', display_name: 'GPT Next', description: 'Current account model',
  supported_reasoning_levels: [{ effort: 'low', description: 'Low' }, { effort: 'max', description: 'Max' }],
  visibility: 'list', supported_in_api: true, priority: 10, support_verbosity: true,
  default_verbosity: 'medium', context_window: 400_000, input_modalities: ['text', 'image'],
  service_tiers: [{ id: 'priority', name: 'Fast', description: 'Priority' }],
  ...overrides,
})

const RETIREMENT_SECONDS = 1792004400
const CATALOG_NOW = Date.UTC(2026, 8, 29)

test('snake_case retirement notices use directory display names without changing model identity or visibility', () => {
  const models = parseOfficialModelCatalog({ models: [
    remote({
      slug: 'gpt-5.5', display_name: 'GPT-5.5', description: 'Current account model', priority: 20,
      retirement_at: RETIREMENT_SECONDS, upgrade: { model: 'gpt-5.6-sol' },
      migration_markdown: '[Switch now](https://example.invalid/migrate)',
    }),
    remote({ slug: 'gpt-5.6-sol', display_name: 'GPT-5.6 Sol', priority: 30 }),
    remote({ slug: 'hidden-retiring', visibility: 'hide', retirement_at: RETIREMENT_SECONDS }),
  ] }, CATALOG_NOW)

  assert.deepEqual(models.map(model => model.id), ['gpt-5.6-sol', 'gpt-5.5'])
  const retiring = models[1]
  assert.ok(retiring)
  assert.equal(retiring.id, 'gpt-5.5')
  assert.equal(retiring.name, 'GPT-5.5 (retires 2026-10-14)')
  assert.equal(retiring.priority, 20)
  assert.equal(retiring.description, 'Current account model\nRetires on 2026-10-14 (UTC). Switch to GPT-5.6 Sol to keep working.')
  assert.deepEqual(retiring.retirement, { at: RETIREMENT_SECONDS * 1000, upgradeTo: 'gpt-5.6-sol' })
  assert.equal(retiring.description.includes('migration_markdown'), false)
  assert.equal(retiring.description.includes('Switch now'), false)
})

test('camelCase retirement notices use upgradeInfo and add only the notice when description is absent', () => {
  const [retiring] = parseOfficialModelCatalog({ models: [
    remote({
      slug: 'legacy-model', display_name: 'Legacy Model', description: null,
      retirementAt: RETIREMENT_SECONDS, upgradeInfo: { model: 'replacement-model' },
      migrationMarkdown: '**Switch** [to the new model](https://example.invalid/migrate).',
    }),
  ] }, CATALOG_NOW)

  assert.equal(retiring.description, 'Retires on 2026-10-14 (UTC). Switch to replacement-model to keep working.')
  assert.deepEqual(retiring.retirement, { at: RETIREMENT_SECONDS * 1000, upgradeTo: 'replacement-model' })
  assert.equal(retiring.description.includes('**Switch**'), false)
  assert.equal(retiring.description.includes('example.invalid'), false)
})

test('retirement targets support string upgrades, snake_case upgrade_info, and date-only notices', () => {
  const [stringUpgrade] = parseOfficialModelCatalog({ models: [
    remote({ slug: 'string-upgrade', description: '', retirement_at: RETIREMENT_SECONDS,
      upgrade: 'not-in-directory', migration_markdown: '[Do not show](https://example.invalid)' }),
  ] }, CATALOG_NOW)
  assert.equal(stringUpgrade.description, 'Retires on 2026-10-14 (UTC). Switch to not-in-directory to keep working.')
  assert.deepEqual(stringUpgrade.retirement, { at: RETIREMENT_SECONDS * 1000, upgradeTo: 'not-in-directory' })

  const [infoUpgrade] = parseOfficialModelCatalog({ models: [
    remote({ slug: 'info-upgrade', retirement_at: RETIREMENT_SECONDS, upgrade_info: { model: 'next-model' } }),
    remote({ slug: 'next-model', display_name: 'Next Model' }),
  ] }, CATALOG_NOW)
  assert.equal(infoUpgrade.description, 'Current account model\nRetires on 2026-10-14 (UTC). Switch to Next Model to keep working.')
  assert.deepEqual(infoUpgrade.retirement, { at: RETIREMENT_SECONDS * 1000, upgradeTo: 'next-model' })

  const [dateOnly] = parseOfficialModelCatalog({ models: [
    remote({ slug: 'date-only', description: undefined, retirementAt: RETIREMENT_SECONDS,
      migrationMarkdown: 'Never use this server-provided migration copy.' }),
  ] }, CATALOG_NOW)
  assert.equal(dateOnly.description, 'Retires on 2026-10-14 (UTC).')
  assert.deepEqual(dateOnly.retirement, { at: RETIREMENT_SECONDS * 1000, upgradeTo: undefined })
  assert.equal(dateOnly.description.includes('server-provided'), false)
})

test('online model lists receive the notice while catalog metadata preserves retirement fields', async () => {
  const catalog = createOfficialModelCatalog({
    baseModels: () => base,
    now: () => CATALOG_NOW,
    getAuth: async () => ({ auth: { apiKey: 'test-token' } }),
    readCredential: async () => ({ type: 'oauth', refresh: 'fixture-refresh', expires: 1_900_000_000_000, access: 'test-token', accountId: 'test-account' }),
    fetch: async () => Response.json({ models: [
      remote({
        slug: 'gpt-5.5', display_name: 'GPT-5.5', retirement_at: RETIREMENT_SECONDS,
        upgrade: 'gpt-5.6-sol', priority: 25,
      }),
      remote({ slug: 'gpt-5.6-sol', display_name: 'GPT-5.6 Sol', priority: 30 }),
    ] }),
  })
  await catalog.refresh()

  const retiring = catalog.getModels().find(model => model.id === 'gpt-5.5')
  assert.ok(retiring)
  assert.equal(retiring.id, 'gpt-5.5')
  assert.equal(retiring.name, 'GPT-5.5 (retires 2026-10-14)')
  assert.equal(retiring.description, 'Current account model\nRetires on 2026-10-14 (UTC). Switch to GPT-5.6 Sol to keep working.')
  assert.deepEqual(catalog.metadata('gpt-5.5')!.retirement, { at: RETIREMENT_SECONDS * 1000, upgradeTo: 'gpt-5.6-sol' })
  assert.equal(catalog.metadata('gpt-5.5')!.priority, 25)
})

test('expired or invalid retirement timestamps produce no notice and never throw', () => {
  const invalidValues = [
    remote({ slug: 'missing' }),
    remote({ slug: 'undefined', retirement_at: undefined }),
    remote({ slug: 'null', retirement_at: null }),
    remote({ slug: 'string', retirement_at: String(RETIREMENT_SECONDS) }),
    remote({ slug: 'negative', retirement_at: -1 }),
    remote({ slug: 'nan', retirement_at: Number.NaN }),
    remote({ slug: 'null-camel', retirementAt: null }),
  ]
  for (const value of invalidValues) {
    assert.doesNotThrow(() => retirementNotice(value, CATALOG_NOW))
    assert.equal(retirementNotice(value, CATALOG_NOW), undefined)
    const [model] = parseOfficialModelCatalog({ models: [value] }, CATALOG_NOW)
    assert.equal(model.description, 'Current account model')
    assert.equal('retirement' in model, false)
  }

  const expired = remote({ slug: 'expired', retirement_at: Date.UTC(2026, 8, 28) / 1000 })
  assert.doesNotThrow(() => retirementNotice(expired, CATALOG_NOW))
  assert.equal(retirementNotice(expired, CATALOG_NOW), undefined)
  const [model] = parseOfficialModelCatalog({ models: [expired] }, CATALOG_NOW)
  assert.equal(model.description, 'Current account model')
  assert.equal('retirement' in model, false)
})

test('catalog commit and account clearing notify host observers, failed and unchanged refreshes do not', async () => {
  let notices = 0, status = 200
  const catalog = createOfficialModelCatalog({
    baseModels: () => base,
    getAuth: async () => ({ auth: { apiKey: 'test' } }),
    readCredential: async () => ({ type: 'oauth', refresh: 'fixture-refresh', expires: 1_900_000_000_000, access: 'test', accountId: 'test' }),
    onUpdated: () => notices++,
    fetch: async () => status === 200 ? Response.json({ models: [remote()] }) : new Response(null, { status }),
  })
  await catalog.refresh()
  assert.equal(notices, 1)
  status = 304
  await catalog.refresh()
  status = 500
  await assert.rejects(catalog.refresh())
  assert.equal(notices, 1)
  catalog.clear()
  assert.equal(notices, 2)
})

test('unsupported catalog capabilities are diagnostic-only and follow catalog lifetime', async () => {
  let unchanged = false
  const catalog = createOfficialModelCatalog((({
    baseModels: () => base,
    getAuth: async () => ({ auth: { apiKey: 'test-token' } }),
    readCredential: async () => ({ type: 'oauth', refresh: 'fixture-refresh', expires: 1_900_000_000_000, access: 'test-token', accountId: 'test-account' }),
    fetch: async () => unchanged ? new Response(null, { status: 304 }) : Response.json({ models: [remote({
      supported_reasoning_levels: [{ effort: 'max' }, { effort: 'ultra' }, { effort: 'private text' }],
      input_modalities: ['text', 'image', 'audio', null],
      additional_speed_tiers: ['fast', 'burst', 'https://private.invalid'],
    })] }, { headers: { etag: 'revision-one' } }),
  }) as unknown as NonNullable<Parameters<typeof createOfficialModelCatalog>[0]>))
  await catalog.refresh()
  const expected = [{ model: 'gpt-next', reasoning: ['ultra'], inputs: ['audio'], speeds: ['burst'] }]
  assert.deepEqual(catalog.capabilityGaps(), expected)
  const [model] = catalog.getModels()
  assert.deepEqual(model.input, ['text', 'image'])
  assert.equal((model.thinkingLevelMap as Record<string, unknown>).ultra, undefined)
  assert.equal((model as typeof model & {unsupported?: unknown}).unsupported, undefined)
  const copy = catalog.capabilityGaps()
  copy[0].inputs!.push('video')
  assert.deepEqual(catalog.capabilityGaps(), expected)
  unchanged = true
  await catalog.refresh()
  assert.deepEqual(catalog.capabilityGaps(), expected)
  catalog.clear()
  assert.deepEqual(catalog.capabilityGaps(), [])
})

test('official model catalog filters hidden entries and preserves advertised capabilities', () => {
  const models = parseOfficialModelCatalog({ models: [
    remote(),
    remote({ slug: 'hidden', visibility: 'hide' }),
  ] })
  assert.equal(models.length, 1)
  assert.deepEqual(models[0], {
    id: 'gpt-next', name: 'GPT Next', description: 'Current account model', priority: 10,
    input: ['text', 'image'], contextWindow: 400_000, reasoning: true,
    thinkingLevelMap: { off: null, minimal: null, low: 'low', medium: null, high: null, xhigh: null, max: 'max' },
    supportVerbosity: true, defaultVerbosity: 'medium', supportsFast: true, supportsUltrafast: false,
  })
})

test('reviewed DSH prompts cannot be replaced by catalog refresh, failure or account changes', async () => {
  let fail = false
  const catalog = createOfficialModelCatalog((({
    baseModels: () => base,
    getAuth: async () => ({ auth: { apiKey: 'test-token' } }),
    readCredential: async () => ({ type: 'oauth', access: 'test-token', accountId: 'test-account' }),
    fetch: async () => {
      if (fail) throw new Error('offline')
      return Response.json({ models: [...Object.keys(DSH_MODEL_PROMPTS), 'gpt-next'].map(slug => remote({
        slug, context_window: 500_000,
        model_messages: { instructions_template: 'Unreviewed remote instructions', persistent_instructions: 'Remote persistent mode' },
        base_instructions: 'Legacy remote instructions',
      })) })
    },
  }) as unknown as NonNullable<Parameters<typeof createOfficialModelCatalog>[0]>))
  const checkPrompts = () => {
    for (const [id, prompt] of Object.entries(DSH_MODEL_PROMPTS)) assert.equal(catalog.basePrompt(id), prompt)
    for (const id of ['gpt-next', 'gpt-6-luna-preview', 'gpt-5.6-sol', 'other-model', '__proto__', 'constructor', undefined]) {
      assert.equal(catalog.basePrompt(id as string), undefined)
    }
  }
  checkPrompts()
  await catalog.refresh()
  checkPrompts()
  assert.equal(catalog.getModels()[0].contextWindow, 500_000, 'capability updates still work')
  for (const id of Object.keys(DSH_MODEL_PROMPTS)) assert.equal((catalog.metadata(id)! as {instructionsTemplate?: unknown}).instructionsTemplate, undefined)
  fail = true
  await assert.rejects(catalog.refresh(), /offline/u)
  checkPrompts()
  catalog.clear()
  checkPrompts()
})

test('ChatGPT catalog keeps picker-visible subscription models that are not API-key models', () => {
  const models = parseOfficialModelCatalog({ models: [remote({
    slug: 'gpt-5.3-codex-spark',
    display_name: 'GPT-5.3-Codex-Spark',
    supported_in_api: false,
    input_modalities: ['text'],
  })] })
  assert.equal(models.length, 1)
  assert.equal(models[0].id, 'gpt-5.3-codex-spark')
})

test('Reserve is a labeled last-choice experiment only when advertised by the account', () => {
  const models = parseOfficialModelCatalog({ models: [
    remote({ slug: 'gpt-reserve', visibility: 'hide', priority: 999, input_modalities: ['text'] }),
    remote({ slug: 'other-hidden', visibility: 'hide' }),
    remote(),
  ] })
  assert.deepEqual(models.map(model => model.id), ['gpt-next', 'gpt-reserve'])
  assert.equal(models[1].name, 'GPT-Reserve (Experimental)')
  assert.deepEqual(models[1].input, ['text'])
  assert.equal(models[1].thinkingLevelMap.max, 'max')
  assert.equal(parseOfficialModelCatalog({ models: [remote()] }).some(model => model.id === 'gpt-reserve'), false)
  assert.equal(parseOfficialModelCatalog({ models: [remote({ slug: 'gpt-reserve', visibility: 'disabled' })] }).length, 0)
})

test('Astra from the official catalog reaches DSH with the selected context window', async () => {
  const astraContext = { context_window: 272_000, max_context_window: 872_000 }
  const catalog = createOfficialModelCatalog((({
    baseModels: () => openaiCodexProvider().getModels(),
    async getAuth() { return { auth: { apiKey: 'test-token' } } },
    async readCredential() { return { type: 'oauth', refresh: 'fixture-refresh', expires: 1_900_000_000_000, access: 'test-token', accountId: 'test-account' } },
    async fetch() {
      return Response.json({ models: [remote({
        slug: 'gpt-6-astra', display_name: 'GPT-6 Astra',
        ...astraContext,
      })] })
    },
  }) as unknown as NonNullable<Parameters<typeof createOfficialModelCatalog>[0]>))
  await catalog.refresh()
  let contextMode = 'standard'
  const customWindows: Record<string, number> = {}
  const provider = openaiCodexSubscriptionProvider((({
    catalog,
    resolveContextMode: () => contextMode,
    resolveCustomContextWindow: (modelKey: string) => customWindows[modelKey],
  }) as unknown as NonNullable<Parameters<typeof openaiCodexSubscriptionProvider>[0]>))
  const adapter = new PiAiAdapter(({
    profiles: () => new Map([['openai-codex', {
      provider: 'openai-codex', displayName: 'ChatGPT subscription',
      piProvider: provider, configuredMaxTokens: new Map(), modelErrors: new Map(),
    }]]),
    resolveApiKey: async () => { throw new Error('context resolution must not send a model request') },
  } as unknown as ConstructorParameters<typeof PiAiAdapter>[0]))
  const contextWindow = async () => (await adapter.resolveModel('openai-codex', 'gpt-6-astra'))!.context!.contextWindow
  assert.equal(await contextWindow(), 272_000)
  contextMode = 'extended'
  assert.equal(await contextWindow(), 872_000)
  contextMode = 'custom'
  assert.equal(await contextWindow(), 272_000, 'an unset custom budget keeps the safe default')
  for (const [requested, expected] of [[500_000, 500_000], [1_000_000, 872_000], [99, 128_000]]) {
    customWindows['gpt-6-astra'] = requested
    assert.equal(await contextWindow(), expected)
  }
  contextMode = 'standard'
  assert.equal(await contextWindow(), 272_000, 'switching back must restore the unmodified catalog window')
  assert.equal(catalog.getModels()[0].contextWindow, 272_000)
  Object.assign(astraContext, { context_window: 1_000_000, max_context_window: 1_000_000 })
  await catalog.refresh()
  assert.equal(await contextWindow(), 1_000_000, 'Standard must preserve even a newer catalog window')
  contextMode = 'extended'
  assert.equal(await contextWindow(), 1_000_000, 'Extended follows the new explicit official catalog maximum')
})

test('new Codex models appear from the account catalog with supported reasoning and context', async () => {
  const catalog = createOfficialModelCatalog((({
    baseModels: () => openaiCodexProvider().getModels(),
    async getAuth() { return { auth: { apiKey: 'test-token' } } },
    async readCredential() { return { type: 'oauth', refresh: 'fixture-refresh', expires: 1_900_000_000_000, access: 'test-token', accountId: 'test-account' } },
    async fetch() {
      return Response.json({ models: [
        remote({ slug: 'gpt-6-sol', display_name: 'GPT-6-Sol', priority: 2,
          context_window: 272_000, max_context_window: 872_000,
          supported_reasoning_levels: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'].map(effort => ({ effort })),
        }),
        remote({ slug: 'gpt-6.1-sol', display_name: 'GPT-6.1-Sol', priority: 1,
          context_window: 272_000, max_context_window: 872_000,
          supported_reasoning_levels: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'].map(effort => ({ effort })),
        }),
        remote({ slug: 'gpt-6-luna', display_name: 'GPT-6-Luna', priority: 3,
          context_window: 272_000, max_context_window: 872_000,
          supported_reasoning_levels: ['low', 'medium', 'high', 'xhigh', 'max'].map(effort => ({ effort })),
        }),
      ] })
    },
  }) as unknown as NonNullable<Parameters<typeof createOfficialModelCatalog>[0]>))
  await catalog.refresh()
  let contextMode = 'standard'
  const customWindows: Record<string, number> = {}
  const provider = openaiCodexSubscriptionProvider((({ catalog, resolveContextMode: () => contextMode, resolveCustomContextWindow: (key?: string) => key === undefined ? undefined : customWindows[key] }) as unknown as NonNullable<Parameters<typeof openaiCodexSubscriptionProvider>[0]>))
  const contexts = () => provider.getModels().map(model => [model.id, model.contextWindow])
  assert.deepEqual(contexts(), [['gpt-6-luna', 272_000], ['gpt-6-sol', 272_000], ['gpt-6.1-sol', 500_000]])
  assert.equal(contextModelGroups(catalog.getModels([])).find(model => model.key === 'gpt-6.1-sol')!.default, 500_000, 'UI and provider use the same default even with a stale online catalog')
  contextMode = 'custom'
  assert.deepEqual(contexts(), [['gpt-6-luna', 272_000], ['gpt-6-sol', 272_000], ['gpt-6.1-sol', 500_000]])
  Object.assign(customWindows, { 'gpt-6-luna': 200_000, 'gpt-6-sol': 400_000, 'gpt-6.1-sol': 300_000 })
  await catalog.refresh()
  assert.deepEqual(contexts(), [['gpt-6-luna', 200_000], ['gpt-6-sol', 400_000], ['gpt-6.1-sol', 300_000]])
  contextMode = 'standard'
  assert.deepEqual(contexts(), [['gpt-6-luna', 272_000], ['gpt-6-sol', 272_000], ['gpt-6.1-sol', 500_000]])
  contextMode = 'extended'
  assert.deepEqual(provider.getModels().map(model => [model.id, model.contextWindow]), [
    ['gpt-6-luna', 872_000], ['gpt-6-sol', 872_000], ['gpt-6.1-sol', 872_000],
  ])
  assert.deepEqual(contextModelGroups(catalog.getModels()).map(row => row.key), ['gpt-6-luna', 'gpt-6-sol', 'gpt-6.1-sol'])
  assert.equal(catalog.metadata('gpt-6-luna')!.thinkingLevelMap.max, 'max')
  assert.equal(catalog.metadata('gpt-6.1-sol')!.supportsFast, true)
  assert.equal((catalog.metadata('gpt-6-sol')!.thinkingLevelMap as Record<string, unknown>).ultra, undefined)
  assert.equal(catalog.metadata('gpt-6-sol')!.supportsFast, true)
})

test('catalog refresh is conditional, keeps the last good result, and never exposes credentials', async () => {
  const requests: {input: string; headers: Headers}[] = []
  let mode = 'fresh'
  const catalog = createOfficialModelCatalog((({
    baseModels: () => base,
    async getAuth() { return { auth: { apiKey: 'secret-token' } } },
    async readCredential() { return { type: 'oauth', refresh: 'fixture-refresh', expires: 1_900_000_000_000, access: 'secret-token', accountId: 'secret-account' } },
    async fetch(input: unknown, init: RequestInit) {
      requests.push({ input: String(input), headers: new Headers(init.headers) })
      if (mode === 'not-modified') return new Response(null, { status: 304 })
      if (mode === 'failed') return new Response('{}', { status: 503 })
      return new Response(JSON.stringify({ models: [remote()] }), { status: 200, headers: { etag: '"catalog-1"', 'content-type': 'application/json' } })
    },
  }) as unknown as NonNullable<Parameters<typeof createOfficialModelCatalog>[0]>))
  assert.equal(await catalog.refresh(), true)
  assert.equal(catalog.getModels()[0].id, 'gpt-next')
  assert.equal(catalog.getModels()[0].cost.input, 0)
  assert.equal(catalog.metadata('gpt-next')!.supportVerbosity, true)
  assert.equal(catalog.revision(), 1)
  assert.equal(requests[0].input, CODEX_MODELS_URL)
  mode = 'not-modified'
  assert.equal(await catalog.refresh(), false)
  assert.equal(requests[1].headers.get('if-none-match'), '"catalog-1"')
  mode = 'failed'
  await assert.rejects(catalog.refresh(), /HTTP 503/u)
  assert.equal(catalog.getModels()[0].id, 'gpt-next')
  assert.doesNotMatch(JSON.stringify(catalog.getModels()), /secret-token|secret-account/u)
})

test('catalog timeout rejects even when an injected request ignores abort and drops its late result', async () => {
  let resolveFetch!: (value: Response) => void
  const catalog = createOfficialModelCatalog((({
    baseModels: () => base,
    timeoutMs: 10,
    async getAuth() { return { auth: { apiKey: 'test-token' } } },
    async readCredential() { return { type: 'oauth', refresh: 'fixture-refresh', expires: 1_900_000_000_000, access: 'test-token', accountId: 'test-account' } },
    async fetch() {
      return new Promise<Response>(resolve => { resolveFetch = resolve })
    },
  }) as unknown as NonNullable<Parameters<typeof createOfficialModelCatalog>[0]>))

  await assert.rejects(catalog.refresh(), /timed out/u)
  resolveFetch(Response.json({ models: [remote({ slug: 'late-model' })] }))
  await new Promise<void>(resolve => setImmediate(resolve))
  assert.equal(catalog.revision(), 0)
  assert.equal(catalog.getModels().some(model => model.id === 'late-model'), false, 'late response cannot replace fallback metadata')
})

test('clear aborts the old flight without letting its timer invalidate the replacement', async () => {
  const fetches: ((value: Response) => void)[] = []
  const timers: FixtureTimer[] = []
  let now = 0
  const scheduleTimeout = (callback: () => void, delay: number) => {
    const timer = { at: now + delay, callback, cleared: false }
    timers.push(timer)
    return timer
  }
  const cancelTimeout = (timer: FixtureTimer) => { timer.cleared = true }
  const advanceTo = (target: number) => {
    now = target
    for (const timer of timers.filter(item => !item.cleared && item.at <= target)) {
      timer.cleared = true
      timer.callback()
    }
  }
  const catalog = createOfficialModelCatalog((({
    baseModels: () => base,
    timeoutMs: 50,
    setTimeout: scheduleTimeout,
    clearTimeout: cancelTimeout,
    async getAuth() { return { auth: { apiKey: 'test-token' } } },
    async readCredential() { return { type: 'oauth', refresh: 'fixture-refresh', expires: 1_900_000_000_000, access: 'test-token', accountId: 'test-account' } },
    async fetch() {
      return new Promise<Response>(resolve => fetches.push(resolve))
    },
  }) as unknown as NonNullable<Parameters<typeof createOfficialModelCatalog>[0]>))

  const old = catalog.refresh()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(fetches.length, 1)
  now = 10
  catalog.clear()
  await assert.rejects(old)
  const replacement = catalog.refresh()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(timers.length, 2)
  assert.equal(timers[0].cleared, true)
  advanceTo(50)
  assert.equal(fetches.length, 2)
  fetches[1](Response.json({ models: [remote({ slug: 'replacement-model' })] }))
  assert.equal(await replacement, true)
  fetches[0](Response.json({ models: [remote({ slug: 'late-old-model' })] }))
  await new Promise<void>(resolve => setImmediate(resolve))
  assert.equal(catalog.getModels()[0].id, 'replacement-model')
})

test('catalog support state distinguishes unavailability, successful refresh, and retained online data after failure', async () => {
  let fail = true
  const catalog = createOfficialModelCatalog({
    baseModels: () => base,
    getAuth: async () => ({ auth: { apiKey: 'test-token' } }),
    readCredential: async () => ({ type: 'oauth', refresh: 'fixture-refresh', expires: 1_900_000_000_000, access: 'test-token', accountId: 'test-account' }),
    fetch: async () => fail ? new Response('', { status: 403 }) : Response.json({ models: [remote()] }),
  })
  assert.deepEqual(catalog.status(), { source: 'unavailable', refresh: 'idle' })
  const failed = catalog.refresh()
  assert.equal(catalog.status().refresh, 'refreshing')
  await assert.rejects(failed, /HTTP 403/)
  assert.deepEqual(catalog.status(), { source: 'unavailable', refresh: 'failed' })
  fail = false
  await catalog.refresh()
  assert.deepEqual(catalog.status(), { source: 'online', refresh: 'ok' })
  fail = true
  await assert.rejects(catalog.refresh(), /HTTP 403/)
  assert.deepEqual(catalog.status(), { source: 'online', refresh: 'failed' })
  catalog.clear()
  assert.deepEqual(catalog.status(), { source: 'unavailable', refresh: 'idle' })
})

test('the real HTTP catalog shape nests an ISO retirement date under upgrade', () => {
  const models = parseOfficialModelCatalog({ models: [
    remote({
      slug: 'gpt-5.5', display_name: 'GPT-5.5', description: 'Legacy coding model.', priority: 12,
      upgrade: {
        model: 'gpt-5.6-sol',
        migration_markdown: 'GPT-5.5 retires on October 14, 2026. Switch to GPT-5.6 Sol to continue working in Codex.',
        retirement_at: '2026-10-14T19:00:00Z',
      },
    }),
    remote({ slug: 'gpt-5.6-sol', display_name: 'GPT-5.6 Sol', priority: 30, upgrade: null }),
    remote({ slug: 'bad-date', upgrade: { model: 'x', retirement_at: 'soon' } }),
    remote({ slug: 'numeric-string', upgrade: { model: 'x', retirement_at: '1792004400' } }),
  ] }, CATALOG_NOW)

  const retiring = models.find(model => model.id === 'gpt-5.5')
  assert.ok(retiring)
  assert.equal(retiring.description, 'Legacy coding model.\nRetires on 2026-10-14 (UTC). Switch to GPT-5.6 Sol to keep working.')
  assert.equal(retiring.name, 'GPT-5.5 (retires 2026-10-14)')
  assert.equal(retiring.id, 'gpt-5.5')
  assert.equal(retiring.retirement!.at, Date.UTC(2026, 9, 14, 19))
  assert.equal(retiring.retirement!.upgradeTo, 'gpt-5.6-sol')
  assert.equal(models.find(model => model.id === 'gpt-5.6-sol')!.retirement, undefined)
  assert.equal(models.find(model => model.id === 'bad-date')!.retirement, undefined)
  assert.equal(models.find(model => model.id === 'numeric-string')!.retirement, undefined)
})

test('an unchanged catalog drops a retirement notice once its date has passed', async () => {
  let now = Date.UTC(2026, 9, 1)
  let status = 200
  let notices = 0
  const catalog = createOfficialModelCatalog({
    baseModels: () => base,
    now: () => now,
    getAuth: async () => ({ auth: { apiKey: 'test-token' } }),
    readCredential: async () => ({ type: 'oauth', refresh: 'fixture-refresh', expires: 1_900_000_000_000, access: 'test-token', accountId: 'test-account' }),
    onUpdated: () => notices++,
    fetch: async () => status === 304
      ? new Response(null, { status: 304 })
      : Response.json({ models: [remote({
        slug: 'gpt-5.5', display_name: 'GPT-5.5',
        upgrade: { model: 'gpt-5.6-sol', retirement_at: '2026-10-14T19:00:00Z' },
      })] }, { headers: { etag: 'rev-1' } }),
  })
  await catalog.refresh()
  assert.equal(catalog.getModels()[0].name, 'GPT-5.5 (retires 2026-10-14)')
  assert.equal(notices, 1)

  status = 304
  await catalog.refresh()
  assert.equal(catalog.getModels()[0].name, 'GPT-5.5 (retires 2026-10-14)')
  assert.equal(notices, 1)

  now = Date.UTC(2026, 9, 15)
  const revision = catalog.revision()
  await catalog.refresh()
  const [model] = catalog.getModels()
  assert.equal(model.name, 'GPT-5.5')
  assert.equal(model.id, 'gpt-5.5')
  assert.equal(catalog.metadata('gpt-5.5')!.retirement, undefined)
  assert.equal(notices, 2)
  assert.equal(catalog.revision(), revision + 1)
})

test('Ultrafast is offered only for models whose account catalog lists it, and is not reported as unsupported', () => {
  const models = parseOfficialModelCatalog({ models: [
    remote({ slug: 'gpt-6-astra', service_tiers: [
      { id: 'priority', name: 'Fast', description: '' }, { id: 'ultrafast', name: 'Ultrafast', description: '' },
    ] }),
    remote({ slug: 'gpt-6-luna' }),
    remote({ slug: 'gpt-6-sol', service_tiers: [{ id: 'priority', name: 'Fast', description: '' }, { id: 'turbo', name: 'Turbo', description: '' }] }),
  ] })
  const byId = Object.fromEntries(models.map(model => [model.id, model]))
  assert.equal(byId['gpt-6-astra'].supportsUltrafast, true)
  assert.equal(byId['gpt-6-astra'].supportsFast, true)
  assert.equal(byId['gpt-6-astra'].unsupported?.speeds, undefined)
  assert.equal(byId['gpt-6-luna'].supportsUltrafast, false)
  assert.equal(byId['gpt-6-sol'].supportsUltrafast, false)
  assert.deepEqual(byId['gpt-6-sol'].unsupported!.speeds, ['turbo'])
})

test('official reviewer follows the account catalog, overrides and low effort', async () => {
  const { officialReviewModel } = await import('../src/model-catalog.js')
  const levels = (efforts: string[]) => efforts.map(effort => ({ effort }))
  const catalog = { models: [
    { slug: 'gpt-6-sol', visibility: 'list' },
    { slug: 'gpt-6-astra', visibility: 'list', auto_review_model_override: 'astra-review' },
    { slug: 'codex-auto-review', visibility: 'hide', supported_reasoning_levels: levels(['low', 'medium']), default_reasoning_level: 'medium' },
    { slug: 'astra-review', visibility: 'hide', supported_reasoning_levels: levels(['medium']), default_reasoning_level: 'medium' },
  ] }
  assert.deepEqual(officialReviewModel(catalog, 'gpt-6-sol'), { id: 'codex-auto-review', effort: 'low' })
  assert.deepEqual(officialReviewModel(catalog, 'gpt-6-astra'), { id: 'astra-review', effort: 'medium' })
  assert.equal(officialReviewModel({ models: [{ slug: 'gpt-6-sol' }] }, 'gpt-6-sol'), undefined)
  assert.equal(officialReviewModel(undefined, 'gpt-6-sol'), undefined)
})
