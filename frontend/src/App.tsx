import { useEffect, useRef, useState } from 'react'
import { Layout, type TabId } from '@/components/Layout'
import { SettingsSheet } from '@/components/SettingsSheet'
import { DiaryProvider } from '@/hooks/useDiary'
import { useTelegramChrome } from '@/lib/download'
import { cn } from '@/lib/utils'
import { HomePage } from '@/pages/HomePage'
import { StatsPage } from '@/pages/StatsPage'
import { TablesPage } from '@/pages/TablesPage'

function Shell() {
  useTelegramChrome()
  const [tab, setTab] = useState<TabId>('home')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const skipFirstPageIn = useRef(true)
  const [pageIn, setPageIn] = useState(false)
  const contentKey = settingsOpen ? 'settings' : tab

  useEffect(() => {
    if (skipFirstPageIn.current) {
      skipFirstPageIn.current = false
      setPageIn(false)
      return
    }
    setPageIn(true)
  }, [contentKey])

  return (
    <Layout
      tab={tab}
      settingsOpen={settingsOpen}
      onTab={(next) => {
        setTab(next)
        setSettingsOpen(false)
      }}
      onToggleSettings={() => setSettingsOpen((open) => !open)}
    >
      <div key={contentKey} className={cn('min-w-0', pageIn && 'animate-page-in')}>
        {settingsOpen ? (
          <SettingsSheet open />
        ) : tab === 'stats' ? (
          <StatsPage />
        ) : tab === 'tables' ? (
          <TablesPage />
        ) : (
          <HomePage />
        )}
      </div>
    </Layout>
  )
}

export default function App() {
  return (
    <DiaryProvider>
      <div className="app-shell min-h-dvh">
        <Shell />
      </div>
    </DiaryProvider>
  )
}
