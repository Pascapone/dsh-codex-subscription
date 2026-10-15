import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import type { createSketchAgentBridge } from './sketch-agent-bridge.js';
export declare function createSketchAgentTool(bridge: Pick<ReturnType<typeof createSketchAgentBridge>, 'request'>, attachments: Pick<AttachmentStore, 'readImage' | 'saveImage' | 'imageLimits'>, getSessionMessages?: (id: NonNullable<import('@deepseek-ai/dsh-tools').ToolRunContext['agent']>['id']) => readonly {
    content?: unknown;
}[] | Promise<readonly {
    content?: unknown;
}[]>): ToolDefinition;
