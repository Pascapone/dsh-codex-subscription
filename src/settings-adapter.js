// Stable DSH owns a settings namespace; newer hosts persist volatile Config fields.
export function createSettingsAdapter(ctx, schema, config, namespace) {
  const entry = ctx.fiber?.entry
  const id = entry?.options?.id ?? entry?.id
  let settings
  if (typeof ctx.settings.register === 'function') settings = ctx.settings.register(namespace, schema)
  else {
    if (!id) throw new Error('DSH settings entry is unavailable')
    if (typeof ctx.settings.configure !== 'function' || typeof ctx.settings.update !== 'function') throw new Error('DSH settings API is unavailable')
    ctx.effect(() => ctx.settings.configure({ auto: false }))
    const get = () => Object.fromEntries(Object.entries(config).map(([key, value]) => [key, typeof value?.get === 'function' ? value.get() : value]))
    settings = {
      get,
      update: patch => ctx.settings.update(id, patch),
      watch(listener) { return ctx.on('loader/volatile-update', () => listener(get())) },
    }
  }
  let pending = Promise.resolve()
  return {
    get: () => settings.get(),
    update: patch => settings.update(patch),
    watch: listener => settings.watch(listener),
    setSessionSpeed(sessionId, speedMode) {
      if (id && typeof ctx.settings.mutate === 'function') {
        return ctx.settings.mutate(id, [{ op: 'set', path: ['sessionSpeedModes', sessionId], value: speedMode }])
      }
      // ponytail: older settings hosts lack path mutation; serialize whole-map writes until they are retired.
      const write = pending.then(() => settings.update({ sessionSpeedModes: { ...settings.get().sessionSpeedModes, [sessionId]: speedMode } }))
      pending = write.catch(() => {})
      return write
    },
  }
}
