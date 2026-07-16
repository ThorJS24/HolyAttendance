import { describe, it, expect } from 'vitest'
import { computeAttendanceTrend, computeDailyAttendance } from './attendance-trend'
import type { PeriodTypeRule, AttendanceRecordInput } from './attendance-engine'

const RULES: PeriodTypeRule[] = [{ type: 'class', bucket: 'normal' }]
const SUBJECT_ID = 1

function record(date: string, status: 'present' | 'absent'): AttendanceRecordInput {
  return { subjectId: SUBJECT_ID, date, period: 1, status, slotId: null }
}

describe('computeAttendanceTrend', () => {
  it('buckets by month and computes a cumulative (not per-bucket) percentage', () => {
    const records = [
      record('2026-01-05', 'present'),
      record('2026-01-20', 'absent'),
      record('2026-02-03', 'present'),
    ]

    const trend = computeAttendanceTrend({
      records,
      slots: [],
      holidays: [],
      yellowForms: [],
      rules: RULES,
      granularity: 'month',
    })

    expect(trend).toEqual([
      { bucket: '2026-01', percentage: 50, total: 2, attended: 1 }, // 1 present, 1 absent by end of Jan
      { bucket: '2026-02', percentage: (2 / 3) * 100, total: 3, attended: 2 }, // cumulative through Feb
    ])
  })

  it('buckets by week (Monday start)', () => {
    // 2026-01-05 is a Monday, 2026-01-08 is in the same week, 2026-01-13 is the next Monday
    const records = [record('2026-01-05', 'present'), record('2026-01-08', 'present'), record('2026-01-13', 'absent')]

    const trend = computeAttendanceTrend({
      records,
      slots: [],
      holidays: [],
      yellowForms: [],
      rules: RULES,
      granularity: 'week',
    })

    expect(trend.map((p) => p.bucket)).toEqual(['2026-01-05', '2026-01-12'])
    expect(trend[0]).toEqual({ bucket: '2026-01-05', percentage: 100, total: 2, attended: 2 })
    expect(trend[1]).toEqual({ bucket: '2026-01-12', percentage: (2 / 3) * 100, total: 3, attended: 2 })
  })

  it('returns an empty trend with no records', () => {
    expect(
      computeAttendanceTrend({ records: [], slots: [], holidays: [], yellowForms: [], rules: RULES, granularity: 'month' }),
    ).toEqual([])
  })
})

describe('computeDailyAttendance', () => {
  it('computes each date in isolation, not cumulatively', () => {
    const records = [record('2026-01-05', 'present'), record('2026-01-06', 'absent'), record('2026-01-06', 'absent')]
    const daily = computeDailyAttendance({ records, slots: [], holidays: [], yellowForms: [], rules: RULES })

    expect(daily.get('2026-01-05')).toEqual({ total: 1, attended: 1, percentage: 100 })
    expect(daily.get('2026-01-06')).toEqual({ total: 2, attended: 0, percentage: 0 })
  })
})
