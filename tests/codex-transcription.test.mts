import type { ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection';
type CapturedInit = RequestInit & {headers: Record<string, string>};
import assert from 'node:assert/strict'
import test from 'node:test'
import { createCodexSpeechProvider, createCodexTranscriptionProvider, decodeTranscriptionAudio, CODEX_TRANSCRIPTION_URL, MAX_TRANSCRIPTION_BYTES } from '../src/codex-transcription.js'
import { createSubscriptionRpcHandler } from '../src/subscription-rpc.js'
import { capabilityPatch } from '../src/capability-settings.js'
import { Context } from '@deepseek-ai/cordis'
import SpeechToText from '@deepseek-ai/dsh-experimental-speech-to-text'

const audio = new Uint8Array(32044)
const input = decodeTranscriptionAudio({ mimeType: 'audio/webm;codecs=opus', audioBase64: Buffer.from(audio).toString('base64') })

test('Codex transcription reuses OAuth and sends browser recording as multipart to ChatGPT', async () => {
  let request!: {url: unknown; init: CapturedInit}
  const transcribe = createCodexTranscriptionProvider((({
    getAuth: async () => ({ auth: { apiKey: 'secret' } }),
    readCredential: async () => ({ type: 'oauth', access: 'secret', accountId: 'account' }),
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
    readCredential: async () => ({ type: 'oauth', access }),
    fetch: async (_url: unknown, init: CapturedInit) => { headers = init.headers; return new Response('private server response', { status: 401 }) },
  }) as unknown as Parameters<typeof createCodexTranscriptionProvider>[0]))
  await assert.rejects(failed(input, new AbortController().signal), /sign-in needs to be renewed/)
  assert.equal(headers['ChatGPT-Account-Id'], 'jwt-account')
})

test('Shared speech provider validates WAV, obeys opt-in and cancellation, and reuses subscription transcription', async () => {
  const wav = Buffer.alloc(48044)
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40)
  let enabled = false, calls = 0
  const provider = createCodexSpeechProvider(async (input, signal) => {
    calls++; signal.throwIfAborted(); assert.equal(input.mime, 'audio/wav'); assert.deepEqual(input.audio, wav)
    return { text: 'Existing DSH account' }
  }, () => enabled)
  const request = { audio: wav, language: 'auto' }, signal = new AbortController()
  await assert.rejects(provider.transcribe(request, signal.signal), /Enable transcription/)
  enabled = true
  await assert.rejects(provider.transcribe({ ...request, audio: Buffer.alloc(50) }, signal.signal), /Invalid PCM16/)
  assert.equal(calls, 0)
  const result = await provider.transcribe(request, signal.signal)
  assert.equal(result.text, 'Existing DSH account'); assert.equal(result.audioSeconds, 1)
  assert.ok(result.inferenceSeconds >= 0); assert.equal(calls, 1)
  signal.abort(); await assert.rejects(provider.transcribe(request, signal.signal)); assert.equal(calls, 1)
  const failing = createCodexSpeechProvider(async () => { throw new Error('private-refresh-token') }, () => true)
  await assert.rejects(failing.transcribe(request, new AbortController().signal), error => {
    assert.match(String(error), /Check Codex Subscription/); assert.doesNotMatch(String(error), /private-refresh-token/); return true
  })
})

test('DSH speech registry removes the Codex provider and cancels accepted work on disposal', async () => {
  const ctx = new Context(), base = ctx.plugin(SpeechToText, { defaultProvider: 'codex-subscription', language: 'auto' })
  await base
  try {
    const service = ctx.get('speechToText')!
    const provider = createCodexSpeechProvider(async () => ({ text: 'unused' }), () => true)
    let admitted!: () => void
    const admission = new Promise<void>(resolve => { admitted = resolve })
    const fiber = ctx.inject(['speechToText'], scoped => scoped.effect(() => scoped.speechToText.register({
      ...provider, transcribe: async (_input, signal) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('provider disposed')), { once: true }); admitted()
      }),
    })))
    await fiber
    assert.deepEqual(service.listProviders().map(value => value.id), ['codex-subscription'])
    const spec = service.resolve({ audio: new Uint8Array(44) })
    const work = service.transcribe(spec, new AbortController().signal)
    const rejected = assert.rejects(work, /disposed/)
    await admission; await fiber.dispose(); await rejected
    assert.equal(service.listProviders().length, 0)
    assert.throws(() => service.resolve({ audio: new Uint8Array(44) }), /unavailable/)
  } finally { await base.dispose() }
})

test('Cloudflare rejection is distinct from an expired login and never exposes the response body', async () => {
  const transcribe = createCodexTranscriptionProvider({
    getAuth: async () => ({ auth: { apiKey: 'test-only' } }),
    readCredential: async () => ({ type: 'oauth', access: 'test-only', expires: Date.now() + 3600_000, refresh: 'test-only' }),
    fetch: async () => new Response('private-server-body', { status: 403, headers: { 'cf-mitigated': 'challenge' } }),
  })
  await assert.rejects(transcribe(input, new AbortController().signal), error => {
    assert.match(String(error), /Cloudflare/); assert.doesNotMatch(String(error), /private-server-body|test-only/); return true
  })
})
