export declare function selectModelQuotaWindows(input: unknown, model: unknown): {
    forecast?: {} | null | undefined;
    resetsAt?: number | undefined;
    remainingPercent: number;
    windowSeconds: number;
}[];
export declare function selectModelQuota(usage: unknown, model: unknown): {
    forecast?: {} | null | undefined;
    resetsAt?: number | undefined;
    remainingPercent: number;
    windowSeconds: number;
} | undefined;
