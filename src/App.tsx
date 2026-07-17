import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/layout/app-shell'
import { useSettingsStore } from '@/store/settings-store'
import { useSemestersStore } from '@/store/semesters-store'
import { useTheme } from '@/hooks/use-theme'
import { Toaster } from '@/components/ui/toaster'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { Spinner } from '@/components/ui/spinner'

// Route-level code splitting: each page becomes its own chunk instead of all
// nine being bundled (and parsed on launch) into one ~880kB main chunk —
// only the page the user actually navigates to gets fetched/executed.
const DashboardPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.DashboardPage })))
const SubjectsPage = lazy(() => import('@/pages/subjects').then((m) => ({ default: m.SubjectsPage })))
const AttendancePage = lazy(() => import('@/pages/attendance').then((m) => ({ default: m.AttendancePage })))
const TimetablePage = lazy(() => import('@/pages/timetable').then((m) => ({ default: m.TimetablePage })))
const CalendarPage = lazy(() => import('@/pages/calendar').then((m) => ({ default: m.CalendarPage })))
const PlannerPage = lazy(() => import('@/pages/planner').then((m) => ({ default: m.PlannerPage })))
const AnalyticsPage = lazy(() => import('@/pages/analytics').then((m) => ({ default: m.AnalyticsPage })))
const SettingsPage = lazy(() => import('@/pages/settings').then((m) => ({ default: m.SettingsPage })))
const SemestersPage = lazy(() => import('@/pages/semesters').then((m) => ({ default: m.SemestersPage })))

function RouteFallback() {
  return (
    <div className="flex h-full items-center justify-center py-24">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  )
}

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
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
      <Toaster />
      <KeyboardShortcuts />
    </HashRouter>
  )
}

export default App
