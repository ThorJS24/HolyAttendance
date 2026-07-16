import { useEffect, useMemo } from 'react'
import { useAttendanceStore } from '@/store/attendance-store'
import { useTimetableStore } from '@/store/timetable-store'
import { useHolidaysStore } from '@/store/holidays-store'
import { useYellowFormsStore } from '@/store/yellow-forms-store'
import { usePeriodTypeRulesStore } from '@/store/period-type-rules-store'
import { computeAttendance, aggregateOverall, type SubjectAttendance } from '@/lib/attendance-engine'

export interface UseAttendanceResult {
  bySubject: Map<number, SubjectAttendance>
  overall: ReturnType<typeof aggregateOverall>
  loading: boolean
}

/**
 * Loads every input the attendance engine needs and recomputes live stats
 * whenever any of it changes. `semester` scopes which timetable slots feed
 * the engine's period-type lookups; attendance records, holidays, yellow
 * forms, and rules are otherwise global.
 */
export function useAttendance(semester: string | null): UseAttendanceResult {
  const records = useAttendanceStore((s) => s.records)
  const loadRecords = useAttendanceStore((s) => s.load)
  const recordsLoading = useAttendanceStore((s) => s.loading)

  const slots = useTimetableStore((s) => s.slots)
  const loadSlots = useTimetableStore((s) => s.load)

  const holidays = useHolidaysStore((s) => s.holidays)
  const loadHolidays = useHolidaysStore((s) => s.load)

  const yellowForms = useYellowFormsStore((s) => s.forms)
  const loadYellowForms = useYellowFormsStore((s) => s.load)

  const rules = usePeriodTypeRulesStore((s) => s.rules)
  const loadRules = usePeriodTypeRulesStore((s) => s.load)

  useEffect(() => {
    loadRecords()
    loadHolidays()
    loadYellowForms()
    loadRules()
  }, [loadRecords, loadHolidays, loadYellowForms, loadRules])

  useEffect(() => {
    if (semester) loadSlots(semester)
  }, [loadSlots, semester])

  const bySubject = useMemo(
    () => computeAttendance({ records, slots, holidays, yellowForms, rules }),
    [records, slots, holidays, yellowForms, rules],
  )

  const overall = useMemo(() => aggregateOverall(bySubject), [bySubject])

  return { bySubject, overall, loading: recordsLoading }
}
