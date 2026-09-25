export const CODEX_TRANSCRIPTION_URL = 'https://chatgpt.com/backend-api/transcribe'
export const MAX_TRANSCRIPTION_BYTES = 25 * 1024 * 1024
export const AUDIO_FORMATS = Object.freeze({
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/wav': 'wav',
})
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'

export function decodeTranscriptionAudio(payload) {
  const mime = typeof payload?.mimeType === 'string' ? payload.mimeType.split(';', 1)[0].trim().toLowerCase() : ''
  if (!Object.hasOwn(AUDIO_FORMATS, mime) || typeof payload?.audioBase64 !== 'string'
    || payload.audioBase64.length > Math.ceil(MAX_TRANSCRIPTION_BYTES / 3) * 4 + 4
    || payload.audioBase64.length % 4 !== 0
    || !/^[A-Za-z0-9+/]+={0,2}$/u.test(payload.audioBase64)) {
    throw new Error('Invalid audio recording')
  }
  const audio = Buffer.from(payload.audioBase64, 'base64')
  if (audio.length === 0 || audio.length > MAX_TRANSCRIPTION_BYTES) throw new Error('Invalid audio recording')
  return { audio, mime, filename: `recording.${AUDIO_FORMATS[mime]}` }
}

export function createCodexTranscriptionProvider({ getAuth, readCredential, fetch: fetchAudio = fetch }) {
  return async ({ audio, mime, filename }, signal) => {
    signal.throwIfAborted()
    const auth = await getAuth({ signal })
    const credential = await readCredential({ signal })
    const access = auth?.auth?.apiKey
    if (credential?.type !== 'oauth' || typeof access !== 'string' || !access) throw new Error('ChatGPT subscription is not signed in')
    const form = new FormData()
    form.append('file', new Blob([audio], { type: mime }), filename)
    // The shared proxy transport accepts bytes; Request creates the multipart boundary safely.
    const encoded = new Request(CODEX_TRANSCRIPTION_URL, { method: 'POST', body: form })
    const headers = {
      Authorization: `Bearer ${access}`, Origin: 'https://chatgpt.com', Referer: 'https://chatgpt.com/',
      'User-Agent': USER_AGENT, 'Content-Type': encoded.headers.get('content-type'),
    }
    let accountId = credential.accountId
    if (!accountId) {
      try { accountId = JSON.parse(Buffer.from(access.split('.')[1], 'base64url').toString('utf8'))?.['https://api.openai.com/auth']?.chatgpt_account_id } catch { /* non-JWT token */ }
    }
    if (typeof accountId === 'string' && accountId) headers['ChatGPT-Account-Id'] = accountId
    const response = await fetchAudio(CODEX_TRANSCRIPTION_URL, {
      method: 'POST', headers, body: new Uint8Array(await encoded.arrayBuffer()), signal, redirect: 'error',
    })
    signal.throwIfAborted()
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403
      ? 'ChatGPT sign-in needs to be renewed'
      : `ChatGPT transcription failed (HTTP ${response.status})`)
    const result = await response.json()
    if (typeof result?.text !== 'string' || !result.text.trim()) throw new Error('ChatGPT returned an empty transcription')
    return { text: result.text.trim() }
  }
}
