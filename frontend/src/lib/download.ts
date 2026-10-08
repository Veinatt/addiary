import { useEffect } from 'react'
import { ApiError } from '@/api/client'
import { API_BASE_URL } from '@/api/client'

type TelegramWebApp = {
  platform?: string
  initData?: string
  downloadFile?: (
    params: { url: string; file_name: string },
    callback?: (accepted: boolean) => void,
  ) => void
  openLink?: (url: string) => void
  showAlert?: (message: string) => void
}

export type DownloadPdfResult = { via: 'telegram' | 'browser' }

function telegramWebApp(): TelegramWebApp | null {
  return (
    (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null
  )
}

function isTelegramMiniApp(): boolean {
  const tg = telegramWebApp()
  if (!tg) return false
  const platform = tg.platform?.trim()
  if (platform && platform !== 'unknown') return true
  return Boolean(tg.initData?.trim())
}

async function saveBlobDownload(url: string, fileName: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Не удалось скачать файл')
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** In Telegram, send PDF to the bot chat — downloadFile was saving error bodies as TXT. */
export async function downloadPdf(from: string, to: string): Promise<DownloadPdfResult> {
  const { apiFetch } = await import('@/api/client')
  const tg = telegramWebApp()

  if (isTelegramMiniApp()) {
    await apiFetch<{ via: string; fileName: string }>('/api/download/send', {
      method: 'POST',
      body: JSON.stringify({ from, to }),
    })
    tg?.showAlert?.('PDF отправлен в чат с ботом')
    return { via: 'telegram' }
  }

  const result = await apiFetch<{ url: string; fileName: string }>('/api/download/token', {
    method: 'POST',
    body: JSON.stringify({ from, to }),
  })
  if (!result.url || !result.fileName) throw new ApiError('Не удалось получить ссылку', 500)
  const url = result.url.startsWith('http') ? result.url : `${API_BASE_URL}${result.url}`
  try {
    await saveBlobDownload(url, result.fileName)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  return { via: 'browser' }
}

export function useTelegramChrome(): void {
  useEffect(() => {
    const tg = (
      window as unknown as { Telegram?: { WebApp?: { ready?: () => void; expand?: () => void } } }
    ).Telegram?.WebApp
    tg?.ready?.()
    tg?.expand?.()
  }, [])
}
