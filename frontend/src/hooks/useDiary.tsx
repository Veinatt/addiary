import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ApiError } from '@/api/client'
import { deleteReading as apiDelete, listReadings, upsertReading } from '@/api/readings'
import { getSettings, saveSettings as apiSaveSettings } from '@/api/settings'
import { db, type PendingKind } from '@/db'
import {
  cleanNote,
  DEFAULT_SETTINGS,
  validateBounds,
  validateMorningWindow,
  validateReadingValues,
  type Reading,
  type UserSettings,
} from '@/domain'
import { minskDateTimeToIso } from '@/lib/dates'

export type ReadingDraft = {
  id?: string
  date: string
  time: string
  systolic: number
  diastolic: number
  pulse: number
  arrhythmia: boolean
  note: string
}

export type SyncStatus = { text: string; tone: 'error' | 'info' } | null

function mergeSettings(raw: Partial<UserSettings> | undefined): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    morningStart: raw?.morningStart?.trim() || DEFAULT_SETTINGS.morningStart,
    morningEnd: raw?.morningEnd?.trim() || DEFAULT_SETTINGS.morningEnd,
  }
}

type DiaryValue = {
  readings: Reading[]
  settings: UserSettings
  /** @deprecated use settings — kept for charts that only need bounds */
  bounds: UserSettings
  status: SyncStatus
  refresh: () => Promise<void>
  saveReading: (draft: ReadingDraft) => Promise<void>
  deleteReading: (id: string) => Promise<void>
  saveSettings: (settings: UserSettings) => Promise<void>
}

const DiaryContext = createContext<DiaryValue | null>(null)

let chain: Promise<void> = Promise.resolve()

function enqueue(task: () => Promise<void>): Promise<void> {
  chain = chain.then(task, task)
  return chain
}

async function replacePending(kind: PendingKind, entityId: string): Promise<void> {
  const existing = await db.pendingOps.where('entityId').equals(entityId).toArray()
  const same = existing.filter((item) => item.kind === kind)
  if (same.length > 0) await db.pendingOps.bulkDelete(same.map((item) => item.id))
  await db.pendingOps.put({
    id: crypto.randomUUID(),
    kind,
    entityId,
    createdAt: new Date().toISOString(),
  })
}

async function clearPending(kind: PendingKind, entityId: string): Promise<void> {
  const existing = await db.pendingOps.where('entityId').equals(entityId).toArray()
  const same = existing.filter((item) => item.kind === kind)
  if (same.length > 0) await db.pendingOps.bulkDelete(same.map((item) => item.id))
}

function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0
}

function isDrop(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 400 || error.status === 403 || error.status === 404)
}

async function pull(): Promise<void> {
  let [listed, settings] = await Promise.all([listReadings(), getSettings()])
  const pending = await db.pendingOps.toArray()
  const upsertIds = pending.filter((item) => item.kind === 'upsert-reading').map((item) => item.entityId)
  const deleteIds = new Set(
    pending.filter((item) => item.kind === 'delete-reading').map((item) => item.entityId),
  )

  // After a Railway redeploy / empty Volume the server DB is empty. Re-seed from the
  // device cache instead of wiping local readings on the next sync.
  if (listed.readings.length === 0) {
    const localAll = await db.readings.toArray()
    const toRestore = localAll.filter((row) => !deleteIds.has(row.id))
    if (toRestore.length > 0) {
      let uploaded = 0
      for (const row of toRestore) {
        try {
          await upsertReading({ ...row, note: cleanNote(row.note) })
          await clearPending('upsert-reading', row.id)
          uploaded += 1
        } catch {
          await replacePending('upsert-reading', row.id)
        }
      }
      listed = await listReadings()
      if (listed.readings.length === 0) {
        // Do not clear the device cache while the server is still empty.
        console.warn(`[diary] server empty after restore attempt (uploaded=${uploaded}); keeping local`)
        return
      }
    }
  }

  const kept = upsertIds.length > 0 ? await db.readings.where('id').anyOf(upsertIds).toArray() : []
  const remote = listed.readings
    .filter((item) => !deleteIds.has(item.id) && !upsertIds.includes(item.id))
    .map((item) => ({ ...item, note: cleanNote(item.note) }))
  const broken = listed.readings.filter(
    (item) => !deleteIds.has(item.id) && !upsertIds.includes(item.id) && cleanNote(item.note) !== item.note,
  )
  await db.transaction('rw', db.readings, db.settings, async () => {
    await db.readings.clear()
    if (remote.length + kept.length > 0) await db.readings.bulkPut([...remote, ...kept])
    if (!pending.some((item) => item.kind === 'save-settings')) {
      await db.settings.put({ id: 'local', bounds: mergeSettings(settings.settings) })
    }
  })
  for (const row of broken) {
    try {
      await upsertReading({ ...row, note: cleanNote(row.note) })
    } catch {
      /* local copy is already clean; the next sync retries the server write */
    }
  }
}

async function replay(): Promise<void> {
  const ops = await db.pendingOps.orderBy('createdAt').toArray()
  for (const op of ops) {
    try {
      if (op.kind === 'upsert-reading') {
        const row = await db.readings.get(op.entityId)
        if (row) await upsertReading({ ...row, note: cleanNote(row.note) })
      } else if (op.kind === 'delete-reading') {
        await apiDelete(op.entityId)
      } else {
        const row = await db.settings.get('local')
        if (row) await apiSaveSettings(mergeSettings(row.bounds))
      }
      await db.pendingOps.delete(op.id)
    } catch (error) {
      if (isDrop(error)) {
        await db.pendingOps.delete(op.id)
        continue
      }
      throw error
    }
  }
}

export function DiaryProvider({ children }: { children: ReactNode }) {
  const readings = useLiveQuery(() => db.readings.orderBy('measuredAt').reverse().toArray(), [], [])
  const settingsRow = useLiveQuery(() => db.settings.get('local'))
  const [status, setStatus] = useState<SyncStatus>(null)

  const refresh = useCallback(async () => {
    await enqueue(async () => {
      try {
        await replay()
        await pull()
        setStatus(null)
      } catch (error) {
        if (isOffline(error)) {
          setStatus({ text: 'Нет связи с сервером. Новые записи отправятся позже.', tone: 'info' })
          return
        }
        const message = error instanceof Error ? error.message : 'Не удалось обновить дневник'
        setStatus({ text: message, tone: 'error' })
      }
    })
  }, [])

  useEffect(() => {
    void refresh()
    const onOnline = () => void refresh()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [refresh])

  const saveReading = useCallback(async (draft: ReadingDraft) => {
    const problem = validateReadingValues(draft.systolic, draft.diastolic, draft.pulse)
    if (problem) throw new Error(problem)
    const existing = draft.id ? await db.readings.get(draft.id) : undefined
    const now = new Date().toISOString()
    const reading: Reading = {
      id: draft.id ?? crypto.randomUUID(),
      userId: existing?.userId ?? 0,
      measuredAt: minskDateTimeToIso(draft.date, draft.time),
      date: draft.date,
      systolic: draft.systolic,
      diastolic: draft.diastolic,
      pulse: draft.pulse,
      arrhythmia: draft.arrhythmia,
      note: cleanNote(draft.note),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await db.readings.put(reading)
    try {
      const saved = await upsertReading(reading)
      await db.readings.put(saved.reading)
      await clearPending('upsert-reading', reading.id)
      setStatus(null)
    } catch (error) {
      if (isOffline(error)) {
        await replacePending('upsert-reading', reading.id)
        setStatus({ text: 'Нет связи. Запись сохранится и отправится позже.', tone: 'info' })
        return
      }
      if (existing) await db.readings.put(existing)
      else await db.readings.delete(reading.id)
      throw error instanceof Error ? error : new Error('Не удалось сохранить')
    }
  }, [])

  const deleteReading = useCallback(async (id: string) => {
    const pendingCreate = (await db.pendingOps.where('entityId').equals(id).toArray()).some(
      (item) => item.kind === 'upsert-reading',
    )
    await db.readings.delete(id)
    if (pendingCreate) {
      await clearPending('upsert-reading', id)
      return
    }
    try {
      await apiDelete(id)
      await clearPending('delete-reading', id)
    } catch (error) {
      if (isDrop(error) && error instanceof ApiError && error.status === 404) return
      if (isOffline(error) || (error instanceof ApiError && error.status >= 500)) {
        await replacePending('delete-reading', id)
        setStatus({ text: 'Нет связи. Удаление отправится позже.', tone: 'info' })
        return
      }
      throw error instanceof Error ? error : new Error('Не удалось удалить')
    }
  }, [])

  const saveSettings = useCallback(async (next: UserSettings) => {
    const problem = validateBounds(next) ?? validateMorningWindow(next.morningStart, next.morningEnd)
    if (problem) throw new Error(problem)
    const merged = mergeSettings(next)
    const previous = await db.settings.get('local')
    await db.settings.put({ id: 'local', bounds: merged })
    try {
      const saved = await apiSaveSettings(merged)
      await db.settings.put({ id: 'local', bounds: mergeSettings(saved.settings) })
      await clearPending('save-settings', 'local')
      setStatus(null)
    } catch (error) {
      if (isOffline(error)) {
        await replacePending('save-settings', 'local')
        setStatus({ text: 'Нет связи. Настройки отправятся позже.', tone: 'info' })
        return
      }
      if (previous) await db.settings.put(previous)
      else await db.settings.delete('local')
      throw error instanceof Error ? error : new Error('Не удалось сохранить настройки')
    }
  }, [])

  const resolvedSettings = mergeSettings(settingsRow?.bounds)

  const value = useMemo<DiaryValue>(
    () => ({
      readings: readings ?? [],
      settings: resolvedSettings,
      bounds: resolvedSettings,
      status,
      refresh,
      saveReading,
      deleteReading,
      saveSettings,
    }),
    [readings, resolvedSettings, status, refresh, saveReading, deleteReading, saveSettings],
  )

  return <DiaryContext.Provider value={value}>{children}</DiaryContext.Provider>
}

export function useDiary(): DiaryValue {
  const value = useContext(DiaryContext)
  if (!value) throw new Error('useDiary outside provider')
  return value
}
