import type { Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client';
import type { ModelSelectInjected } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-chat/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-tool/client';
import type {} from '@deepseek-ai/dsh-client-ui-trajectory/client';
type ModelSelection = Parameters<ModelSelectInjected['select']>[0];
import type { PreferenceScope } from './preference-types.js';
import type { ComposerOpener } from './client-session-compat.js';
import type { ViewerAnnotation } from './subscription-image-viewer.js';
import type { ImageClientProps } from './image-client-types.js';
import type { ImageWorkspace as WorkspaceComponent } from './image-workspace.js';
import { createSketchSessionRegistry } from './sketch-session-state.js'
import { withComposerSession, openComposerSession, createSessionOpeners } from './client-session-compat.js'
import { ComposerImagePreviews, MessageImagePreviews, IMAGE_PREVIEWS_CSS } from './client-image-previews.js'
import { imageConversationNode } from './image-conversation-node.js'
import { CodexImageToolRow, CodexImageOutput } from './client-images.js'
import { SKETCH_CSS } from './sketch-workspace.js'
import { ImageWorkspace } from './image-workspace.js'
import { attachImageFiles, appendImagePrompt } from './image-composer.js'
import { createSketchTrigger, createImageTrigger } from './sketch-trigger.js'
import { zh, en } from './client-locales.js'
import { STYLE } from './client-styles.js'
import { createAnnotatedImageReference } from './image-edit-reference.js'
import { SubscriptionImageViewerOverlay } from './subscription-image-viewer-overlay.js'
import { SUBSCRIPTION_IMAGE_VIEWER_CSS } from './subscription-image-viewer-styles.js'
import { SubscriptionImageViewerService } from './subscription-image-viewer.js'
import { SETTINGS_NAMESPACE } from './settings-contract.js'
import { createPreferenceController } from './preference-controller.js'
import { createAccountStatusController } from './account-status-controller.js'
import { NS, CHANNEL, unwrap } from './client-shared.js'
import { createSubscriptionRpcClient } from './rpc-contract.js'
import { CodexComposerQuota } from './client-composer-quota.js'
import { CodexModelSelect } from './client-model-select.js'
import { CodexVoiceInput, CodexVoiceSidebarIndicator } from './client-voice.js'
import { createVoiceController } from './voice-controller.js'
import { CodexSection } from './client-section.js'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  // Plugin-owned namespace keeps the existing dynamic-key/fallback translation contract.
  interface LocaleNamespaceMap { 'settings.codexSubscription': string }
}

export const inject = [
  'slots', 'locale', 'connection', 'remote', 'modelDirectories', 'conversation', 'uiConversation', 'sessions',
]

export function apply(ctx: Context) {
  const imageViewer = new SubscriptionImageViewerService()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'codex-subscription: copy')
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-codex-subscription'
    tag.textContent = STYLE + SUBSCRIPTION_IMAGE_VIEWER_CSS + SKETCH_CSS + IMAGE_PREVIEWS_CSS
    document.head.append(tag)
    return () => tag.remove()
  }, 'codex-subscription: style')
  const rpc = createSubscriptionRpcClient(ctx.get('connection').rpc)
  // Historical settingsScope is optional; current SDKs use the existing RPC fallback.
  const scope = (ctx.get('settingsScope') as { bind(query: { namespace: string }): PreferenceScope } | undefined)?.bind({ namespace: SETTINGS_NAMESPACE }) ?? {
    getSnapshot: () => ({ status: 'unavailable' as const }),
    subscribe: () => () => {},
  }
  const preference = createPreferenceController(scope, rpc)
  ctx.effect(() => {
    let previous = JSON.stringify(preference.getSnapshot(), (key,value) => key.startsWith('image') || key === '' ? value : undefined)
    return preference.subscribe(() => {
      const next = JSON.stringify(preference.getSnapshot(), (key,value) => key.startsWith('image') || key === '' ? value : undefined)
      if (next !== previous) imageViewer.close()
      previous = next
    })
  }, 'codex-subscription: image controls')
  const accountStatus = createAccountStatusController(rpc)
  ctx.effect(() => {
    void preference.load()
    void accountStatus.load()
    const disposeReset = ctx.on('connection/reset', () => { void preference.load(); void preference.refreshModels(); void accountStatus.reload() })
    return () => {
      disposeReset?.()
      preference.dispose()
      accountStatus.dispose()
    }
  }, 'codex-subscription: preferences and account status')
  const t = ctx.locale.bind(NS)
  const voice = createVoiceController(ctx.get('sessions')!, rpc, t, ctx.get('conversation')!)
  ctx.effect(() => {
    const unsubscribe = preference.subscribe(() => { if (!preference.getSnapshot().transcriptionEnabled) voice.cancel() })
    return () => { unsubscribe(); voice.dispose() }
  }, 'codex-subscription: voice recording')
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'codex-subscription-image-viewer', order: 20,
    inject: () => ({ service: imageViewer, t }),
  }, SubscriptionImageViewerOverlay))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'codex-subscription', order: 15,
    label: () => t('nav'), locale: NS, inject: () => ({ preference, rpc: rpc, accountStatus, t }),
  }, CodexSection))
  ctx.slots.inject('conversation.input.activity', () => ctx.slots.register({
    name: 'conversation.input.activity', priority: 10, locale: NS, inject: () => ({ preference, voice, t }),
  }, CodexVoiceInput))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'codex-voice-recording', order: 21,
    locale: NS, inject: () => ({ voice, t }),
  }, CodexVoiceSidebarIndicator))
  const sessions = ctx.get('sessions')!
  const installDirectorySlots = (scope: Context) => {
    const modelDirectories = scope.get('modelDirectories')!
    scope.slots.inject('conversation.input.right', () => scope.slots.register({
      name: 'conversation.input.right', id: 'codex-subscription-quota', order: 15,
      locale: NS,
      inject: sessionId => ({
        preference,
        rpc: rpc,
        t,
        directory: modelDirectories.directoryFor(sessionId).store,
      }),
    }, CodexComposerQuota))
    scope.slots.inject('conversation.input.model', () => scope.slots.register({
      name: 'conversation.input.model', priority: -10, locale: NS,
      inject: sessionId => {
        const directory = modelDirectories.directoryFor(sessionId)
        const available = sessions.subagentAddress(sessionId) === undefined
        return {
          available,
          directory: directory.store,
          load: () => { if (available) void directory.load() },
          select: (selection: ModelSelection) => available ? directory.select(selection).then(() => true, () => false) : Promise.resolve(false),
          preference,
          sessionId,
        }
      },
    }, CodexModelSelect))
  }
  if (ctx.get('remote.session') === undefined) installDirectorySlots(ctx)
  else ctx.inject(['remote.session'], installDirectorySlots)
  const conversation = ctx.get('conversation')! as Context['conversation'] & Parameters<typeof attachImageFiles>[0]
  const uiConversation = ctx.get('uiConversation')!
  const sketchOpeners = createSessionOpeners()
  const sketchSessions = createSketchSessionRegistry()
  const lifetime = new AbortController()
  ctx.effect(() => () => { lifetime.abort(); imageViewer.close(); sketchOpeners.clear(); sketchSessions.dispose() }, 'codex-subscription: sketch sessions')
  ctx.inject(['inputTriggers'], triggerContext => triggerContext.effect(() => triggerContext.get('inputTriggers')!.registerSource(createSketchTrigger({
    enabled: () => { const value = preference.getSnapshot(); return value.imageSketchAgent && value.imageSketch && value.imageEditing },
    consume: (sessionId, span) => {
      const actx = sessions.scope(sessionId)
      return sketchOpeners.has(sessionId) && actx?.bail(actx, 'slash/input-insert-text', { text: '@sketch ', span }) === true
    },
  })), 'codex-subscription: Sketch trigger'))
  ctx.inject(['inputTriggers'], triggerContext => triggerContext.effect(() => triggerContext.get('inputTriggers')!.registerSource(createImageTrigger({
    enabled: () => { const value = preference.getSnapshot(); return value.imageShortcut && (value.imageGeneration || value.imageEditing) },
    open: () => {},
    consume: (sessionId, span) => {
      const actx = sessions.scope(sessionId)
      return sketchOpeners.has(sessionId) && actx?.bail(actx, 'slash/input-insert-text', { text: t('imageInlinePrompt'), span }) === true
    },
  })), 'codex-subscription: Image trigger'))
  const sessionInput = (sessionId: SessionId) => {
    const actx = sessions.scope(sessionId)
    if (!actx || !conversation.input?.for) throw new Error('Image composer is unavailable')
    return conversation.input.for(actx)
  }
  const openSketchImage = (sessionId: SessionId) => async (src: string, name: string) => {
    const settings = preference.getSnapshot(), open = sketchOpeners.get(sessionId)
    if (!settings.imageSketch || !settings.imageEditing || !open) throw Error('Sketch unavailable')
    const response = await fetch(src, { signal: lifetime.signal })
    if (!response.ok) throw Error('Image unavailable')
    const blob = await response.blob()
    if (blob.size > 20 * 1024 * 1024) throw Error('Image too large')
    lifetime.signal.throwIfAborted()
    const liveOpen = sketchOpeners.get(sessionId)
    if (!liveOpen || !preference.getSnapshot().imageSketch || !preference.getSnapshot().imageEditing) throw Error('Sketch unavailable')
    imageViewer.close()
    liveOpen('sketch', document.activeElement, new File([blob], name || 'image.png', {type:blob.type || 'image/png'}))
  }
  const attachForEdit = (sessionId: SessionId) => async (src: string, filename: string, draft: string, annotations: readonly ViewerAnnotation[] = [], referenceName?: string, sourceInDraft = false) => {
    if (!preference.getSnapshot().imageEditing) throw new Error('Image editing is disabled')
    return withComposerSession(sessions, sessionId, async actx => {
      if (conversation.input?.for === undefined) {
        throw new Error('This DSH version does not provide the image composer bridge')
      }
      const response = await fetch(src, { signal: lifetime.signal })
      if (!response.ok) throw new Error('Could not read generated image')
      const blob = await response.blob()
      const files = sourceInDraft ? [] : [new File([blob], filename, { type: blob.type || 'image/png' })]
      if (annotations.length > 0) {
        const reference = await createAnnotatedImageReference(blob, annotations)
        files.push(new File([reference], referenceName!, { type: 'image/png' }))
      }
      lifetime.signal.throwIfAborted()
      const input = conversation.input.for(actx)
      if (!preference.getSnapshot().imageEditing) throw new Error('Image editing is disabled')
      if (files.length) attachImageFiles(conversation, input, files, sessionId)
      openComposerSession(sessions, ctx.get('uiWorkspace'), sessionId)
      // Preserve text typed while the asynchronous image preparation ran.
      if (sourceInDraft && !annotations.length) return
      if (!input.state.getSnapshot().draft.trim()) input.setDraft(draft)
      else if (annotations.length) {
        if (!input.state.getSnapshot().occurrences?.length) appendImagePrompt(input, draft)
        else input.notify('info', draft)
      }
    })
  }
  const nativeAttachments = () => ctx.slots.entries('conversation.input.attachments').find(entry =>
    entry.component !== ComposerImagePreviews && entry.locale === 'conversation' &&
    !entry.inject && !entry.store && !entry.children)
  const watchNativeAttachments = (callback: () => void) => ctx.slots.subscribe('conversation.input.attachments',callback)
  const nativeTranslate = ctx.locale.bind('conversation')
  // Use the host's attachment presentation slots; restore its own renderer when
  // enhancement is off. Intake, validation and draft ownership stay with DSH.
  for (const [name, component] of [
    ['conversation.input.attachments', ComposerImagePreviews],
    ['conversation.message.images', MessageImagePreviews],
    ['conversation.trajectory.images', MessageImagePreviews],
  ] as const) ctx.slots.inject(name, () => {
    let dispose: (() => void) | undefined
    const sync = () => {
      if (preference.getSnapshot().imageViewer) {
        // Heterogeneous tuple: retain the native session registration signature, without changing its slot or renderer.
        dispose ??= ctx.slots.register({ name: name as 'conversation.message.images', priority: -10,
          inject: (sessionId: SessionId) => ({ preference, t, nativeAttachments, watchNativeAttachments, nativeTranslate, service: imageViewer, openSketchImage: openSketchImage(sessionId), attachForEdit: attachForEdit(sessionId) }),
        }, component as typeof MessageImagePreviews)
      } else { dispose?.(); dispose = undefined }
    }
    sync()
    const unwatch = preference.subscribe(sync)
    return () => { unwatch(); dispose?.() }
  })
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left', id: 'codex-image-workspace', order: 30,
    inject: sessionId => ({
      preference, t, sessionId, rpc, sessionState: sketchSessions.get(sessionId),
      registerOpen: (callback: ComposerOpener) => sketchOpeners.register(sessionId, callback),
      attachSketch: (blob: Blob) => {
        const current = preference.getSnapshot()
        if (!current.imageSketch || !current.imageEditing) throw new Error('Sketch editing is disabled')
        attachImageFiles(conversation, sessionInput(sessionId), [new File([blob], 'sketch-reference.png', { type: 'image/png' })], sessionId)
      },
    }),
  }, ImageWorkspace))
  const imageProps = (sessionId: SessionId): ImageClientProps => ({
      sessionId,
      rpc: rpc,
      t,
      preference,
      loadImage: attachment => uiConversation.imageUrl(sessionId, attachment),
      getImageViewer: () => {
        try {
          return ctx.get('nativeImageViewer')
        } catch {
          return undefined
        }
      },
      getInternalImageViewer: () => imageViewer,
      openSketchImage: openSketchImage(sessionId),
      attachForEdit: attachForEdit(sessionId),
  })
  ctx.effect(() => uiConversation.events.register(imageConversationNode), 'codex-subscription: image results in chat')
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node', key: 'codex-image-output', inject: imageProps,
  }, CodexImageOutput))
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview', key: 'codex_image_generate', locale: NS,
    inject: imageProps,
  }, CodexImageToolRow))
}
