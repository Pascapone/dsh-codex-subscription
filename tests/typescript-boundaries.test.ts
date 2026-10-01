import assert from 'node:assert/strict';
import test from 'node:test';
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex';
import { createOfficialModelCatalog, parseOfficialModelCatalog } from '../src/model-catalog.js';
import { parseCodexUsage } from '../src/usage.js';
import { testGroup } from '../scripts/test-groups.mjs';

test('typed catalog and quota boundaries reject malformed JSON while preserving Sol 6.1 and exact quota precision', () => {
  for (const value of [null, [], 'catalog', {}, { models: {} }]) assert.throws(() => parseOfficialModelCatalog(value));
  const models = parseOfficialModelCatalog({ models: [null, 1, { slug: 'gpt-6.1-sol', visibility: 'list', input_modalities: ['text', null, 'audio'], supported_reasoning_levels: [null, { effort: 'low' }], service_tiers: [null, { id: 'priority' }] }] });
  assert.equal(models[0].id, 'gpt-6.1-sol');
  assert.deepEqual(models[0].input, ['text']);
  assert.equal(models[0].supportsFast, true);
  assert.equal(models[0].thinkingLevelMap.low, 'low');
  assert.equal(createOfficialModelCatalog().getModels(openaiCodexProvider().getModels()).some(model => model.id === 'gpt-6.1-sol'), true);
  for (const value of [null, [], { rate_limit: { primary_window: { used_percent: '1', limit_window_seconds: 1 } } }, { rate_limit_reset_credits: { available_count: -1 } }]) assert.throws(() => parseCodexUsage(value));
  const usage = parseCodexUsage({ rate_limit: { primary_window: { used_percent: 12.3456, limit_window_seconds: 18000 } }, rate_limit_reset_credits: { available_count: 1, credits: [{ status: 1 }, { status: 'available', title: 'Credit' }] } });
  assert.equal(usage.rateLimits[0].windows[0].usedPercent, 12.3456);
  assert.equal(usage.rateLimits[0].windows[0].remainingPercent, 100 - 12.3456);
  assert.deepEqual(usage.resetCredits?.credits, [{ name: 'Credit' }]);
  for (const extension of ['mjs', 'mts', 'js', 'ts']) {
    assert.equal(testGroup(`tests/new.test.${extension}`), 'behavior');
    assert.equal(testGroup(`tests/release-contract.test.${extension}`), 'delivery');
    assert.equal(testGroup(`tests/powershell-manager.test.${extension}`), 'manager');
  }
});

