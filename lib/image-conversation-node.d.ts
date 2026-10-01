import type { ConversationNodeDefinition, ConversationLocation } from '@deepseek-ai/dsh-client-ui-conversation/client';
type ImageEvent = Parameters<ConversationNodeDefinition<undefined>['match']>[0];
type LegacyImageResultBlock = {
    type?: unknown;
    isError?: unknown;
    content?: readonly {
        type?: unknown;
        attachment?: unknown;
    }[];
};
type ImageResultBlock = LegacyImageResultBlock & {
    kind: 'tool-result';
    meta: Extract<ImageEvent, {
        type: 'tool/result';
    }>['data']['meta'];
};
export declare const imageConversationNode: {
    kind: string;
    target: string;
    match(event: import("@deepseek-ai/dsh-api-session-controller/client").SessionEventLike): {
        id: string;
        role: "update";
    } | null;
    start: () => undefined;
    update: (context: import("@deepseek-ai/dsh-client-ui-conversation/client").ConversationNodeContext<undefined> & {
        readonly state: undefined;
    }) => undefined;
    buildViewNode(context: import("@deepseek-ai/dsh-client-ui-conversation/client").ConversationNodeContext<undefined>): {
        key: string;
        id: string;
        kind: string;
        target: string;
        location: ConversationLocation;
        anchorSeq: number;
        visibility: string;
        data: {
            blocks: ImageResultBlock[];
        };
    } | null;
};
export {};
