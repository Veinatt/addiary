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
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  fullWidth,
  size = 'md',
}: Props<T>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef(new Map<string, HTMLButtonElement>())
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

  return (
    <div
      ref={rootRef}
      role="tablist"
      className={cn(
        'relative inline-flex rounded-2xl border border-primary/15 bg-muted/70 p-1 shadow-sm',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 left-0 rounded-xl bg-primary shadow-sm shadow-primary/30"
        style={{
          width: pill.w,
          transform: `translate3d(${pill.x}px, 0, 0)`,
          opacity: pill.ready ? 1 : 0,
          transition: pill.ready
            ? 'transform 0.4s var(--ease-bounce), width 0.4s var(--ease-bounce), opacity 0.15s ease'
            : 'none',
        }}
      />
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={opt.label}
            ref={(el) => {
              if (el) btnRefs.current.set(opt.value, el)
              else btnRefs.current.delete(opt.value)
            }}
            onClick={() => {
              if (opt.value !== value) onChange(opt.value)
            }}
            className={cn(
              'relative z-10 flex min-w-0 items-center justify-center rounded-xl font-medium transition-colors duration-200',
              size === 'sm' ? 'px-1 py-2 text-xs sm:text-sm' : 'px-2 py-2 text-sm',
              fullWidth && 'flex-1',
              active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="truncate">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
