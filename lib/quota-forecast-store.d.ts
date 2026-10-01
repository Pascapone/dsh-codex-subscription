import type { ForecastState } from './forecast-types.js';
export declare class QuotaForecastStateStore {
    filename: string;
    maxBytes: number;
    constructor({ filename, maxBytes }: {
        filename: string;
        maxBytes?: number;
    });
    load(): Promise<ForecastState | undefined>;
    save(state: unknown): Promise<void>;
    clear(): Promise<void>;
}
