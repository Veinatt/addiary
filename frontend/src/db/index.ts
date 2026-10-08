import Dexie, { type EntityTable } from 'dexie'
import type { Reading, UserSettings } from '@/domain'

export type PendingKind = 'upsert-reading' | 'delete-reading' | 'save-settings'

export type PendingOp = {
  id: string
  kind: PendingKind
  entityId: string
  createdAt: string
}

export type SettingsRow = {
  id: 'local'
  /** Full user settings (bounds + morning window). */
  bounds: UserSettings
}

class DnevnikDB extends Dexie {
  readings!: EntityTable<Reading, 'id'>
  settings!: EntityTable<SettingsRow, 'id'>
  pendingOps!: EntityTable<PendingOp, 'id'>

  constructor() {
    super('dnevnik')
    this.version(1).stores({
      readings: 'id, date, measuredAt',
      settings: 'id',
      pendingOps: 'id, entityId, createdAt',
    })
  }
}

export const db = new DnevnikDB()
