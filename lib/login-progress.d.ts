import type { LoginFlow, AccountStatusView } from './auth-types.js';
/** Reconcile a login flow with the credential store without exposing credentials. */
export declare function readLoginProgress({ flow, readFlow, readAccount }: {
    flow: Pick<LoginFlow, 'id' | 'method'>;
    readFlow(): Promise<LoginFlow>;
    readAccount(): Promise<AccountStatusView | undefined>;
}): Promise<{
    flow: {
        id: string;
        method: import("./auth-types.js").LoginMethod;
        phase: "authenticated";
        authenticated: boolean;
    };
    account: AccountStatusView;
    recovered: boolean;
} | {
    flow: LoginFlow;
    account?: undefined;
    recovered?: undefined;
} | {
    flow: LoginFlow;
    account: AccountStatusView | undefined;
    recovered?: undefined;
}>;
