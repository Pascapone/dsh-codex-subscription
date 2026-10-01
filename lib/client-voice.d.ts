import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { CodexUiProps } from './client-types.js';
import type { createVoiceController } from './voice-controller.js';
type VoiceProps = {
    voice: ReturnType<typeof createVoiceController>;
} & Pick<CodexUiProps, 't'>;
export declare function CodexVoiceInput({ sessionId, inputActions, onActiveChange, locked, preference, voice, t }: VoiceProps & Pick<CodexUiProps, 'preference'> & Pick<PropsRuntime<'conversation.input.activity'>, 'sessionId' | 'inputActions' | 'onActiveChange' | 'locked'>): import("react/jsx-runtime").JSX.Element | null;
export declare function CodexVoiceSidebarIndicator({ voice, t }: VoiceProps): import("react/jsx-runtime").JSX.Element | null;
export {};
