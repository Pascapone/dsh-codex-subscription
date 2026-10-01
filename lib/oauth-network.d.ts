import type { IncomingMessage } from 'node:http';
import type { FetchInput, FetchInit, NetworkOptions, NetworkRoute, ProxyOptions } from './network-types.js';
export declare function headroomRouteUrl(value: unknown): string | undefined;
export declare function proxyFromEnvironment(env?: NodeJS.ProcessEnv, target?: import("url").URL): string | undefined;
export declare function resolveCodexOAuthProxy(options?: ProxyOptions): Promise<string | undefined>;
export declare function transportError<T>(input: T, signal?: AbortSignal | null): T | Error;
export declare function transportResponseBody(response: IncomingMessage, signal?: AbortSignal | null): import("stream/web").ReadableStream<any>;
export declare function fetchThroughProxy(input: FetchInput, init: FetchInit, proxyUrl: string): Promise<Response>;
export declare function withCodexNetwork<T>(run: () => T | Promise<T>, options?: NetworkOptions): Promise<T>;
export declare const withCodexOAuthNetwork: <T>(run: () => T | Promise<T>, options?: NetworkOptions) => Promise<T>;
export declare function createCodexNetworkTransport(options?: NetworkOptions): Readonly<{
    run: <T>(area: string, operation: () => T | Promise<T>, connection?: NetworkOptions) => Promise<T>;
    fetch: (area: string, input: FetchInput, init?: FetchInit) => Promise<Response>;
    snapshot: () => {
        [k: string]: {
            status: "ok" | "failed";
            stage?: "http" | "transport";
            code?: "http-error" | "timeout" | "dns" | "tls" | "connection" | "network";
            httpStatus?: number;
            route: NetworkRoute;
            elapsed: "under-1s" | "1-5s" | "5-15s" | "over-15s";
        };
    };
}>;
