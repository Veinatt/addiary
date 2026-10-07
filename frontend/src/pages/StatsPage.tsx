import { useMemo, useState } from 'react'
import { combinedZone, type Reading } from '@/domain'
import { MonthCalendar } from '@/components/MonthCalendar'
import { PeriodPicker } from '@/components/PeriodPicker'
import { PressureChart } from '@/components/PressureChart'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ReadingCard } from '@/components/ReadingCard'
import { ConfirmDelete, ReadingDialog } from '@/components/ReadingDialog'
import { useDiary } from '@/hooks/useDiary'
import { dayTitle, monthTitle, shiftMonth } from '@/lib/dates'
import { initialPeriod, readingsInPeriod, type PeriodValue } from '@/lib/period'
import { applyFilter, chartModel, groupReadings, summarize, type ListFilter } from '@/lib/stats'

const FILTERS: Array<{ value: ListFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'high', label: 'Выше' },
  { value: 'low', label: 'Ниже' },
  { value: 'arrhythmia', label: 'Аритмия' },
]

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface-panel px-4 py-3">
      <p className="section-label">{label}</p>
      <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function StatsPage() {
  const { readings, bounds, deleteReading } = useDiary()
  const [period, setPeriod] = useState<PeriodValue>(() => initialPeriod())
  const [filter, setFilter] = useState<ListFilter>('all')
  const [editing, setEditing] = useState<Reading | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Reading | null>(null)

  const inPeriod = useMemo(() => readingsInPeriod(readings, period), [readings, period])
  const summary = useMemo(() => summarize(inPeriod, bounds), [inPeriod, bounds])
  const chart = useMemo(() => chartModel(period, inPeriod, readings), [period, inPeriod, readings])
  const filtered = useMemo(() => applyFilter(inPeriod, filter, bounds), [inPeriod, filter, bounds])
  const groups = useMemo(() => groupReadings(filtered), [filtered])

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

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Статистика</h1>
        <p className="mt-1 text-sm text-muted-foreground">Сводка, график и все записи за период.</p>
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

      <div key={`chart-${period.mode}`} className="animate-fade-up">
        <PressureChart title={chart.title} hint={chart.hint} points={chart.points} bounds={bounds} />
      </div>

      <section className="grid grid-cols-2 gap-3">
        <Metric
          label="Среднее давление"
          value={summary.avgSys == null ? '—' : `${summary.avgSys} / ${summary.avgDia}`}
        />
        <Metric label="Средний пульс" value={summary.avgPulse == null ? '—' : String(summary.avgPulse)} />
        <Metric label="Измерений" value={String(summary.count)} hint={`${summary.days} дн.`} />
        <Metric label="Выше обычного" value={String(summary.high)} />
        <Metric label="Ниже обычного" value={String(summary.low)} />
        <Metric label="С аритмией" value={String(summary.arrhythmia)} />
      </section>

      <SegmentedControl fullWidth size="sm" value={filter} options={FILTERS} onChange={setFilter} />

      <section className="grid min-w-0 gap-4">
        <div className="flex items-center justify-between">
          <h2 className="section-label">{period.mode === 'all' ? 'Все записи' : 'За период'}</h2>
          <span className="count-chip">{filtered.length}</span>
        </div>
        {groups.length === 0 ? (
          <div className="surface-panel px-5 py-8 text-center text-sm text-muted-foreground">Пока пусто.</div>
        ) : (
          groups.map((month) => (
            <div key={month.month} className="grid min-w-0 gap-3">
              <h3 className="text-sm font-semibold">
                {monthTitle(Number(month.month.slice(0, 4)), Number(month.month.slice(5, 7)))}
              </h3>
              {month.days.map((day) => (
                <div key={day.date} className="grid min-w-0 gap-2">
                  <p className="text-xs text-muted-foreground">{dayTitle(day.date)}</p>
                  {day.items.map((item) => (
                    <div key={item.id} className="min-w-0">
                      <ReadingCard
                        reading={item}
                        bounds={bounds}
                        onEdit={setEditing}
                        onDelete={setPendingDelete}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </section>

      <ReadingDialog reading={editing} onClose={() => setEditing(null)} />
      <ConfirmDelete
        open={pendingDelete != null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          void deleteReading(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
