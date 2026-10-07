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
  const url = `${publicApiBase(req)}/api/download/${encodeURIComponent(token)}`
  res.json({ success: true, url, fileName })
})

downloadRouter.get('/:token', async (req: Request, res: Response) => {
  const tokenParam = req.params.token
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam
  const payload = verifyDownloadToken(token ?? '')
  if (!payload) {
    res.status(401).json({ success: false, error: 'Ссылка устарела' })
    return
  }
  const readings = listReadingsBetween(payload.userId, payload.from, payload.to)
  const bounds = getOrCreateSettings(payload.userId)
  const pdf = await buildDiaryPdf({ readings, bounds, from: payload.from, to: payload.to })
  const fileName = `dnevnik-${payload.from}_${payload.to}.pdf`
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition')
  res.send(pdf)
})
