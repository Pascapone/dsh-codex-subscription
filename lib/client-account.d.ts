import type { CodexUiProps, AccountStatusState, Translate } from './client-types.js';
import type { AccountStatusView, PublicAccount } from './auth-types.js';
import type { MouseEventHandler } from 'react';
export declare function AccountEmail({ candidate, fallback, t, emailVisible, onClick }: {
    candidate?: Pick<PublicAccount, "email" | "label">;
    fallback?: string;
    t: Translate;
    emailVisible: boolean;
    onClick: MouseEventHandler<HTMLButtonElement>;
}): import("react/jsx-runtime").JSX.Element;
export declare function AccountCard({ rpc, t, account, setAccount, onSignedOut }: Pick<CodexUiProps, 'rpc' | 't'> & {
    account?: AccountStatusView;
    setAccount(account: AccountStatusView): void;
    onSignedOut(): void;
}): import("react/jsx-runtime").JSX.Element;
export declare function AccountFailureCard({ accountStatus, snapshot, t, rpc, onRecovered }: Pick<CodexUiProps, 'accountStatus' | 't' | 'rpc'> & {
    snapshot: AccountStatusState;
    onRecovered(): void;
}): import("react/jsx-runtime").JSX.Element;
