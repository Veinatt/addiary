import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'
import { TZ } from '../domain'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export function dateKeyFromIso(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, 'yyyy-MM-dd')
}

export function timeLabelFromIso(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, 'HH:mm')
}

export function shortDateFromIso(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, 'dd.MM.yyyy')
}

export function assertDayKey(value: string): string {
  if (!DAY_RE.test(value)) {
    throw new Error('bad day')
  }
  const parsed = parseISO(value)
  if (Number.isNaN(parsed.getTime())) throw new Error('bad day')
  return value
}

export function periodLabel(from: string, to: string): string {
  const start = parseISO(from)
  const end = parseISO(to)
  if (from === to) return format(start, 'd MMMM yyyy', { locale: ru })
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${format(start, 'd', { locale: ru })}–${format(end, 'd MMMM yyyy', { locale: ru })}`
  }
  return `${format(start, 'd MMMM yyyy', { locale: ru })} — ${format(end, 'd MMMM yyyy', { locale: ru })}`
}
