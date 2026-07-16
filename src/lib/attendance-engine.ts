// Pure attendance calculation engine. No UI or DB imports on purpose: the
// dashboard, the simulator/predictor (Phase 5), and analytics all need the
// exact same math, and the safest way to guarantee that is one module with
// no side effects that every caller feeds plain data into.

export type AttendanceStatus = 'present' | 'absent'
export type YellowFormStatus = 'pending' | 'approved' | 'rejected'

// Which bucket a period type falls into. Table-driven (see
// electron/db/repositories/period-type-rules.ts) so a new institution-
// specific period type can be added without touching this file:
//   - 'excluded': happened, but never counts (e.g. meetings)
//   - 'project':  counts toward the subject total AND a separate "Project
//                 Work" sub-total (e.g. mentoring, minor)
//   - 'normal':   counts toward the subject total only (e.g. class)
//   - 'ignored':  not a class at all, never shown or counted (e.g. lunch)
export type AttendanceBucket = 'excluded' | 'project' | 'normal' | 'ignored'

export interface PeriodTypeRule {
  type: string
  bucket: AttendanceBucket
}

// A holiday's `type` determines whether it excludes scheduled periods.
// `working_saturday` is the one deliberate exception: it marks a Saturday
// that has been redesignated a working day (compensating for a holiday
// elsewhere in the term), so unlike the other types it does NOT exclude
// periods on that date.
export type HolidayType = 'public' | 'university' | 'working_saturday' | 'custom'
const HOLIDAY_TYPES_THAT_EXCLUDE = new Set<HolidayType>(['public', 'university', 'custom'])

export interface HolidayInput {
  date: string
  type: string
}

export interface TimetableSlotInput {
  id: number
  subjectId: number | null
  type: string
}

export interface AttendanceRecordInput {
  subjectId: number
  date: string
  period: number
  status: AttendanceStatus
  slotId: number | null
}

export interface YellowFormInput {
  subjectId: number
  date: string
  /** null means the approval covers every period that subject has that day. */
  period: number | null
  status: YellowFormStatus
}

export interface BucketStats {
  total: number
  attended: number
  /** null when total is 0 (nothing to compute a percentage from yet). */
  percentage: number | null
}

export interface SubjectAttendance {
  subjectId: number
  /** Overall stats: 'normal' + 'project' bucket periods combined. */
  overall: BucketStats
  /** 'class'-type (bucket 'normal') periods only. */
  classWork: BucketStats
  /** Mentoring/minor (bucket 'project') periods only. */
  projectWork: BucketStats
}

function resolveBucket(type: string, rules: PeriodTypeRule[]): AttendanceBucket {
  return rules.find((r) => r.type === type)?.bucket ?? 'normal'
}

function isExcludedHoliday(date: string, holidays: HolidayInput[]): boolean {
  return holidays.some((h) => h.date === date && HOLIDAY_TYPES_THAT_EXCLUDE.has(h.type as HolidayType))
}

function isApprovedByYellowForm(
  record: AttendanceRecordInput,
  yellowForms: YellowFormInput[],
): boolean {
  return yellowForms.some(
    (f) =>
      f.status === 'approved' &&
      f.subjectId === record.subjectId &&
      f.date === record.date &&
      (f.period === null || f.period === record.period),
  )
}

function emptyStats(): BucketStats {
  return { total: 0, attended: 0, percentage: null }
}

function addToStats(stats: BucketStats, attended: boolean): void {
  stats.total += 1
  if (attended) stats.attended += 1
}

function finalizeStats(stats: BucketStats): BucketStats {
  return { ...stats, percentage: stats.total === 0 ? null : (stats.attended / stats.total) * 100 }
}

export interface ComputeAttendanceParams {
  records: AttendanceRecordInput[]
  slots: TimetableSlotInput[]
  holidays: HolidayInput[]
  yellowForms: YellowFormInput[]
  rules: PeriodTypeRule[]
}

/**
 * Computes live, per-subject attendance stats from raw records. Never
 * mutates or persists a percentage anywhere — callers recompute from source
 * data every time, per the "percentages are never stored" rule.
 */
export function computeAttendance(params: ComputeAttendanceParams): Map<number, SubjectAttendance> {
  const { records, slots, holidays, yellowForms, rules } = params
  const slotsById = new Map(slots.map((s) => [s.id, s]))

  const bySubject = new Map<
    number,
    { overall: BucketStats; classWork: BucketStats; projectWork: BucketStats }
  >()

  const getOrCreate = (subjectId: number) => {
    let entry = bySubject.get(subjectId)
    if (!entry) {
      entry = { overall: emptyStats(), classWork: emptyStats(), projectWork: emptyStats() }
      bySubject.set(subjectId, entry)
    }
    return entry
  }

  for (const record of records) {
    if (isExcludedHoliday(record.date, holidays)) continue

    const slot = record.slotId !== null ? slotsById.get(record.slotId) : undefined
    const periodType = slot?.type ?? 'class'
    const bucket = resolveBucket(periodType, rules)
    if (bucket === 'excluded' || bucket === 'ignored') continue

    const attended = record.status === 'present' || isApprovedByYellowForm(record, yellowForms)
    const entry = getOrCreate(record.subjectId)

    addToStats(entry.overall, attended)
    if (bucket === 'project') {
      addToStats(entry.projectWork, attended)
    } else {
      addToStats(entry.classWork, attended)
    }
  }

  const result = new Map<number, SubjectAttendance>()
  for (const [subjectId, entry] of bySubject) {
    result.set(subjectId, {
      subjectId,
      overall: finalizeStats(entry.overall),
      classWork: finalizeStats(entry.classWork),
      projectWork: finalizeStats(entry.projectWork),
    })
  }
  return result
}

/** Aggregates per-subject stats into a single overall figure (e.g. for the dashboard header). */
export function aggregateOverall(bySubject: Map<number, SubjectAttendance>): BucketStats {
  const stats = emptyStats()
  for (const s of bySubject.values()) {
    stats.total += s.overall.total
    stats.attended += s.overall.attended
  }
  return finalizeStats(stats)
}

/**
 * How many more (conducted-but-absent) classes can happen from here while
 * attendance stays at or above `targetPercent`, assuming no more classes are
 * ever attended. Returns 0 if already below target.
 */
export function computeSafeBunkCount(attended: number, total: number, targetPercent: number): number {
  if (targetPercent <= 0) return Infinity
  if (targetPercent >= 100) return 0
  const maxTotal = Math.floor((attended * 100) / targetPercent)
  return Math.max(0, maxTotal - total)
}

/**
 * How many consecutive future classes must be attended (assuming perfect
 * attendance from here) to reach `targetPercent`. Returns 0 if already at or
 * above target.
 */
export function computeClassesNeededToReachTarget(
  attended: number,
  total: number,
  targetPercent: number,
): number {
  if (targetPercent <= 0) return 0
  const currentPercent = total === 0 ? 100 : (attended / total) * 100
  if (currentPercent >= targetPercent) return 0

  // Smallest n such that (attended + n) / (total + n) >= targetPercent / 100
  const p = targetPercent / 100
  const numerator = p * total - attended
  const denominator = 1 - p
  if (denominator <= 0) return Infinity
  return Math.max(0, Math.ceil(numerator / denominator))
}
