import assert from 'node:assert/strict';
import test from 'node:test';
import type { LlmCallConfig } from '@deepseek-ai/dsh-llm';
import { createRunOptions } from '../src/run-options.js';

type Selection = { provider: string; model: string; reasoningEffort?: string };
type Assembly = { sections: unknown[]; contexts: unknown[]; tools: unknown[]; variables: Record<string, string> };
const signal = () => new AbortController().signal;
const selection = { provider: 'openai-codex', model: 'gpt-6-luna', reasoningEffort: 'low' };
const change = { sessionId: 'session-a', model: 'gpt-6-luna', reasoningEffort: 'high', speedMode: 'fast', expectedModel: 'gpt-6-luna', confirmed: true };
function fixture() {
  let pending: Selection | null = null;
  let header: Selection = { ...selection };
  const values = { runtimeOptions: true, sessionSpeedModes: { 'session-a': 'standard', 'session-b': 'standard' } as Record<string, string> };
  const events: { type: string; data: Selection }[] = [];
  const hooks = new Map<string, unknown>();
  const cleanup: (() => void)[] = [];
  let pauseSave: (() => Promise<void>) | undefined;
  let rejectSave = false;
  const owner = {
    effect(install: () => (() => void)) {
      const dispose = install(); cleanup.push(dispose); return dispose;
    },
    on(name: string, hook: unknown, options: { prepend: boolean }) {
      assert.equal(options.prepend, true); hooks.set(name, hook); return () => { hooks.delete(name); };
    },
  };
  const agent = { id: 'session-a', status: 'running', ctx: owner, session: {
    requestHeader: () => ({ config: header }),
    append(type: string, data: Selection) { events.push({ type, data }); pending = data; return { seq: events.length }; },
  } };
  const services = { sessionController: { resolveAgent: async () => ({ agent }) }, sessionProjections: { stateOf: () => ({ pending }) } };
  const ctx = {
    get: (name: keyof typeof services) => services[name],
    sessionProjections: services.sessionProjections,
    effect: owner.effect,
    llm: {
      listModels: async () => ['gpt-6-luna', 'gpt-6.1-sol', 'gpt-5.3-codex-spark'].map(id => ({ id, reasoning: { efforts: [{ id: 'low' }, { id: 'high' }] } })),
      resolveCallConfig: async (config: Selection) => {
        if (config.reasoningEffort && !['low', 'high'].includes(config.reasoningEffort)) throw new Error('Unsupported reasoning effort');
        return config;
      },
    },
  };
  const run = createRunOptions(ctx as unknown as Parameters<typeof createRunOptions>[0], {
    get: () => values,
    async setSessionSpeed(id, speed) { if (rejectSave) { rejectSave = false; throw new Error('storage failed'); } values.sessionSpeedModes[id] = speed; const pause = pauseSave; pauseSave = undefined; await pause?.(); },
  }, model => model !== 'gpt-5.3-codex-spark');
  const assemble = async (next = async (): Promise<Assembly> => ({ sections: [], contexts: [], tools: [], variables: { provider: header.provider, model: header.model } })) => {
    const hook = hooks.get('system-prompt/assemble') as (_input: unknown, _context: unknown, next: () => Promise<Assembly>) => Promise<Assembly>;
    return hook({}, {}, next);
  };
  const request = async () => {
    const hook = hooks.get('agent/request') as (_payload: unknown, next: () => Promise<LlmCallConfig>) => Promise<LlmCallConfig>;
    return hook({}, async () => header as LlmCallConfig);
  };
  return { run, values, events, agent, hooks, assemble, request,
    commit(config: Selection) { header = config; pending = null; },
    pauseSave(pause: () => Promise<void>) { pauseSave = pause; },
    failNextSave() { rejectSave = true; },
    cleanup() { for (const dispose of [...cleanup].reverse()) dispose(); },
  };
}

test('confirmed options wait for the next assembly and stay session-local', async () => {
  const f = fixture();
  await f.run.apply(change, signal());
  assert.equal(f.run.speedFor('session-a'), 'standard', 'a request already past assembly retains the original speed');
  await f.assemble();
  assert.equal((await f.request()).reasoningEffort, 'high');
  assert.equal(f.run.speedFor('session-a'), 'fast');
  assert.equal(f.run.speedFor('session-b'), 'standard');
  assert.equal(f.events[0].type, 'model/selection');
  assert.equal(f.events.length, 1, 'no synthetic user turn or default-model write');
  f.commit({ ...selection, reasoningEffort: 'high' });
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const oldAssembly = f.assemble(async () => { await blocked; return { sections: [], contexts: [], tools: [], variables: { provider: selection.provider, model: selection.model } }; });
  await f.run.apply({ ...change, reasoningEffort: 'low', speedMode: 'standard' }, signal());
  release(); await oldAssembly;
  assert.equal((await f.request()).reasoningEffort, 'high');
  assert.equal(f.run.speedFor('session-a'), 'fast', 'no mixing newly saved Fast with an already assembled request');
  await f.assemble();
  assert.equal((await f.request()).reasoningEffort, 'low');
  assert.equal(f.run.speedFor('session-a'), 'standard');
  f.cleanup();
  assert.equal(f.hooks.size, 0);
});

test('model switch preserves the prompt and gets a logged next-step notice', async () => {
  const f = fixture();
  await f.run.apply({ ...change, model: 'gpt-6.1-sol' }, signal());
  const assembly = await f.assemble();
  assert.equal(assembly.variables.model, 'gpt-6.1-sol');
  assert.equal(f.run.selectionFor('session-a')?.model, 'gpt-6.1-sol');
  assert.equal((await f.request()).model, 'gpt-6.1-sol');
  const hook = f.hooks.get('agent/pre-step') as (payload: unknown, next: () => Promise<{ kind: 'accept'; messages: unknown[]; startsRequestSeries: boolean }>) => Promise<{ messages: { content: { text: string }[] }[]; startsRequestSeries: boolean }>;
  const decision = await hook({ messages: [], step: 2, signal: signal() }, async () => ({ kind: 'accept', messages: [], startsRequestSeries: true }));
  assert.equal(decision.startsRequestSeries, true);
  assert.match(decision.messages[0].content[0].text, /gpt-6-luna.*gpt-6\.1-sol/);
  f.cleanup();
});

test('saving or cancelling never changes an already captured request', async () => {
  const f = fixture();
  await f.run.apply(change, signal()); await f.assemble();
  f.commit({ ...selection, reasoningEffort: 'high' });
  const controller = new AbortController();
  f.pauseSave(async () => { await f.assemble(); controller.abort(); });
  await assert.rejects(f.run.apply({ ...change, reasoningEffort: 'low', speedMode: 'standard' }, controller.signal));
  assert.equal(f.values.sessionSpeedModes['session-a'], 'fast', 'cancelled persistence is rolled back');
  assert.equal((await f.request()).reasoningEffort, 'high');
  assert.equal(f.run.speedFor('session-a'), 'fast');
  assert.equal(f.events.length, 1);
  f.cleanup();
});

test('failed rollback keeps the previous speed fenced until a successful retry', async () => {
  const f = fixture();
  f.pauseSave(async () => { f.failNextSave(); throw new Error('write notification failed'); });
  await assert.rejects(f.run.apply(change, signal()), /could not be restored/);
  assert.equal(f.events.length, 0);
  await f.assemble(); await f.request();
  assert.equal(f.run.speedFor('session-a'), 'standard');
  await f.run.apply({ ...change, speedMode: 'standard' }, signal());
  assert.equal(f.values.sessionSpeedModes['session-a'], 'standard');
  f.cleanup();
});

test('concurrent confirmations cannot interleave their selection and Fast writes', async () => {
  const f = fixture();
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const blocked = new Promise<void>(resolve => { release = resolve; });
  f.pauseSave(async () => { entered(); await blocked; });
  const saving = f.run.apply(change, signal());
  await started;
  await assert.rejects(f.run.apply({ ...change, speedMode: 'standard' }, signal()), /already being saved/);
  assert.equal(f.run.speedFor('session-a'), 'standard');
  release(); await saving;
  assert.equal(f.events.length, 1);
  await f.assemble(); await f.request();
  assert.equal(f.run.speedFor('session-a'), 'fast');
  f.cleanup();
});

test('a later native selection is not overridden or given a duplicate notice', async () => {
  const f = fixture();
  await f.run.apply(change, signal()); await f.assemble(); await f.request();
  f.commit({ ...selection, reasoningEffort: 'high' });
  f.agent.session.append('model/selection', { ...selection, model: 'gpt-6.1-sol' });
  const native = { sections: [], contexts: [], tools: [], variables: { provider: selection.provider, model: 'gpt-6.1-sol' } };
  assert.deepEqual(await f.assemble(async () => native), native);
  assert.equal(f.run.selectionFor('session-a'), undefined);
  const decision = { kind: 'accept', messages: [{ role: 'user', content: [{ type: 'text', text: 'native model notice' }] }], startsRequestSeries: true };
  const hook = f.hooks.get('agent/pre-step') as (payload: unknown, next: () => Promise<typeof decision>) => Promise<typeof decision>;
  assert.deepEqual(await hook({ messages: [], step: 2, signal: signal() }, async () => decision), decision);
  f.cleanup();
});

test('disabled, unconfirmed, stale, unsupported and idle requests are rejected without writes', async () => {
  const f = fixture();
  f.values.runtimeOptions = false;
  await assert.rejects(f.run.apply(change, signal()), /disabled/);
  f.values.runtimeOptions = true;
  for (const payload of [null, { ...change, confirmed: false }, { ...change, extra: true }, { ...change, provider: 'other' }, { ...change, speedMode: 'invalid' }, { ...change, model: 'unknown' }, { ...change, reasoningEffort: 'invalid' }, { ...change, expectedModel: 'old' }, { ...change, model: 'gpt-5.3-codex-spark' }]) {
    await assert.rejects(f.run.apply(payload, signal()));
  }
  f.agent.status = 'idle';
  await assert.rejects(f.run.apply(change, signal()), /no longer running/);
  assert.equal(f.events.length, 0);
  assert.equal(f.values.sessionSpeedModes['session-a'], 'standard');
  f.cleanup();
});
