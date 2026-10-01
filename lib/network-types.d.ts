import type { ExecFileOptionsWithStringEncoding } from 'node:child_process';
export type FetchInput = Parameters<typeof fetch>[0];
export type FetchInit = Parameters<typeof fetch>[1];
export type NetworkRoute = 'direct' | 'bypass' | 'environment' | 'system';
export interface ProxyOptions {
    env?: NodeJS.ProcessEnv;
    platform?: string;
    target?: URL;
    execFile?: (file: string, args: string[], options: ExecFileOptionsWithStringEncoding) => Promise<{
        stdout: string;
    }>;
}
export interface NetworkOptions extends ProxyOptions {
    websocket?: boolean;
    websocketProxy?: string;
    headroomBaseUrl?: string;
    hosts?: ReadonlySet<string>;
    fetchThroughProxy?: (input: FetchInput, init: FetchInit, proxyUrl: string) => Promise<Response>;
    transformResponse?: (response: Response, target: URL) => Response | Promise<Response>;
    onRoute?: (source: NetworkRoute) => void;
    now?: () => number;
}
export interface NetworkScope {
    options: NetworkOptions;
    allowedHosts: ReadonlySet<string>;
    resolved: Map<string, Promise<{
        url: string | undefined;
        source: NetworkRoute;
    }>>;
}
export interface NetworkAttempt {
    status: 'ok' | 'failed';
    stage?: 'http' | 'transport';
    code?: 'http-error' | 'timeout' | 'dns' | 'tls' | 'connection' | 'network';
    httpStatus?: number;
    route: NetworkRoute;
    elapsed: 'under-1s' | '1-5s' | '5-15s' | 'over-15s';
}
export type CodexNetworkTransport = ReturnType<typeof import('./oauth-network.js').createCodexNetworkTransport>;
