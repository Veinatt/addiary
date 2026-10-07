import type { Reading } from '@/domain'
import { apiFetch } from '@/api/client'

export function listReadings(): Promise<{ readings: Reading[] }> {
  return apiFetch('/api/readings')
}

export function upsertReading(reading: Reading): Promise<{ reading: Reading }> {
  return apiFetch('/api/readings', {
    method: 'POST',
    body: JSON.stringify(reading),
  })
}

export function deleteReading(id: string): Promise<{ success: true }> {
  return apiFetch(`/api/readings/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
