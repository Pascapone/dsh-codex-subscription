import type { StreamOptions } from '@earendil-works/pi-ai';
import type { NetworkOptions } from './network-types.js';
import type { CompactionOptions, CompactionAdapter, CodexPayload } from './compaction-types.js';
export declare function createCompactionBridge({ enabled, threshold, accountScope, diagnostic, now }: CompactionOptions): {
    snapshot: () => {
        requests: number;
        checkpointsSaved: number;
        checkpointsReused: number;
    };
    resolveApiKey: (resolve: () => Promise<string>) => Promise<string>;
    wrapAdapter<T extends CompactionAdapter>(adapter: T): T;
    preparePayload(payload: CodexPayload, contextWindow?: number): CodexPayload;
    requestOptions(options: StreamOptions): StreamOptions;
    networkOptions(options: NetworkOptions | undefined): NetworkOptions | undefined;
};
