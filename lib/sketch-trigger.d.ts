import type { InputTriggerSource, ClientSessionContext, TokenSpan } from '@deepseek-ai/dsh-client-ui-input-trigger/client';
type TriggerOptions = {
    enabled(): boolean;
    open?(sessionId: ClientSessionContext['sessionId']): void;
    consume(sessionId: ClientSessionContext['sessionId'], span: TokenSpan): boolean;
};
export declare const createSketchTrigger: (options: TriggerOptions) => InputTriggerSource;
export declare const createImageTrigger: (options: TriggerOptions) => InputTriggerSource;
export {};
