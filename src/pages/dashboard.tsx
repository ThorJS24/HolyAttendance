import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarDays, ShieldCheck, Flame } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Sparkline } from '@/components/ui/sparkline'
import { SemesterSwitcher } from '@/components/semester-switcher'
import { useSubjectsStore } from '@/store/subjects-store'
import { useSettingsStore } from '@/store/settings-store'
import { useHolidaysStore } from '@/store/holidays-store'
import { useTimetableStore } from '@/store/timetable-store'
import { useAttendance } from '@/hooks/use-attendance'
import { computeSafeBunkCount, resolveSubjectMinTarget, jsDayToWeekday } from '@/lib/attendance-engine'
import { computeProjection, cumulativeAttendanceSeries } from '@/lib/insights'
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
  const { bySubject, overall, streaksBySubject, bestStreak, remainingBySubject, remainingOverall, recordsBySubject } =
    useAttendance(semester)

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
          const streak = streaksBySubject.get(subject.id) ?? 0
          const projection = computeProjection({
            attended: overallStats.attended,
            total: overallStats.total,
            remaining: remainingBySubject.get(subject.id) ?? 0,
            target: resolvedTarget,
          })
          const series = cumulativeAttendanceSeries(recordsBySubject.get(subject.id) ?? [])
          return { subject, stats, overallStats, resolvedTarget, safeBunks, streak, projection, series }
        })
        .sort((a, b) => (a.overallStats.percentage ?? 100) - (b.overallStats.percentage ?? 100)),
    [subjects, bySubject, subjectMinTarget, streaksBySubject, remainingBySubject, recordsBySubject],
  )

  const belowTarget = subjectRows.filter(
    (row) => row.overallStats.percentage !== null && row.overallStats.percentage < row.resolvedTarget,
  )

  const overallProjection = useMemo(
    () =>
      computeProjection({
        attended: overall.attended,
        total: overall.total,
        remaining: remainingOverall,
        target: overallMinTarget,
      }),
    [overall, remainingOverall, overallMinTarget],
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
            <CardTitle className={cn('text-3xl tabular-nums', percentColor(overall.percentage, overallMinTarget))}>
              {overall.percentage === null ? '—' : `${overall.percentage.toFixed(1)}%`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={overall.percentage ?? 0} />
            <p className="mt-2 text-xs text-muted-foreground">
              {overall.attended} / {overall.total} periods attended · target {overallMinTarget}%
            </p>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              {remainingOverall > 0 && overallProjection.ifAllAttended !== null && (
                <span
                  title={`If you attend all ${remainingOverall} remaining periods you finish at ${overallProjection.ifAllAttended.toFixed(1)}%; if none, ${overallProjection.ifNoneAttended?.toFixed(1)}%.`}
                >
                  Projected {overallProjection.ifNoneAttended?.toFixed(0)}–{overallProjection.ifAllAttended.toFixed(0)}%
                  by term end
                </span>
              )}
              {bestStreak >= 3 && (
                <span className="flex items-center gap-0.5 text-warning">
                  <Flame className="size-3" /> {bestStreak} best streak
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="size-3.5" /> Below target
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">{belowTarget.length}</CardTitle>
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
            <CardTitle className="text-3xl tabular-nums">{todaysClasses.length}</CardTitle>
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
            {subjectRows.map(({ subject, overallStats, resolvedTarget, safeBunks, streak, projection, series }) => (
              <div key={subject.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{subject.name}</span>
                    {streak >= 3 && (
                      <span
                        className="flex shrink-0 items-center gap-0.5 text-xs text-warning"
                        title={`${streak} in a row attended`}
                      >
                        <Flame className="size-3" />
                        {streak}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Sparkline values={series} className="hidden sm:block" />
                    <span className={cn('tabular-nums', percentColor(overallStats.percentage, resolvedTarget))}>
                      {overallStats.percentage === null ? '—' : `${overallStats.percentage.toFixed(1)}%`}
                    </span>
                  </span>
                </div>
                <Progress value={overallStats.percentage ?? 0} />
                <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted-foreground">
                  <span>
                    {overallStats.attended} / {overallStats.total} periods
                  </span>
                  <span className="flex items-center gap-3">
                    {projection.remaining > 0 && projection.ifAllAttended !== null && (
                      <span
                        title={`If you attend all ${projection.remaining} remaining, you finish at ${projection.ifAllAttended.toFixed(1)}%. If you attend none, ${projection.ifNoneAttended?.toFixed(1)}%.`}
                      >
                        {overallStats.percentage !== null && overallStats.percentage < resolvedTarget
                          ? projection.targetReachable
                            ? `${projection.classesNeededForTarget} of ${projection.remaining} left to hit ${resolvedTarget}%`
                            : `Can't reach ${resolvedTarget}% this term`
                          : `Projected ${projection.ifNoneAttended?.toFixed(0)}–${projection.ifAllAttended.toFixed(0)}%`}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="size-3" /> {safeBunks} safe bunk{safeBunks === 1 ? '' : 's'}
                    </span>
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
