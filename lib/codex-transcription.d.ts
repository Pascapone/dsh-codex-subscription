import type { AuthReaders } from './model-types.js';
export interface TranscriptionAudio {
    audio: Buffer<ArrayBuffer>;
    mime: string;
    filename: string;
}
export declare const CODEX_TRANSCRIPTION_URL = "https://chatgpt.com/backend-api/transcribe";
export declare const MAX_TRANSCRIPTION_BYTES: number;
export declare const AUDIO_FORMATS: Readonly<{
    'audio/webm': "webm";
    'audio/ogg': "ogg";
    'audio/mp4': "m4a";
    'audio/wav': "wav";
}>;
export declare function decodeTranscriptionAudio(input: unknown): TranscriptionAudio;
export declare function createCodexTranscriptionProvider({ getAuth, readCredential, fetch: fetchAudio }: AuthReaders & {
    fetch?: typeof fetch;
}): ({ audio, mime, filename }: TranscriptionAudio, signal: AbortSignal) => Promise<{
    text: string;
}>;
