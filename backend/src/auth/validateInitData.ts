import { createHmac, timingSafeEqual } from 'node:crypto'

export type ValidatedInitData = {
  userId: number
  authDate: number
  username?: string
}

/**
 * Validates Telegram Mini App initData per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(
  initDataRaw: string,
  botToken: string,
  maxAgeSec: number,
): ValidatedInitData {
  const params = new URLSearchParams(initDataRaw)
  const hash = params.get('hash')
  if (!hash) throw new Error('initData missing hash')

  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort((a, b) => a.localeCompare(b))
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const hashBuf = Buffer.from(hash, 'hex')
  const computedBuf = Buffer.from(computed, 'hex')
  if (hashBuf.length !== computedBuf.length || !timingSafeEqual(hashBuf, computedBuf)) {
    throw new Error('initData hash mismatch')
  }

  const authDate = Number(params.get('auth_date'))
  if (!Number.isFinite(authDate)) throw new Error('initData missing auth_date')

  const age = Math.floor(Date.now() / 1000) - authDate
  if (age > maxAgeSec) throw new Error(`initData expired (age=${age}s max=${maxAgeSec}s)`)
  if (age < -60) throw new Error('initData auth_date is in the future')

  const userRaw = params.get('user')
  if (!userRaw) throw new Error('initData missing user')

  let user: { id?: number; username?: string }
  try {
    user = JSON.parse(userRaw) as { id?: number; username?: string }
  } catch {
    throw new Error('initData user is not valid JSON')
  }
  if (!Number.isFinite(user.id)) throw new Error('initData user.id missing')

  const result: ValidatedInitData = {
    userId: Number(user.id),
    authDate,
  }
  if (user.username) result.username = user.username
  return result
}

/** Parse `Authorization: tma <initData>` or `Bearer tma <initData>`. */
export function extractInitDataFromAuthHeader(header: string | undefined): string | null {
  if (!header) return null
  const trimmed = header.trim()
  if (trimmed.toLowerCase().startsWith('tma ')) return trimmed.slice(4).trim() || null
  if (trimmed.toLowerCase().startsWith('bearer tma ')) {
    return trimmed.slice('bearer tma '.length).trim() || null
  }
  return null
}
