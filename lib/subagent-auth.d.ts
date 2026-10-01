import type { OAuthCredential } from '@earendil-works/pi-ai';
import type { DshOAuthCredentialStore } from './credential-store.js';
import type { JsonRpcLineTransport } from '@deepseek-ai/dsh-sdk-protocol';
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess';
type TokenGetter = (previousAccountId?: unknown, forceRefresh?: boolean) => Promise<{
    accessToken: string;
    chatgptAccountId: string;
}>;
type TransportPort = Pick<JsonRpcLineTransport, 'request' | 'notify' | 'start' | 'close' | 'onRequest' | 'onNotification'>;
interface TokenOptions {
    resolveAuth(): Promise<unknown>;
    store: Pick<DshOAuthCredentialStore, 'read' | 'modify'>;
    refresh(current: OAuthCredential): Promise<OAuthCredential>;
    signal: AbortSignal;
}
interface AuthenticatedChildOptions {
    Transport: new (...args: ConstructorParameters<typeof JsonRpcLineTransport>) => TransportPort;
    getTokens: TokenGetter;
    thread: Record<string, unknown>;
    signal: AbortSignal;
}
/** Keep refresh rotation in the plugin's existing serialized credential store. */
export declare function createSubagentTokens({ resolveAuth, store, refresh, signal }: TokenOptions): Promise<TokenGetter>;
/**
 * Authenticate the official DSH provider's private app-server connection.
 * DSH still owns framing, process containment, turns, tool approvals and disposal.
 * Only the documented external-auth handshake and thread policy are adapted.
 * No token is passed in argv, environment, logs or a second auth.json.
 */
export declare function authenticatedSubagentChild<T extends Pick<SubprocessHandle, 'stdin' | 'stdout' | 'done'>>(child: T, { Transport, getTokens, thread, signal }: AuthenticatedChildOptions): T;
export {};
