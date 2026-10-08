import type { Request, Response } from 'express'
import { Router } from 'express'
import { config } from '../config'
import { createDownloadTicket, getDownloadTicket } from '../db/downloadTicketsRepo'
import { listReadings, listReadingsBetween } from '../db/readingsRepo'
import { getOrCreateSettings } from '../db/settingsRepo'
import { telegramAuth } from '../middleware/telegramAuth'
import { buildDiaryPdf } from '../services/pdfDiary'
import { sendDocumentToUser } from '../services/telegramSend'
import { assertDayKey, diaryPdfCaption, diaryPdfFileName } from '../utils/dates'

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

function parsePeriod(body: { from?: unknown; to?: unknown }): { from: string; to: string } | null {
  try {
    const from = assertDayKey(String(body.from ?? ''))
    const to = assertDayKey(String(body.to ?? ''))
    if (from > to) return null
    return { from, to }
  } catch {
    return null
  }
}

async function buildPdfForUser(userId: number, from: string, to: string): Promise<{ pdf: Buffer; fileName: string }> {
  const readings = listReadingsBetween(userId, from, to)
  const total = listReadings(userId).length
  console.log(
    `[api:download] build userId=${userId} from=${from} to=${to} matched=${readings.length} total=${total}`,
  )
  const bounds = getOrCreateSettings(userId)
  const pdf = await buildDiaryPdf({ readings, bounds, from, to })
  return { pdf, fileName: diaryPdfFileName(from, to) }
}

/** Reliable path for Mini Apps: PDF arrives in the bot chat (Open works). */
downloadRouter.post('/send', telegramAuth, async (req, res) => {
  const userId = req.telegramUserId
  if (userId == null) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }
  const period = parsePeriod((req.body ?? {}) as { from?: unknown; to?: unknown })
  if (!period) {
    res.status(400).json({ success: false, error: 'Укажите период' })
    return
  }
  try {
    const { pdf, fileName } = await buildPdfForUser(userId, period.from, period.to)
    await sendDocumentToUser({
      userId,
      fileName,
      bytes: pdf,
      caption: diaryPdfCaption(period.from, period.to),
    })
    console.log(`[api:download] sent userId=${userId} file=${fileName} bytes=${pdf.length}`)
    res.json({ success: true, via: 'telegram', fileName })
  } catch (error) {
    console.error('[api:download] send failed', error)
    const message = error instanceof Error ? error.message : 'Не удалось отправить PDF'
    res.status(500).json({ success: false, error: message })
  }
})

downloadRouter.post('/token', telegramAuth, (req, res) => {
  const userId = req.telegramUserId
  if (userId == null) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }
  const period = parsePeriod((req.body ?? {}) as { from?: unknown; to?: unknown })
  if (!period) {
    res.status(400).json({ success: false, error: 'Укажите период' })
    return
  }

  const fileName = diaryPdfFileName(period.from, period.to)
  const ticket = createDownloadTicket({
    userId,
    fromDay: period.from,
    toDay: period.to,
    fileName,
  })
  // `.pdf` in the path helps clients pick the right type; short id avoids token truncation.
  const url = `${publicApiBase(req)}/api/download/file/${encodeURIComponent(ticket.id)}.pdf`
  console.log(`[api:download] ticket userId=${userId} file=${fileName} id=${ticket.id}`)
  res.json({ success: true, url, fileName })
})

downloadRouter.options('/file/:id', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://web.telegram.org')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.status(204).end()
})

async function serveTicketPdf(req: Request, res: Response, rawId: string): Promise<void> {
  try {
    const id = rawId.replace(/\.pdf$/i, '').trim()
    const ticket = id ? getDownloadTicket(id) : null
    if (!ticket) {
      console.warn(`[api:download] missing/expired ticket id=${id || '(empty)'}`)
      res.status(401).type('text/plain').send('Download link expired')
      return
    }

    const { pdf, fileName } = await buildPdfForUser(ticket.userId, ticket.fromDay, ticket.toDay)
    console.log(`[api:download] file userId=${ticket.userId} file=${fileName} bytes=${pdf.length}`)
    setPdfHeaders(res, ticket.fileName || fileName, pdf.length)
    res.end(pdf)
  } catch (error) {
    console.error('[api:download] file failed', error)
    res.status(500).type('text/plain').send('Internal server error')
  }
}

downloadRouter.get('/file/:id', async (req, res) => {
  await serveTicketPdf(req, res, String(req.params.id ?? ''))
})

downloadRouter.get('/file', async (req, res) => {
  const raw = req.query.id
  await serveTicketPdf(req, res, typeof raw === 'string' ? raw : '')
})
