import { useMemo, useState } from 'react'
import { cleanNote, zoneFor } from '@/domain'
import { MonthCalendar } from '@/components/MonthCalendar'
import { PeriodPicker } from '@/components/PeriodPicker'
import { useDiary } from '@/hooks/useDiary'
import { clock, periodLabel, shiftMonth } from '@/lib/dates'
import { downloadPdf } from '@/lib/download'
import { combinedZone } from '@/domain'
import { groupReadingsByDay } from '@/lib/daySlots'
import { initialPeriod, readingsInPeriod, resolveRange, type PeriodValue } from '@/lib/period'
import { cn } from '@/lib/utils'

function tone(zone: 'low' | 'high' | 'normal'): string {
  if (zone === 'high') return 'text-red-600 dark:text-red-400'
  if (zone === 'low') return 'text-sky-700 dark:text-sky-300'
  return ''
}

function PressureCell({
  reading,
  bounds,
}: {
  reading: { systolic: number; diastolic: number } | null
  bounds: { sysMin: number; sysMax: number; diaMin: number; diaMax: number }
}) {
  if (!reading) return <span className="text-muted-foreground">—</span>
  return (
    <span className="tabular-nums">
      <span className={tone(zoneFor(reading.systolic, bounds.sysMin, bounds.sysMax))}>{reading.systolic}</span>
      <span className="px-1 text-muted-foreground">/</span>
      <span className={tone(zoneFor(reading.diastolic, bounds.diaMin, bounds.diaMax))}>{reading.diastolic}</span>
    </span>
  )
}

export function TablesPage() {
  const { readings, bounds, settings, refresh } = useDiary()
  const [period, setPeriod] = useState<PeriodValue>(() => initialPeriod())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentHint, setSentHint] = useState<string | null>(null)

  const range = useMemo(() => resolveRange(period, readings), [period, readings])
  const inPeriod = useMemo(() => readingsInPeriod(readings, period), [readings, period])
  const dayMode = period.mode === 'day'
  const dayRows = useMemo(() => groupReadingsByDay(inPeriod, settings), [inPeriod, settings])
  const readingRows = useMemo(
    () => inPeriod.slice().sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)),
    [inPeriod],
  )
  const count = dayMode ? readingRows.length : dayRows.length
  const label = periodLabel(range.from, range.to)

  const marks = useMemo(() => {
    const map = new Map<string, 'low' | 'high' | 'normal'>()
    for (const reading of readings) {
      const zone = combinedZone(reading, bounds)
      const previous = map.get(reading.date)
      if (!previous || zone === 'high' || (zone === 'low' && previous !== 'high')) {
        map.set(reading.date, zone)
      }
    }
    return map
  }, [readings, bounds])

  const selectDay = (date: string) => {
    if (period.mode === 'day') {
      setPeriod({ ...period, day: date })
      return
    }
    if (!period.rangeFrom || period.rangeTo) {
      setPeriod({ ...period, rangeFrom: date, rangeTo: null })
      return
    }
    setPeriod({ ...period, rangeTo: date })
  }

  const download = async () => {
    setBusy(true)
    setError(null)
    setSentHint(null)
    try {
      await refresh()
      const result = await downloadPdf(range.from, range.to)
      if (result.via === 'telegram') {
        setSentHint('PDF отправлен в чат с ботом — откройте там.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось скачать PDF')
    } finally {
      setBusy(false)
    }
  }

  const th = 'px-2 py-1.5 text-center font-medium'
  const thEdge = 'border-r border-border/35'

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Таблицы</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {dayMode
            ? 'За выбранный день — каждое измерение отдельной строкой.'
            : 'Одна строка — один день. Утро/вечер по времени; если измерений несколько — среднее.'}
        </p>
      </div>

      <PeriodPicker value={period} onChange={setPeriod} />
      {(period.mode === 'day' || period.mode === 'range') && (
        <div key={period.mode} className="animate-fade-up">
          <MonthCalendar
            year={period.year}
            month={period.month}
            marks={marks}
            selected={period.mode === 'day' ? period.day : null}
            rangeFrom={period.mode === 'range' ? period.rangeFrom : null}
            rangeTo={period.mode === 'range' ? period.rangeTo : null}
            onShift={(delta) => setPeriod({ ...period, ...shiftMonth(period.year, period.month, delta) })}
            onSelect={selectDay}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Период: {label}</p>
        <span className="count-chip">{count}</span>
      </div>

      <div className="surface-panel overflow-x-auto">
        {dayMode ? (
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className={cn(th, thEdge)}>Время</th>
                <th className={cn(th, thEdge)}>АД</th>
                <th className={cn(th, thEdge)}>ПД</th>
                <th className={cn(th, thEdge)}>Пульс</th>
                <th className={cn(th, thEdge)}>Аритмия</th>
                <th className={cn(th, 'text-center')}>Примечание</th>
              </tr>
            </thead>
            <tbody>
              {readingRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-muted-foreground" colSpan={6}>
                    Нет записей за этот день
                  </td>
                </tr>
              ) : (
                readingRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/70 last:border-0">
                    <td className="border-r border-border/35 px-2 py-2 text-center tabular-nums">
                      {clock(row.measuredAt)}
                    </td>
                    <td className="border-r border-border/35 px-2 py-2 text-center">
                      <PressureCell reading={row} bounds={bounds} />
                    </td>
                    <td className="border-r border-border/35 px-2 py-2 text-center tabular-nums">
                      {row.systolic - row.diastolic}
                    </td>
                    <td
                      className={cn(
                        'border-r border-border/35 px-2 py-2 text-center tabular-nums',
                        tone(zoneFor(row.pulse, bounds.pulseMin, bounds.pulseMax)),
                      )}
                    >
                      {row.pulse}
                    </td>
                    <td className="border-r border-border/35 px-2 py-2 text-center">
                      {row.arrhythmia ? 'да' : ''}
                    </td>
                    <td className="max-w-[14rem] whitespace-pre-wrap break-words px-2 py-2 text-left text-muted-foreground">
                      {cleanNote(row.note)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th rowSpan={2} className={cn(th, thEdge, 'align-middle')}>
                  Дата
                </th>
                <th colSpan={3} className={cn(th, thEdge, 'border-b border-border/50')}>
                  Утро
                </th>
                <th colSpan={3} className={cn(th, thEdge, 'border-b border-border/50')}>
                  Вечер
                </th>
                <th rowSpan={2} className={cn(th, 'align-middle text-center')}>
                  Примечания
                </th>
              </tr>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className={cn(th, thEdge)}>АД</th>
                <th className={cn(th, thEdge)}>ПД</th>
                <th className={cn(th, thEdge)}>Пульс</th>
                <th className={cn(th, thEdge)}>АД</th>
                <th className={cn(th, thEdge)}>ПД</th>
                <th className={cn(th, thEdge)}>Пульс</th>
              </tr>
            </thead>
            <tbody>
              {dayRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-muted-foreground" colSpan={8}>
                    Нет записей за этот период
                  </td>
                </tr>
              ) : (
                dayRows.map((row) => (
                  <tr key={row.date} className="border-b border-border/70 last:border-0">
                    <td className="border-r border-border/35 px-2 py-2 text-center tabular-nums">
                      {`${row.date.slice(8, 10)}.${row.date.slice(5, 7)}`}
                    </td>
                    <td className="border-r border-border/35 px-2 py-2 text-center">
                      <PressureCell reading={row.morning} bounds={bounds} />
                    </td>
                    <td className="border-r border-border/35 px-2 py-2 text-center tabular-nums">
                      {row.morning ? row.morning.systolic - row.morning.diastolic : '—'}
                    </td>
                    <td
                      className={cn(
                        'border-r border-border/35 px-2 py-2 text-center tabular-nums',
                        row.morning && tone(zoneFor(row.morning.pulse, bounds.pulseMin, bounds.pulseMax)),
                      )}
                    >
                      {row.morning ? row.morning.pulse : '—'}
                    </td>
                    <td className="border-r border-border/35 px-2 py-2 text-center">
                      <PressureCell reading={row.evening} bounds={bounds} />
                    </td>
                    <td className="border-r border-border/35 px-2 py-2 text-center tabular-nums">
                      {row.evening ? row.evening.systolic - row.evening.diastolic : '—'}
                    </td>
                    <td
                      className={cn(
                        'border-r border-border/35 px-2 py-2 text-center tabular-nums',
                        row.evening && tone(zoneFor(row.evening.pulse, bounds.pulseMin, bounds.pulseMax)),
                      )}
                    >
                      {row.evening ? row.evening.pulse : '—'}
                    </td>
                    <td className="max-w-[14rem] whitespace-pre-wrap break-words px-2 py-2 text-left text-muted-foreground">
                      {row.note || ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Пульсовое давление — разница между верхним и нижним. Пример: 120 / 80, пульсовое 40.
      </p>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {sentHint && <p className="text-sm text-primary-soft">{sentHint}</p>}
      <button type="button" className="btn-primary" disabled={busy} onClick={() => void download()}>
        {busy ? 'Готовлю PDF…' : 'Скачать PDF'}
      </button>
    </div>
  )
}
