import { useState } from 'react'
import { parseWhole, validateReadingValues } from '@/domain'
import { SegmentedControl } from '@/components/SegmentedControl'
import { minskNow } from '@/lib/dates'
import type { ReadingDraft } from '@/hooks/useDiary'

const ARRHYTHMIA_OPTIONS = [
  { value: 'no', label: 'Нет' },
  { value: 'yes', label: 'Да' },
] as const

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
  const [time, setTime] = useState(() => normalizeTime(initial?.time ?? now.time) ?? now.time)
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
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-1.5">
        <span className="text-center text-sm text-muted-foreground">Дата</span>
        <span aria-hidden className="w-4" />
        <span className="text-center text-sm text-muted-foreground">Время</span>
        <input
          className="field field-date w-full text-center"
          type="date"
          lang="ru"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
        <span aria-hidden className="w-4" />
        <input
          className="field field-time w-full text-center tabular-nums"
          type="time"
          value={time}
          onChange={(event) => {
            const next = normalizeTime(event.target.value)
            if (next) setTime(next)
          }}
          required
        />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-1.5">
        <span className="text-center text-sm text-muted-foreground">Верхнее</span>
        <span aria-hidden className="w-4" />
        <span className="text-center text-sm text-muted-foreground">Нижнее</span>
        <input
          className="field w-full text-center text-3xl font-semibold tabular-nums"
          inputMode="numeric"
          value={systolic}
          onChange={(event) => setSystolic(event.target.value)}
          placeholder="120"
          aria-label="Верхнее давление"
        />
        <span className="flex w-4 items-center justify-center text-2xl leading-none text-muted-foreground">/</span>
        <input
          className="field w-full text-center text-3xl font-semibold tabular-nums"
          inputMode="numeric"
          value={diastolic}
          onChange={(event) => setDiastolic(event.target.value)}
          placeholder="80"
          aria-label="Нижнее давление"
        />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-1.5">
        <span className="text-center text-sm text-muted-foreground">Пульс</span>
        <span aria-hidden className="w-4" />
        <span className="text-center text-sm text-muted-foreground">Аритмия</span>
        <input
          className="field w-full text-center tabular-nums"
          inputMode="numeric"
          value={pulse}
          onChange={(event) => setPulse(event.target.value)}
          placeholder="72"
          aria-label="Пульс"
        />
        <span aria-hidden className="w-4" />
        <SegmentedControl
          fullWidth
          size="sm"
          toggleWhole
          variant="field"
          value={arrhythmia ? 'yes' : 'no'}
          options={ARRHYTHMIA_OPTIONS}
          activeTone={arrhythmia ? 'primary' : 'muted'}
          onChange={(value) => setArrhythmia(value === 'yes')}
        />
      </div>

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
