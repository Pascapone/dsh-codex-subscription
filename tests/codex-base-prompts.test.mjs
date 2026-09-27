import assert from 'node:assert/strict'
import test from 'node:test'
import { DSH_MODEL_PROMPTS } from '../src/codex-base-prompts.js'

// Guard against accidentally restoring raw upstream templates; this is not an LLM behavior eval.
test('DSH adaptations retain host boundaries, useful autonomy and distinct model scopes', () => {
  assert.deepEqual(Object.keys(DSH_MODEL_PROMPTS), ['gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna'])
  assert.equal(new Set(Object.values(DSH_MODEL_PROMPTS)).size, 3)
  for (const [id, text] of Object.entries(DSH_MODEL_PROMPTS)) {
    assert.match(text, /^# Additional DSH model guidance/u)
    assert.match(text, /If a preference here conflicts with those rules, follow the DSH rules/u)
    assert.match(text, /Silence and elapsed time are not authorization/u)
    assert.match(text, /Keep working through the next useful authorized steps/u)
    assert.match(text, /required DSH, repository and user checks/u)
    assert.match(text, /glob, grep and read/u)
    assert.match(text, /output\/link conventions/u)
    assert.doesNotMatch(text, /You are Codex|functions\.exec|exec_command|request_user_input_async|send_user_message_async|skills\.(?:list|read)|codex_apps|app:\/\/|tool_search|mcp__server__tool|clock\.sleep|rg --files|Do not provide ranges of lines/iu, id)
    assert.doesNotMatch(text, /Do not add or run tests unless the user asks/u, id)
    for (const model of ['Astra', 'Sol', 'Luna']) {
      assert.equal(text.includes(`# ${model}:`), id.endsWith(model.toLowerCase()), 'exactly one model scope')
    }
  }
  assert.match(DSH_MODEL_PROMPTS['gpt-6-astra'], /Handle complex, multi-step tasks/u)
  assert.match(DSH_MODEL_PROMPTS['gpt-6-astra'], /reviewer who has not read the conversation/u)
  assert.match(DSH_MODEL_PROMPTS['gpt-6-sol'], /Stop optional test expansion/u)
  const luna = DSH_MODEL_PROMPTS['gpt-6-luna']
  assert.match(luna, /small, local, low-risk changes/u)
  assert.match(luna, /A small diff is not evidence of low risk/u)
  assert.match(luna, /Do not silently switch models/u)
  assert.match(luna, /Minimize newly written tests/u)
  assert.match(luna, /fewer new tests does not mean skipping required verification/u)
})
