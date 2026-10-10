import type { CodexUiProps } from './client-types.js';
export declare function QuickQuotaPreference({ preference, t }: Pick<CodexUiProps, 'preference' | 't'>): import("react/jsx-runtime").JSX.Element;
export declare function AutoQuotaRetryPreference({ preference, t }: Pick<CodexUiProps, 'preference' | 't'>): import("react/jsx-runtime").JSX.Element;
export declare function SearchProviderPreference({ preference, t }: Pick<CodexUiProps, 'preference' | 't'>): import("react/jsx-runtime").JSX.Element;
export declare function InputImageDetailPreference({ preference, t }: Pick<CodexUiProps, 'preference' | 't'>): import("react/jsx-runtime").JSX.Element;
export declare function StreamIdleTimeoutPreference({ preference, t }: Pick<CodexUiProps, 'preference' | 't'>): import("react/jsx-runtime").JSX.Element;
/**
 * Show every account model while saving which entries the composer picker hides.
 * The controller ignores a write while another is saving, so quick toggles are kept
 * in a local draft and sent as one write once the previous one has settled.
 */
export declare function PickerModelsPreference({ preference, t }: Pick<CodexUiProps, 'preference' | 't'>): import("react/jsx-runtime").JSX.Element | null;
export declare function ContextWindowPreference({ preference, t }: Pick<CodexUiProps, 'preference' | 't'>): import("react/jsx-runtime").JSX.Element | null;
/** The account catalog is the only model list: say why it is empty, and offer one refresh. */
export declare function ModelCatalogStatus({ preference, t }: Pick<CodexUiProps, 'preference' | 't'>): import("react/jsx-runtime").JSX.Element;
export declare function PreferencesCard({ preference, rpc, t, defaultModel, section }: Pick<CodexUiProps, 'preference' | 'rpc' | 't' | 'defaultModel'> & {
    section?: 'display' | 'advanced';
}): import("react/jsx-runtime").JSX.Element;
