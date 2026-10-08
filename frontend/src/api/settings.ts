import type { UserSettings } from '@/domain'
import { apiFetch } from '@/api/client'

export function getSettings(): Promise<{ settings: UserSettings }> {
  return apiFetch('/api/settings')
}

export function saveSettings(settings: UserSettings): Promise<{ settings: UserSettings }> {
  return apiFetch('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}
