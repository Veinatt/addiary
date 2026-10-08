import { useMemo, useState } from 'react'
import type { Reading } from '@/domain'
import { ReadingCard } from '@/components/ReadingCard'
import { ConfirmDelete, ReadingDialog } from '@/components/ReadingDialog'
import { ReadingForm } from '@/components/ReadingForm'
import { useDiary } from '@/hooks/useDiary'
import { slotForReading, slotLabel } from '@/lib/daySlots'
import { todayKey } from '@/lib/dates'

export function HomePage() {
  const { readings, settings, bounds, saveReading, deleteReading } = useDiary()
  const today = todayKey()
  const items = useMemo(
    () =>
      readings
        .filter((item) => item.date === today)
        .slice()
        .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)),
    [readings, today],
  )
  const [formKey, setFormKey] = useState(0)
  const [editing, setEditing] = useState<Reading | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Reading | null>(null)

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Главная</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Дата и время подставляются сами. Их можно поменять, в том числе задним числом. Утро или вечер
          определяется по времени автоматически.
        </p>
      </div>

      <ReadingForm
        key={formKey}
        submitLabel="Сохранить"
        onSubmit={async (draft) => {
          await saveReading(draft)
          setFormKey((value) => value + 1)
        }}
      />

      <section className="grid min-w-0 gap-3">
        <div className="flex items-center justify-between">
          <h2 className="section-label">Сегодня</h2>
          <span className="count-chip">{items.length}</span>
        </div>
        {items.length === 0 ? (
          <div className="surface-panel px-5 py-8 text-center text-sm text-muted-foreground">Пока пусто.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="min-w-0">
              <ReadingCard
                reading={item}
                bounds={bounds}
                slotLabel={slotLabel(slotForReading(item, settings))}
                onEdit={setEditing}
                onDelete={setPendingDelete}
              />
            </div>
          ))
        )}
      </section>

      <ReadingDialog reading={editing} onClose={() => setEditing(null)} />
      <ConfirmDelete
        open={pendingDelete != null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          void deleteReading(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
