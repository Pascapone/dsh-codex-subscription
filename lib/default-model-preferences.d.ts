import type { CodexUiProps } from './client-types.js';
/**
 * Choose the model a new conversation opens with. DSH owns that selection, so
 * the control always shows the live value, including a model chosen in a chat
 * and any non-subscription default the user set elsewhere.
 */
export declare function DefaultModelPreference({ preference, defaultModel, t }: Pick<CodexUiProps, 'preference' | 't'> & {
    defaultModel: NonNullable<CodexUiProps['defaultModel']>;
}): import("react/jsx-runtime").JSX.Element;
