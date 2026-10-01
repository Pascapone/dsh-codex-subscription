import type { ModelSelectInjected } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { CodexUiProps } from './client-types.js';
type ModelSelection = Parameters<ModelSelectInjected['select']>[0];
type ModelProps = Omit<ModelSelectInjected, 'select'> & Pick<CodexUiProps, 'preference' | 't'> & {
    locked: boolean;
    sessionId: string;
    select(selection: ModelSelection): Promise<boolean>;
};
export declare function CodexModelSelect({ locked, available, directory, load, select, preference, sessionId, t }: ModelProps): import("react/jsx-runtime").JSX.Element | null;
export {};
