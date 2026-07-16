import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarDays, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { SemesterSwitcher } from '@/components/semester-switcher'
import { useSubjectsStore } from '@/store/subjects-store'
import { useSettingsStore } from '@/store/settings-store'
import { useHolidaysStore } from '@/store/holidays-store'
import { useTimetableStore } from '@/store/timetable-store'
import { useAttendance } from '@/hooks/use-attendance'
import { computeSafeBunkCount, resolveSubjectMinTarget, jsDayToWeekday } from '@/lib/attendance-engine'
import { todayIso } from '@/lib/date-utils'
import { cn } from '@/lib/utils'

function percentColor(percent: number | null, target: number): string {
  if (percent === null) return 'text-muted-foreground'
  if (percent < target) return 'text-destructive'
  if (percent < target + 5) return 'text-warning'
  return 'text-success'
}

export function DashboardPage() {
  const { subjects, load: loadSubjects } = useSubjectsStore()
  const currentSemester = useSettingsStore((s) => s.currentSemester)
  const overallMinTarget = useSettingsStore((s) => s.overallMinTarget)
  const subjectMinTarget = useSettingsStore((s) => s.subjectMinTarget)
  const { holidays, load: loadHolidays } = useHolidaysStore()
  const { slots, load: loadSlots } = useTimetableStore()

  const semester = currentSemester || null
  const { bySubject, overall } = useAttendance(semester)

  useEffect(() => {
    loadSubjects({ includeArchived: false })
    loadHolidays()
  }, [loadSubjects, loadHolidays])

  useEffect(() => {
    if (semester) loadSlots(semester)
  }, [loadSlots, semester])

  const today = todayIso()
  const todayWeekday = jsDayToWeekday(today)
  const todayHoliday = holidays.find((h) => h.date === today && h.type !== 'working_saturday')

  const subjectsById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  const todaysClasses = useMemo(() => {
    if (!todayWeekday) return []
    return slots
      .filter((s) => s.day === todayWeekday)
      .sort((a, b) => a.period - b.period)
      .map((s) => ({ ...s, subjectName: s.subjectId ? subjectsById.get(s.subjectId)?.name : undefined }))
  }, [slots, todayWeekday, subjectsById])

  const upcomingHolidays = useMemo(
    () =>
      holidays
        .filter((h) => h.date >= today)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .slice(0, 5),
    [holidays, today],
  )

  const subjectRows = useMemo(
    () =>
      subjects
        .map((subject) => {
          const stats = bySubject.get(subject.id)
          const overallStats = stats?.overall ?? { total: 0, attended: 0, percentage: null }
          const resolvedTarget = resolveSubjectMinTarget(subject, subjectMinTarget)
          const safeBunks = computeSafeBunkCount(overallStats.attended, overallStats.total, resolvedTarget)
          return { subject, stats, overallStats, resolvedTarget, safeBunks }
        })
        .sort((a, b) => (a.overallStats.percentage ?? 100) - (b.overallStats.percentage ?? 100)),
    [subjects, bySubject, subjectMinTarget],
  )

  const belowTarget = subjectRows.filter(
    (row) => row.overallStats.percentage !== null && row.overallStats.percentage < row.resolvedTarget,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <SemesterSwitcher />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Overall attendance</CardDescription>
            <CardTitle className={cn('text-3xl', percentColor(overall.percentage, overallMinTarget))}>
              {overall.percentage === null ? '—' : `${overall.percentage.toFixed(1)}%`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={overall.percentage ?? 0} />
            <p className="mt-2 text-xs text-muted-foreground">
              {overall.attended} / {overall.total} periods attended · target {overallMinTarget}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="size-3.5" /> Below target
            </CardDescription>
            <CardTitle className="text-3xl">{belowTarget.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {belowTarget.length === 0
                ? 'No subjects below target.'
                : belowTarget.map((r) => r.subject.name).join(', ')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1">
              <CalendarDays className="size-3.5" /> Today
            </CardDescription>
            <CardTitle className="text-3xl">{todaysClasses.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {todayHoliday ? `Holiday: ${todayHoliday.label ?? todayHoliday.type}` : 'scheduled periods'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Subject-wise attendance</CardTitle>
            <CardDescription>Live, computed from attendance records — never stored.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subjectRows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No subjects yet. <Link to="/subjects" className="underline">Add one</Link>.
              </p>
            )}
            {subjectRows.map(({ subject, overallStats, resolvedTarget, safeBunks }) => (
              <div key={subject.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{subject.name}</span>
                  <span className={cn('tabular-nums', percentColor(overallStats.percentage, resolvedTarget))}>
                    {overallStats.percentage === null ? '—' : `${overallStats.percentage.toFixed(1)}%`}
                  </span>
                </div>
                <Progress value={overallStats.percentage ?? 0} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {overallStats.attended} / {overallStats.total} periods
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="size-3" /> {safeBunks} safe bunk{safeBunks === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s classes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayHoliday && (
                <Badge variant="warning">Holiday: {todayHoliday.label ?? todayHoliday.type}</Badge>
              )}
              {!todayHoliday && todaysClasses.length === 0 && (
                <p className="text-sm text-muted-foreground">No classes scheduled today.</p>
              )}
              {!todayHoliday &&
                todaysClasses.map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between text-sm">
                    <span>
                      P{slot.period} · {slot.subjectName ?? slot.type}
                    </span>
                    <Badge variant="outline">{slot.type}</Badge>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming holidays</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingHolidays.length === 0 && (
                <p className="text-sm text-muted-foreground">No upcoming holidays on record.</p>
              )}
              {upcomingHolidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm">
                  <span>{h.label ?? h.type}</span>
                  <span className="text-muted-foreground">{h.date}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
