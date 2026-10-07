import { useMemo, useState } from 'react'
import { cleanNote, zoneFor } from '@/domain'
import { MonthCalendar } from '@/components/MonthCalendar'
import { PeriodPicker } from '@/components/PeriodPicker'
import { useDiary } from '@/hooks/useDiary'
import { clock, periodLabel, shiftMonth, shortDate } from '@/lib/dates'
import { downloadPdf } from '@/lib/download'
import { combinedZone } from '@/domain'
import { initialPeriod, readingsInPeriod, resolveRange, type PeriodValue } from '@/lib/period'
import { cn } from '@/lib/utils'

function tone(zone: 'low' | 'high' | 'normal'): string {
  if (zone === 'high') return 'text-red-600 dark:text-red-400'
  if (zone === 'low') return 'text-sky-700 dark:text-sky-300'
  return ''
}

export function TablesPage() {
  const { readings, bounds } = useDiary()
  const [period, setPeriod] = useState<PeriodValue>(() => initialPeriod())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo(() => resolveRange(period, readings), [period, readings])
  const rows = useMemo(
    () =>
      readingsInPeriod(readings, period).slice().sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)),
    [readings, period],
  )
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
    try {
      await downloadPdf(range.from, range.to)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось скачать PDF')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Таблицы</h1>
        <p className="mt-1 text-sm text-muted-foreground">Одна строка — одно измерение. PDF за выбранный период.</p>
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
        <span className="count-chip">{rows.length}</span>
      </div>

      <div className="surface-panel overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="border-r border-border/35 px-3 py-2 font-medium last:border-r-0">Дата</th>
              <th className="border-r border-border/35 px-3 py-2 font-medium last:border-r-0">Время</th>
              <th className="border-r border-border/35 px-3 py-2 font-medium last:border-r-0">Давление</th>
              <th className="border-r border-border/35 px-3 py-2 font-medium last:border-r-0">Пульсовое</th>
              <th className="border-r border-border/35 px-3 py-2 font-medium last:border-r-0">Пульс</th>
              <th className="border-r border-border/35 px-3 py-2 font-medium last:border-r-0">Аритмия</th>
              <th className="px-3 py-2 font-medium">Примечание</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={7}>
                  Нет записей за этот период
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border/70 last:border-0">
                  <td className="border-r border-border/35 px-3 py-2 tabular-nums">{shortDate(row.measuredAt)}</td>
                  <td className="border-r border-border/35 px-3 py-2 tabular-nums">{clock(row.measuredAt)}</td>
                  <td className="border-r border-border/35 px-3 py-2 tabular-nums">
                    <span className={tone(zoneFor(row.systolic, bounds.sysMin, bounds.sysMax))}>{row.systolic}</span>
                    <span className="px-1 text-muted-foreground">/</span>
                    <span className={tone(zoneFor(row.diastolic, bounds.diaMin, bounds.diaMax))}>
                      {row.diastolic}
                    </span>
                  </td>
                  <td className="border-r border-border/35 px-3 py-2 tabular-nums">{row.systolic - row.diastolic}</td>
                  <td
                    className={cn(
                      'border-r border-border/35 px-3 py-2 tabular-nums',
                      tone(zoneFor(row.pulse, bounds.pulseMin, bounds.pulseMax)),
                    )}
                  >
                    {row.pulse}
                  </td>
                  <td className="border-r border-border/35 px-3 py-2">{row.arrhythmia ? 'да' : ''}</td>
                  <td className="max-w-[16rem] whitespace-pre-wrap break-words px-3 py-2 text-muted-foreground">
                    {cleanNote(row.note)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Пульсовое давление — разница между верхним и нижним. Пример: 120 / 80, пульсовое 40.
      </p>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button type="button" className="btn-primary" disabled={busy} onClick={() => void download()}>
        {busy ? 'Готовлю PDF…' : 'Скачать PDF'}
      </button>
    </div>
  )
}
