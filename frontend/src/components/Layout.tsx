import { BarChart3, House, Settings, Table2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useDiary } from '@/hooks/useDiary'
import { cn } from '@/lib/utils'

export type TabId = 'home' | 'stats' | 'tables'

const TABS: Array<{ id: TabId; label: string; icon: typeof House }> = [
  { id: 'home', label: 'Главная', icon: House },
  { id: 'stats', label: 'Статистика', icon: BarChart3 },
  { id: 'tables', label: 'Таблицы', icon: Table2 },
]

type Props = {
  tab: TabId
  settingsOpen: boolean
  onTab: (tab: TabId) => void
  onToggleSettings: () => void
  children: ReactNode
}

export function Layout({ tab, settingsOpen, onTab, onToggleSettings, children }: Props) {
  const { status } = useDiary()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 flex items-center border-b border-primary/10 bg-card/70 px-4 py-2.5 backdrop-blur-md">
        <div className="bg-gradient-to-r from-primary to-[hsl(var(--brand-end))] bg-clip-text text-lg font-bold tracking-tight text-transparent">
          Дневник
        </div>
        <button
          type="button"
          className={cn(
            'ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200',
            settingsOpen
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
              : 'text-muted-foreground hover:bg-primary/8 hover:text-foreground',
          )}
          aria-label="Настройки"
          aria-pressed={settingsOpen}
          onClick={onToggleSettings}
        >
          <Settings key={settingsOpen ? 'on' : 'off'} className={cn('h-5 w-5', settingsOpen && 'animate-nav-bounce')} />
        </button>
      </header>

      {status && (
        <p
          className={cn(
            'px-4 py-2 text-center text-xs',
            status.tone === 'error' ? 'bg-red-500/15 text-red-600 dark:text-red-300' : 'bg-primary/10 text-primary-soft',
          )}
        >
          {status.text}
        </p>
      )}

      <main className="mx-auto w-full min-w-0 max-w-lg flex-1 px-4 pb-28 pt-4">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/10 bg-card/95 backdrop-blur-md"
        style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-3">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = !settingsOpen && tab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTab(id)}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-200',
                  active ? 'text-primary-soft' : 'text-muted-foreground',
                )}
              >
                <Icon key={active ? 'on' : 'off'} className={cn('h-5 w-5', active && 'animate-nav-bounce')} />
                <span className="transition-transform duration-300 ease-[var(--ease-bounce)]">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
