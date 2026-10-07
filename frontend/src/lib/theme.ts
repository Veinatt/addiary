export type ThemePreference = 'light' | 'dark'

const STORAGE_KEY = 'dnevnik-theme'

export function getThemePreference(): ThemePreference {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(preference: ThemePreference): void {
  document.documentElement.classList.toggle('dark', preference === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    /* ignore */
  }
}
