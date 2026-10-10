import type { ModelSelectInjected } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { CodexUiProps } from './client-types.js';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
type ModelSelection = Parameters<ModelSelectInjected['select']>[0];
type ModelProps = Omit<ModelSelectInjected, 'select'> & Pick<CodexUiProps, 'preference' | 'rpc' | 't'> & Pick<PropsRuntime<'conversation.input.model'>, 'useSession'> & {
    locked: boolean;
    sessionId: string;
    runtime?: boolean;
    select(selection: ModelSelection): Promise<boolean>;
};
export declare function CodexModelSelect({ locked, available, directory, load, select, preference, rpc, sessionId, useSession, runtime, t }: ModelProps): import("react/jsx-runtime").JSX.Element | null;
export {};
