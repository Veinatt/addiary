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
}

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

function nativeDownload(url: string, fileName: string): Promise<boolean> {
  const tg = telegramWebApp()
  if (!tg?.downloadFile) return Promise.resolve(false)
  return new Promise((resolve) => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      resolve(false)
    }, 5000)
    try {
      tg.downloadFile!({ url, file_name: fileName }, (accepted) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve(accepted)
      })
    } catch {
      if (!settled) {
        settled = true
        window.clearTimeout(timer)
        resolve(false)
      }
    }
  })
}

export async function downloadPdf(from: string, to: string): Promise<void> {
  const { apiFetch } = await import('@/api/client')
  const result = await apiFetch<{ url: string; fileName: string }>('/api/download/token', {
    method: 'POST',
    body: JSON.stringify({ from, to }),
  })
  if (!result.url || !result.fileName) throw new ApiError('Не удалось получить ссылку', 500)
  const url = result.url.startsWith('http') ? result.url : `${API_BASE_URL}${result.url}`
  const tg = telegramWebApp()
  if (isTelegramMiniApp() && url.startsWith('https://') && tg?.downloadFile) {
    const accepted = await nativeDownload(url, result.fileName)
    if (accepted) return
  }
  try {
    await saveBlobDownload(url, result.fileName)
  } catch {
    if (tg?.openLink) tg.openLink(url)
    else window.open(url, '_blank', 'noopener,noreferrer')
  }
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
