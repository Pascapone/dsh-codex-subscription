import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { ContextModelGroup } from './settings-types.js';
export type PreferenceValue = Record<string, unknown> & {
    sessionSpeedModes?: Readonly<Record<string, unknown>>;
};
export type PreferenceSnapshot = Pick<ConfigFormSnapshot<PreferenceValue>, 'status'> & Partial<Omit<ConfigFormSnapshot<PreferenceValue>, 'status'>>;
export type PreferenceScope = Pick<ConfigForm<PreferenceValue>, 'subscribe'> & {
    getSnapshot(): PreferenceSnapshot;
    set?(...args: Parameters<ConfigForm<PreferenceValue>['set']>): Promise<Awaited<ReturnType<ConfigForm<PreferenceValue>['set']>> | void>;
};
export type ContextModelDescriptor = Pick<ContextModelGroup, 'key' | 'maximum'> & Partial<Omit<ContextModelGroup, 'key' | 'maximum'>>;
export type PreferenceWireView = PreferenceValue & {
    contextModels?: unknown;
    verbosityModels?: unknown;
    fastModels?: unknown;
    catalogStatus?: unknown;
};
