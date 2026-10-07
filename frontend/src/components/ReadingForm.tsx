import { useState } from 'react'
import { parseWhole, validateReadingValues } from '@/domain'
import { minskNow } from '@/lib/dates'
import type { ReadingDraft } from '@/hooks/useDiary'

type Initial = {
  date: string
  time: string
  systolic: string
  diastolic: string
  pulse: string
  arrhythmia: boolean
  note: string
}

type Props = {
  initial?: Partial<Initial>
  submitLabel: string
  framed?: boolean
  onSubmit: (draft: Omit<ReadingDraft, 'id'>) => Promise<void>
}

function normalizeTime(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{1,2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function ReadingForm({ initial, submitLabel, framed = true, onSubmit }: Props) {
  const now = minskNow()
  const [date, setDate] = useState(initial?.date ?? now.date)
  const [time, setTime] = useState(initial?.time ?? now.time)
  const [systolic, setSystolic] = useState(initial?.systolic ?? '')
  const [diastolic, setDiastolic] = useState(initial?.diastolic ?? '')
  const [pulse, setPulse] = useState(initial?.pulse ?? '')
  const [arrhythmia, setArrhythmia] = useState(initial?.arrhythmia ?? false)
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const sys = parseWhole(systolic)
    const dia = parseWhole(diastolic)
    const bpm = parseWhole(pulse)
    const clock = normalizeTime(time)
    if (sys == null || dia == null || bpm == null) {
      setError('Заполните верхнее, нижнее и пульс целыми числами')
      return
    }
    if (!clock) {
      setError('Укажите время')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Укажите дату')
      return
    }
    const problem = validateReadingValues(sys, dia, bpm)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        date,
        time: clock,
        systolic: sys,
        diastolic: dia,
        pulse: bpm,
        arrhythmia,
        note,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className={framed ? 'surface-panel grid gap-4 p-4' : 'grid gap-4 p-4'}
      lang="ru"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5 text-sm">
          <span className="text-center text-muted-foreground">Дата</span>
          <input
            className="field text-center"
            type="date"
            lang="ru"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-center text-muted-foreground">Время</span>
          <input
            className="field text-center tabular-nums"
            type="time"
            lang="ru"
            step={60}
            value={time}
            onChange={(event) => setTime(event.target.value)}
            onClick={(event) => {
              const input = event.currentTarget
              if (typeof input.showPicker === 'function') {
                try {
                  input.showPicker()
                } catch {
                  /* ignore — not all WebViews allow it */
                }
              }
            }}
            required
          />
        </label>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Верхнее</span>
          <input
            className="field text-center text-3xl font-semibold tabular-nums"
            inputMode="numeric"
            value={systolic}
            onChange={(event) => setSystolic(event.target.value)}
            placeholder="120"
            aria-label="Верхнее давление"
          />
        </label>
        <span className="px-1 pb-3 text-2xl text-muted-foreground">/</span>
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Нижнее</span>
          <input
            className="field text-center text-3xl font-semibold tabular-nums"
            inputMode="numeric"
            value={diastolic}
            onChange={(event) => setDiastolic(event.target.value)}
            placeholder="80"
            aria-label="Нижнее давление"
          />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">Пульс</span>
        <input
          className="field tabular-nums"
          inputMode="numeric"
          value={pulse}
          onChange={(event) => setPulse(event.target.value)}
          placeholder="72"
        />
      </label>

      <button
        type="button"
        role="switch"
        aria-checked={arrhythmia}
        onClick={() => setArrhythmia((value) => !value)}
        className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-3 text-left"
      >
        <span className="text-sm">Аритмия</span>
        <span className="inline-flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{arrhythmia ? 'Да' : 'Нет'}</span>
          <span
            className={
              arrhythmia
                ? 'relative h-7 w-12 shrink-0 rounded-full bg-primary transition-colors duration-200'
                : 'relative h-7 w-12 shrink-0 rounded-full bg-muted transition-colors duration-200'
            }
          >
            <span
              className={
                arrhythmia
                  ? 'absolute top-0.5 left-0.5 h-6 w-6 translate-x-5 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-bounce)]'
                  : 'absolute top-0.5 left-0.5 h-6 w-6 translate-x-0 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-bounce)]'
              }
            />
          </span>
        </span>
      </button>

      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">Примечание</span>
        <textarea
          className="field min-h-16 resize-none"
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Необязательно"
        />
      </label>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? 'Сохраняю…' : submitLabel}
      </button>
    </form>
  )
}
