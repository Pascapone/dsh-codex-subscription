import type { ForecastState, ForecastRecord, ForecastContext, ForecastObservation, QuotaForecast } from './forecast-types.js';
import type { createCodexUsageReader } from './usage.js';
import type { QuotaForecastStateStore } from './quota-forecast-store.js';
type UsageReader = Pick<ReturnType<typeof createCodexUsageReader>, 'read' | 'clear'>;
interface ForecastUsageInput {
    fetchedAt?: number;
    rateLimits?: readonly {
        id?: unknown;
        windows: readonly ForecastObservation[];
    }[];
}
type ForecastedUsage<T extends ForecastUsageInput> = T & {
    rateLimits: {
        windows: (ForecastObservation & {
            forecast: QuotaForecast;
        })[];
    }[];
};
interface ForecastReaderOptions {
    reader: UsageReader;
    enabled(): boolean;
    now?: () => number;
    scope?: () => unknown | Promise<unknown>;
    stateStore?: Partial<Pick<QuotaForecastStateStore, 'load' | 'save' | 'clear' | 'usage'>>;
}
export declare function observeQuotaForecast(state: ForecastState | undefined, windows: readonly ForecastObservation[] | undefined, now?: number, context?: ForecastContext): {
    state: {
        windows: {
            [x: string]: ForecastRecord;
        };
    };
    changed: boolean;
};
export declare function estimateQuotaForecast(state: ForecastState | undefined, window: ForecastObservation, now?: number, context?: ForecastContext): QuotaForecast;
export declare function forecastUsage<T extends ForecastUsageInput>(usage: T | undefined, state?: ForecastState, now?: number, options?: ForecastContext): {
    state: ForecastState;
    changed: boolean;
    usage: ForecastedUsage<T>;
};
export declare function createQuotaForecastReader({ reader, enabled, now, scope, stateStore }: ForecastReaderOptions): Readonly<{
    read(options?: Parameters<UsageReader["read"]>[0]): Promise<import("./model-types.js").UsageSnapshot>;
    clear: () => Promise<void>;
    storage: () => Promise<{
        bytes: number;
        limit: number;
    }>;
    clearCache(): void;
    clearScope(targetScope: unknown): Promise<void>;
}>;
export {};
