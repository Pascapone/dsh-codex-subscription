import type { CodexUiProps } from './client-types.js';
export declare function QuickQuotaPreference({ preference, t }: Pick<CodexUiProps, 'preference' | 't'>): import("react/jsx-runtime").JSX.Element;
export declare function SearchProviderPreference({ preference, t }: Pick<CodexUiProps, 'preference' | 't'>): import("react/jsx-runtime").JSX.Element;
export declare function ContextWindowPreference({ preference, t }: Pick<CodexUiProps, 'preference' | 't'>): import("react/jsx-runtime").JSX.Element;
export declare function PreferencesCard({ preference, rpc, t, section }: Pick<CodexUiProps, 'preference' | 'rpc' | 't'> & {
    section?: string;
}): import("react/jsx-runtime").JSX.Element;
