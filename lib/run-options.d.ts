import type { Context } from '@deepseek-ai/cordis';
import type { LlmCallConfig } from '@deepseek-ai/dsh-llm';
import type { SpeedMode } from './settings-types.js';
type Selection = Pick<LlmCallConfig, 'provider' | 'model' | 'reasoningEffort'>;
export declare function createRunOptions(ctx: Context, settings: {
    get(): Record<string, unknown> & {
        sessionSpeedModes?: Readonly<Record<string, unknown>>;
    };
    setSessionSpeed(sessionId: string, speedMode: SpeedMode): Promise<unknown>;
}, supportsFast: (model: string) => boolean): {
    selectionFor: (sessionId: string | undefined) => Selection | undefined;
    speedFor: (sessionId: string | undefined) => SpeedMode | undefined;
    apply(input: unknown, signal: AbortSignal): Promise<{
        selected: Selection;
        speedMode: SpeedMode;
        queued: true;
    }>;
};
export {};
