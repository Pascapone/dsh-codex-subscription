import type { AuthEvent, AuthInteraction, AuthOperationOptions, AuthPrompt, CredentialStore, Models, OAuthCredential } from '@earendil-works/pi-ai';
import type { CredentialKey, CredentialProvider, CredentialRef } from '@deepseek-ai/dsh-credentials';

export type SafeOAuthCredential = OAuthCredential & { email?: string };
export interface VaultPayload {
  version: 1;
  activeId: string;
  legacyAccountId?: string;
  accounts: { id: string; label: string; credential: SafeOAuthCredential }[];
}
export interface PublicAccount { id: string; label: string; active: boolean; expiresAt: number; email?: string }
export interface AccountStatus { authenticated: boolean; provider: 'openai-codex'; type?: 'oauth'; expiresAt?: number; accounts?: PublicAccount[] }
export type AccountStatusView = Pick<AccountStatus, 'authenticated'> & Partial<Omit<AccountStatus, 'authenticated'>>;
export type VaultCredentials = Pick<CredentialProvider, 'resolve' | 'set' | 'unset' | 'readRecord' | 'modifyRecord' | 'deleteRecord'>;
export interface VaultOptions { key: CredentialKey; legacyRef: CredentialRef; legacyRefs?: readonly CredentialRef[]; createId?: () => string; onLegacySyncFailure?: () => void }
type NativeCredentialMutation = Parameters<CredentialStore['modify']>[1];
export type CredentialMutation = (...args: Parameters<NativeCredentialMutation>) => ReturnType<NativeCredentialMutation> | Awaited<ReturnType<NativeCredentialMutation>>;
export type LoginMethod = 'browser' | 'device_code';
export type LoginPhase = 'starting' | 'waiting_input' | 'waiting_browser' | 'waiting_device' | 'authenticated' | 'failed' | 'cancelled';
// pi-ai 0.82's secret prompt remains supported alongside the audited 0.85 public prompt union.
export type CodexAuthPrompt = AuthPrompt | { type: 'secret'; message: string; placeholder?: string; signal?: AbortSignal };
export type CodexAuthInteraction = Omit<AuthInteraction, 'prompt'> & { prompt(prompt: CodexAuthPrompt): Promise<string> };
export interface LoginFlow {
  id: string;
  provider?: 'openai-codex';
  method: LoginMethod;
  phase: LoginPhase;
  authenticated: boolean;
  expiresAt?: number;
  prompt?: { type: CodexAuthPrompt['type']; message: string; placeholder?: string };
  authUrl?: string;
  instructions?: string;
  deviceCode?: Omit<Extract<AuthEvent, { type: 'device_code' }>, 'type'>;
  message?: string;
  error?: string;
  externalOpened?: boolean;
}
export interface Deferred<T> { promise: Promise<T>; resolve(value: T | PromiseLike<T>): void; reject(reason?: unknown): void }
export interface LoginSession { controller: AbortController; prompt?: Deferred<string>; ready: Deferred<LoginFlow>; view: LoginFlow; run?: Promise<void>; hostError?: unknown }
export interface AuthService {
  status(options?: AuthOperationOptions): Promise<AccountStatus>;
  login(interaction: CodexAuthInteraction, input?: { label?: string }): Promise<Awaited<ReturnType<Models['login']>> | void>;
  logout(options?: AuthOperationOptions): Promise<void>;
  select(id: unknown): Promise<AccountStatus>;
  remove(id: unknown): Promise<AccountStatus>;
}
