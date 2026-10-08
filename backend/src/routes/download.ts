import type { Request, Response } from 'express'
import { Router } from 'express'
import { config } from '../config'
import { createDownloadTicket, getDownloadTicket } from '../db/downloadTicketsRepo'
import { listReadingsBetween } from '../db/readingsRepo'
import { getOrCreateSettings } from '../db/settingsRepo'
import { telegramAuth } from '../middleware/telegramAuth'
import { buildDiaryPdf } from '../services/pdfDiary'
import { assertDayKey } from '../utils/dates'

export const downloadRouter = Router()

function publicApiBase(req: Request): string {
  if (config.publicApiUrl) return config.publicApiUrl
  const proto = (req.get('x-forwarded-proto') ?? req.protocol).split(',')[0]?.trim()
  const host = (req.get('x-forwarded-host') ?? req.get('host') ?? '').split(',')[0]?.trim()
  return `${proto}://${host}`
}

function setPdfHeaders(res: Response, fileName: string, byteLength: number): void {
  // Telegram downloadFile: Content-Disposition must match file_name; ACAO for web.telegram.org
  const disposition = `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', disposition)
  res.setHeader('Content-Length', String(byteLength))
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length')
  res.setHeader('Access-Control-Allow-Origin', 'https://web.telegram.org')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Cache-Control', 'no-store')
}

downloadRouter.post('/token', telegramAuth, (req, res) => {
  const userId = req.telegramUserId
  if (userId == null) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }
  const body = (req.body ?? {}) as { from?: unknown; to?: unknown }
  let from: string
  let to: string
  try {
    from = assertDayKey(String(body.from ?? ''))
    to = assertDayKey(String(body.to ?? ''))
  } catch {
    res.status(400).json({ success: false, error: 'Укажите период' })
    return
  }
  if (from > to) {
    res.status(400).json({ success: false, error: 'Начало периода позже конца' })
    return
  }

  const fileName = `dnevnik-${from}_${to}.pdf`
  const ticket = createDownloadTicket({ userId, fromDay: from, toDay: to, fileName })
  // Short opaque id — long HMAC tokens in the URL often fail inside Telegram downloadFile.
  const url = `${publicApiBase(req)}/api/download/file?id=${encodeURIComponent(ticket.id)}`
  console.log(`[api:download] ticket userId=${userId} file=${fileName} id=${ticket.id}`)
  res.json({ success: true, url, fileName })
})

downloadRouter.options('/file', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://web.telegram.org')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.status(204).end()
})

downloadRouter.get('/file', async (req: Request, res: Response) => {
  try {
    const raw = req.query.id
    const id = typeof raw === 'string' ? raw.trim() : ''
    const ticket = id ? getDownloadTicket(id) : null
    if (!ticket) {
      console.warn(`[api:download] missing/expired ticket id=${id || '(empty)'}`)
      res.status(401).type('text/plain').send('Download link expired')
      return
    }

    const readings = listReadingsBetween(ticket.userId, ticket.fromDay, ticket.toDay)
    const bounds = getOrCreateSettings(ticket.userId)
    const pdf = await buildDiaryPdf({
      readings,
      bounds,
      from: ticket.fromDay,
      to: ticket.toDay,
    })
    console.log(
      `[api:download] file userId=${ticket.userId} file=${ticket.fileName} bytes=${pdf.length}`,
    )
    setPdfHeaders(res, ticket.fileName, pdf.length)
    res.end(pdf)
  } catch (error) {
    console.error('[api:download] file failed', error)
    res.status(500).type('text/plain').send('Internal server error')
  }
})
