import type { ContentBlock, GenerateOptions, LlmAdapter, RequestMessage } from '@deepseek-ai/dsh-llm';

export interface CodexPayload extends Record<string, unknown> { input: unknown[]; text?: Record<string, unknown> | null }
export interface CompactionOptions {
  enabled?: () => boolean;
  threshold?: () => number;
  accountScope(options: GenerateOptions): { access?: string; accountId?: string } | Promise<{ access?: string; accountId?: string }>;
  diagnostic?: (status: { completed: boolean; captured: number; replay: boolean }) => void;
  now?: () => number;
}
export interface CompactionState { access: string; identity: string; original: RequestMessage[]; blocks: ContentBlock[]; suffix?: unknown[]; completed: boolean; captured?: unknown[]; counted?: boolean }
export interface RawCheckpoint { createdAt?: unknown; scope?: unknown; prefix?: unknown; content?: unknown; items?: unknown; digest?: unknown }
export type CompactionAdapter = Pick<LlmAdapter, 'stream' | 'prepareCall'>;
export type CompactionBridge = ReturnType<typeof import('./subscription-compaction.js').createCompactionBridge>;
