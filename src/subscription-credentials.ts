import type { AuthReaders } from './model-types.js';
// Refresh first, then take token and account ID from the same vault snapshot.
// A switch between the awaits must never combine two different accounts.
export async function readSubscriptionCredentials(getAuth: AuthReaders['getAuth'] | undefined, readCredential: AuthReaders['readCredential'] | undefined, signal?: AbortSignal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const auth = await getAuth?.({ signal })
    signal?.throwIfAborted()
    if (typeof auth?.auth?.apiKey !== 'string' || !auth.auth.apiKey) break
    const credential = await readCredential?.({ signal })
    signal?.throwIfAborted()
    if (credential?.type !== 'oauth') break
    if (credential.access === auth.auth.apiKey) return { access: credential.access, accountId: typeof credential.accountId === 'string' ? credential.accountId : undefined }
  }
  return { access: undefined, accountId: undefined }
}
