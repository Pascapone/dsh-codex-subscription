import type { Context, Volatile } from '@deepseek-ai/cordis';
import type Schemastery from '@deepseek-ai/schemastery';
import type { SettingsForms } from '@deepseek-ai/dsh-settings';
import type {} from '@deepseek-ai/cordis-plugin-loader';
type SettingsValue = Record<string, unknown> & { sessionSpeedModes?: Readonly<Record<string, unknown>> };
interface LegacyNamespace { get(): SettingsValue; update(patch: Record<string, unknown>): Promise<unknown>; watch(listener: (value: SettingsValue) => void): () => void }
type SettingsPort = Partial<Pick<SettingsForms, 'configure' | 'update' | 'mutate'>> & { register?: <S, T>(namespace: string, schema: Schemastery<S, T>) => LegacyNamespace };
type AdapterContext = Pick<Context, 'effect' | 'on'> & { settings: SettingsPort; fiber?: { entry?: { options?: { id?: string }; id?: string } } };
// Stable DSH owns a settings namespace; newer hosts persist volatile Config fields.
export function createSettingsAdapter<S, T>(ctx: AdapterContext, schema: Schemastery<S, T>, config: Readonly<Record<string, unknown>>, namespace: string) {
  const entry = ctx.fiber?.entry
  const id = entry?.options?.id ?? entry?.id
  let settings: LegacyNamespace
  if (typeof ctx.settings.register === 'function') settings = ctx.settings.register(namespace, schema)
  else {
    if (!id) throw new Error('DSH settings entry is unavailable')
    if (typeof ctx.settings.configure !== 'function' || typeof ctx.settings.update !== 'function') throw new Error('DSH settings API is unavailable')
    ctx.effect(() => ctx.settings.configure!({ auto: false }))
    const get = () => Object.fromEntries(Object.entries(config).map(([key, value]) => [key, typeof (value as Partial<Pick<Volatile<unknown>, 'get'>> | null | undefined)?.get === 'function' ? (value as Pick<Volatile<unknown>, 'get'>).get() : value]))
    settings = {
      get: get as () => SettingsValue,
      update: (patch: Record<string, unknown>) => ctx.settings.update!(id, patch),
      watch(listener: (value: SettingsValue) => void) { return ctx.on('loader/volatile-update', () => listener(get() as SettingsValue)) },
    }
  }
  let pending: Promise<unknown> = Promise.resolve()
  return {
    get: () => settings.get(),
    update: (patch: Record<string, unknown>) => settings.update(patch),
    watch: (listener: (value: SettingsValue) => void) => settings.watch(listener),
    setSessionSpeed(sessionId: string, speedMode: unknown) {
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
