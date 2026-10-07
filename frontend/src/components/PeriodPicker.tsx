import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SegmentedControl } from '@/components/SegmentedControl'
import { monthTitle, shiftMonth } from '@/lib/dates'
import type { PeriodMode, PeriodValue } from '@/lib/period'

const MODES: Array<{ value: PeriodMode; label: string }> = [
  { value: 'all', label: 'Год' },
  { value: 'month', label: 'Месяц' },
  { value: 'day', label: 'День' },
  { value: 'range', label: 'Период' },
]

type Props = {
  value: PeriodValue
  onChange: (value: PeriodValue) => void
}

export function PeriodPicker({ value, onChange }: Props) {
  const shift = (delta: number) => {
    const next = shiftMonth(value.year, value.month, delta)
    onChange({ ...value, ...next })
  }

  return (
    <div className="grid gap-3">
      <SegmentedControl
        fullWidth
        value={value.mode}
        options={MODES}
        onChange={(mode) => onChange({ ...value, mode })}
      />
      {value.mode === 'month' && (
        <div key="month-nav" className="surface-panel flex animate-fade-up items-center justify-between px-2 py-1">
          <button type="button" className="rounded-lg p-2" aria-label="Предыдущий месяц" onClick={() => shift(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-sm font-semibold">{monthTitle(value.year, value.month)}</p>
          <button type="button" className="rounded-lg p-2" aria-label="Следующий месяц" onClick={() => shift(1)}>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  )
}
