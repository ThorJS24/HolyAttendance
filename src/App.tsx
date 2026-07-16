import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/layout/app-shell'
import { DashboardPage } from '@/pages/dashboard'
import { SubjectsPage } from '@/pages/subjects'
import { AttendancePage } from '@/pages/attendance'
import { TimetablePage } from '@/pages/timetable'
import { CalendarPage } from '@/pages/calendar'
import { PlannerPage } from '@/pages/planner'
import { AnalyticsPage } from '@/pages/analytics'
import { SettingsPage } from '@/pages/settings'
import { useSettingsStore } from '@/store/settings-store'
import { useTheme } from '@/hooks/use-theme'
import { Toaster } from '@/components/ui/toaster'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'

function App() {
  const loadSettings = useSettingsStore((s) => s.load)
  useEffect(() => {
    loadSettings()
  }, [loadSettings])
  useTheme()

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="timetable" element={<TimetablePage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      <Toaster />
      <KeyboardShortcuts />
    </HashRouter>
  )
}

export default App
