import type { Request, Response } from 'express'
import { Router } from 'express'
import { HttpError, parseReadingInput } from '../domain'
import { deleteReading, listReadings, upsertReading } from '../db/readingsRepo'
import { telegramAuth } from '../middleware/telegramAuth'

export const readingsRouter = Router()

readingsRouter.use(telegramAuth)

function userId(req: Request, res: Response): number | null {
  if (req.telegramUserId == null) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return null
  }
  return req.telegramUserId
}

readingsRouter.get('/', (req, res) => {
  const id = userId(req, res)
  if (id == null) return
  res.json({ success: true, readings: listReadings(id) })
})

readingsRouter.post('/', (req, res) => {
  const id = userId(req, res)
  if (id == null) return
  try {
    const reading = upsertReading(id, parseReadingInput(req.body))
    res.json({ success: true, reading })
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ success: false, error: error.message })
      return
    }
    throw error
  }
})

readingsRouter.delete('/:id', (req, res) => {
  const id = userId(req, res)
  if (id == null) return
  try {
    const rawId = req.params.id
    deleteReading(id, (Array.isArray(rawId) ? rawId[0] : rawId) ?? '')
    res.json({ success: true })
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ success: false, error: error.message })
      return
    }
    throw error
  }
})
