import { useMemo } from 'react'
import { useSubjectsStore } from '@/store/subjects-store'
import { useSettingsStore } from '@/store/settings-store'
import { useHolidaysStore } from '@/store/holidays-store'
import { useAttendance } from './use-attendance'
import { buildNotifications, type AppNotification } from '@/lib/notifications'
import { todayIso } from '@/lib/date-utils'

export function useNotifications(): AppNotification[] {
  const subjects = useSubjectsStore((s) => s.subjects)
  const overallMinTarget = useSettingsStore((s) => s.overallMinTarget)
  const subjectMinTarget = useSettingsStore((s) => s.subjectMinTarget)
  const currentSemester = useSettingsStore((s) => s.currentSemester)
  const holidays = useHolidaysStore((s) => s.holidays)
  const { bySubject, overall } = useAttendance(currentSemester || null)

  return useMemo(() => {
    const bySubjectOverall = new Map(
      Array.from(bySubject.entries()).map(([subjectId, stats]) => [subjectId, stats.overall]),
    )
    return buildNotifications({
      subjects,
      bySubjectOverall,
      overall,
      overallMinTarget,
      subjectMinTarget,
      holidays,
      today: todayIso(),
    })
  }, [subjects, bySubject, overall, overallMinTarget, subjectMinTarget, holidays])
}
