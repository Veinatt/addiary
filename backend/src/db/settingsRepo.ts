import {
  DEFAULT_MORNING_END,
  DEFAULT_MORNING_START,
  DEFAULT_SETTINGS,
  type UserSettings,
} from '../domain'
import { getDb } from './index'

type SettingsRow = UserSettings & { userId: number; updatedAt: string }

function toSettings(row: SettingsRow): UserSettings {
  return {
    sysMin: row.sysMin,
    sysMax: row.sysMax,
    diaMin: row.diaMin,
    diaMax: row.diaMax,
    pulseMin: row.pulseMin,
    pulseMax: row.pulseMax,
    morningStart: row.morningStart?.trim() || DEFAULT_MORNING_START,
    morningEnd: row.morningEnd?.trim() || DEFAULT_MORNING_END,
  }
}

export function getOrCreateSettings(userId: number): UserSettings {
  const row = getDb()
    .prepare(`SELECT * FROM user_settings WHERE userId = ?`)
    .get(userId) as SettingsRow | undefined
  if (row) return toSettings(row)
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO user_settings (
        userId, sysMin, sysMax, diaMin, diaMax, pulseMin, pulseMax,
        morningStart, morningEnd, updatedAt
      ) VALUES (
        @userId, @sysMin, @sysMax, @diaMin, @diaMax, @pulseMin, @pulseMax,
        @morningStart, @morningEnd, @updatedAt
      )`,
    )
    .run({ userId, ...DEFAULT_SETTINGS, updatedAt: now })
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(userId: number, settings: UserSettings): UserSettings {
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO user_settings (
        userId, sysMin, sysMax, diaMin, diaMax, pulseMin, pulseMax,
        morningStart, morningEnd, updatedAt
      ) VALUES (
        @userId, @sysMin, @sysMax, @diaMin, @diaMax, @pulseMin, @pulseMax,
        @morningStart, @morningEnd, @updatedAt
      )
      ON CONFLICT(userId) DO UPDATE SET
        sysMin = excluded.sysMin,
        sysMax = excluded.sysMax,
        diaMin = excluded.diaMin,
        diaMax = excluded.diaMax,
        pulseMin = excluded.pulseMin,
        pulseMax = excluded.pulseMax,
        morningStart = excluded.morningStart,
        morningEnd = excluded.morningEnd,
        updatedAt = excluded.updatedAt`,
    )
    .run({ userId, ...settings, updatedAt: now })
  return settings
}
