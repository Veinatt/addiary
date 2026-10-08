import type { Request, Response } from 'express'
import { Router } from 'express'
import { HttpError, parseUserSettings } from '../domain'
import { getOrCreateSettings, saveSettings } from '../db/settingsRepo'
import { telegramAuth } from '../middleware/telegramAuth'

export const settingsRouter = Router()

settingsRouter.use(telegramAuth)

function userId(req: Request, res: Response): number | null {
  if (req.telegramUserId == null) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return null
  }
  return req.telegramUserId
}

settingsRouter.get('/', (req, res) => {
  const id = userId(req, res)
  if (id == null) return
  res.json({ success: true, settings: getOrCreateSettings(id) })
})

settingsRouter.put('/', (req, res) => {
  const id = userId(req, res)
  if (id == null) return
  try {
    const settings = saveSettings(id, parseUserSettings(req.body))
    res.json({ success: true, settings })
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ success: false, error: error.message })
      return
    }
    throw error
  }
})
