import type { Translate, PreferenceController, AccountStatusController } from './client-types.js';
import type { QuotaForecast } from './forecast-types.js';
export { CHANNEL, unwrap } from './rpc-contract.js'
import { useSyncExternalStore } from 'react'
export const NS = 'settings.codexSubscription'
export const SUPPORT_ISSUE_URL = 'https://github.com/Pascapone/dsh-codex-subscription/issues/new?template=install-problem.yml'
export const QUICK_QUOTA_REFRESH_EVENT = 'dsh-codex-subscription:refresh-quick-quota'
export const QUICK_QUOTA_REFRESH_MS = 60_000

export const accountStatusErrorText = (error: { code?: string } | undefined, t: Translate) => {
  const key = ({
    'credential-unavailable': 'accountCredentialUnavailable',
    'credential-malformed': 'accountCredentialMalformed',
    timeout: 'accountStatusTimeout',
    transport: 'accountStatusTransport',
    unknown: 'accountStatusUnknown',
  } as Readonly<Record<string, string>>)[error?.code!]
  return t(key ?? 'accountStatusUnknown')
}
export const fill = (text: string, values: Readonly<Record<string, unknown>>) => Object.entries(values).reduce((next, [key, value]) => next.replace(`{${key}}`, String(value)), text)
export const maskEmail = (value: unknown) => {
  if (typeof value !== 'string' || !value.includes('@')) return '••••'
  const [local, domain] = value.split('@', 2)
  if (local.length <= 2) return `${local.slice(0, 1)}••@${domain}`
  return `${local[0]}•••${local.at(-1)}@${domain}`
}
export const hours = (seconds: number) => Math.round((seconds / 3600) * 10) / 10
export const percent = (value: unknown) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })
export const isApproximateWindow = (seconds: number, expected: number) => seconds >= expected * 0.95 && seconds <= expected * 1.05
export const windowLabel = (seconds: number, t: Translate) => {
  if (isApproximateWindow(seconds, 18_000)) return t('windowFiveHours')
  if (isApproximateWindow(seconds, 86_400)) return t('windowDaily')
  if (isApproximateWindow(seconds, 604_800)) return t('windowWeekly')
  if (isApproximateWindow(seconds, 2_592_000)) return t('windowMonthly')
  if (isApproximateWindow(seconds, 31_536_000)) return t('windowAnnual')
  return seconds >= 86_400 && seconds % 86_400 === 0
    ? fill(t('windowDays'), { value: seconds / 86_400 })
    : fill(t('windowHours'), { value: hours(seconds) })
}
export const validDate = (value: unknown) => {
  const date = new Date(value as string | number)
  return Number.isFinite(date.getTime()) ? date : undefined
}
export const usePreferenceSnapshot = (preference: PreferenceController) => useSyncExternalStore(
  preference.subscribe,
  preference.getSnapshot,
)
export const useAccountStatusSnapshot = (accountStatus: AccountStatusController): ReturnType<AccountStatusController['getSnapshot']> => useSyncExternalStore(
  accountStatus.subscribe,
  accountStatus.getSnapshot,
)

export const notifyQuickQuota = () => window.dispatchEvent(new Event(QUICK_QUOTA_REFRESH_EVENT))

export const formatRunway = (seconds: number | undefined, t: Translate) => {
  if (!Number.isFinite(seconds) || seconds! <= 0) return undefined
  const minutes = Math.max(1, Math.round(seconds! / 60))
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  if (days > 0) return hours > 0 ? fill(t('runwayDaysHours'), { days, hours }) : fill(t('runwayDays'), { days })
  if (hours > 0) return fill(t('runwayHours'), { hours })
  return fill(t('runwayMinutes'), { minutes })
}

export const formatQuotaForecast = (forecast: QuotaForecast | { status: 'idle' } | null | undefined, t: Translate) => {
  if (forecast?.status === 'ready' && forecast.provisional) return `≈${formatRunway(forecast.runwaySeconds, t)}`
  if (forecast?.status === 'calibrating') return t(({ resolution: 'forecastResolution', 'changing-pace': 'forecastChanging', stale: 'forecastStale' } as Readonly<Record<string, string>>)[forecast.reason!] ?? 'quotaForecastCalibrating')
  if (forecast?.status === 'idle') return t('quotaForecastIdle')
  if (forecast?.status !== 'ready') return undefined
  if (forecast.survivesReset) return t('quotaForecastUntilReset')
  if (Number.isFinite(forecast.runwayMinSeconds) && Number.isFinite(forecast.runwayMaxSeconds)) {
    const min = formatRunway(forecast.runwayMinSeconds, t), max = formatRunway(forecast.runwayMaxSeconds, t)
    if (min && max && min !== max) return fill(t('quotaForecast'), { symbol: '≈', duration: `${min}–${max}` })
  }
  const duration = formatRunway(forecast.runwaySeconds, t)
  return duration === undefined ? undefined : fill(t('quotaForecast'), { symbol: '≈', duration })
}
