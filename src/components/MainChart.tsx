import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type MouseHandlerDataParam,
} from 'recharts'
import {
  AXIS_WIDTH, CHANNELS, PLOT_MARGIN, enabledUnits, fmtClock, fmtTick, niceTicks, timeTicks,
  type ChannelKey, type Range, type Sample,
} from '@/lib/waveform'
import { useT } from '@/lib/i18n'

interface MainChartProps {
  data: Sample[]
  enabled: Set<ChannelKey>
  domain: Range
  offSpans: Range[]
  onHover: (sample: Sample | null) => void
  onSelect: (range: Range) => void
  /** factor < 1 zooms in, > 1 zooms out, anchored at timestamp `at`. */
  onZoom: (factor: number, at: number) => void
  onPan: (deltaMs: number) => void
}

interface AxisGroup {
  id: string
  unit: string
  color: string
  domain: Range
  ticks: number[]
  side: 'left' | 'right' | 'hidden'
}

function fmtAxis(v: number): string {
  return String(Number(v.toPrecision(4)))
}

export const MainChart = memo(function MainChart({
  data, enabled, domain, offSpans, onHover, onSelect, onZoom, onPan,
}: MainChartProps) {
  const t = useT()
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragEnd, setDragEnd] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef({ domain, onZoom, onPan })
  plotRef.current = { domain, onZoom, onPan }

  const axes = useMemo<AxisGroup[]>(() => {
    const units = enabledUnits(enabled)
    return units.map((unit, i) => {
      const channels = CHANNELS.filter(ch => ch.unit === unit && enabled.has(ch.key))
      let min = Infinity
      let max = -Infinity
      for (const s of data) {
        for (const ch of channels) {
          const v = s[ch.key]
          if (v < min) min = v
          if (v > max) max = v
        }
      }
      const ticks = niceTicks(min, max)
      return {
        id: unit,
        unit,
        color: channels.length === 1 ? channels[0].color : 'var(--muted-foreground)',
        domain: [ticks[0], ticks[ticks.length - 1]] as Range,
        ticks,
        side: i === 0 ? 'left' : i === 1 ? 'right' : 'hidden',
      }
    })
  }, [data, enabled])

  const { ticks, step } = useMemo(() => timeTicks(domain), [domain])
  const hasAxes = axes.length > 0

  // Native listener: React's onWheel is passive, so it can't stop the page from scrolling.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || !hasAxes) return
    const handler = (e: WheelEvent) => {
      const plot = el.querySelector('.recharts-cartesian-grid')?.getBoundingClientRect()
      if (!plot || plot.width === 0) return
      e.preventDefault()
      const { domain: [lo, hi], onZoom: zoom, onPan: pan } = plotRef.current
      const scale = e.deltaMode === 1 ? 16 : 1
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        const d = (e.shiftKey ? e.deltaY : e.deltaX) * scale
        pan((d / plot.width) * (hi - lo))
        return
      }
      const frac = Math.min(1, Math.max(0, (e.clientX - plot.left) / plot.width))
      const factor = Math.exp(Math.max(-1, Math.min(1, (e.deltaY * scale) / 300)))
      zoom(factor, lo + frac * (hi - lo))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [hasAxes])

  const handleMove = (e: MouseHandlerDataParam) => {
    const i = e.activeTooltipIndex == null ? NaN : Number(e.activeTooltipIndex)
    const sample = Number.isInteger(i) ? data[i] ?? null : null
    onHover(sample)
    if (dragStart != null && sample) setDragEnd(sample.ts)
  }

  const handleDown = (e: MouseHandlerDataParam) => {
    if (e.activeLabel == null) return
    setDragStart(Number(e.activeLabel))
    setDragEnd(null)
  }

  const handleUp = () => {
    if (dragStart != null && dragEnd != null && dragStart !== dragEnd) {
      onSelect([Math.min(dragStart, dragEnd), Math.max(dragStart, dragEnd)])
    }
    setDragStart(null)
    setDragEnd(null)
  }

  const handleLeave = () => {
    onHover(null)
    setDragStart(null)
    setDragEnd(null)
  }

  const clamp = (t: number) => Math.min(domain[1], Math.max(domain[0], t))
  const visibleOff = offSpans.filter(([a, b]) => b >= domain[0] && a <= domain[1])
  const left = axes.find(a => a.side === 'left')
  const right = axes.find(a => a.side === 'right')

  if (!hasAxes) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t.noChannels}
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative h-full select-none cursor-crosshair">
      {left && (
        <span className="pointer-events-none absolute top-0 left-2 text-[10px] font-medium" style={{ color: left.color }}>
          {left.unit}
        </span>
      )}
      {right && (
        <span className="pointer-events-none absolute top-0 right-2 text-[10px] font-medium" style={{ color: right.color }}>
          {right.unit}
        </span>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 18, right: PLOT_MARGIN, bottom: 0, left: PLOT_MARGIN }}
          onMouseMove={handleMove}
          onMouseDown={handleDown}
          onMouseUp={handleUp}
          onMouseLeave={handleLeave}
        >
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            domain={domain}
            ticks={ticks}
            tickFormatter={t => fmtTick(t, step)}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            allowDataOverflow
            height={24}
          />
          {axes.map(axis => (
            <YAxis
              key={axis.id}
              yAxisId={axis.id}
              orientation={axis.side === 'right' ? 'right' : 'left'}
              hide={axis.side === 'hidden'}
              domain={axis.domain}
              allowDataOverflow
              ticks={axis.ticks}
              tickFormatter={fmtAxis}
              tick={{ fontSize: 10, fill: axis.color }}
              tickLine={false}
              axisLine={false}
              width={AXIS_WIDTH}
            />
          ))}
          {visibleOff.map(([a, b]) => (
            <ReferenceArea
              key={a}
              yAxisId={axes[0].id}
              x1={clamp(a)}
              x2={clamp(b)}
              fill="var(--muted-foreground)"
              fillOpacity={0.08}
              strokeOpacity={0}
              label={{ value: t.outputOff, position: 'insideTop', fontSize: 9, fill: 'var(--muted-foreground)' }}
            />
          ))}
          <Tooltip
            isAnimationActive={false}
            cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-md border bg-popover/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur">
                  <p className="mb-1 font-mono text-muted-foreground">{fmtClock(Number(label), step < 1000)}</p>
                  {payload.map(entry => {
                    const ch = CHANNELS.find(c => c.key === entry.dataKey)
                    if (!ch) return null
                    return (
                      <div key={ch.key} className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: ch.color }} />
                        <span className="text-muted-foreground">{ch.short}</span>
                        <span className="ml-auto pl-3 font-mono tabular-nums">
                          {Number(entry.value).toFixed(ch.digits)} {ch.unit}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            }}
          />
          {CHANNELS.filter(ch => enabled.has(ch.key)).map(ch => (
            <Line
              key={ch.key}
              yAxisId={ch.unit}
              type="linear"
              dataKey={ch.key}
              stroke={ch.color}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}
          {dragStart != null && dragEnd != null && (
            <ReferenceArea
              yAxisId={axes[0].id}
              x1={Math.min(dragStart, dragEnd)}
              x2={Math.max(dragStart, dragEnd)}
              fill="var(--primary)"
              fillOpacity={0.12}
              stroke="var(--primary)"
              strokeOpacity={0.4}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
})
