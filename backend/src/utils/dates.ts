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

/** Display date for filenames: 08.10.2026 */
export function formatDayDot(dayKey: string): string {
  return format(parseISO(dayKey), 'dd.MM.yyyy')
}

/** PDF attachment name: one day → dnevnik-08.10.2026.pdf; range → dnevnik-01.10.2026-31.10.2026.pdf */
export function diaryPdfFileName(from: string, to: string): string {
  if (from === to) return `dnevnik-${formatDayDot(from)}.pdf`
  return `dnevnik-${formatDayDot(from)}-${formatDayDot(to)}.pdf`
}

export function diaryPdfCaption(from: string, to: string): string {
  if (from === to) return `Дневник ${formatDayDot(from)}`
  return `Дневник ${formatDayDot(from)} — ${formatDayDot(to)}`
}
