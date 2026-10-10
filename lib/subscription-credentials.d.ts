import type { AuthReaders } from './model-types.js';
export declare function readSubscriptionCredentials(getAuth: AuthReaders['getAuth'] | undefined, readCredential: AuthReaders['readCredential'] | undefined, signal?: AbortSignal): Promise<{
    access: string;
    accountId: string | undefined;
} | {
    access: undefined;
    accountId: undefined;
}>;
