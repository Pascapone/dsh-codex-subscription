
import type { ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection';
import type { createCodexRpcHandler } from './login-coordinator.js';
import type { createQuotaForecastReader } from './quota-forecast.js';
import type { createCodexResetCreditService } from './reset-credits.js';
import type { createOfficialModelCatalog } from './model-catalog.js';
import type { OriginalImageStore } from './image-original-store.js';
import type { inheritedOriginalImageRef } from './image-original-contract.js';
import type { createRuntimeManagement } from './runtime-management.js';
import type { createCodexTranscriptionProvider } from './codex-transcription.js';
import type { SpeedMode } from './settings-types.js';
interface RpcHandlerOptions {
  authHandler: ReturnType<typeof createCodexRpcHandler>;
  usageReader: Pick<ReturnType<typeof createQuotaForecastReader>, 'read' | 'clearScope' | 'clear' | 'clearCache' | 'storage'>;
  resetCreditService: ReturnType<typeof createCodexResetCreditService>;
  preferences: { status(): Record<string, unknown>; update(patch: Record<string, unknown>): Promise<unknown>; setSpeed(sessionId: string, speedMode: SpeedMode): Promise<unknown> };
  runtimeManagement?: ReturnType<typeof createRuntimeManagement>;
  diagnosticsReader(): unknown | Promise<unknown>;
  modelCatalog?: Pick<ReturnType<typeof createOfficialModelCatalog>, 'refresh' | 'clear'>;
  originalImages?: Pick<OriginalImageStore, 'chunk'>;
  resolveInheritedOriginal?: (sessionId: string, assetId: string) => ReturnType<typeof inheritedOriginalImageRef>;
  closeConnections?: () => void;
  transcriptionEnabled?: () => boolean;
  onAccountChanged?: () => void;
  onCleanupFailure?: () => void;
  defaultModel?: ReturnType<typeof import('./default-model.js').createDefaultModelController>;
  transcribeAudio?: ReturnType<typeof createCodexTranscriptionProvider>;
}
import { MODEL_CONTROL_DEFAULTS, PREFERENCE_FIELDS } from './preference-fields.js'
import { decodeTranscriptionAudio } from './codex-transcription.js'
import { capabilityPatch } from './capability-settings.js'
import { ORIGINAL_IMAGE_CHUNK_BYTES, ORIGINAL_IMAGE_ID_PATTERN } from './image-original-contract.js'
import { AUTO_QUOTA_RETRY_FIELD, CUSTOM_CONTEXT_MODEL_CAPS, CUSTOM_CONTEXT_MODEL_FIELDS, CUSTOM_CONTEXT_WINDOW_FIELD, DISABLED_MODELS_FIELD, normalizeCustomContextWindow, normalizeDisabledModels } from './settings-contract.js'
const publicError = (code: string, message: string): ConnectionRpcResult<never> => ({
  ok: false,
  error: { code, message, details: { issues: [] } },
})

export function createSubscriptionRpcHandler({ authHandler, usageReader, resetCreditService, preferences, defaultModel, runtimeManagement, diagnosticsReader, modelCatalog, originalImages, resolveInheritedOriginal, closeConnections, onAccountChanged, onCleanupFailure, transcriptionEnabled, transcribeAudio }: RpcHandlerOptions) {
  return async (endpoint: string, input: unknown, signal: AbortSignal): Promise<ConnectionRpcResult<unknown>> => {
    const payload = input as Record<string, unknown> | null | undefined;
    if (endpoint === 'default-model/status' || endpoint === 'default-model/select') {
      try {
        signal.throwIfAborted()
        if (!defaultModel) return publicError('unavailable', 'The default model is unavailable')
        const value = endpoint === 'default-model/status'
          ? defaultModel.status()
          : await defaultModel.select({ model: payload?.model })
        return { ok: true, value }
      } catch (error) {
        if (signal.aborted) throw error
        if ((error as { code?: string } | undefined)?.code === 'invalid-model') return publicError('invalid-input', 'Invalid default model')
        if ((error as { code?: string } | undefined)?.code === 'unavailable') {
          return publicError('unavailable', endpoint === 'default-model/status'
            ? 'The default model is unavailable'
            : 'Could not save the default model')
        }
        return publicError('internal', endpoint === 'default-model/status'
          ? 'Could not read the default model'
          : 'Could not save the default model')
      }
    }
    if (endpoint === 'storage/status' || endpoint === 'storage/clear-forecast') {
      try {
        signal.throwIfAborted()
        if (endpoint === 'storage/clear-forecast') await usageReader.clear()
        return { ok: true, value: await usageReader.storage() }
      } catch (error) {
        if (signal.aborted) throw error
        return publicError('operation-error', 'Could not manage forecast cache')
      }
    }
    if (['runtime/status', 'runtime/install', 'runtime/remove', 'runtime/cancel'].includes(endpoint)) {
      try {
        signal.throwIfAborted()
        if (!runtimeManagement) return publicError('unavailable', 'Runtime management is unavailable')
        const action = endpoint.split('/')[1]!
        const value = action === 'status' ? await runtimeManagement.status() : action === 'cancel' ? await runtimeManagement.cancel() : await runtimeManagement.start(action)
        return { ok: true, value }
      } catch (error) {
        if (signal.aborted) throw error
        const code = ['busy', 'active-tasks', 'restart-required', 'unavailable'].includes((error as { message: string }).message) ? (error as { message: string }).message : 'operation-error'
        return publicError(code, code)
      }
    }
    if (endpoint === 'image/original/chunk') {
      try {
        signal.throwIfAborted()
        if (typeof payload?.sessionId !== 'string' || payload!.sessionId.length === 0 || payload!.sessionId.length > 512
          || typeof payload?.assetId !== 'string' || !ORIGINAL_IMAGE_ID_PATTERN.test(payload.assetId)
          || !Number.isSafeInteger(payload?.offset) || (payload!.offset as number) < 0 || (payload!.offset as number) % ORIGINAL_IMAGE_CHUNK_BYTES !== 0) {
          return publicError('invalid-input', 'Invalid original image request')
        }
        const inherited = resolveInheritedOriginal?.(payload!.sessionId as string, payload!.assetId as string)
        const chunk = await originalImages?.chunk(payload!.sessionId as string, payload!.assetId as string, payload!.offset as number, inherited)
        if (chunk === undefined) return publicError('not-found', 'Original image is unavailable')
        return { ok: true, value: chunk }
      } catch (error) {
        if (signal.aborted) throw error
        return publicError('internal', 'Could not read the original image')
      }
    }
    if (endpoint === 'diagnostics') {
      try {
        signal.throwIfAborted()
        return { ok: true, value: await diagnosticsReader() }
      } catch (error) {
        if (signal.aborted) throw error
        return publicError('internal', 'Could not create support diagnostics')
      }
    }
    if (endpoint === 'preferences/models') {
      try {
        signal.throwIfAborted()
        if (typeof modelCatalog?.refresh !== 'function' || typeof preferences?.status !== 'function') {
          return publicError('internal', 'Could not refresh Codex model catalog')
        }
        await modelCatalog.refresh({ signal })
        const value = preferences.status()
        return {
          ok: true,
          value: {
            availableModels: Array.isArray(value?.availableModels) ? value.availableModels : [],
            contextModels: Array.isArray(value?.contextModels) ? value.contextModels : [],
            verbosityModels: Array.isArray(value?.verbosityModels) ? value.verbosityModels : [],
            fastModels: Array.isArray(value?.fastModels) ? value.fastModels : [],
            ultrafastModels: Array.isArray(value?.ultrafastModels) ? value.ultrafastModels : [],
            catalogStatus: value?.catalogStatus,
          },
        }
      } catch (error) {
        if (signal.aborted) throw error
        return publicError('internal', 'Could not refresh Codex model catalog')
      }
    }
    if (endpoint === 'transcription/transcribe') {
      if (!transcriptionEnabled?.() || !transcribeAudio) return publicError('unavailable', 'Subscription transcription is disabled')
      let audio: ReturnType<typeof decodeTranscriptionAudio>
      try { audio = decodeTranscriptionAudio(payload) } catch { return publicError('invalid-input', 'Invalid audio recording') }
      try {
        signal.throwIfAborted()
        return { ok: true, value: await transcribeAudio(audio, signal) }
      } catch (error) {
        if (signal.aborted) throw error
        const message = (error as { message?: unknown } | null | undefined)?.message
        return publicError('transcription-failed', message === 'ChatGPT subscription is not signed in' || message === 'ChatGPT sign-in needs to be renewed'
          ? message : 'ChatGPT transcription failed. Try again.')
      }
    }
    if (endpoint === 'preferences/status' || endpoint === 'preferences/update') {
      try {
        signal.throwIfAborted()
        if (endpoint === 'preferences/update') {
          if (Object.hasOwn(payload ?? {}, 'sessionId')) {
            if (typeof payload?.sessionId !== 'string' || !payload.sessionId || payload.sessionId.length > 512 || typeof payload.speedMode !== 'string' || !['standard', 'fast', 'ultrafast'].includes(payload.speedMode) || Object.keys(payload).some(key => !['sessionId', 'speedMode'].includes(key))) return publicError('invalid-input', 'Invalid session speed preference');
            await preferences.setSpeed(payload.sessionId, payload.speedMode as SpeedMode);
            return { ok: true, value: preferences.status() };
          }
          const patch = capabilityPatch(payload) as Record<string, unknown>
          if (Object.hasOwn(payload ?? {}, DISABLED_MODELS_FIELD)) {
            const disabled = payload![DISABLED_MODELS_FIELD]
            if (!Array.isArray(disabled) || disabled.length > 100 || disabled.length !== normalizeDisabledModels(disabled).length) return publicError('invalid-input', 'Invalid disabled models preference')
            patch[DISABLED_MODELS_FIELD] = disabled
          }
          if (Object.hasOwn(payload ?? {}, AUTO_QUOTA_RETRY_FIELD)) {
            if (typeof payload![AUTO_QUOTA_RETRY_FIELD] !== 'boolean') return publicError('invalid-input', 'Invalid automatic quota retry preference')
            patch[AUTO_QUOTA_RETRY_FIELD] = payload![AUTO_QUOTA_RETRY_FIELD]
          }
          for (const field of Object.keys(MODEL_CONTROL_DEFAULTS)) {
            if (!Object.hasOwn(payload ?? {}, field)) continue
            if (typeof payload![field] !== 'boolean') return publicError('invalid-input', 'Invalid model control preference')
            patch[field] = payload![field]
          }
          if (Object.hasOwn(payload ?? {}, 'codexBasePrompt')) {
            if (typeof payload!.codexBasePrompt !== 'boolean') return publicError('invalid-input', 'Invalid Codex base prompt preference')
            patch.codexBasePrompt = payload!.codexBasePrompt
          }
          for (const [field, rule] of Object.entries(PREFERENCE_FIELDS)) {
            if (!Object.hasOwn(payload ?? {}, field)) continue
            if (!(rule.choices as readonly unknown[]).includes(payload![field])) return publicError('internal', rule.error)
            patch[field] = payload![field]
          }
          if (Object.hasOwn(payload ?? {}, CUSTOM_CONTEXT_WINDOW_FIELD)) {
            if (normalizeCustomContextWindow(payload![CUSTOM_CONTEXT_WINDOW_FIELD]) !== payload![CUSTOM_CONTEXT_WINDOW_FIELD]) {
              return publicError('internal', 'Invalid custom context window')
            }
            patch[CUSTOM_CONTEXT_WINDOW_FIELD] = payload![CUSTOM_CONTEXT_WINDOW_FIELD]
          }
          for (const [modelKey, field] of Object.entries(CUSTOM_CONTEXT_MODEL_FIELDS)) {
            if (!Object.hasOwn(payload ?? {}, field)) continue
            if (normalizeCustomContextWindow(payload![field], CUSTOM_CONTEXT_MODEL_CAPS[modelKey as keyof typeof CUSTOM_CONTEXT_MODEL_CAPS]) !== payload![field]) {
              return publicError('internal', 'Invalid custom model context window')
            }
            patch[field] = payload![field]
          }
          if (Object.keys(patch).length === 0) {
            return publicError('internal', 'Invalid preference update')
          }
          await preferences.update(patch)
        }
        return { ok: true, value: preferences.status() }
      } catch (error) {
        if (signal.aborted) throw error
        return publicError('internal', 'Could not update preferences')
      }
    }
    if (endpoint === 'usage') {
      try {
        signal.throwIfAborted()
        return { ok: true, value: await usageReader.read({ force: payload?.force === true, signal }) }
      } catch (error) {
        if (signal.aborted) throw error
        const known = new Set([
          'ChatGPT subscription is not signed in',
          'ChatGPT sign-in needs to be renewed',
        ])
        const message = error instanceof Error && known.has((error as { message: string }).message)
          ? (error as { message: string }).message
          : 'Could not read ChatGPT usage'
        return publicError('internal', message)
      }
    }
    if (endpoint === 'reset-credit/inspect' || endpoint === 'reset-credit/prepare' || endpoint === 'reset-credit/consume') {
      try {
        signal.throwIfAborted()
        const value = endpoint === 'reset-credit/inspect'
          ? await resetCreditService.inspect({ signal })
          : endpoint === 'reset-credit/prepare'
            ? await resetCreditService.prepare({ creditRef: payload?.creditRef, signal })
            : await resetCreditService.consume({
            challengeId: payload?.challengeId,
            acknowledged: payload?.acknowledged,
            signal,
            })
        return { ok: true, value }
      } catch (error) {
        if (signal.aborted) throw error
        const known = new Set([
          'ChatGPT subscription is not signed in',
          'ChatGPT sign-in needs to be renewed',
          'No quota reset is available',
          'No usable quota reset is available',
          'The available quota reset expires too soon',
          'This quota reset confirmation is no longer valid',
          'This quota reset is already in progress',
          'Wait before confirming this quota reset',
          'You must acknowledge that one quota reset will be consumed',
          'The signed-in ChatGPT account changed',
        ])
        const fallback = endpoint === 'reset-credit/inspect'
          ? 'Could not read quota reset details'
          : endpoint === 'reset-credit/prepare'
            ? 'Could not prepare a quota reset'
            : 'Could not use the quota reset'
        const message = error instanceof Error && known.has((error as { message: string }).message) ? (error as { message: string }).message : fallback
        return publicError('internal', message)
      }
    }
    const result = await authHandler(endpoint, payload, signal)
    if (result.ok === true && (endpoint === 'logout' || endpoint === 'account/select' || endpoint === 'account/remove'
      || (endpoint === 'login/status' && result.value?.authenticated === true))) {
      // The account transaction has committed. Auxiliary cache failures must not
      // misreport that transaction or prevent the remaining invalidations.
      const tasks: (() => unknown)[] = [() => closeConnections?.(), () => usageReader.clearCache(),
        () => resetCreditService.clear(), () => modelCatalog?.clear(), () => onAccountChanged?.()]
      if (endpoint === 'logout') tasks.push(() => usageReader.clear())
      if (endpoint === 'account/remove' && typeof payload?.id === 'string') tasks.push(() => usageReader.clearScope(payload.id))
      const outcomes = await Promise.allSettled(tasks.map(task => Promise.resolve().then(task)))
      if (outcomes.some(value => value.status === 'rejected')) {
        try { onCleanupFailure?.() } catch { /* Diagnostics must not change account results. */ }
      }
      if (endpoint !== 'logout') void Promise.resolve().then(() => modelCatalog?.refresh({ signal: undefined })).catch(() => {})
    } else if (result.ok === true && (endpoint === 'status' || result.value?.authenticated === true)) {
      void modelCatalog?.refresh({ signal: undefined }).catch(() => {})
    }
    return result
  }
}
