import type { CodexUiProps } from './client-types.js';
import type { ModelSelectInjected } from '@deepseek-ai/dsh-client-ui-model-selection/client';
export declare function CodexComposerQuota({ preference, rpc, t, directory }: Pick<CodexUiProps, 'preference' | 'rpc' | 't'> & Pick<ModelSelectInjected, 'directory'>): import("react/jsx-runtime").JSX.Element | null;
