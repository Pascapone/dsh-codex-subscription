import type { StreamOptions } from '@earendil-works/pi-ai';
import type { NetworkOptions } from './network-types.js';
import { resolveCodexOAuthProxy } from './oauth-network.js';
export declare function createSubscriptionConnection({ resolveMode, resolveProxy }?: {
    resolveMode?: () => 'sse' | 'websocket';
    resolveProxy?: typeof resolveCodexOAuthProxy;
}): {
    snapshot(): Record<string, number>;
    prepare(options?: StreamOptions, baseUrl?: string): Promise<{
        options: StreamOptions & {
            websocketConnectTimeoutMs?: number;
        };
        network?: NetworkOptions;
    }>;
    dispose(): void;
};
