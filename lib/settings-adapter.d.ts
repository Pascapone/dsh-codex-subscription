import type { Context } from '@deepseek-ai/cordis';
import type Schemastery from '@deepseek-ai/schemastery';
import type { SettingsForms } from '@deepseek-ai/dsh-settings';
type SettingsValue = Record<string, unknown> & {
    sessionSpeedModes?: Readonly<Record<string, unknown>>;
};
interface LegacyNamespace {
    get(): SettingsValue;
    update(patch: Record<string, unknown>): Promise<unknown>;
    watch(listener: (value: SettingsValue) => void): () => void;
}
type SettingsPort = Partial<Pick<SettingsForms, 'configure' | 'update' | 'mutate'>> & {
    register?: <S, T>(namespace: string, schema: Schemastery<S, T>) => LegacyNamespace;
};
type AdapterContext = Pick<Context, 'effect' | 'on'> & {
    settings: SettingsPort;
    fiber?: {
        entry?: {
            options?: {
                id?: string;
            };
            id?: string;
        };
    };
};
export declare function createSettingsAdapter<S, T>(ctx: AdapterContext, schema: Schemastery<S, T>, config: Readonly<Record<string, unknown>>, namespace: string): {
    get: () => SettingsValue;
    update: (patch: Record<string, unknown>) => Promise<unknown>;
    watch: (listener: (value: SettingsValue) => void) => () => void;
    setSessionSpeed(sessionId: string, speedMode: unknown): Promise<unknown>;
};
export {};
