import type { Api, AuthOperationOptions, AuthResult, Credential, Model, ThinkingLevelMap } from '@earendil-works/pi-ai';
export type CodexModel = Model<'openai-codex-responses'> & {
    maxContextWindow?: number;
};
export interface RemoteModel {
    id: string;
    name: string;
    description?: string;
    priority: number;
    input: Model<Api>['input'];
    contextWindow?: number;
    maxContextWindow?: number;
    reasoning: boolean;
    thinkingLevelMap: ThinkingLevelMap;
    supportVerbosity: boolean;
    defaultVerbosity?: 'low' | 'medium' | 'high';
    supportsFast: boolean;
    templateId?: string;
    unsupported?: {
        reasoning?: string[];
        inputs?: string[];
        speeds?: string[];
    };
}
export interface AuthReaders {
    getAuth(options?: AuthOperationOptions): Promise<AuthResult | undefined>;
    readCredential(options?: AuthOperationOptions): Promise<Credential | undefined>;
}
export interface ModelCatalogOptions extends Partial<AuthReaders> {
    baseModels?: () => readonly CodexModel[];
    fetch?: typeof fetch;
    setTimeout?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
    clearTimeout?: (timer: ReturnType<typeof setTimeout> | undefined) => void;
    timeoutMs?: number;
}
export interface UsageWindow {
    usedPercent: number;
    remainingPercent: number;
    windowSeconds: number;
    resetsAt?: number;
    forecast?: import('./forecast-types.js').QuotaForecast;
}
export interface UsageLimit {
    id: string;
    name?: string;
    windows: UsageWindow[];
}
export interface CodexUsage {
    rateLimits: UsageLimit[];
    credits?: {
        unlimited: boolean;
        balance?: string;
    };
    individualLimit?: {
        limit: string;
        used: string;
        remainingPercent: number;
        resetsAt?: number;
    };
    spendControlReached?: boolean;
    resetCredits?: {
        availableCount: number;
        credits?: {
            name?: string;
            expiresAt?: number;
        }[];
        nextExpiresAt?: number;
    };
}
export type UsageSnapshot = CodexUsage & {
    fetchedAt: number;
};
export interface UsageReaderOptions extends AuthReaders {
    fetch?: typeof fetch;
    now?: () => number;
    ttlMs?: number;
    timeoutMs?: number;
    failureTtlMs?: number;
    maxRetryAfterMs?: number;
}
export type OfficialModelCatalog = ReturnType<typeof import('./model-catalog.js').createOfficialModelCatalog>;
