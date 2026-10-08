import { config } from '../config'

export async function sendDocumentToUser(input: {
  userId: number
  fileName: string
  bytes: Buffer
  caption?: string
}): Promise<void> {
  const token = config.botToken
  if (!token) throw new Error('BOT_TOKEN is not configured')

  const form = new FormData()
  form.append('chat_id', String(input.userId))
  const bytes = new Uint8Array(input.bytes)
  form.append('document', new Blob([bytes], { type: 'application/pdf' }), input.fileName)
  if (input.caption) form.append('caption', input.caption)

  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: form,
  })
  const payload = (await response.json()) as { ok?: boolean; description?: string }
  if (!response.ok || !payload.ok) {
    throw new Error(payload.description ?? `Telegram sendDocument failed (${response.status})`)
  }
}
