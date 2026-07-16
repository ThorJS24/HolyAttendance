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
import { SemestersPage } from '@/pages/semesters'
import { useSettingsStore } from '@/store/settings-store'
import { useSemestersStore } from '@/store/semesters-store'
import { useTheme } from '@/hooks/use-theme'
import { Toaster } from '@/components/ui/toaster'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'

function App() {
  const loadSettings = useSettingsStore((s) => s.load)
  const settingsLoaded = useSettingsStore((s) => s.loaded)
  const currentSemester = useSettingsStore((s) => s.currentSemester)
  const setCurrentSemester = useSettingsStore((s) => s.setCurrentSemester)
  const semesters = useSemestersStore((s) => s.semesters)
  const loadSemesters = useSemestersStore((s) => s.load)
  useEffect(() => {
    loadSettings()
    loadSemesters()
  }, [loadSettings, loadSemesters])

  // If the current-semester setting is empty or points at a semester that no
  // longer exists (deleted, or never set), fall back to whichever semester
  // is marked active so every semester-scoped page has something sensible
  // to show instead of silently rendering empty.
  useEffect(() => {
    if (!settingsLoaded || semesters.length === 0) return
    const stillValid = semesters.some((s) => s.label === currentSemester)
    if (stillValid) return
    const active = semesters.find((s) => s.isActive)
    if (active) setCurrentSemester(active.label)
  }, [settingsLoaded, semesters, currentSemester, setCurrentSemester])

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
          <Route path="semesters" element={<SemestersPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      <Toaster />
      <KeyboardShortcuts />
    </HashRouter>
  )
}

export default App
