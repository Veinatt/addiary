import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { monthTitle, periodLabel, todayKey } from '@/lib/dates'
import type { Zone } from '@/domain'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

type Props = {
  year: number
  month: number
  marks: Map<string, Zone>
  selected: string | null
  rangeFrom: string | null
  rangeTo: string | null
  onShift: (delta: number) => void
  onSelect: (date: string) => void
}

function ordered(from: string | null, to: string | null): { start: string | null; end: string | null } {
  if (!from && !to) return { start: null, end: null }
  if (from && !to) return { start: from, end: null }
  if (!from && to) return { start: to, end: null }
  if (!from || !to) return { start: null, end: null }
  return from <= to ? { start: from, end: to } : { start: to, end: from }
}

function inRange(key: string, from: string | null, to: string | null): boolean {
  const { start, end } = ordered(from, to)
  if (!start || !end) return false
  return key >= start && key <= end
}

function rangeCaption(from: string | null, to: string | null): string | null {
  const { start, end } = ordered(from, to)
  if (!start) return null
  if (!end) return `Начало: ${format(parseISO(start), 'd MMMM', { locale: ru })}. Выберите конец периода`
  return periodLabel(start, end)
}

export function MonthCalendar({
  year,
  month,
  marks,
  selected,
  rangeFrom,
  rangeTo,
  onShift,
  onSelect,
}: Props) {
  const cursor = startOfMonth(new Date(year, month - 1, 1))
  const days = eachDayOfInterval({
    start: startOfWeek(cursor, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
  })
  const today = todayKey()
  const edges = ordered(rangeFrom, rangeTo)
  const caption = rangeCaption(rangeFrom, rangeTo)

  return (
    <div className="surface-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="rounded-lg p-2" aria-label="Предыдущий месяц" onClick={() => onShift(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold">{monthTitle(year, month)}</p>
        <button type="button" className="rounded-lg p-2" aria-label="Следующий месяц" onClick={() => onShift(1)}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            className={cn(
              'py-1 text-center text-[11px] font-medium',
              index >= 5 ? 'text-red-500' : 'text-muted-foreground',
            )}
          >
            {label}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const inMonth = isSameMonth(day, cursor)
          const mark = marks.get(key)
          const ranged = inRange(key, rangeFrom, rangeTo)
          const isEdge = key === edges.start || key === edges.end
          const isSelected = selected === key
          const marked = isEdge || isSelected
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={cn(
                'flex h-10 flex-col items-center justify-center rounded-lg text-sm tabular-nums',
                !inMonth && 'text-muted-foreground/40',
                ranged && !isEdge && 'bg-primary/15',
                isEdge && 'bg-primary font-semibold text-primary-foreground ring-2 ring-primary',
                isSelected && 'bg-primary font-semibold text-primary-foreground',
                key === today && !marked && 'ring-1 ring-primary/50',
              )}
            >
              {format(day, 'd')}
              {mark && (
                <span
                  className={cn(
                    'mt-0.5 h-1.5 w-1.5 rounded-full',
                    mark === 'high' && 'bg-red-500',
                    mark === 'low' && 'bg-sky-400',
                    mark === 'normal' && 'bg-primary',
                    marked && 'bg-white',
                  )}
                />
              )}
            </button>
          )
        })}
      </div>
      {caption && <p className="mt-2 text-center text-xs text-muted-foreground">{caption}</p>}
    </div>
  )
}
