import type { Api, Model } from '@earendil-works/pi-ai';
import type { IMAGE_FEATURE_DEFAULTS } from './image-features.js';
import type { IMAGE_MODELS } from './image-models.js';
export type ContextModel = Partial<Pick<Model<Api>, 'id' | 'name' | 'contextWindow'>> & {
    maxContextWindow?: number;
};
export interface ContextModelGroup {
    key: string;
    label: string;
    maximum: number;
    fixed?: boolean;
    default?: number;
}
export type SearchProvider = 'auto' | 'dsh' | 'codex';
export type SearchMode = 'live' | 'cached' | 'disabled';
export type QuotaAlertMode = 'off' | 'important' | 'early' | 'custom';
export type OutputVerbosity = 'default' | 'low' | 'medium' | 'high';
export type SpeedMode = 'standard' | 'fast';
export type ContextMode = 'standard' | 'extended' | 'custom';
export type QuickQuotaMode = 'off' | 'percent' | 'bar' | 'forecast';
export type ImageModel = keyof typeof IMAGE_MODELS;
export type ImageQuality = (typeof IMAGE_MODELS)[ImageModel][number];
export type ImageFeatures = {
    [K in keyof typeof IMAGE_FEATURE_DEFAULTS]: boolean;
};
export type ImageDefaults = {
    imageModel: ImageModel;
    imageQuality: ImageQuality;
};
export type CapabilitySettings = ImageFeatures & ImageDefaults & {
    quotaShortThreshold: number;
    quotaLongThreshold: number;
    customContextModels: Record<string, number>;
    searchMode: SearchMode;
    searchDomains: string[];
    quotaAlerts: QuotaAlertMode;
    transcriptionEnabled: boolean;
};
export interface QuotaWarningUsage {
    fetchedAt: number;
    rateLimits?: {
        id: string;
        windows?: {
            remainingPercent: number;
            windowSeconds: number;
            resetsAt?: number;
        }[];
    }[];
}
