import { useMemo } from 'react'
import { useSubjectsStore } from '@/store/subjects-store'
import { useSettingsStore } from '@/store/settings-store'
import { useHolidaysStore } from '@/store/holidays-store'
import { useAttendance } from './use-attendance'
import { computeSafeBunkCount } from '@/lib/attendance-engine'
import { todayIso } from '@/lib/date-utils'

export type NotificationSeverity = 'critical' | 'warning' | 'info'

export interface AppNotification {
  id: string
  severity: NotificationSeverity
  title: string
  description: string
}

const AT_RISK_MARGIN_PP = 5
const UPCOMING_HOLIDAY_WINDOW_DAYS = 14

export function useNotifications(): AppNotification[] {
  const subjects = useSubjectsStore((s) => s.subjects)
  const minTarget = useSettingsStore((s) => s.minTarget)
  const currentSemester = useSettingsStore((s) => s.currentSemester)
  const holidays = useHolidaysStore((s) => s.holidays)
  const { bySubject } = useAttendance(currentSemester || null)

  return useMemo(() => {
    const notifications: AppNotification[] = []
    const today = todayIso()

    for (const subject of subjects) {
      const stats = bySubject.get(subject.id)?.overall
      if (!stats || stats.percentage === null) continue

      if (stats.percentage < minTarget) {
        notifications.push({
          id: `below-target-${subject.id}`,
          severity: 'critical',
          title: `${subject.name} is below target`,
          description: `${stats.percentage.toFixed(1)}% attended, target is ${minTarget}%.`,
        })
      } else if (stats.percentage < minTarget + AT_RISK_MARGIN_PP) {
        notifications.push({
          id: `at-risk-${subject.id}`,
          severity: 'warning',
          title: `${subject.name} is close to the target`,
          description: `${stats.percentage.toFixed(1)}% attended — within ${AT_RISK_MARGIN_PP} points of ${minTarget}%.`,
        })
      }

      const safeBunks = computeSafeBunkCount(stats.attended, stats.total, minTarget)
      if (safeBunks === 0 && stats.percentage >= minTarget) {
        notifications.push({
          id: `safe-bunk-zero-${subject.id}`,
          severity: 'warning',
          title: `${subject.name} has no safe bunks left`,
          description: 'Missing the next class would drop you below target.',
        })
      }
    }

    for (const holiday of holidays) {
      if (holiday.date < today) continue
      const daysAway = Math.round(
        (new Date(`${holiday.date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) /
          (24 * 60 * 60 * 1000),
      )
      if (daysAway <= UPCOMING_HOLIDAY_WINDOW_DAYS) {
        notifications.push({
          id: `holiday-${holiday.id}`,
          severity: 'info',
          title: holiday.label ?? 'Upcoming holiday',
          description: daysAway === 0 ? 'Today' : `In ${daysAway} day${daysAway === 1 ? '' : 's'} (${holiday.date})`,
        })
      }
    }

    const severityRank: Record<NotificationSeverity, number> = { critical: 0, warning: 1, info: 2 }
    return notifications.sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
  }, [subjects, bySubject, minTarget, holidays])
}
