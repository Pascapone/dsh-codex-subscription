import type { QuotaSample } from './quota-rate-interval.js';
export interface ForecastRecord {
    resetsAt: number | null;
    samples: QuotaSample[];
}
export interface ForecastState {
    windows: Record<string, ForecastRecord>;
}
export interface ForecastContext {
    scope?: unknown;
    limitId?: unknown;
}
export interface ForecastObservation {
    remainingPercent?: unknown;
    windowSeconds?: unknown;
    resetsAt?: unknown;
}
export interface ForecastSummary {
    sampleCount: number;
    observedSpanMs: number;
    consumedPercent: number;
    lowerPacePerHour: number;
    upperPacePerHour: number;
    changedIntensity: boolean;
    rateMethod: string;
}
export type QuotaForecast = ({
    status: 'calibrating';
    reason?: 'stale' | 'changing-pace' | 'resolution';
} & Partial<ForecastSummary>) | (ForecastSummary & {
    status: 'ready';
    pacePerHour: number;
    runwaySeconds: number;
    survivesReset: boolean;
    provisional?: boolean;
    runwayMinSeconds?: number;
    runwayMaxSeconds?: number;
});
