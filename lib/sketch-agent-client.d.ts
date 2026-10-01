import type { SubscriptionRpcClient } from './client-types.js';
import type { SketchRequest } from './sketch-types.js';
export declare function connectSketchAgent(rpc: SubscriptionRpcClient, sessionId: string, execute: (request: SketchRequest) => unknown | Promise<unknown>, report: (message: string) => void, pollDelay?: () => number): () => void;
