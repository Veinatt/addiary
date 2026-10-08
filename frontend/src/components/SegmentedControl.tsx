import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type SegmentOption<T extends string = string> = {
  value: T
  label: string
  icon?: ReactNode
}

type Props<T extends string> = {
  value: T
  options: readonly SegmentOption<T>[] | SegmentOption<T>[]
  onChange: (value: T) => void
  className?: string
  fullWidth?: boolean
  size?: 'sm' | 'md'
  /** Soft pill looks muted / disabled-like (e.g. «Нет»). */
  activeTone?: 'primary' | 'muted'
  /** Click anywhere on the control to flip between the two options. */
  toggleWhole?: boolean
  /** Match `.field` radius / border / background. */
  variant?: 'default' | 'field'
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  fullWidth,
  size = 'md',
  activeTone = 'primary',
  toggleWhole = false,
  variant = 'default',
}: Props<T>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef(new Map<string, HTMLElement>())
  const [pill, setPill] = useState({ x: 0, w: 0, ready: false })

  const updatePill = () => {
    const btn = btnRefs.current.get(value)
    if (!btn) return
    setPill({ x: btn.offsetLeft, w: btn.offsetWidth, ready: true })
  }

  useLayoutEffect(() => {
    updatePill()
  }, [value, options])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const ro = new ResizeObserver(() => updatePill())
    ro.observe(root)
    window.addEventListener('resize', updatePill)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updatePill)
    }
  }, [value, options])

  const flip = () => {
    const next = options.find((opt) => opt.value !== value)
    if (next) onChange(next.value)
  }

  return (
    <div
      ref={rootRef}
      role={toggleWhole ? 'switch' : 'tablist'}
      aria-checked={toggleWhole ? value === options[1]?.value : undefined}
      tabIndex={toggleWhole ? 0 : undefined}
      onClick={toggleWhole ? flip : undefined}
      onKeyDown={
        toggleWhole
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                flip()
              }
            }
          : undefined
      }
      className={cn(
        'relative inline-flex p-1',
        variant === 'field'
          ? 'rounded-xl border border-border bg-background shadow-none'
          : 'rounded-2xl border border-primary/15 bg-muted/70 shadow-sm',
        fullWidth && 'flex w-full',
        toggleWhole && 'cursor-pointer select-none',
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1 bottom-1 left-0 transition-colors duration-200',
          variant === 'field' ? 'rounded-lg' : 'rounded-xl',
          activeTone === 'muted'
            ? 'bg-muted-foreground/20 shadow-none'
            : 'bg-primary shadow-sm shadow-primary/30',
        )}
        style={{
          width: pill.w,
          transform: `translate3d(${pill.x}px, 0, 0)`,
          opacity: pill.ready ? 1 : 0,
          transition: pill.ready
            ? toggleWhole
              ? // Same duration as tabs, milder spring than --ease-bounce (1.56 → 1.18).
                'transform 0.4s cubic-bezier(0.34, 1.18, 0.64, 1), width 0.4s cubic-bezier(0.34, 1.18, 0.64, 1), opacity 0.15s ease, background-color 0.2s ease'
              : 'transform 0.4s var(--ease-bounce), width 0.4s var(--ease-bounce), opacity 0.15s ease, background-color 0.2s ease'
            : 'none',
        }}
      />
      {options.map((opt) => {
        const active = opt.value === value
        const itemClass = cn(
          'relative z-10 flex min-w-0 items-center justify-center font-medium transition-colors duration-200',
          variant === 'field' ? 'rounded-lg' : 'rounded-xl',
          size === 'sm' ? 'px-1 py-2 text-xs sm:text-sm' : 'px-2 py-2 text-sm',
          fullWidth && 'flex-1',
          active
            ? activeTone === 'muted'
              ? 'text-muted-foreground/55'
              : 'text-primary-foreground'
            : 'text-muted-foreground',
          !toggleWhole && !active && 'hover:text-foreground',
        )
        const setRef = (el: HTMLElement | null) => {
          if (el) btnRefs.current.set(opt.value, el)
          else btnRefs.current.delete(opt.value)
        }
        if (toggleWhole) {
          return (
            <span key={opt.value} ref={setRef} className={cn(itemClass, 'pointer-events-none')}>
              <span className="truncate">{opt.label}</span>
            </span>
          )
        }
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={opt.label}
            ref={setRef}
            onClick={() => {
              if (opt.value !== value) onChange(opt.value)
            }}
            className={itemClass}
          >
            <span className="truncate">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
