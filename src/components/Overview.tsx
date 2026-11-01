import { memo, useRef } from 'react'
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { CHANNELS, niceDomain, type ChannelKey, type Range, type Sample } from '@/lib/waveform'

interface OverviewProps {
  data: Sample[]
  enabled: Set<ChannelKey>
  full: Range
  view: Range | null
  insets: { left: number; right: number }
  onChange: (range: Range | null) => void
}

type DragMode = 'move' | 'left' | 'right' | 'new'

const MIN_FRACTION = 0.002

export const Overview = memo(function Overview({ data, enabled, full, view, insets, onChange }: OverviewProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: DragMode; origin: number; start: Range } | null>(null)

  const channels = CHANNELS.filter(ch => enabled.has(ch.key))
  const shown = channels.length > 0 ? channels : CHANNELS.slice(0, 1)
  const span = full[1] - full[0] || 1
  const win = view ?? full
  const leftPct = ((win[0] - full[0]) / span) * 100
  const widthPct = ((win[1] - win[0]) / span) * 100

  const toTs = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return full[0] + frac * span
  }

  const emit = (lo: number, hi: number) => {
    if (hi - lo < span * MIN_FRACTION) return
    onChange(lo <= full[0] && hi >= full[1] ? null : [lo, hi])
  }

  const onPointerDown = (e: React.PointerEvent, mode: DragMode) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { mode, origin: toTs(e.clientX), start: win }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const t = toTs(e.clientX)
    const [lo, hi] = d.start
    if (d.mode === 'move') {
      const w = hi - lo
      const nlo = Math.min(full[1] - w, Math.max(full[0], lo + t - d.origin))
      emit(nlo, nlo + w)
    } else if (d.mode === 'left') {
      emit(Math.min(t, hi), hi)
    } else if (d.mode === 'right') {
      emit(lo, Math.max(t, lo))
    } else {
      emit(Math.min(d.origin, t), Math.max(d.origin, t))
    }
  }

  const onPointerUp = () => {
    drag.current = null
  }

  return (
    <div className="relative h-14">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: insets.right, bottom: 4, left: insets.left }}>
          <XAxis dataKey="ts" type="number" domain={full} hide />
          {shown.map(ch => {
            let min = Infinity
            let max = -Infinity
            for (const s of data) {
              if (s[ch.key] < min) min = s[ch.key]
              if (s[ch.key] > max) max = s[ch.key]
            }
            return <YAxis key={ch.key} yAxisId={ch.key} domain={niceDomain(min, max)} hide />
          })}
          {shown.map(ch => (
            <Area
              key={ch.key}
              yAxisId={ch.key}
              type="linear"
              dataKey={ch.key}
              stroke={ch.color}
              strokeOpacity={0.8}
              strokeWidth={1}
              fill={ch.color}
              fillOpacity={0.08}
              isAnimationActive={false}
              activeDot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      <div
        ref={trackRef}
        className="absolute inset-y-0 cursor-crosshair touch-none"
        style={{ left: insets.left, right: insets.right }}
        onPointerDown={e => onPointerDown(e, 'new')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {view && (
          <>
            <div className="absolute inset-y-0 left-0 bg-background/60" style={{ width: `${leftPct}%` }} />
            <div className="absolute inset-y-0 right-0 bg-background/60" style={{ width: `${100 - leftPct - widthPct}%` }} />
          </>
        )}
        <div
          className="group absolute inset-y-0 cursor-grab rounded-sm border border-primary/50 bg-primary/5 active:cursor-grabbing"
          style={{ left: `${leftPct}%`, width: `max(${widthPct}%, 4px)` }}
          onPointerDown={e => onPointerDown(e, 'move')}
        >
          {(['left', 'right'] as const).map(side => (
            <div
              key={side}
              className={`absolute inset-y-0 w-2.5 cursor-ew-resize ${side === 'left' ? '-left-1.5' : '-right-1.5'}`}
              onPointerDown={e => onPointerDown(e, side)}
            >
              <div className="absolute inset-y-3 left-1/2 w-1 -translate-x-1/2 rounded-full bg-primary/70 opacity-60 group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
