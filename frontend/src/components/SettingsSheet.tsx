import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import {
  parseWhole,
  validateMorningWindow,
  type Bounds,
  type UserSettings,
} from '@/domain'
import { useDiary } from '@/hooks/useDiary'
import { applyTheme, getThemePreference, type ThemePreference } from '@/lib/theme'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
}

export function SettingsSheet({ open }: Props) {
  const { settings, saveSettings } = useDiary()
  const [theme, setTheme] = useState<ThemePreference>(() => getThemePreference())
  const [draft, setDraft] = useState<UserSettings>(settings)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(settings)
    setError(null)
    setSaved(false)
  }, [open, settings])

  if (!open) return null

  const chooseTheme = (next: ThemePreference) => {
    setTheme(next)
    applyTheme(next)
  }

  const updateBound = (key: keyof Bounds, raw: string) => {
    const value = parseWhole(raw)
    setSaved(false)
    setDraft((current) => ({ ...current, [key]: value ?? Number.NaN }))
  }

  const save = async () => {
    setError(null)
    setSaved(false)
    const windowProblem = validateMorningWindow(draft.morningStart, draft.morningEnd)
    if (windowProblem) {
      setError(windowProblem)
      return
    }
    try {
      await saveSettings(draft)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    }
  }

  const fields: Array<{ min: keyof Bounds; max: keyof Bounds; label: string }> = [
    { min: 'sysMin', max: 'sysMax', label: 'Верхнее' },
    { min: 'diaMin', max: 'diaMax', label: 'Нижнее' },
    { min: 'pulseMin', max: 'pulseMax', label: 'Пульс' },
  ]

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
        <p className="mt-1 text-sm text-muted-foreground">Тема, утро/вечер и границы для дневника.</p>
      </div>

      <section className="surface-panel grid gap-3 p-4">
        <h2 className="font-semibold">Тема</h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => chooseTheme('dark')}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium',
              theme === 'dark' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            <Moon className="h-4 w-4" />
            Тёмная
          </button>
          <button
            type="button"
            onClick={() => chooseTheme('light')}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium',
              theme === 'light' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            <Sun className="h-4 w-4" />
            Светлая
          </button>
        </div>
      </section>

      <section className="surface-panel grid gap-3 p-4">
        <div>
          <h2 className="font-semibold">Утро / вечер</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Утро — с начала до конца (конец не включается). Остальное время считается вечером.
          </p>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <label className="grid gap-1.5">
            <span className="text-center text-sm text-muted-foreground">Начало утра</span>
            <input
              className="field field-time w-full text-center tabular-nums"
              type="time"
              lang="ru"
              dir="ltr"
              step={60}
              value={draft.morningStart}
              onChange={(event) => {
                setSaved(false)
                setDraft((current) => ({ ...current, morningStart: event.target.value }))
              }}
            />
          </label>
          <span className="mt-6 text-muted-foreground">—</span>
          <label className="grid gap-1.5">
            <span className="text-center text-sm text-muted-foreground">Конец утра</span>
            <input
              className="field field-time w-full text-center tabular-nums"
              type="time"
              lang="ru"
              dir="ltr"
              step={60}
              value={draft.morningEnd}
              onChange={(event) => {
                setSaved(false)
                setDraft((current) => ({ ...current, morningEnd: event.target.value }))
              }}
            />
          </label>
        </div>
      </section>

      <section className="surface-panel grid gap-4 p-4">
        <div>
          <h2 className="font-semibold">Границы</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ниже нижней границы число голубое, выше верхней — красное.
          </p>
        </div>
        {fields.map((field) => (
          <div key={field.label} className="grid gap-1.5">
            <span className="text-sm text-muted-foreground">{field.label}</span>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                className="field text-center tabular-nums"
                inputMode="numeric"
                value={Number.isFinite(draft[field.min]) ? String(draft[field.min]) : ''}
                onChange={(event) => updateBound(field.min, event.target.value)}
                aria-label={`${field.label} от`}
              />
              <span className="text-muted-foreground">—</span>
              <input
                className="field text-center tabular-nums"
                inputMode="numeric"
                value={Number.isFinite(draft[field.max]) ? String(draft[field.max]) : ''}
                onChange={(event) => updateBound(field.max, event.target.value)}
                aria-label={`${field.label} до`}
              />
            </div>
          </div>
        ))}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {saved && <p className="text-sm text-primary-soft">Настройки сохранены</p>}
        <button type="button" className="btn-primary" onClick={() => void save()}>
          Сохранить
        </button>
      </section>
    </div>
  )
}
