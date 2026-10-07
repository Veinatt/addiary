import { initData, retrieveRawInitData, restoreInitData } from '@telegram-apps/sdk-react'

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:5001'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function readNativeInitData(): string | null {
  try {
    const raw = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram
      ?.WebApp?.initData
    if (raw && String(raw).trim()) return String(raw)
  } catch {
    /* ignore */
  }
  return null
}

function getTelegramInitDataRaw(): string | null {
  try {
    restoreInitData()
  } catch {
    /* ignore */
  }
  try {
    const fromSdk = typeof initData.raw === 'function' ? initData.raw() : null
    if (fromSdk && String(fromSdk).trim()) return String(fromSdk)
  } catch {
    /* ignore */
  }
  try {
    const retrieved = retrieveRawInitData()
    if (retrieved && String(retrieved).trim()) return String(retrieved)
  } catch {
    /* ignore */
  }
  return readNativeInitData()
}

function devUserId(): string | null {
  if (!import.meta.env.DEV) return null
  const id = Number(import.meta.env.VITE_DEV_USER_ID)
  if (!Number.isFinite(id)) return null
  return String(id)
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const raw = getTelegramInitDataRaw()
  if (raw) headers.set('Authorization', `tma ${raw}`)
  else {
    const userId = devUserId()
    if (userId) headers.set('X-User-Id', userId)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError('Нет связи с сервером', 0)
  }

  const text = await response.text()
  const data = text ? (JSON.parse(text) as T & { success?: boolean; error?: string }) : ({} as T)
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Ошибка сервера'
    throw new ApiError(message, response.status)
  }
  return data
}
