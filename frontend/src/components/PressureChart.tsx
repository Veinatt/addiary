import { useId, useMemo } from 'react'
import type { Bounds } from '@/domain'
import { zoneFor, type Zone } from '@/domain'
import type { ChartPoint } from '@/lib/stats'

type Props = {
  title: string
  hint: string
  points: ChartPoint[]
  bounds: Bounds
}

type Series = {
  name: string
  minBound: number
  maxBound: number
  values: Array<number | null>
}

const WIDTH = 360
/** Left pad fits 3-digit ticks; outer px-3 keeps them on the card content grid. */
const PAD = { l: 28, r: 8, t: 10, b: 24 }
/** Keep first/last points away from the band edge. */
const POINT_INSET = 18
/** Must match `.chart-line-draw` duration in index.css. */
const DRAW_S = 1.15

function tone(zone: Zone): string {
  if (zone === 'high') return '#ef4444'
  if (zone === 'low') return '#38bdf8'
  return '#22c55e'
}

function LinePanel({ series, labels, drawKey }: { series: Series; labels: string[]; drawKey: string }) {
  const uid = useId().replace(/:/g, '')
  const present = series.values.filter((value): value is number => value != null)
  if (present.length === 0) {
    return (
      <div className="min-w-0">
        <p className="mb-1 px-3 text-xs font-medium text-foreground">{series.name}</p>
        <p className="py-8 text-center text-xs text-muted-foreground">Нет данных</p>
      </div>
    )
  }

  const rawMin = Math.min(...present, series.minBound)
  const rawMax = Math.max(...present, series.maxBound)
  const yMin = Math.floor(rawMin / 10) * 10
  const yMax = Math.max(yMin + 10, Math.ceil(rawMax / 10) * 10)
  const ticks: number[] = []
  for (let value = yMin; value <= yMax; value += 10) ticks.push(value)
  const height = Math.max(168, PAD.t + PAD.b + ticks.length * 22)
  const bandLeft = PAD.l
  const bandRight = WIDTH - PAD.r
  const bandW = bandRight - bandLeft
  const bandH = height - PAD.t - PAD.b
  const lineLeft = bandLeft + POINT_INSET
  const lineRight = bandRight - POINT_INSET
  const lineW = Math.max(1, lineRight - lineLeft)
  const xOf = (index: number) =>
    lineLeft + (series.values.length <= 1 ? lineW / 2 : (index / (series.values.length - 1)) * lineW)
  const yOf = (value: number) => PAD.t + ((yMax - value) / (yMax - yMin)) * bandH

  const plotted = series.values.flatMap((value, index) =>
    value == null ? [] : [{ x: xOf(index), y: yOf(value), v: value, index }],
  )
  const linePath =
    plotted.length === 0
      ? ''
      : plotted.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
  // Share of path length at each point — same progress the stroke-dash draw uses.
  const pathProgress: number[] = (() => {
    if (plotted.length === 0) return []
    if (plotted.length === 1) return [0]
    const distances = [0]
    let total = 0
    for (let i = 1; i < plotted.length; i += 1) {
      const prev = plotted[i - 1]!
      const next = plotted[i]!
      total += Math.hypot(next.x - prev.x, next.y - prev.y)
      distances.push(total)
    }
    if (total <= 0) return plotted.map(() => 0)
    return distances.map((distance) => distance / total)
  })()

  const yHigh = yOf(series.maxBound)
  const yLow = yOf(series.minBound)
  const labelIndexes = labels.reduce<number[]>((chosen, label, index) => {
    const x = xOf(index)
    const half = Math.max(6, label.length * 2.1)
    const previous = chosen.at(-1)
    if (previous == null) return [index]
    const previousHalf = Math.max(6, labels[previous]!.length * 2.1)
    if (x - xOf(previous) >= half + previousHalf + 4) chosen.push(index)
    return chosen
  }, [])
  const last = labels.length - 1
  if (last > 0 && labelIndexes.at(-1) !== last) {
    const previous = labelIndexes.at(-1) ?? 0
    const gap = xOf(last) - xOf(previous)
    const need = Math.max(6, labels[last]!.length * 2.1) + Math.max(6, labels[previous]!.length * 2.1) + 4
    if (gap >= need) labelIndexes.push(last)
    else labelIndexes[labelIndexes.length - 1] = last
  }

  const zoneLayers: Array<{ id: string; color: string; y: number; height: number }> = [
    { id: `${uid}-high`, color: tone('high'), y: PAD.t, height: Math.max(0, yHigh - PAD.t) },
    { id: `${uid}-norm`, color: tone('normal'), y: yHigh, height: Math.max(0, yLow - yHigh) },
    { id: `${uid}-low`, color: tone('low'), y: yLow, height: Math.max(0, PAD.t + bandH - yLow) },
  ]

  return (
    <div className="min-w-0 px-3">
      <p className="mb-1 text-xs font-medium text-foreground">{series.name}</p>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="w-full"
        style={{ aspectRatio: `${WIDTH} / ${height}` }}
        role="img"
        aria-label={series.name}
      >
        <defs>
          {zoneLayers.map((layer) => (
            <clipPath key={layer.id} id={layer.id}>
              <rect x={bandLeft} y={layer.y} width={bandW} height={layer.height} />
            </clipPath>
          ))}
        </defs>

        <rect x={bandLeft} y={PAD.t} width={bandW} height={Math.max(0, yHigh - PAD.t)} fill="#ef4444" opacity="0.14" />
        <rect
          x={bandLeft}
          y={yHigh}
          width={bandW}
          height={Math.max(0, yLow - yHigh)}
          fill="#22c55e"
          opacity="0.16"
        />
        <rect
          x={bandLeft}
          y={yLow}
          width={bandW}
          height={Math.max(0, PAD.t + bandH - yLow)}
          fill="#38bdf8"
          opacity="0.16"
        />
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={bandLeft}
              x2={bandRight}
              y1={yOf(tick)}
              y2={yOf(tick)}
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeDasharray="3 3"
            />
            <text
              x={0}
              y={yOf(tick) + 3}
              fill="currentColor"
              fontSize="9"
              opacity="0.75"
              textAnchor="start"
            >
              {tick}
            </text>
          </g>
        ))}

        {linePath &&
          zoneLayers.map((layer) =>
            layer.height <= 0 ? null : (
              <path
                key={`${drawKey}-${layer.id}`}
                d={linePath}
                fill="none"
                stroke={layer.color}
                strokeWidth="2.6"
                strokeLinejoin="round"
                strokeLinecap="round"
                pathLength={1}
                clipPath={`url(#${layer.id})`}
                className="chart-line-draw"
              />
            ),
          )}

        {plotted.map((point, order) => (
          <circle
            key={`${drawKey}-dot-${point.index}`}
            cx={point.x}
            cy={point.y}
            r="3.2"
            fill={tone(zoneFor(point.v, series.minBound, series.maxBound))}
            className="chart-dot-draw"
            style={{ animationDelay: `${(pathProgress[order] ?? 0) * DRAW_S}s` }}
          />
        ))}

        {labelIndexes.map((index) => (
          <text
            key={`${labels[index]}-${index}`}
            x={xOf(index)}
            y={height - 5}
            textAnchor="middle"
            fill="currentColor"
            fontSize="9"
            opacity="0.75"
          >
            {labels[index]}
          </text>
        ))}
      </svg>
    </div>
  )
}

export function PressureChart({ title, hint, points, bounds }: Props) {
  const hasValue = points.some((point) => point.sys != null || point.dia != null)
  const labels = points.map((point) => point.label)
  const drawKey = useMemo(
    () => points.map((point) => `${point.key}:${point.sys ?? 'x'}/${point.dia ?? 'x'}`).join('|'),
    [points],
  )
  return (
    <section className="surface-panel grid gap-4 py-4">
      <h2 className="section-label px-3">{title}</h2>
      {hasValue ? (
        <div className="grid gap-5">
          <LinePanel
            drawKey={`sys-${drawKey}`}
            labels={labels}
            series={{
              name: 'Верхнее',
              minBound: bounds.sysMin,
              maxBound: bounds.sysMax,
              values: points.map((point) => point.sys),
            }}
          />
          <LinePanel
            drawKey={`dia-${drawKey}`}
            labels={labels}
            series={{
              name: 'Нижнее',
              minBound: bounds.diaMin,
              maxBound: bounds.diaMax,
              values: points.map((point) => point.dia),
            }}
          />
        </div>
      ) : (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">Пока пусто.</p>
      )}
      <p className="px-3 text-[11px] text-muted-foreground">
        {hint} Линия зелёная в норме, красная выше границ и голубая ниже.
      </p>
    </section>
  )
}
