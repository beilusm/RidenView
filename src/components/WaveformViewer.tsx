import { useCallback, useMemo, useState } from 'react'
import { BarChart3, MousePointer2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MainChart } from '@/components/MainChart'
import { Overview } from '@/components/Overview'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  CHANNELS, computeStats, decimate, enabledUnits, fmtClock, fmtDateTime,
  fmtDuration, outputOffSpans, plotInsets, sliceRange,
  type Channel, type ChannelKey, type ChannelStats, type Range, type Sample,
} from '@/lib/waveform'

interface WaveformViewerProps {
  samples: Sample[]
}

const MAIN_BUCKETS = 1200
const OVERVIEW_BUCKETS = 300

function fmtCharge(ah: number): string {
  return Math.abs(ah) < 1 ? `${(ah * 1000).toFixed(1)} mAh` : `${ah.toFixed(3)} Ah`
}

function fmtEnergy(wh: number): string {
  return Math.abs(wh) < 1 ? `${(wh * 1000).toFixed(1)} mWh` : `${wh.toFixed(3)} Wh`
}

export function WaveformViewer({ samples }: WaveformViewerProps) {
  const t = useT()
  const [enabled, setEnabled] = useState<Set<ChannelKey>>(() => new Set(['voltage', 'current']))
  const [view, setView] = useState<Range | null>(null)
  const [hover, setHover] = useState<Sample | null>(null)
  const [showStats, setShowStats] = useState(true)

  const full = useMemo<Range>(() => {
    const lo = samples[0].ts
    const hi = samples[samples.length - 1].ts
    return hi > lo ? [lo, hi] : [lo - 500, lo + 500]
  }, [samples])
  const span = full[1] - full[0]
  const minSpan = Math.min(span, 200)

  const domain = view ?? full
  const mainData = useMemo(() => decimate(sliceRange(samples, view), MAIN_BUCKETS), [samples, view])
  const overviewData = useMemo(() => decimate(samples, OVERVIEW_BUCKETS), [samples])
  const offSpans = useMemo(() => outputOffSpans(samples), [samples])
  const stats = useMemo(() => computeStats(samples, view), [samples, view])

  const lastInView = mainData[mainData.length - 1] ?? null
  const readout = hover ?? lastInView
  const hasState = samples.some(s => s.outputEnable != null || s.protectionState != null || s.activeSlot != null)
  const unitCount = enabledUnits(enabled).length
  const insets = useMemo(() => plotInsets(unitCount), [unitCount])

  const applyView = useCallback((lo: number, hi: number) => {
    let w = Math.max(minSpan, hi - lo)
    if (w >= span) {
      setView(null)
      return
    }
    lo = Math.min(full[1] - w, Math.max(full[0], lo))
    w = Math.min(w, full[1] - lo)
    setView([lo, lo + w])
  }, [full, span, minSpan])

  const zoomAt = useCallback((factor: number, at: number) => {
    setView(prev => {
      const [lo, hi] = prev ?? full
      const w = Math.min(span, Math.max(minSpan, (hi - lo) * factor))
      if (w >= span) return null
      const frac = hi > lo ? (at - lo) / (hi - lo) : 0.5
      const nlo = Math.min(full[1] - w, Math.max(full[0], at - frac * w))
      return [nlo, nlo + w]
    })
  }, [full, span, minSpan])

  const pan = useCallback((delta: number) => {
    setView(prev => {
      if (!prev) return prev
      const w = prev[1] - prev[0]
      const lo = Math.min(full[1] - w, Math.max(full[0], prev[0] + delta))
      return [lo, lo + w]
    })
  }, [full])

  const select = useCallback((r: Range) => applyView(r[0], r[1]), [applyView])
  const navigate = useCallback((r: Range | null) => (r ? applyView(r[0], r[1]) : setView(null)), [applyView])
  const zoomCenter = (factor: number) => zoomAt(factor, (domain[0] + domain[1]) / 2)

  const toggle = (key: ChannelKey) => {
    setEnabled(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 lg:h-[calc(100dvh-3.5rem)]">
      <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {CHANNELS.map(ch => (
          <ChannelCard
            key={ch.key}
            channel={ch}
            value={readout?.[ch.key] ?? null}
            stats={stats.channels[ch.key]}
            extra={
              ch.key === 'current' ? fmtCharge(stats.charge)
                : ch.key === 'power' ? fmtEnergy(stats.energy)
                  : null
            }
            enabled={enabled.has(ch.key)}
            showStats={showStats}
            onToggle={() => toggle(ch.key)}
          />
        ))}
      </div>

      <section className="flex flex-col overflow-hidden rounded-xl border bg-card lg:min-h-[420px] lg:flex-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-mono tabular-nums text-muted-foreground">
              {fmtDateTime(domain[0])} <span className="opacity-50">→</span> {fmtClock(domain[1])}
            </span>
            <span className="tabular-nums">
              <span className="text-muted-foreground">{t.span} </span>
              {fmtDuration(domain[1] - domain[0])}
            </span>
            <span className="tabular-nums">
              <span className="text-muted-foreground">{t.samplesLabel} </span>
              {stats.count.toLocaleString()}
              {view && <span className="text-muted-foreground"> / {samples.length.toLocaleString()}</span>}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {hasState && readout && <StateChips sample={readout} />}
            <div className="flex items-center rounded-lg border p-0.5">
              <IconButton label={t.zoomIn} onClick={() => zoomCenter(0.5)} disabled={span <= minSpan || (view != null && view[1] - view[0] <= minSpan)}>
                <ZoomIn />
              </IconButton>
              <IconButton label={t.zoomOut} onClick={() => zoomCenter(2)} disabled={!view}>
                <ZoomOut />
              </IconButton>
              <IconButton label={t.resetZoom} onClick={() => setView(null)} disabled={!view}>
                <RotateCcw />
              </IconButton>
              <span className="mx-0.5 h-4 w-px bg-border" />
              <IconButton label={showStats ? t.hideStats : t.showStats} onClick={() => setShowStats(s => !s)} active={showStats}>
                <BarChart3 />
              </IconButton>
            </div>
          </div>
        </div>

        <div className="h-80 bg-plot px-1 pt-2 sm:h-96 lg:h-auto lg:min-h-0 lg:flex-1">
          <MainChart
            data={mainData}
            enabled={enabled}
            domain={domain}
            offSpans={offSpans}
            onHover={setHover}
            onSelect={select}
            onZoom={zoomAt}
            onPan={pan}
          />
        </div>

        <div className="border-t bg-muted/30 px-1 pt-1">
          <Overview data={overviewData} enabled={enabled} full={full} view={view} insets={insets} onChange={navigate} />
          <p className="flex items-center gap-1.5 px-2 pb-1.5 text-[10px] text-muted-foreground">
            <MousePointer2 className="size-3" />
            {t.hint}
          </p>
        </div>
      </section>
    </div>
  )
}

interface ChannelCardProps {
  channel: Channel
  value: number | null
  stats: ChannelStats
  extra: string | null
  enabled: boolean
  showStats: boolean
  onToggle: () => void
}

function ChannelCard({ channel, value, stats, extra, enabled, showStats, onToggle }: ChannelCardProps) {
  const t = useT()
  const fmt = (v: number) => v.toFixed(channel.digits)
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onToggle}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card px-3.5 py-3 text-left transition-all',
        'outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        enabled ? 'shadow-sm' : 'opacity-55 hover:opacity-80',
      )}
      style={enabled ? { borderColor: `color-mix(in oklab, ${channel.color} 45%, transparent)` } : undefined}
    >
      <span
        className="absolute inset-x-0 top-0 h-0.5 transition-opacity"
        style={{ backgroundColor: channel.color, opacity: enabled ? 1 : 0 }}
      />
      <div className="flex items-center gap-2">
        <span
          className="size-2.5 rounded-full border-2 transition-colors"
          style={{ borderColor: channel.color, backgroundColor: enabled ? channel.color : 'transparent' }}
        />
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">{channel.short}</span>
        <span className="ml-auto truncate text-[10px] text-muted-foreground/70">{t.channels[channel.key]}</span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1 font-mono tabular-nums">
        <span className="text-2xl font-semibold tracking-tight" style={{ color: enabled ? channel.color : undefined }}>
          {value == null ? '--' : fmt(value)}
        </span>
        <span className="text-sm text-muted-foreground">{channel.unit}</span>
        {extra && showStats && (
          <span className="ml-auto self-center whitespace-nowrap rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Σ {extra}</span>
        )}
      </div>

      {showStats && (
        <dl className="mt-2 grid grid-cols-3 gap-1 border-t pt-2 text-[10px]">
          {(['min', 'avg', 'max'] as const).map(k => (
            <div key={k} className="min-w-0">
              <dt className="uppercase tracking-wider text-muted-foreground/70">{t[k]}</dt>
              <dd className="truncate font-mono tabular-nums">{fmt(stats[k])}</dd>
            </div>
          ))}
        </dl>
      )}
    </button>
  )
}

function StateChips({ sample }: { sample: Sample }) {
  const t = useT()
  const prot = sample.protectionState
  const tripped = prot != null && prot !== 0
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-medium">
      {sample.outputEnable != null && (
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5',
            sample.outputEnable ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
          )}
        >
          {sample.outputEnable ? t.outOn : t.outOff}
        </span>
      )}
      {prot != null && (
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5',
            tripped ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground',
          )}
        >
          {t.protection[prot] ?? t.protectionOther(prot)}
        </span>
      )}
      {sample.activeSlot != null && (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">M{sample.activeSlot}</span>
      )}
    </div>
  )
}

interface IconButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}

function IconButton({ label, onClick, disabled, active, children }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            className={cn(active && 'bg-muted text-foreground')}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
