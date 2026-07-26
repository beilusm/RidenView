import { useState, useMemo, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Upload, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

interface WaveformViewerProps {
  data: Record<string, string>[]
  onLoadNew: () => void
}

interface ChannelConfig {
  key: string
  label: string
  unit: string
  color: string
  yAxisId: 'left' | 'right'
}

const CHANNELS: ChannelConfig[] = [
  { key: 'voltage', label: 'Voltage', unit: 'V', color: '#3b82f6', yAxisId: 'left' },
  { key: 'current', label: 'Current', unit: 'A', color: '#f97316', yAxisId: 'right' },
  { key: 'power', label: 'Power', unit: 'W', color: '#ef4444', yAxisId: 'right' },
  { key: 'inputVoltage', label: 'Input Voltage', unit: 'V', color: '#8b5cf6', yAxisId: 'left' },
  { key: 'temperature', label: 'Temperature', unit: '°C', color: '#10b981', yAxisId: 'right' },
]

interface ChartRow {
  ts: number
  voltage: number
  current: number
  power: number
  inputVoltage: number
  temperature: number
}

function toEpoch(s: string): number {
  const d = new Date(s)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

function fmtTick(ts: number): string {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function fmtFull(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

export function WaveformViewer({ data, onLoadNew }: WaveformViewerProps) {
  const [enabledChannels, setEnabledChannels] = useState<Set<string>>(
    new Set(['voltage', 'current'])
  )
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null)
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null)
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null)
  const [showStats, setShowStats] = useState(true)

  const chartData = useMemo<ChartRow[]>(() => {
    return data.map(row => ({
      ts: toEpoch(row.time),
      voltage: parseFloat(row.voltage) || 0,
      current: parseFloat(row.current) || 0,
      power: parseFloat(row.power) || 0,
      inputVoltage: parseFloat(row.inputVoltage) || 0,
      temperature: parseFloat(row.temperature) || 0,
    }))
  }, [data])

  const displayData = useMemo(() => {
    if (!zoomDomain) return chartData
    const [lo, hi] = zoomDomain
    return chartData.filter(d => d.ts >= lo && d.ts <= hi)
  }, [chartData, zoomDomain])

  const timeRange = useMemo(() => {
    if (displayData.length === 0) return { min: 0, max: 1 }
    return {
      min: displayData[0].ts,
      max: displayData[displayData.length - 1].ts,
    }
  }, [displayData])

  const computedTicks = useMemo(() => {
    const { min, max } = timeRange
    if (min === max) return [min]
    const durationMs = max - min
    const targetTicks = 8

    const intervals = [100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000]
    let step = intervals[intervals.length - 1]
    for (const iv of intervals) {
      if (durationMs / iv <= targetTicks * 1.5) {
        step = iv
        break
      }
    }

    const ticks: number[] = []
    const start = Math.ceil(min / step) * step
    for (let t = start; t <= max; t += step) {
      ticks.push(t)
    }
    return ticks
  }, [timeRange])

  const stats = useMemo(() => {
    const subset = zoomDomain
      ? chartData.filter(d => d.ts >= zoomDomain[0] && d.ts <= zoomDomain[1])
      : chartData

    return CHANNELS.map(ch => {
      const values = subset.map(d => d[ch.key as keyof ChartRow] as number).filter(v => !isNaN(v))
      if (values.length === 0) return { ...ch, min: 0, max: 0, avg: 0 }
      const min = Math.min(...values)
      const max = Math.max(...values)
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      return { ...ch, min, max, avg }
    })
  }, [chartData, zoomDomain])

  const handleMouseDown = useCallback((e: Record<string, unknown>) => {
    const val = e?.activeLabel as number | undefined
    if (val != null) setRefAreaLeft(val)
  }, [])

  const handleMouseMove = useCallback((e: Record<string, unknown>) => {
    const val = e?.activeLabel as number | undefined
    if (refAreaLeft != null && val != null) setRefAreaRight(val)
  }, [refAreaLeft])

  const handleMouseUp = useCallback(() => {
    if (refAreaLeft != null && refAreaRight != null) {
      const lo = Math.min(refAreaLeft, refAreaRight)
      const hi = Math.max(refAreaLeft, refAreaRight)
      if (hi - lo > 1000) {
        setZoomDomain([lo, hi])
      }
    }
    setRefAreaLeft(null)
    setRefAreaRight(null)
  }, [refAreaLeft, refAreaRight])

  const zoomOut = useCallback(() => setZoomDomain(null), [])

  const handleZoomIn = useCallback(() => {
    if (chartData.length < 2) return
    const minTs = chartData[0].ts
    const maxTs = chartData[chartData.length - 1].ts
    const mid = (minTs + maxTs) / 2
    const half = (maxTs - minTs) / 4
    setZoomDomain([mid - half, mid + half])
  }, [chartData])

  return (
    <div className="flex flex-col h-[calc(100vh-52px)]">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {data.length.toLocaleString()} samples
          </Badge>
          {zoomDomain && (
            <Badge variant="secondary" className="text-xs">
              {fmtFull(zoomDomain[0])} ~ {fmtFull(zoomDomain[1])}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={zoomOut} disabled={!zoomDomain} title="Reset Zoom">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={handleZoomIn} title="Fit View">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Button variant="ghost" size="icon-sm" onClick={onLoadNew} title="Load New File">
            <Upload className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-48 border-r border-border/50 p-3 flex flex-col gap-2 overflow-y-auto">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Channels</p>
          {CHANNELS.map(ch => (
            <label
              key={ch.key}
              className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={enabledChannels.has(ch.key)}
                onCheckedChange={(checked: boolean) => {
                  setEnabledChannels(prev => {
                    const next = new Set(prev)
                    if (checked) next.add(ch.key)
                    else next.delete(ch.key)
                    return next
                  })
                }}
              />
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: ch.color }}
              />
              <span className="text-xs flex-1 truncate">{ch.label}</span>
              <span className="text-[10px] text-muted-foreground">{ch.unit}</span>
            </label>
          ))}

          <Separator className="my-2" />

          <Button
            variant="ghost"
            size="sm"
            className="text-xs justify-start h-7"
            onClick={() => setShowStats(s => !s)}
          >
            {showStats ? 'Hide Stats' : 'Show Stats'}
          </Button>

          {showStats && (
            <div className="space-y-2 mt-1">
              {stats.map(ch => (
                enabledChannels.has(ch.key) && (
                  <div key={ch.key} className="text-[10px] space-y-0.5">
                    <p className="font-medium text-muted-foreground">{ch.label}</p>
                    <div className="grid grid-cols-3 gap-1">
                      <div>
                        <span className="text-muted-foreground">Min </span>
                        <span className="font-mono">{ch.min.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Max </span>
                        <span className="font-mono">{ch.max.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg </span>
                        <span className="font-mono">{ch.avg.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 p-4 min-w-0">
          <Card className="h-full p-4 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={displayData}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={[timeRange.min, timeRange.max]}
                  tickFormatter={fmtTick}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  ticks={computedTicks}
                  allowDataOverflow
                />
                <YAxis yAxisId="left" orientation="left"
                  tick={{ fontSize: 10, fill: '#3b82f6' }}
                  tickLine={false} axisLine={false} width={48}
                />
                <YAxis yAxisId="right" orientation="right"
                  tick={{ fontSize: 10, fill: '#f97316' }}
                  tickLine={false} axisLine={false} width={48}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const ts = Number(label)
                    return (
                      <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                        <p className="font-medium text-muted-foreground mb-1">
                          {fmtFull(ts)}
                        </p>
                        {payload.map(entry => {
                          const ch = CHANNELS.find(c => c.key === entry.dataKey)
                          return (
                            <div key={String(entry.dataKey)} className="flex items-center gap-2">
                              <div
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: ch?.color }}
                              />
                              <span className="text-muted-foreground">{ch?.label}</span>
                              <span className="font-mono font-medium ml-auto">
                                {typeof entry.value === 'number' ? entry.value.toFixed(3) : entry.value} {ch?.unit}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }}
                />
                {CHANNELS.map(ch => (
                  enabledChannels.has(ch.key) && (
                    <Line
                      key={ch.key}
                      yAxisId={ch.yAxisId}
                      type="monotone"
                      dataKey={ch.key}
                      stroke={ch.color}
                      dot={false}
                      strokeWidth={1.5}
                      isAnimationActive={false}
                    />
                  )
                ))}
                {refAreaLeft != null && refAreaRight != null && (
                  <ReferenceArea
                    yAxisId="left"
                    x1={Math.min(refAreaLeft, refAreaRight)}
                    x2={Math.max(refAreaLeft, refAreaRight)}
                    strokeOpacity={0.3}
                    fill="hsl(var(--primary))"
                    fillOpacity={0.1}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  )
}
