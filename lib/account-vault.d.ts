import type { CredentialInfo, OAuthCredential } from '@earendil-works/pi-ai';
import type { CredentialKey, CredentialRef } from '@deepseek-ai/dsh-credentials';
import type { SafeOAuthCredential, PublicAccount, VaultCredentials, VaultOptions, CredentialMutation } from './auth-types.js';
/** Keep only a bounded, display-safe email address from a trusted OAuth result. */
export declare function normalizeAccountEmail(value: unknown): string | undefined;
/** Normalize the one non-secret account attribute that may cross the UI boundary. */
export declare function sanitizeOAuthCredential(value: unknown): SafeOAuthCredential;
export declare class PendingOAuthCredentialStore {
    #private;
    read(providerId: string): Promise<OAuthCredential | undefined>;
    list(): Promise<CredentialInfo[]>;
    modify(providerId: string, update: CredentialMutation): Promise<OAuthCredential | undefined>;
    delete(providerId: string): Promise<void>;
    credential(): SafeOAuthCredential | undefined;
}
/**
 * Multi-account owner state stored in DSH's atomic plugin credential record.
 * The old single-account reference remains as a rollback source and is kept in
 * sync whenever that imported account rotates its refresh token.
 */
export declare class DshOAuthAccountVault {
    #private;
    credentials: VaultCredentials;
    key: CredentialKey;
    legacyRef: CredentialRef;
    legacyRefs: readonly CredentialRef[];
    createId: () => string;
    onLegacySyncFailure: () => void;
    constructor(credentials: VaultCredentials | null | undefined, options: VaultOptions);
    list(): Promise<PublicAccount[]>;
    readActive(): Promise<SafeOAuthCredential | undefined>;
    activeId(): Promise<string | undefined>;
    add(label: unknown, credential: unknown): Promise<PublicAccount>;
    select(id: unknown): Promise<void>;
    modifyActive(update: (current: OAuthCredential | undefined) => ReturnType<CredentialMutation>): Promise<OAuthCredential | undefined>;
    deleteAll(): Promise<void>;
    remove(id: unknown): Promise<void>;
}
