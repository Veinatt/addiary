import { DEFAULT_BOUNDS, type Bounds } from '../domain'
import { getDb } from './index'

type SettingsRow = Bounds & { userId: number; updatedAt: string }

export function getOrCreateSettings(userId: number): Bounds {
  const row = getDb()
    .prepare(`SELECT * FROM user_settings WHERE userId = ?`)
    .get(userId) as SettingsRow | undefined
  if (row) {
    return {
      sysMin: row.sysMin,
      sysMax: row.sysMax,
      diaMin: row.diaMin,
      diaMax: row.diaMax,
      pulseMin: row.pulseMin,
      pulseMax: row.pulseMax,
    }
  }
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO user_settings (
        userId, sysMin, sysMax, diaMin, diaMax, pulseMin, pulseMax, updatedAt
      ) VALUES (
        @userId, @sysMin, @sysMax, @diaMin, @diaMax, @pulseMin, @pulseMax, @updatedAt
      )`,
    )
    .run({ userId, ...DEFAULT_BOUNDS, updatedAt: now })
  return { ...DEFAULT_BOUNDS }
}

export function saveSettings(userId: number, bounds: Bounds): Bounds {
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO user_settings (
        userId, sysMin, sysMax, diaMin, diaMax, pulseMin, pulseMax, updatedAt
      ) VALUES (
        @userId, @sysMin, @sysMax, @diaMin, @diaMax, @pulseMin, @pulseMax, @updatedAt
      )
      ON CONFLICT(userId) DO UPDATE SET
        sysMin = excluded.sysMin,
        sysMax = excluded.sysMax,
        diaMin = excluded.diaMin,
        diaMax = excluded.diaMax,
        pulseMin = excluded.pulseMin,
        pulseMax = excluded.pulseMax,
        updatedAt = excluded.updatedAt`,
    )
    .run({ userId, ...bounds, updatedAt: now })
  return bounds
}
