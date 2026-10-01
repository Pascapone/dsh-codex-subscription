import type { PluginManager, BundleInfo, PluginInstallRequestId, PluginInstallProgress } from '@deepseek-ai/dsh-plugin-manager';
type ManagementPort = Pick<PluginManager, 'listBundles' | 'installBundle' | 'removeBundle' | 'cancelInstall'>;
interface ManagementOptions { manager(): unknown; inspect(): { installed: boolean; present?: boolean }; active(): number; selectDsh(): Promise<unknown>; componentVersion?: () => string | undefined }
interface RuntimeManagementState { phase: 'idle' | 'installing' | 'removing' | 'applying' | 'cancelled' | 'done' | 'failed'; restartRequired: boolean; error?: string }
interface RuntimeOperation { action: string; requestId: PluginInstallRequestId; host: ManagementPort; done?: Promise<void> }
import { randomUUID } from 'node:crypto'
import { SUBAGENT_RUNTIME_PACKAGE, matchingSubagentRuntimeVersion } from './subagent-runtime.js'

// DSH owns package locking, installation, rollback and script approval. This
// adapter accepts no package names, commands or paths from the browser.
export function createRuntimeManagement({ manager, inspect, active, selectDsh, componentVersion = matchingSubagentRuntimeVersion }: ManagementOptions) {
  let operation: RuntimeOperation | undefined
  let state: RuntimeManagementState = { phase: 'idle', restartRequired: false }
  const supported = (value: unknown): value is ManagementPort => ['listBundles', 'installBundle', 'removeBundle', 'cancelInstall'].every(key => typeof (value as Partial<ManagementPort> | null | undefined)?.[key as keyof ManagementPort] === 'function')
  const status = async () => {
    const host = manager()
    let bundle: BundleInfo | undefined
    let available = supported(host)
    try { if (available) bundle = (await (host as ManagementPort).listBundles()).find(value => value.name === SUBAGENT_RUNTIME_PACKAGE) }
    catch { available = false }
    const runtime = inspect()
    const version = componentVersion()
    return { ...state, available, installable: available && version !== undefined, componentVersion: version, installed: runtime.installed, present: runtime.installed || runtime.present === true || bundle?.installed === true, removable: available && bundle?.installed === true && !bundle.readOnlyReason, active: active() }
  }
  const start = async (action: string) => {
    if (!['install', 'remove'].includes(action)) throw Error('invalid-action')
    if (operation) throw Error('busy')
    if (state.restartRequired) throw Error('restart-required')
    if (active() > 0) throw Error('active-tasks')
    const host = manager()
    if (!supported(host)) throw Error('unavailable')
    const version = componentVersion()
    if (action === 'install' && version === undefined) throw Error('unavailable')
    const requestId = randomUUID() as PluginInstallRequestId
    // Reserve synchronously before any await, including the removal checks.
    const current: RuntimeOperation = { action, requestId, host }
    operation = current
    state = { phase: action === 'install' ? 'installing' : 'removing', restartRequired: false }
    current.done = (async () => {
      try {
        if (action === 'remove') {
          const bundle = (await (host as ManagementPort).listBundles()).find(value => value.name === SUBAGENT_RUNTIME_PACKAGE)
          if (!bundle?.installed || bundle.readOnlyReason) throw Error('not-removable')
          await selectDsh()
        }
        const result = action === 'install'
          ? await host.installBundle(`${SUBAGENT_RUNTIME_PACKAGE}@${version}`, { enabled: false, requestId })
          : await host.removeBundle(SUBAGENT_RUNTIME_PACKAGE)
        if (result.application === 'cancelled') state = { phase: 'cancelled', restartRequired: false }
        else if (['applied', 'restart-required'].includes(result.application)) state = { phase: 'done', restartRequired: true }
        else state = { phase: 'failed', restartRequired: false, error: result.packageResult?.kind ?? result.error?.code ?? 'operation-error' }
      } catch (error) {
        state = { phase: 'failed', restartRequired: false, error: (error as { message?: unknown }).message === 'not-removable' ? 'not-removable' : 'operation-error' }
      } finally { operation = undefined }
    })()
    return status()
  }
  return {
    status, start,
    blocked: () => operation !== undefined || state.restartRequired,
    progress(value: Pick<PluginInstallProgress, 'requestId' | 'phase'>) {
      if (operation?.action === 'install' && value.requestId === operation.requestId && value.phase === 'applying') state.phase = 'applying'
    },
    async cancel() {
      const current = operation
      if (current?.action !== 'install') return status()
      const result = await current.host.cancelInstall(current.requestId)
      if (result.status === 'cancelled') await current.done
      return status()
    },
  }
}
