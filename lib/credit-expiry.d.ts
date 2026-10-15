export declare const PRO_200_COMPENSATION: Readonly<{
    credits: 62500;
    expiresAt: number;
}>;
/** Expiry of the balance: the API's own value when it has one, otherwise the known grant. */
export declare function creditExpiry({ planType, balance, apiExpiresAt }: {
    planType?: unknown;
    balance?: unknown;
    apiExpiresAt?: number;
}, now?: number): {
    expiresAt: number | undefined;
    source: string;
} | undefined;
/** Whole days left, and whether the expiry is close enough to call out. */
export declare function creditExpiryStatus(expiry: {
    expiresAt: number;
} | undefined, now?: number): {
    daysLeft: number;
    soon: boolean;
} | undefined;
