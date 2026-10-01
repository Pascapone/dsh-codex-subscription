import type { AccountStatusView, LoginFlow } from './auth-types.js';
import type { UsageSnapshot } from './model-types.js';
import type { QuotaForecast } from './forecast-types.js';
import type { SketchRequest } from './sketch-types.js';
export type RuntimeStatus = {
    phase: 'idle' | 'installing' | 'removing' | 'applying' | 'cancelled' | 'done' | 'failed';
    restartRequired: boolean;
    error?: string;
    available: boolean;
    installable: boolean;
    componentVersion?: string;
    installed: boolean;
    present: boolean;
    removable: boolean;
    active: number;
};
export type PublicResetCredit = {
    ref?: string;
    name?: string;
    expiresAt?: number;
};
export type PublicResetChallenge = {
    challengeId: string;
    readyAt: number;
    expiresAt: number;
    title?: string;
    description?: string;
    creditExpiresAt?: number;
    availableCount?: number;
    state?: string;
};
export type ForecastUsage = Omit<UsageSnapshot, 'rateLimits'> & {
    rateLimits: (Omit<UsageSnapshot['rateLimits'][number], 'windows'> & {
        windows: (UsageSnapshot['rateLimits'][number]['windows'][number] & {
            forecast?: QuotaForecast | {
                status: 'idle';
            };
        })[];
    })[];
};
export type SketchTaskDelivery = {
    id: string;
    cancelled?: boolean;
    request: SketchRequest;
    expiresAt: number;
};
export type RpcResponseMap = {
    status: AccountStatusView;
    logout: AccountStatusView;
    'account/select': AccountStatusView;
    'account/remove': AccountStatusView;
    'login/start': LoginFlow;
    'login/status': LoginFlow;
    'login/submit': LoginFlow;
    'login/cancel': LoginFlow;
    usage: ForecastUsage;
    diagnostics: Record<string, unknown>;
    'preferences/status': Record<string, unknown>;
    'preferences/models': Record<string, unknown>;
    'preferences/update': Record<string, unknown>;
    'runtime/status': RuntimeStatus;
    'runtime/install': RuntimeStatus;
    'runtime/remove': RuntimeStatus;
    'runtime/cancel': RuntimeStatus;
    'reset-credit/inspect': {
        availableCount: number;
        credits: PublicResetCredit[];
        nextExpiresAt?: number;
    };
    'reset-credit/prepare': PublicResetChallenge;
    'reset-credit/consume': {
        code: string;
        windowsReset?: string[];
        windowsResetCount?: number;
    };
    'image/original/chunk': unknown;
    'transcription/transcribe': {
        text: string;
    };
    'sketch/connect': {
        token: string;
    };
    'sketch/poll': SketchTaskDelivery[];
    'sketch/claim': boolean;
    'sketch/result': null;
    'sketch/disconnect': null;
};
export type RpcResponse<E extends string> = E extends keyof RpcResponseMap ? RpcResponseMap[E] : unknown;
