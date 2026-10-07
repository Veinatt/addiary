import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { TZ } from '@/domain'

export function minskNow(): { date: string; time: string } {
  const now = new Date()
  return {
    date: formatInTimeZone(now, TZ, 'yyyy-MM-dd'),
    time: formatInTimeZone(now, TZ, 'HH:mm'),
  }
}

export function todayKey(): string {
  return formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')
}

export function minskDateTimeToIso(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error('Укажите дату и время')
  }
  const utc = fromZonedTime(`${date}T${time}:00`, TZ)
  if (Number.isNaN(utc.getTime())) throw new Error('Укажите дату и время')
  return utc.toISOString()
}

export function splitMinsk(iso: string): { date: string; time: string } {
  const date = new Date(iso)
  return {
    date: formatInTimeZone(date, TZ, 'yyyy-MM-dd'),
    time: formatInTimeZone(date, TZ, 'HH:mm'),
  }
}

export function shortDate(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, 'dd.MM')
}

export function clock(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, 'HH:mm')
}

export function monthTitle(year: number, month: number): string {
  const label = format(new Date(year, month - 1, 1), 'LLLL yyyy', { locale: ru })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function monthShort(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), 'LLL', { locale: ru }).replace('.', '').slice(0, 3)
}

export function dayTitle(date: string): string {
  const label = format(parseISO(date), 'EEEE, d MMMM', { locale: ru })
  return label.charAt(0).toUpperCase() + label.slice(1)
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

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta
  const nextYear = Math.floor(index / 12)
  const nextMonth = index - nextYear * 12
  return { year: nextYear, month: nextMonth + 1 }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
