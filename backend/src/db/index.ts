import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { config } from '../config'
import { runMigrations } from './migrate'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) throw new Error('Database is not initialized. Call initDb() first.')
  return db
}

export function initDb(databasePath = config.databasePath): Database.Database {
  const dir = path.dirname(databasePath)
  fs.mkdirSync(dir, { recursive: true })
  db = new Database(databasePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  console.log(`[db] ready ${databasePath}`)
  return db
}

export function closeDb(): void {
  if (!db) return
  db.close()
  db = null
}
