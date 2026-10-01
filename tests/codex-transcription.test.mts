import type { ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection';
type CapturedInit = RequestInit & {headers: Record<string, string>};
import assert from 'node:assert/strict'
import test from 'node:test'
import { createCodexTranscriptionProvider, decodeTranscriptionAudio, CODEX_TRANSCRIPTION_URL, MAX_TRANSCRIPTION_BYTES } from '../src/codex-transcription.js'
import { createSubscriptionRpcHandler } from '../src/subscription-rpc.js'
import { capabilityPatch } from '../src/capability-settings.js'

const audio = new Uint8Array(32044)
const input = decodeTranscriptionAudio({ mimeType: 'audio/webm;codecs=opus', audioBase64: Buffer.from(audio).toString('base64') })

test('Codex transcription reuses OAuth and sends browser recording as multipart to ChatGPT', async () => {
  let request!: {url: unknown; init: CapturedInit}
  const transcribe = createCodexTranscriptionProvider((({
    getAuth: async () => ({ auth: { apiKey: 'secret' } }),
    readCredential: async () => ({ type: 'oauth', accountId: 'account' }),
    fetch: async (url: unknown, init: CapturedInit) => { request = { url, init }; return new Response(JSON.stringify({ text: '  hello  ' })) },
  }) as unknown as Parameters<typeof createCodexTranscriptionProvider>[0]))
  const result = await transcribe(input, new AbortController().signal)
  assert.equal(request.url, CODEX_TRANSCRIPTION_URL)
  assert.equal(request.init.headers.Authorization, 'Bearer secret')
  assert.equal(request.init.headers['ChatGPT-Account-Id'], 'account')
  assert.equal(request.init.headers.Origin, 'https://chatgpt.com')
  const form = await new Request(CODEX_TRANSCRIPTION_URL, { method: 'POST', headers: request.init.headers, body: request.init.body }).formData()
  const file = form.get('file') as File
  assert.equal(file.name, 'recording.webm')
  assert.equal(file.type, 'audio/webm')
  assert.equal(file.size, audio.byteLength)
  assert.equal(form.get('model'), null)
  assert.deepEqual(result, { text: 'hello' })
})

test('Host rejects disabled, malformed and oversized audio before OAuth or transport', async () => {
  let calls = 0
  let enabled = false
  const handler = createSubscriptionRpcHandler((({ transcriptionEnabled: () => enabled, transcribeAudio: async () => { calls++; return { text: 'ok' } } }) as unknown as Parameters<typeof createSubscriptionRpcHandler>[0]))
  const signal = new AbortController().signal
  const send = (payload: unknown) => handler('transcription/transcribe', payload, signal)
  const payload = { mimeType: 'audio/webm', audioBase64: Buffer.from(audio).toString('base64') }
  assert.equal(((await send(payload) as Extract<ConnectionRpcResult<never>,{ok: false}>)).error.code, 'unavailable')
  enabled = true
  assert.equal(((await send({ ...payload, mimeType: 'text/plain' }) as Extract<ConnectionRpcResult<never>,{ok: false}>)).error.code, 'invalid-input')
  assert.equal(((await send({ ...payload, audioBase64: '!!!' }) as Extract<ConnectionRpcResult<never>,{ok: false}>)).error.code, 'invalid-input')
  assert.throws(() => decodeTranscriptionAudio({ ...payload, audioBase64: Buffer.alloc(MAX_TRANSCRIPTION_BYTES + 1).toString('base64') }), /Invalid audio/)
  assert.equal(calls, 0)
  assert.equal(((await send(payload) as Extract<ConnectionRpcResult<{text: string}>,{ok: true}>)).value.text, 'ok')
  assert.equal(calls, 1)
  assert.throws(() => capabilityPatch({ transcriptionEnabled: 'true' }), /Invalid transcription/)
})

test('OAuth failures and provider responses do not leak server error bodies', async () => {
  let called = false
  const unsigned = createCodexTranscriptionProvider((({
    getAuth: async () => ({ auth: { apiKey: 'secret' } }),
    readCredential: async () => ({ type: 'api_key' }),
    fetch: async () => { called = true },
  }) as unknown as Parameters<typeof createCodexTranscriptionProvider>[0]))
  await assert.rejects(unsigned(input, new AbortController().signal), /not signed in/)
  assert.equal(called, false)
  let headers!: Record<string, string>
  const access = `header.${Buffer.from(JSON.stringify({ 'https://api.openai.com/auth': { chatgpt_account_id: 'jwt-account' } })).toString('base64url')}.signature`
  const failed = createCodexTranscriptionProvider((({
    getAuth: async () => ({ auth: { apiKey: access } }),
    readCredential: async () => ({ type: 'oauth' }),
    fetch: async (_url: unknown, init: CapturedInit) => { headers = init.headers; return new Response('private server response', { status: 401 }) },
  }) as unknown as Parameters<typeof createCodexTranscriptionProvider>[0]))
  await assert.rejects(failed(input, new AbortController().signal), /sign-in needs to be renewed/)
  assert.equal(headers['ChatGPT-Account-Id'], 'jwt-account')
})
