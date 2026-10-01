import type { AuthOperationOptions, CredentialInfo, Models, OAuthCredential } from '@earendil-works/pi-ai';
import type { CredentialProvider, CredentialRef } from '@deepseek-ai/dsh-credentials';
import type { AuthService, CredentialMutation } from './auth-types.js';
import type { DshOAuthAccountVault } from './account-vault.js';
import { PendingOAuthCredentialStore } from './account-vault.js';
/**
 * Adapt DSH's managed string credential service to pi-ai's typed OAuth store.
 * Refresh/login/logout operations are serialized so an older refresh response
 * cannot overwrite a newer rotated token.
 */
export declare class DshOAuthCredentialStore {
    #private;
    credentials: Pick<CredentialProvider, 'resolve' | 'set' | 'unset'>;
    ref: CredentialRef;
    legacyRefs: readonly CredentialRef[];
    expirySkewMs: number;
    vault: DshOAuthAccountVault | undefined;
    constructor(credentials: Pick<CredentialProvider, 'resolve' | 'set' | 'unset'> | null | undefined, ref: CredentialRef, legacyRefs?: readonly CredentialRef[], options?: {
        expirySkewMs?: number;
        vault?: DshOAuthAccountVault;
    });
    read(providerId: string, options?: AuthOperationOptions): Promise<OAuthCredential | undefined>;
    list(options?: AuthOperationOptions): Promise<CredentialInfo[]>;
    modify(providerId: string, update: CredentialMutation, options?: AuthOperationOptions): Promise<OAuthCredential | undefined>;
    delete(providerId: string, options?: AuthOperationOptions): Promise<void>;
}
/** Return only account state that is safe to expose to the browser client. */
export declare function createCodexAuthService(models: Pick<Models, 'login' | 'logout'>, store: Pick<DshOAuthCredentialStore, 'read'>, options?: {
    runLogin?: <T>(run: () => Promise<T>) => Promise<T>;
    accountVault?: DshOAuthAccountVault;
    createLoginModels?: (store: PendingOAuthCredentialStore) => Pick<Models, 'login'>;
    createPendingStore?: () => PendingOAuthCredentialStore;
}): AuthService;
