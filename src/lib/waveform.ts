export type ChannelKey = 'voltage' | 'current' | 'power' | 'inputVoltage' | 'temperature'

export interface Channel {
  key: ChannelKey
  short: string
  unit: string
  color: string
  digits: number
}

export const CHANNELS: Channel[] = [
  { key: 'voltage', short: 'V OUT', unit: 'V', color: '#38bdf8', digits: 2 },
  { key: 'current', short: 'I OUT', unit: 'A', color: '#f59e0b', digits: 3 },
  { key: 'power', short: 'P OUT', unit: 'W', color: '#f43f5e', digits: 2 },
  { key: 'inputVoltage', short: 'V IN', unit: 'V', color: '#a78bfa', digits: 2 },
  { key: 'temperature', short: 'TEMP', unit: '°C', color: '#10b981', digits: 1 },
]

export interface Sample {
  ts: number
  voltage: number
  current: number
  power: number
  inputVoltage: number
  temperature: number
  outputEnable: boolean | null
  protectionState: number | null
  activeSlot: number | null
}

export interface Dataset {
  name: string
  size: number | null
  samples: Sample[]
}

export type Range = [number, number]

function num(s: string | undefined): number {
  const v = parseFloat(s ?? '')
  return Number.isFinite(v) ? v : 0
}

function optInt(s: string | undefined): number | null {
  const v = parseInt(s ?? '', 10)
  return Number.isFinite(v) ? v : null
}

function optBool(s: string | undefined): boolean | null {
  const v = s?.trim().toLowerCase()
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  return null
}

/**
 * Converts parsed CSV rows into samples sorted by time. Rows without a valid
 * `time` are dropped. When timestamps only have whole-second resolution, rows
 * sharing the same second are spread evenly across that second so the chart
 * doesn't draw vertical steps.
 */
export function toSamples(rows: Record<string, string>[]): Sample[] {
  const out: Sample[] = []
  for (const row of rows) {
    const ts = new Date(row.time).getTime()
    if (Number.isNaN(ts)) continue
    out.push({
      ts,
      voltage: num(row.voltage),
      current: num(row.current),
      power: num(row.power),
      inputVoltage: num(row.inputVoltage),
      temperature: num(row.temperature),
      outputEnable: optBool(row.outputEnable),
      protectionState: optInt(row.protectionState),
      activeSlot: optInt(row.activeSlot),
    })
  }
  out.sort((a, b) => a.ts - b.ts)

  if (out.every(s => s.ts % 1000 === 0)) {
    let i = 0
    while (i < out.length) {
      let j = i
      while (j < out.length && out[j].ts === out[i].ts) j++
      const n = j - i
      for (let k = 1; k < n; k++) out[i + k].ts += Math.round((k * 1000) / n)
      i = j
    }
  }
  return out
}

/** Index of the first sample with ts >= t. */
export function lowerBound(samples: Sample[], t: number): number {
  let lo = 0
  let hi = samples.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid].ts < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function sliceRange(samples: Sample[], range: Range | null): Sample[] {
  if (!range) return samples
  // Keep one sample on each side so lines run to the edges of the plot.
  const lo = Math.max(0, lowerBound(samples, range[0]) - 1)
  const hi = Math.min(samples.length, lowerBound(samples, range[1]) + 1)
  return samples.slice(lo, hi)
}

export function nearest(samples: Sample[], t: number): Sample | null {
  if (samples.length === 0) return null
  const i = lowerBound(samples, t)
  if (i === 0) return samples[0]
  if (i >= samples.length) return samples[samples.length - 1]
  return t - samples[i - 1].ts <= samples[i].ts - t ? samples[i - 1] : samples[i]
}

export interface ChannelStats {
  min: number
  max: number
  avg: number
}

export interface WindowStats {
  count: number
  channels: Record<ChannelKey, ChannelStats>
  /** Integrated charge in Ah. */
  charge: number
  /** Integrated energy in Wh. */
  energy: number
}

export function computeStats(samples: Sample[], range: Range | null): WindowStats {
  const lo = range ? lowerBound(samples, range[0]) : 0
  const hi = range ? lowerBound(samples, range[1] + 1e-6) : samples.length
  const channels = {} as Record<ChannelKey, ChannelStats>
  for (const ch of CHANNELS) {
    let min = Infinity
    let max = -Infinity
    let sum = 0
    for (let i = lo; i < hi; i++) {
      const v = samples[i][ch.key]
      if (v < min) min = v
      if (v > max) max = v
      sum += v
    }
    const n = hi - lo
    channels[ch.key] = n > 0 ? { min, max, avg: sum / n } : { min: 0, max: 0, avg: 0 }
  }

  let charge = 0
  let energy = 0
  for (let i = lo + 1; i < hi; i++) {
    const a = samples[i - 1]
    const b = samples[i]
    const dtH = (b.ts - a.ts) / 3_600_000
    charge += ((a.current + b.current) / 2) * dtH
    energy += ((a.power + b.power) / 2) * dtH
  }
  return { count: Math.max(0, hi - lo), channels, charge, energy }
}

/**
 * Min/max decimation: splits samples into buckets and keeps, for every
 * channel, the extreme points of each bucket. Peaks survive at any zoom level.
 */
export function decimate(samples: Sample[], buckets: number): Sample[] {
  const n = samples.length
  if (n <= buckets * 2) return samples
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1
  const size = n / buckets
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * size)
    const end = Math.min(n, Math.floor((b + 1) * size))
    for (const ch of CHANNELS) {
      let mi = start
      let ma = start
      for (let i = start + 1; i < end; i++) {
        const v = samples[i][ch.key]
        if (v < samples[mi][ch.key]) mi = i
        if (v > samples[ma][ch.key]) ma = i
      }
      keep[mi] = 1
      keep[ma] = 1
    }
  }
  return samples.filter((_, i) => keep[i])
}

/** Time spans where the output was reported as disabled. */
export function outputOffSpans(samples: Sample[]): Range[] {
  const spans: Range[] = []
  let start: number | null = null
  for (let i = 0; i < samples.length; i++) {
    const off = samples[i].outputEnable === false
    if (off && start == null) start = samples[i].ts
    if (!off && start != null) {
      spans.push([start, samples[i].ts])
      start = null
    }
  }
  if (start != null) spans.push([start, samples[samples.length - 1].ts])
  return spans
}

function niceStep(raw: number): number {
  const exp = Math.floor(Math.log10(raw))
  const base = raw / 10 ** exp
  const nice = base <= 1 ? 1 : base <= 2 ? 2 : base <= 2.5 ? 2.5 : base <= 5 ? 5 : 10
  return nice * 10 ** exp
}

function niceScale(min: number, max: number): { lo: number; hi: number; step: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { lo: 0, hi: 1, step: 0.25 }
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1
    min -= pad
    max += pad
  }
  const pad = (max - min) * 0.06
  const step = niceStep((max - min + pad * 2) / 4)
  let lo = Math.floor((min - pad) / step) * step
  const hi = Math.ceil((max + pad) / step) * step
  if (min >= 0 && lo < 0) lo = 0
  return { lo, hi, step }
}

/** Y-axis domain with a little headroom, snapped to round numbers. */
export function niceDomain(min: number, max: number): Range {
  const { lo, hi } = niceScale(min, max)
  return [lo, hi]
}

/** Evenly spaced round-number ticks spanning `niceDomain(min, max)`. */
export function niceTicks(min: number, max: number): number[] {
  const { lo, hi, step } = niceScale(min, max)
  const ticks: number[] = []
  for (let i = 0; lo + i * step <= hi + step * 1e-6; i++) ticks.push(Number((lo + i * step).toPrecision(12)))
  return ticks
}

const TIME_STEPS = [
  10, 20, 50, 100, 200, 500,
  1_000, 2_000, 5_000, 10_000, 15_000, 30_000,
  60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000,
  3_600_000, 7_200_000, 10_800_000, 21_600_000, 43_200_000, 86_400_000,
]

export function timeTicks(range: Range, target = 8): { ticks: number[]; step: number } {
  const [min, max] = range
  if (max <= min) return { ticks: [min], step: 1000 }
  const span = max - min
  const step = TIME_STEPS.find(s => span / s <= target) ?? TIME_STEPS[TIME_STEPS.length - 1]
  // Align to local wall-clock time rather than UTC.
  const offset = new Date(min).getTimezoneOffset() * 60_000
  const ticks: number[] = []
  for (let t = Math.ceil((min - offset) / step) * step + offset; t <= max; t += step) ticks.push(t)
  return { ticks, step }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export function fmtClock(ts: number, withMs = false): string {
  const d = new Date(ts)
  const base = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  return withMs ? `${base}.${String(d.getMilliseconds()).padStart(3, '0')}` : base
}

export function fmtTick(ts: number, step: number): string {
  if (step < 1000) return fmtClock(ts, true).slice(0, step < 100 ? 12 : 10)
  if (step >= 86_400_000) {
    const d = new Date(ts)
    return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  }
  return step >= 60_000 ? fmtClock(ts).slice(0, 5) : fmtClock(ts)
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${fmtClock(ts)}`
}

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  const s = Math.round(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${pad2(m)}m ${pad2(sec)}s`
  if (m > 0) return `${m}m ${pad2(sec)}s`
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}


/** Distinct units of the enabled channels, in channel order. Each unit gets its own Y axis. */
export function enabledUnits(enabled: Set<ChannelKey>): string[] {
  return [...new Set(CHANNELS.filter(ch => enabled.has(ch.key)).map(ch => ch.unit))]
}

export const AXIS_WIDTH = 44
export const PLOT_MARGIN = 8

/** Horizontal insets of the main chart's plot area, so other elements can line up with it. */
export function plotInsets(unitCount: number): { left: number; right: number } {
  return {
    left: PLOT_MARGIN + (unitCount >= 1 ? AXIS_WIDTH : 0),
    right: PLOT_MARGIN + (unitCount >= 2 ? AXIS_WIDTH : 0),
  }
}
