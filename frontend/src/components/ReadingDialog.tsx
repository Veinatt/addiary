import { X } from 'lucide-react'
import { cleanNote, type Reading } from '@/domain'
import { splitMinsk } from '@/lib/dates'
import { useDiary, type ReadingDraft } from '@/hooks/useDiary'
import { ReadingForm } from '@/components/ReadingForm'

type Props = {
  reading: Reading | null
  onClose: () => void
}

export function ReadingDialog({ reading, onClose }: Props) {
  const { saveReading } = useDiary()
  if (!reading) return null
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div className="surface-panel max-h-[90dvh] w-full max-w-md overflow-auto">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">Запись</h2>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
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
  )
}

type ConfirmProps = {
  open: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDelete({ open, onConfirm, onClose }: ConfirmProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="surface-panel w-full max-w-sm p-5">
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
    </div>
  )
}
