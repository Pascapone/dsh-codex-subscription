import type { ForecastState, ForecastRecord } from './forecast-types.js';
import type { QuotaSample } from './quota-rate-interval.js';
import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'

const DEFAULT_MAX_BYTES = 256 * 1024
const MAX_WINDOWS = 128
const MAX_SAMPLES = 192

function sanitize(input: unknown): ForecastState | undefined {
  const value = input as { windows?: unknown } | null;
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || value.windows === null || typeof value.windows !== 'object' || Array.isArray(value.windows)) return undefined
  const entries = Object.entries(value.windows as Record<string, unknown>)
  if (entries.length > MAX_WINDOWS) return undefined
  const windows: ForecastState['windows'] = {}
  for (const [key, raw] of entries) {
    const record = raw as Partial<Record<keyof ForecastRecord, unknown>> | null;
    if (key.length === 0 || key.length > 320 || record === null || typeof record !== 'object'
      || !Array.isArray(record.samples) || record.samples.length > MAX_SAMPLES) return undefined
    const resetsAt = record.resetsAt === null ? null : Number(record.resetsAt)
    if (resetsAt !== null && !Number.isFinite(resetsAt)) return undefined
    const samples: QuotaSample[] = []
    for (const raw of record.samples as unknown[]) {
      const sample = raw as { at?: unknown; remainingPercent?: unknown } | null | undefined;
      const at = Number(sample?.at)
      const remainingPercent = Number(sample?.remainingPercent)
      if (!Number.isFinite(at) || !Number.isFinite(remainingPercent)
        || remainingPercent < 0 || remainingPercent > 100) return undefined
      samples.push({ at, remainingPercent })
    }
    windows[key] = { resetsAt, samples }
  }
  return { windows }
}

export class QuotaForecastStateStore {
  declare filename: string;
  declare maxBytes: number;
  constructor({ filename, maxBytes = DEFAULT_MAX_BYTES }: { filename: string; maxBytes?: number }) {
    this.filename = filename
    this.maxBytes = maxBytes
  }

  async load() {
    try {
      if ((await stat(this.filename)).size > this.maxBytes) return undefined
      return sanitize(JSON.parse(await readFile(this.filename, 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException | null | undefined)?.code === 'ENOENT' || error instanceof SyntaxError) return undefined
      throw error
    }
  }

  async save(state: unknown) {
    const safe = sanitize(state)
    if (safe === undefined) throw new Error('Refusing to persist malformed quota forecast state')
    const data = `${JSON.stringify(safe)}\n`
    if (Buffer.byteLength(data) > this.maxBytes) throw new Error('Quota forecast state is too large')
    await mkdir(dirname(this.filename), { recursive: true, mode: 0o700 })
    const temporary = `${this.filename}.${process.pid}.${randomUUID()}.tmp`
    let handle: Awaited<ReturnType<typeof open>> | undefined
    try {
      handle = await open(temporary, 'wx', 0o600)
      await handle.writeFile(data)
      await handle.sync()
      await handle.close()
      handle = undefined
      await rename(temporary, this.filename)
    } finally {
      await handle?.close().catch(() => undefined)
      await rm(temporary, { force: true }).catch(() => undefined)
    }
  }

  async clear() {
    await rm(this.filename, { force: true })
  }
}
