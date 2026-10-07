import type Database from 'better-sqlite3'

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      measuredAt TEXT NOT NULL,
      date TEXT NOT NULL,
      systolic INTEGER NOT NULL,
      diastolic INTEGER NOT NULL,
      pulse INTEGER NOT NULL,
      arrhythmia INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_readings_user_date ON readings(userId, date);
    CREATE INDEX IF NOT EXISTS idx_readings_user_measured ON readings(userId, measuredAt);

    CREATE TABLE IF NOT EXISTS user_settings (
      userId INTEGER PRIMARY KEY,
      sysMin INTEGER NOT NULL,
      sysMax INTEGER NOT NULL,
      diaMin INTEGER NOT NULL,
      diaMax INTEGER NOT NULL,
      pulseMin INTEGER NOT NULL,
      pulseMax INTEGER NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `)
}
