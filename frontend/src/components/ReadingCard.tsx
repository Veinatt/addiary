import { Trash2 } from 'lucide-react'
import { cleanNote, zoneFor, type Bounds, type Reading } from '@/domain'
import { clock, shortDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

function tone(zone: 'low' | 'high' | 'normal'): string {
  if (zone === 'high') return 'text-red-600 dark:text-red-400'
  if (zone === 'low') return 'text-sky-700 dark:text-sky-300'
  return ''
}

type Props = {
  reading: Reading
  bounds: Bounds
  onEdit: (reading: Reading) => void
  onDelete: (reading: Reading) => void
}

export function ReadingCard({ reading, bounds, onEdit, onDelete }: Props) {
  const note = cleanNote(reading.note)
  return (
    <div className="surface-panel flex w-full min-w-0 items-center gap-3 px-4 py-3">
      <button type="button" className="min-w-0 flex-1 overflow-hidden text-left" onClick={() => onEdit(reading)}>
        <p className="text-sm font-medium tabular-nums">
          <span>{shortDate(reading.measuredAt)}</span>
          <span className="px-2 text-muted-foreground">·</span>
          <span>{clock(reading.measuredAt)}</span>
        </p>
        <p className="mt-1 truncate text-sm tabular-nums">
          <span className={tone(zoneFor(reading.systolic, bounds.sysMin, bounds.sysMax))}>
            {reading.systolic}
          </span>
          <span className="px-1 text-muted-foreground">/</span>
          <span className={tone(zoneFor(reading.diastolic, bounds.diaMin, bounds.diaMax))}>
            {reading.diastolic}
          </span>
          <span className="text-muted-foreground"> · пульс </span>
          <span className={tone(zoneFor(reading.pulse, bounds.pulseMin, bounds.pulseMax))}>
            {reading.pulse}
          </span>
          {reading.arrhythmia && <span className="text-muted-foreground"> · аритмия</span>}
        </p>
        {note ? <p className="mt-1 truncate text-xs text-muted-foreground">{note}</p> : null}
      </button>
      <button
        type="button"
        className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500')}
        aria-label="Удалить"
        onClick={() => onDelete(reading)}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
