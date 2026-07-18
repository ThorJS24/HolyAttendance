// Pure "insight" calculations layered on top of the attendance engine:
// present-streaks and end-of-semester projection. Kept separate (and tested
// directly) so the Dashboard just renders what these return.
import { computeClassesNeededToReachTarget } from './attendance-engine'

export interface StreakRecordInput {
  subjectId: number
  date: string
  period: number
  status: 'present' | 'absent'
}

/** Chronological order for records within a day and across days — the order
 * a streak is counted back through. */
function byDateThenPeriod(a: StreakRecordInput, b: StreakRecordInput): number {
  return a.date === b.date ? a.period - b.period : a.date < b.date ? -1 : 1
}

/**
 * Current present-streak: how many of the most recent consecutive conducted
 * classes were attended, counting back from the latest until the first
 * absence. Only logged records count (an unmarked future class doesn't break
 * or extend anything). 0 if the most recent record is an absence.
 */
export function computeCurrentStreak(records: StreakRecordInput[]): number {
  const sorted = [...records].sort(byDateThenPeriod)
  let streak = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].status === 'present') streak++
    else break
  }
  return streak
}

export function computeStreaksBySubject(records: StreakRecordInput[]): Map<number, number> {
  const bySubject = new Map<number, StreakRecordInput[]>()
  for (const r of records) {
    const list = bySubject.get(r.subjectId)
    if (list) list.push(r)
    else bySubject.set(r.subjectId, [r])
  }
  return new Map(Array.from(bySubject, ([subjectId, recs]) => [subjectId, computeCurrentStreak(recs)]))
}

/**
 * Running attendance percentage after each record, in date/period order — the
 * shape a sparkline draws. Deliberately a plain present/total ratio over a
 * subject's own records: it's a trend indicator, not the headline figure
 * (which the engine computes with bucket/yellow-form rules), so it needs no
 * timetable/holiday inputs. Returns [] for no records.
 */
export function cumulativeAttendanceSeries(records: StreakRecordInput[]): number[] {
  const sorted = [...records].sort(byDateThenPeriod)
  const series: number[] = []
  let attended = 0
  sorted.forEach((r, i) => {
    if (r.status === 'present') attended++
    series.push((attended / (i + 1)) * 100)
  })
  return series
}

export interface Projection {
  /** Periods still scheduled between now and the semester end. */
  remaining: number
  /** Final % if every remaining scheduled period is attended (best case). */
  ifAllAttended: number | null
  /** Final % if none of the remaining are attended (worst case). */
  ifNoneAttended: number | null
  /** Can the target still be reached by attending remaining periods? */
  targetReachable: boolean
  /** How many of the remaining must be attended to hit the target (0 if
   * already at/above; null if unreachable even attending them all). */
  classesNeededForTarget: number | null
}

/**
 * Projects a subject's (or the overall) end-of-semester attendance from where
 * it stands now plus how many periods remain. Pure arithmetic over the engine
 * primitives — no dates here; the caller counts `remaining` via
 * enumerateScheduledPeriods.
 */
export function computeProjection(params: {
  attended: number
  total: number
  remaining: number
  target: number
}): Projection {
  const { attended, total, remaining, target } = params
  const finalTotal = total + remaining
  const ifAllAttended = finalTotal === 0 ? null : ((attended + remaining) / finalTotal) * 100
  const ifNoneAttended = finalTotal === 0 ? null : (attended / finalTotal) * 100

  const needed = computeClassesNeededToReachTarget(attended, total, target)
  const targetReachable = needed <= remaining
  return {
    remaining,
    ifAllAttended,
    ifNoneAttended,
    targetReachable,
    classesNeededForTarget: targetReachable ? needed : null,
  }
}
