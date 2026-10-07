import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { isHigh, isLow, type Bounds, type Reading } from '@/domain'
import { clock, dayKey, daysInMonth, monthShort, shiftMonth, todayKey } from '@/lib/dates'
import type { PeriodValue } from '@/lib/period'
import { resolveRange } from '@/lib/period'

export type ChartPoint = {
  key: string
  label: string
  sys: number | null
  dia: number | null
}

export type Summary = {
  count: number
  days: number
  avgSys: number | null
  avgDia: number | null
  avgPulse: number | null
  high: number
  low: number
  arrhythmia: number
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function summarize(readings: Reading[], bounds: Bounds): Summary {
  return {
    count: readings.length,
    days: new Set(readings.map((item) => item.date)).size,
    avgSys: average(readings.map((item) => item.systolic)),
    avgDia: average(readings.map((item) => item.diastolic)),
    avgPulse: average(readings.map((item) => item.pulse)),
    high: readings.filter((item) => isHigh(item, bounds)).length,
    // High wins, same as calendar/combinedZone — mixed readings are not double-counted as low.
    low: readings.filter((item) => isLow(item, bounds) && !isHigh(item, bounds)).length,
    arrhythmia: readings.filter((item) => item.arrhythmia).length,
  }
}

function avgPair(items: Reading[]): { sys: number | null; dia: number | null } {
  if (items.length === 0) return { sys: null, dia: null }
  const sys = Math.round(items.reduce((sum, item) => sum + item.systolic, 0) / items.length)
  const dia = Math.round(items.reduce((sum, item) => sum + item.diastolic, 0) / items.length)
  return { sys, dia }
}

export function chartModel(
  period: PeriodValue,
  inPeriod: Reading[],
  allReadings: Reading[],
): { title: string; hint: string; points: ChartPoint[] } {
  if (period.mode === 'day') {
    const rows = [...inPeriod].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
    return {
      title: 'Измерения за день',
      hint: 'Каждая точка — одно измерение.',
      points: rows.map((item) => ({
        key: item.id,
        label: clock(item.measuredAt),
        sys: item.systolic,
        dia: item.diastolic,
      })),
    }
  }

  if (period.mode === 'all') {
    const today = todayKey()
    const [year, month] = today.split('-').map(Number)
    const end = { year: year ?? 2026, month: month ?? 1 }
    const points: ChartPoint[] = []
    for (let i = 11; i >= 0; i -= 1) {
      const point = shiftMonth(end.year, end.month, -i)
      const key = `${point.year}-${String(point.month).padStart(2, '0')}`
      const items = allReadings.filter((item) => item.date.startsWith(key))
      points.push({ key, label: monthShort(point.year, point.month), ...avgPair(items) })
    }
    return { title: 'Среднее по месяцам', hint: 'Последние 12 месяцев, среднее за месяц.', points }
  }

  if (period.mode === 'month') {
    const points: ChartPoint[] = []
    const count = daysInMonth(period.year, period.month)
    for (let day = 1; day <= count; day += 1) {
      const key = dayKey(period.year, period.month, day)
      const items = inPeriod.filter((item) => item.date === key)
      points.push({ key, label: String(day), ...avgPair(items) })
    }
    return { title: 'Среднее по дням', hint: 'Среднее верхнее и нижнее за каждый день.', points }
  }

  const range = resolveRange(period, inPeriod)
  const days = eachDayOfInterval({ start: parseISO(range.from), end: parseISO(range.to) })
  return {
    title: 'Среднее по дням',
    hint: 'Среднее верхнее и нижнее за каждый день периода.',
    points: days.map((day) => {
      const key = format(day, 'yyyy-MM-dd')
      const items = inPeriod.filter((item) => item.date === key)
      return { key, label: format(day, 'd.MM'), ...avgPair(items) }
    }),
  }
}

export type DayGroup = { date: string; items: Reading[] }
export type MonthGroup = { month: string; days: DayGroup[] }

export function groupReadings(readings: Reading[]): MonthGroup[] {
  const sorted = [...readings].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
  const months: MonthGroup[] = []
  for (const item of sorted) {
    const month = item.date.slice(0, 7)
    let monthGroup = months.find((group) => group.month === month)
    if (!monthGroup) {
      monthGroup = { month, days: [] }
      months.push(monthGroup)
    }
    let dayGroup = monthGroup.days.find((group) => group.date === item.date)
    if (!dayGroup) {
      dayGroup = { date: item.date, items: [] }
      monthGroup.days.push(dayGroup)
    }
    dayGroup.items.push(item)
  }
  return months
}

export type ListFilter = 'all' | 'high' | 'low' | 'arrhythmia'

export function applyFilter(readings: Reading[], filter: ListFilter, bounds: Bounds): Reading[] {
  if (filter === 'high') return readings.filter((item) => isHigh(item, bounds))
  if (filter === 'low') return readings.filter((item) => isLow(item, bounds) && !isHigh(item, bounds))
  if (filter === 'arrhythmia') return readings.filter((item) => item.arrhythmia)
  return readings
}
