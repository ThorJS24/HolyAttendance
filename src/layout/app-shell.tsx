import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  CalendarCheck,
  Table2,
  CalendarDays,
  BarChart3,
  Wand2,
  Settings,
  GraduationCap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlobalSearch } from '@/components/global-search'
import { NotificationCenter } from '@/components/notification-center'
import { ErrorBoundary } from '@/components/error-boundary'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/timetable', label: 'Timetable', icon: Table2 },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/planner', label: 'Planner', icon: Wand2 },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/semesters', label: 'Semesters', icon: GraduationCap },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppShell() {
  const location = useLocation()
  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-lg font-semibold">BunkMate Pro</span>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
          <GlobalSearch />
          <NotificationCenter />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
