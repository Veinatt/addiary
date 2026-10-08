import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cleanNote, type Reading } from '@/domain'
import { splitMinsk } from '@/lib/dates'
import { useDiary, type ReadingDraft } from '@/hooks/useDiary'
import { ReadingForm } from '@/components/ReadingForm'

type Props = {
  reading: Reading | null
  onClose: () => void
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [locked])
}

export function ReadingDialog({ reading, onClose }: Props) {
  const { saveReading } = useDiary()
  useBodyScrollLock(reading != null)
  if (!reading || typeof document === 'undefined') return null

  const when = splitMinsk(reading.measuredAt)
  const initial = {
    date: when.date,
    time: when.time,
    systolic: String(reading.systolic),
    diastolic: String(reading.diastolic),
    pulse: String(reading.pulse),
    arrhythmia: reading.arrhythmia,
    note: cleanNote(reading.note),
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reading-dialog-title"
        className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-lg"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 id="reading-dialog-title" className="text-base font-semibold">
            Запись
          </h2>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ReadingForm
            key={reading.id}
            framed={false}
            initial={initial}
            submitLabel="Сохранить"
            onSubmit={async (draft: Omit<ReadingDraft, 'id'>) => {
              await saveReading({ ...draft, id: reading.id })
              onClose()
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}

type ConfirmProps = {
  open: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDelete({ open, onConfirm, onClose }: ConfirmProps) {
  useBodyScrollLock(open)
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-border/70 bg-card p-5 shadow-lg"
      >
        <h2 className="text-base font-semibold">Удалить запись?</h2>
        <p className="mt-2 text-sm text-muted-foreground">Её нельзя будет вернуть.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="rounded-xl border border-border px-3 py-2.5 text-sm" onClick={onClose}>
            Оставить
          </button>
          <button
            type="button"
            className="rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white"
            onClick={onConfirm}
          >
            Удалить
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
