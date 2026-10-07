import type { NextFunction, Request, Response } from 'express'
import { extractInitDataFromAuthHeader, validateInitData } from '../auth/validateInitData'
import { config } from '../config'

declare global {
  namespace Express {
    interface Request {
      telegramUserId?: number
    }
  }
}

/**
 * Requires valid Telegram Mini App initData, unless AUTH_DEV_BYPASS is on.
 * Sets req.telegramUserId from the signed payload (never trust body userId alone).
 */
export function telegramAuth(req: Request, res: Response, next: NextFunction): void {
  const initDataRaw = extractInitDataFromAuthHeader(req.header('authorization'))

  if (!initDataRaw) {
    if (config.authDevBypass) {
      const raw = req.header('x-user-id')?.trim() ?? ''
      if (!/^\d+$/.test(raw)) {
        res.status(401).json({ success: false, error: 'Unauthorized: userId required in dev bypass' })
        return
      }
      const fallback = Number(raw)
      if (!Number.isInteger(fallback) || fallback <= 0) {
        res.status(401).json({ success: false, error: 'Unauthorized: userId required in dev bypass' })
        return
      }
      req.telegramUserId = fallback
      next()
      return
    }
    res.status(401).json({ success: false, error: 'Unauthorized: missing Telegram initData' })
    return
  }

  if (!config.botToken) {
    res.status(503).json({ success: false, error: 'Auth unavailable: BOT_TOKEN not configured' })
    return
  }

  try {
    const validated = validateInitData(initDataRaw, config.botToken, config.initDataMaxAgeSec)
    req.telegramUserId = validated.userId
    next()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid initData'
    res.status(401).json({ success: false, error: `Unauthorized: ${message}` })
  }
}
