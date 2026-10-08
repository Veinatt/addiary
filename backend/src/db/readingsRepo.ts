import { dateKeyFromIso } from '../utils/dates'
import type { Reading, ReadingInput } from '../domain'
import { HttpError } from '../domain'
import { getDb } from './index'

type ReadingRow = {
  id: string
  userId: number
  measuredAt: string
  date: string
  systolic: number
  diastolic: number
  pulse: number
  arrhythmia: number
  note: string
  createdAt: string
  updatedAt: string
}

function toReading(row: ReadingRow): Reading {
  return {
    id: row.id,
    userId: row.userId,
    measuredAt: row.measuredAt,
    date: row.date,
    systolic: row.systolic,
    diastolic: row.diastolic,
    pulse: row.pulse,
    arrhythmia: row.arrhythmia === 1,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function listReadings(userId: number): Reading[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM readings WHERE userId = ? ORDER BY measuredAt DESC`,
    )
    .all(userId) as ReadingRow[]
  return rows.map(toReading)
}

export function listReadingsBetween(userId: number, from: string, to: string): Reading[] {
  // Filter by Minsk day of measuredAt (same as UI date/time columns), not only the
  // stored `date` column — that can lag after restores or older writes.
  return listReadings(userId)
    .filter((reading) => {
      const key = dateKeyFromIso(reading.measuredAt)
      return key >= from && key <= to
    })
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
}

function getRow(id: string): ReadingRow | undefined {
  return getDb().prepare(`SELECT * FROM readings WHERE id = ?`).get(id) as ReadingRow | undefined
}

export function upsertReading(userId: number, input: ReadingInput): Reading {
  const existing = getRow(input.id)
  if (existing && existing.userId !== userId) {
    throw new HttpError(403, 'Forbidden')
  }
  const now = new Date().toISOString()
  const row: ReadingRow = {
    id: input.id,
    userId,
    measuredAt: input.measuredAt,
    date: dateKeyFromIso(input.measuredAt),
    systolic: input.systolic,
    diastolic: input.diastolic,
    pulse: input.pulse,
    arrhythmia: input.arrhythmia ? 1 : 0,
    note: input.note,
    createdAt: existing?.createdAt ?? input.createdAt ?? now,
    updatedAt: now,
  }
  getDb()
    .prepare(
      `INSERT INTO readings (
        id, userId, measuredAt, date, systolic, diastolic, pulse, arrhythmia, note, createdAt, updatedAt
      ) VALUES (
        @id, @userId, @measuredAt, @date, @systolic, @diastolic, @pulse, @arrhythmia, @note, @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        measuredAt = excluded.measuredAt,
        date = excluded.date,
        systolic = excluded.systolic,
        diastolic = excluded.diastolic,
        pulse = excluded.pulse,
        arrhythmia = excluded.arrhythmia,
        note = excluded.note,
        updatedAt = excluded.updatedAt`,
    )
    .run(row)
  return toReading(row)
}

export function deleteReading(userId: number, id: string): void {
  const existing = getRow(id)
  if (!existing) return
  if (existing.userId !== userId) throw new HttpError(403, 'Forbidden')
  getDb().prepare(`DELETE FROM readings WHERE id = ? AND userId = ?`).run(id, userId)
}
