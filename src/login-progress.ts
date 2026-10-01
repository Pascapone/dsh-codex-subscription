import type { LoginFlow, AccountStatusView } from './auth-types.js';
/** Reconcile a login flow with the credential store without exposing credentials. */
export async function readLoginProgress({ flow, readFlow, readAccount }: { flow: Pick<LoginFlow, 'id' | 'method'>; readFlow(): Promise<LoginFlow>; readAccount(): Promise<AccountStatusView | undefined> }) {
  try {
    const nextFlow = await readFlow()
    if (nextFlow.phase === 'failed') {
      try {
        const account = await readAccount()
        if (account?.authenticated === true) {
          return {
            flow: {
              id: flow.id,
              method: flow.method,
              phase: 'authenticated' as const,
              authenticated: true,
            },
            account,
            recovered: true,
          }
        }
      } catch {
        // Keep the provider's terminal failure when account state is unavailable.
      }
    }
    if (nextFlow.phase !== 'authenticated') return { flow: nextFlow }
    return { flow: nextFlow, account: await readAccount() }
  } catch (flowError) {
    try {
      const account = await readAccount()
      if (account?.authenticated === true) {
        return {
          flow: {
            id: flow.id,
            method: flow.method,
            phase: 'authenticated' as const,
            authenticated: true,
          },
          account,
          recovered: true,
        }
      }
    } catch {
      // Preserve the original flow failure as the actionable diagnostic.
    }
    throw flowError
  }
}
