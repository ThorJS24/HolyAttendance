import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'node:path'
import { schema } from '../../../src/db/schema'
import type { AppDatabase } from '../client'
import * as subjectsRepo from './subjects'
import * as timetableSlotsRepo from './timetable-slots'
import * as attendanceRecordsRepo from './attendance-records'
import * as holidaysRepo from './holidays'
import * as leavePlansRepo from './leave-plans'
import * as yellowFormsRepo from './yellow-forms'
import * as settingsRepo from './settings'

function createTestDb(): AppDatabase {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: path.join(__dirname, '../migrations') })
  return db
}

describe('subjects repository', () => {
  let db: AppDatabase
  beforeEach(() => {
    db = createTestDb()
  })

  it('creates, lists, updates, archives, and deletes a subject', () => {
    const created = subjectsRepo.createSubject(db, {
      name: 'Data Structures',
      semester: '2026-1',
      credits: 4,
      faculty: 'Dr. Rao',
      category: 'core',
    })
    expect(created.id).toBeTypeOf('number')
    expect(created.archived).toBe(false)

    expect(subjectsRepo.listSubjects(db, { semester: '2026-1' })).toHaveLength(1)
    expect(subjectsRepo.listSubjects(db, { semester: '2025-2' })).toHaveLength(0)

    const updated = subjectsRepo.updateSubject(db, created.id, { credits: 5 })
    expect(updated.credits).toBe(5)

    const archived = subjectsRepo.setSubjectArchived(db, created.id, true)
    expect(archived.archived).toBe(true)
    expect(subjectsRepo.listSubjects(db, { semester: '2026-1' })).toHaveLength(0)
    expect(subjectsRepo.listSubjects(db, { semester: '2026-1', includeArchived: true })).toHaveLength(1)

    subjectsRepo.deleteSubject(db, created.id)
    expect(subjectsRepo.getSubject(db, created.id)).toBeUndefined()
  })

  it('defaults customMinTarget to null and persists an explicit override', () => {
    const created = subjectsRepo.createSubject(db, {
      name: 'Operating Systems',
      semester: '2026-1',
      credits: 3,
      faculty: null,
      category: null,
    })
    expect(created.customMinTarget).toBeNull()

    const overridden = subjectsRepo.updateSubject(db, created.id, { customMinTarget: 60 })
    expect(overridden.customMinTarget).toBe(60)

    const clearedBackToDefault = subjectsRepo.updateSubject(db, created.id, { customMinTarget: null })
    expect(clearedBackToDefault.customMinTarget).toBeNull()
  })
})

describe('timetable slots repository', () => {
  let db: AppDatabase
  beforeEach(() => {
    db = createTestDb()
  })

  it('scopes slots by semester and finds a slot by day/period', () => {
    const subject = subjectsRepo.createSubject(db, {
      name: 'Algorithms',
      semester: '2026-1',
      credits: 3,
      faculty: null,
      category: null,
    })

    timetableSlotsRepo.createTimetableSlot(db, {
      semester: '2026-1',
      day: 'mon',
      period: 1,
      subjectId: subject.id,
      type: 'class',
      startTime: null,
      endTime: null,
    })
    timetableSlotsRepo.createTimetableSlot(db, {
      semester: '2025-2',
      day: 'mon',
      period: 1,
      subjectId: subject.id,
      type: 'class',
      startTime: null,
      endTime: null,
    })

    expect(timetableSlotsRepo.listTimetableSlots(db, { semester: '2026-1' })).toHaveLength(1)
    const found = timetableSlotsRepo.findSlot(db, { semester: '2026-1', day: 'mon', period: 1 })
    expect(found?.subjectId).toBe(subject.id)
  })

  it('cascades subject deletion to its timetable slots', () => {
    const subject = subjectsRepo.createSubject(db, {
      name: 'Networks',
      semester: '2026-1',
      credits: 3,
      faculty: null,
      category: null,
    })
    const slot = timetableSlotsRepo.createTimetableSlot(db, {
      semester: '2026-1',
      day: 'tue',
      period: 2,
      subjectId: subject.id,
      type: 'class',
      startTime: null,
      endTime: null,
    })

    subjectsRepo.deleteSubject(db, subject.id)
    expect(timetableSlotsRepo.getTimetableSlot(db, slot.id)).toBeUndefined()
  })

  it('assigning the same semester/day/period twice updates the slot instead of duplicating it', () => {
    const subjectA = subjectsRepo.createSubject(db, {
      name: 'A',
      semester: '2026-1',
      credits: 3,
      faculty: null,
      category: null,
    })
    const subjectB = subjectsRepo.createSubject(db, {
      name: 'B',
      semester: '2026-1',
      credits: 3,
      faculty: null,
      category: null,
    })

    const first = timetableSlotsRepo.createTimetableSlot(db, {
      semester: '2026-1',
      day: 'mon',
      period: 1,
      subjectId: subjectA.id,
      type: 'class',
      startTime: null,
      endTime: null,
    })
    const second = timetableSlotsRepo.createTimetableSlot(db, {
      semester: '2026-1',
      day: 'mon',
      period: 1,
      subjectId: subjectB.id,
      type: 'meeting',
      startTime: null,
      endTime: null,
    })

    expect(second.id).toBe(first.id)
    expect(second.subjectId).toBe(subjectB.id)
    expect(second.type).toBe('meeting')
    expect(timetableSlotsRepo.listTimetableSlots(db, { semester: '2026-1' })).toHaveLength(1)
  })
})

describe('attendance records repository', () => {
  let db: AppDatabase
  beforeEach(() => {
    db = createTestDb()
  })

  it('filters records by subject and date range', () => {
    const subject = subjectsRepo.createSubject(db, {
      name: 'DBMS',
      semester: '2026-1',
      credits: 4,
      faculty: null,
      category: null,
    })

    attendanceRecordsRepo.createAttendanceRecord(db, {
      subjectId: subject.id,
      date: '2026-01-10',
      period: 1,
      status: 'present',
      source: 'manual',
      slotId: null,
    })
    attendanceRecordsRepo.createAttendanceRecord(db, {
      subjectId: subject.id,
      date: '2026-02-10',
      period: 1,
      status: 'absent',
      source: 'manual',
      slotId: null,
    })

    expect(attendanceRecordsRepo.listAttendanceRecords(db, { subjectId: subject.id })).toHaveLength(2)
    expect(
      attendanceRecordsRepo.listAttendanceRecords(db, {
        subjectId: subject.id,
        dateFrom: '2026-02-01',
        dateTo: '2026-02-28',
      }),
    ).toHaveLength(1)
  })

  it('updates and deletes a record', () => {
    const subject = subjectsRepo.createSubject(db, {
      name: 'OS',
      semester: '2026-1',
      credits: 4,
      faculty: null,
      category: null,
    })
    const record = attendanceRecordsRepo.createAttendanceRecord(db, {
      subjectId: subject.id,
      date: '2026-01-10',
      period: 1,
      status: 'absent',
      source: 'manual',
      slotId: null,
    })

    const updated = attendanceRecordsRepo.updateAttendanceRecord(db, record.id, { status: 'present' })
    expect(updated.status).toBe('present')

    attendanceRecordsRepo.deleteAttendanceRecord(db, record.id)
    expect(attendanceRecordsRepo.getAttendanceRecord(db, record.id)).toBeUndefined()
  })

  it('marking the same subject/date/period twice updates the record instead of duplicating it', () => {
    const subject = subjectsRepo.createSubject(db, {
      name: 'Networks',
      semester: '2026-1',
      credits: 3,
      faculty: null,
      category: null,
    })

    const first = attendanceRecordsRepo.createAttendanceRecord(db, {
      subjectId: subject.id,
      date: '2026-01-10',
      period: 1,
      status: 'absent',
      source: 'manual',
      slotId: null,
    })
    const second = attendanceRecordsRepo.createAttendanceRecord(db, {
      subjectId: subject.id,
      date: '2026-01-10',
      period: 1,
      status: 'present',
      source: 'manual',
      slotId: null,
    })

    expect(second.id).toBe(first.id)
    expect(second.status).toBe('present')
    expect(attendanceRecordsRepo.listAttendanceRecords(db, { subjectId: subject.id })).toHaveLength(1)
  })
})

describe('holidays repository', () => {
  it('creates, updates, and deletes a holiday, enforcing unique dates', () => {
    const db = createTestDb()
    const holiday = holidaysRepo.createHoliday(db, { date: '2026-01-26', type: 'public', label: 'Republic Day' })
    expect(holidaysRepo.listHolidays(db)).toHaveLength(1)

    expect(() => holidaysRepo.createHoliday(db, { date: '2026-01-26', type: 'custom', label: null })).toThrow()

    const updated = holidaysRepo.updateHoliday(db, holiday.id, { label: 'Republic Day (updated)' })
    expect(updated.label).toBe('Republic Day (updated)')

    holidaysRepo.deleteHoliday(db, holiday.id)
    expect(holidaysRepo.listHolidays(db)).toHaveLength(0)
  })
})

describe('leave plans repository', () => {
  it('stores a JSON array of dates', () => {
    const db = createTestDb()
    const plan = leavePlansRepo.createLeavePlan(db, {
      label: 'Family trip',
      dates: ['2026-03-01', '2026-03-02'],
      status: 'planned',
    })
    expect(plan.dates).toEqual(['2026-03-01', '2026-03-02'])

    const cancelled = leavePlansRepo.updateLeavePlan(db, plan.id, { status: 'cancelled' })
    expect(cancelled.status).toBe('cancelled')

    leavePlansRepo.deleteLeavePlan(db, plan.id)
    expect(leavePlansRepo.listLeavePlans(db)).toHaveLength(0)
  })
})

describe('yellow forms repository', () => {
  it('defaults new forms to pending and supports status transitions', () => {
    const db = createTestDb()
    const subject = subjectsRepo.createSubject(db, {
      name: 'Compilers',
      semester: '2026-1',
      credits: 3,
      faculty: null,
      category: null,
    })

    const form = yellowFormsRepo.createYellowForm(db, {
      date: '2026-01-15',
      subjectId: subject.id,
      period: 2,
      reason: 'Medical',
    })
    expect(form.status).toBe('pending')

    const approved = yellowFormsRepo.setYellowFormStatus(db, form.id, 'approved')
    expect(approved.status).toBe('approved')

    expect(yellowFormsRepo.listYellowForms(db, { subjectId: subject.id })).toHaveLength(1)

    yellowFormsRepo.deleteYellowForm(db, form.id)
    expect(yellowFormsRepo.listYellowForms(db)).toHaveLength(0)
  })
})

describe('settings repository', () => {
  it('ensures a singleton row with defaults and persists updates to both targets independently', () => {
    const db = createTestDb()
    const settings = settingsRepo.getSettings(db)
    expect(settings.id).toBe(1)
    expect(settings.overallMinTarget).toBe(75)
    expect(settings.subjectMinTarget).toBe(75)

    const updated = settingsRepo.updateSettings(db, {
      overallMinTarget: 80,
      subjectMinTarget: 70,
      currentSemester: '2026-1',
    })
    expect(updated.overallMinTarget).toBe(80)
    expect(updated.subjectMinTarget).toBe(70)
    expect(updated.currentSemester).toBe('2026-1')

    // A second ensure/get call must not create a duplicate row.
    settingsRepo.ensureSettingsRow(db)
    expect(settingsRepo.getSettings(db).overallMinTarget).toBe(80)
    expect(settingsRepo.getSettings(db).subjectMinTarget).toBe(70)
  })
})
