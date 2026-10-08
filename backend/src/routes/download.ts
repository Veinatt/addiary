import type { Request, Response } from 'express'
import { Router } from 'express'
import { config } from '../config'
import { listReadingsBetween } from '../db/readingsRepo'
import { getOrCreateSettings } from '../db/settingsRepo'
import { telegramAuth } from '../middleware/telegramAuth'
import { buildDiaryPdf } from '../services/pdfDiary'
import { assertDayKey } from '../utils/dates'
import { createDownloadToken, verifyDownloadToken } from '../utils/downloadToken'

export const downloadRouter = Router()

function publicApiBase(req: Request): string {
  if (config.publicApiUrl) return config.publicApiUrl
  const proto = (req.get('x-forwarded-proto') ?? req.protocol).split(',')[0]?.trim()
  const host = (req.get('x-forwarded-host') ?? req.get('host') ?? '').split(',')[0]?.trim()
  return `${proto}://${host}`
}

function setPdfHeaders(res: Response, fileName: string, byteLength: number): void {
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  res.setHeader('Content-Length', String(byteLength))
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition')
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
  const token = createDownloadToken({ userId, from, to })
  const fileName = `dnevnik-${from}_${to}.pdf`
  // Query string (same as NasTask) — path tokens with `.` often break Telegram downloadFile.
  const url = `${publicApiBase(req)}/api/download/file?token=${encodeURIComponent(token)}`
  res.json({ success: true, url, fileName })
})

downloadRouter.get('/file', async (req: Request, res: Response) => {
  try {
    const raw = req.query.token
    const token = typeof raw === 'string' ? raw : ''
    const payload = verifyDownloadToken(token)
    if (!payload) {
      res.status(401).json({ success: false, error: 'Ссылка устарела' })
      return
    }
    const readings = listReadingsBetween(payload.userId, payload.from, payload.to)
    const bounds = getOrCreateSettings(payload.userId)
    const pdf = await buildDiaryPdf({ readings, bounds, from: payload.from, to: payload.to })
    const fileName = `dnevnik-${payload.from}_${payload.to}.pdf`
    setPdfHeaders(res, fileName, pdf.length)
    res.end(pdf)
  } catch (error) {
    console.error('[api:download] file failed', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})
