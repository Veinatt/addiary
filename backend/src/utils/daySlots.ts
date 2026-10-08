import type { DaySlot, Reading, UserSettings } from '../domain'
import { DEFAULT_MORNING_END, DEFAULT_MORNING_START } from '../domain'
import { timeLabelFromIso } from './dates'

export type DayRow = {
  date: string
  morning: Reading | null
  evening: Reading | null
  note: string
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function normalizeWindow(settings: Pick<UserSettings, 'morningStart' | 'morningEnd'>): {
  start: string
  end: string
} {
  return {
    start: settings.morningStart?.trim() || DEFAULT_MORNING_START,
    end: settings.morningEnd?.trim() || DEFAULT_MORNING_END,
  }
}

/** Morning is [start, end). */
export function slotForTime(
  hhmm: string,
  settings: Pick<UserSettings, 'morningStart' | 'morningEnd'>,
): DaySlot {
  const { start, end } = normalizeWindow(settings)
  const t = minutes(hhmm)
  const a = minutes(start)
  const b = minutes(end)
  if (a < b) return t >= a && t < b ? 'morning' : 'evening'
  return t >= a || t < b ? 'morning' : 'evening'
}

export function slotForReading(
  reading: Pick<Reading, 'measuredAt'>,
  settings: Pick<UserSettings, 'morningStart' | 'morningEnd'>,
): DaySlot {
  return slotForTime(timeLabelFromIso(reading.measuredAt), settings)
}

/** All day notes as «текст (ЧЧ:ММ)», without morning/evening labels. */
export function composeDayNotes(items: Reading[]): string {
  return items
    .slice()
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
    .filter((item) => item.note.trim())
    .map((item) => `${item.note.trim()} (${timeLabelFromIso(item.measuredAt)})`)
    .join('\n')
}

/** Average numeric fields; arrhythmia if any. Notes live on the day row, not the slot. */
export function averageSlotReadings(items: Reading[]): Reading | null {
  if (items.length === 0) return null
  const ordered = [...items].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
  if (ordered.length === 1) return ordered[0] ?? null
  const n = ordered.length
  const first = ordered[0]!
  const last = ordered[n - 1]!
  return {
    id: `${first.date}-avg-${first.id}`,
    userId: first.userId,
    measuredAt: last.measuredAt,
    date: first.date,
    systolic: Math.round(ordered.reduce((sum, item) => sum + item.systolic, 0) / n),
    diastolic: Math.round(ordered.reduce((sum, item) => sum + item.diastolic, 0) / n),
    pulse: Math.round(ordered.reduce((sum, item) => sum + item.pulse, 0) / n),
    arrhythmia: ordered.some((item) => item.arrhythmia),
    note: '',
    createdAt: first.createdAt,
    updatedAt: last.updatedAt,
  }
}

/** Group by day; within each slot take the average of all measurements. */
export function groupReadingsByDay(
  readings: Reading[],
  settings: Pick<UserSettings, 'morningStart' | 'morningEnd'>,
): DayRow[] {
  const byDate = new Map<string, { morning: Reading[]; evening: Reading[]; all: Reading[] }>()
  const ordered = [...readings].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
  for (const reading of ordered) {
    const bucket = byDate.get(reading.date) ?? { morning: [], evening: [], all: [] }
    const slot = slotForReading(reading, settings)
    if (slot === 'morning') bucket.morning.push(reading)
    else bucket.evening.push(reading)
    bucket.all.push(reading)
    byDate.set(reading.date, bucket)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, slots]) => ({
      date,
      morning: averageSlotReadings(slots.morning),
      evening: averageSlotReadings(slots.evening),
      note: composeDayNotes(slots.all),
    }))
}
