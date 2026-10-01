export interface QuotaSample {
    at: number;
    remainingPercent: number;
}
export interface QuotaRateBounds {
    min: number;
    max: number;
    feasible: boolean;
    method?: string;
    maxLagMs?: number;
}
export declare function quotaRateInterval(samples: readonly QuotaSample[], { quantum, rounding }?: {
    quantum?: number;
    rounding?: 'unknown' | 'floor' | 'nearest';
}): QuotaRateBounds;
export declare function quotaSharedOffsetInterval(samples: readonly QuotaSample[], { quantum, maxLagMs }?: {
    quantum?: number;
    maxLagMs?: number;
}): QuotaRateBounds;
export declare function refineQuotaRate(samples: readonly QuotaSample[], conservative: QuotaRateBounds): QuotaRateBounds;
