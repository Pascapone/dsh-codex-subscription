interface RawLimit { id?: unknown; name?: unknown; windows?: unknown[] }
interface DisplayableWindow { remainingPercent: number; windowSeconds: number; resetsAt?: unknown; forecast?: unknown }
const isDisplayableWindow = (input: unknown): input is DisplayableWindow => {
  const window = input as Partial<Record<keyof DisplayableWindow, unknown>> | null | undefined;
  return Number.isFinite(window?.remainingPercent)
  && (window!.remainingPercent as number) >= 0
  && (window!.remainingPercent as number) <= 100
  && Number.isFinite(window?.windowSeconds)
  && (window!.windowSeconds as number) > 0
}

const normalized = (value: unknown) => String(value ?? '').toLocaleLowerCase('en-US')
  .replaceAll(/[^a-z0-9]+/gu, '-')

const exactModelLimit = (limit: RawLimit | null | undefined, model: unknown) => {
  const id = normalized(model)
  return id.length > 0 && [limit?.id, limit?.name]
    .some(value => typeof value === 'string' && normalized(value) === id)
}

const limitMatchesModel = (limit: RawLimit | null | undefined, model: unknown, hasExactLimit: boolean) => {
  if (hasExactLimit) return exactModelLimit(limit, model)
  // Reserve is a separate route. Missing quota is unknown, not ordinary Codex quota.
  if (normalized(model) === 'gpt-reserve') return false
  if (/\bspark\b/u.test(normalized(model))) {
    return /\bspark\b/u.test(normalized(`${limit?.id ?? ''} ${limit?.name ?? ''}`))
  }
  return limit?.id === 'codex'
}

export function selectModelQuotaWindows(input: unknown, model: unknown) {
  const usage = input as { rateLimits?: (RawLimit | null | undefined)[] } | null | undefined;
  const hasExactLimit = Array.isArray(usage?.rateLimits)
    && usage.rateLimits.some(limit => exactModelLimit(limit, model))
  const windows = Array.isArray(usage?.rateLimits)
    ? usage.rateLimits
      .filter(limit => limitMatchesModel(limit, model, hasExactLimit) && Array.isArray(limit!.windows))
      .flatMap(limit => limit!.windows!)
      .filter(isDisplayableWindow)
    : []
  return windows.map(selected => ({
    remainingPercent: selected.remainingPercent,
    windowSeconds: selected.windowSeconds,
    ...(Number.isSafeInteger(selected.resetsAt) ? { resetsAt: selected.resetsAt as number } : {}),
    ...(selected.forecast === undefined ? {} : { forecast: selected.forecast }),
  })).sort((a, b) => a.windowSeconds - b.windowSeconds)
}

export function selectModelQuota(usage: unknown, model: unknown) {
  const windows = selectModelQuotaWindows(usage, model)
  if (windows.length === 0) return undefined
  const selected = windows.reduce((lowest, candidate) => (
    candidate.remainingPercent < lowest.remainingPercent ? candidate : lowest
  ))
  return {
    remainingPercent: selected.remainingPercent,
    windowSeconds: selected.windowSeconds,
    ...(Number.isSafeInteger(selected.resetsAt) ? { resetsAt: selected.resetsAt } : {}),
    ...(selected.forecast === undefined ? {} : { forecast: selected.forecast }),
  }
}
