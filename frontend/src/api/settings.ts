import type { Bounds } from '@/domain'
import { apiFetch } from '@/api/client'

export function getSettings(): Promise<{ settings: Bounds }> {
  return apiFetch('/api/settings')
}

export function saveSettings(bounds: Bounds): Promise<{ settings: Bounds }> {
  return apiFetch('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(bounds),
  })
}
