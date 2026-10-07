import type { Reading } from '@/domain'
import { dayKey, daysInMonth, todayKey } from '@/lib/dates'

export type PeriodMode = 'all' | 'month' | 'day' | 'range'

export type PeriodValue = {
  mode: PeriodMode
  year: number
  month: number
  day: string
  rangeFrom: string | null
  rangeTo: string | null
}

export function initialPeriod(): PeriodValue {
  const today = todayKey()
  const [year, month] = today.split('-').map(Number)
  return {
    mode: 'all',
    year: year ?? 2026,
    month: month ?? 1,
    day: today,
    rangeFrom: null,
    rangeTo: null,
  }
}

export function resolveRange(period: PeriodValue, readings: Reading[]): { from: string; to: string } {
  const today = todayKey()
  if (period.mode === 'all') {
    if (readings.length === 0) return { from: today, to: today }
    const dates = readings.map((item) => item.date).sort()
    return { from: dates[0] ?? today, to: dates[dates.length - 1] ?? today }
  }
  if (period.mode === 'month') {
    const last = daysInMonth(period.year, period.month)
    return {
      from: dayKey(period.year, period.month, 1),
      to: dayKey(period.year, period.month, last),
    }
  }
  if (period.mode === 'day') return { from: period.day, to: period.day }
  const start = period.rangeFrom
  const end = period.rangeTo
  if (!start && !end) return { from: today, to: today }
  if (start && !end) return { from: start, to: start }
  if (!start && end) return { from: end, to: end }
  if (!start || !end) return { from: today, to: today }
  return start <= end ? { from: start, to: end } : { from: end, to: start }
}

export function readingsInPeriod(readings: Reading[], period: PeriodValue): Reading[] {
  const { from, to } = resolveRange(period, readings)
  return readings.filter((item) => item.date >= from && item.date <= to)
}
