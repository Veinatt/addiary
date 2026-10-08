import crypto from 'node:crypto'
import { getDb } from './index'

const TTL_MS = 5 * 60 * 1000

export type DownloadTicket = {
  id: string
  userId: number
  fromDay: string
  toDay: string
  fileName: string
  exp: number
}

function purgeExpired(): void {
  getDb().prepare(`DELETE FROM download_tickets WHERE exp < ?`).run(Date.now())
}

export function createDownloadTicket(input: {
  userId: number
  fromDay: string
  toDay: string
  fileName: string
}): DownloadTicket {
  purgeExpired()
  const ticket: DownloadTicket = {
    id: crypto.randomUUID(),
    userId: input.userId,
    fromDay: input.fromDay,
    toDay: input.toDay,
    fileName: input.fileName,
    exp: Date.now() + TTL_MS,
  }
  getDb()
    .prepare(
      `INSERT INTO download_tickets (id, userId, fromDay, toDay, fileName, exp)
       VALUES (@id, @userId, @fromDay, @toDay, @fileName, @exp)`,
    )
    .run(ticket)
  return ticket
}

/** Read a ticket without consuming it (Telegram may probe the URL more than once). */
export function getDownloadTicket(id: string): DownloadTicket | null {
  purgeExpired()
  const row = getDb()
    .prepare(`SELECT id, userId, fromDay, toDay, fileName, exp FROM download_tickets WHERE id = ?`)
    .get(id) as DownloadTicket | undefined
  if (!row) return null
  if (row.exp < Date.now()) return null
  return row
}
