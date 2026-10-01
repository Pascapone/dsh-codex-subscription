import type { CodexUiProps } from './client-types.js';
import { selectModelQuotaWindows } from './sidebar-quota.js';
import type { QuotaForecast } from './forecast-types.js';
export type QuickQuotaWindow = Omit<ReturnType<typeof selectModelQuotaWindows>[number], 'forecast'> & {
    fetchedAt: number;
    forecast?: QuotaForecast | {
        status: 'idle';
    } | null;
};
export declare function useQuickQuota(rpc: CodexUiProps['rpc'], enabled: boolean, model?: string): QuickQuotaWindow[] | undefined;
