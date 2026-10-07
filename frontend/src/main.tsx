import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyTheme, getThemePreference } from '@/lib/theme'
import App from './App'
import './index.css'

applyTheme(getThemePreference())

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
