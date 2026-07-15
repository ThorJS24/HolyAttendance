import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// Weekday keys used across timetable_slots and holidays scoping.
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type Weekday = (typeof WEEKDAYS)[number]

// Period types are table-driven (see periodTypeRules) rather than hardcoded
// in the attendance engine, so new institution-specific types can be added
// by inserting a row instead of touching engine code.
export const PERIOD_TYPES = ['class', 'project', 'mentoring', 'meeting', 'minor', 'lunch'] as const
export type PeriodType = (typeof PERIOD_TYPES)[number]

export const ATTENDANCE_STATUSES = ['present', 'absent'] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export const ATTENDANCE_SOURCES = ['manual', 'timetable'] as const
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number]

export const HOLIDAY_TYPES = ['public', 'university', 'working_saturday', 'custom'] as const
export type HolidayType = (typeof HOLIDAY_TYPES)[number]

export const LEAVE_PLAN_STATUSES = ['planned', 'taken', 'cancelled'] as const
export type LeavePlanStatus = (typeof LEAVE_PLAN_STATUSES)[number]

export const YELLOW_FORM_STATUSES = ['pending', 'approved', 'rejected'] as const
export type YellowFormStatus = (typeof YELLOW_FORM_STATUSES)[number]

export const subjects = sqliteTable('subjects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  semester: text('semester').notNull(),
  credits: integer('credits').notNull().default(0),
  faculty: text('faculty'),
  category: text('category'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

// Governs how each period type folds into attendance totals. Table-driven so
// new rules (e.g. a new institution-specific period type) can be added via a
// row insert instead of an engine code change.
export const periodTypeRules = sqliteTable('period_type_rules', {
  type: text('type').$type<PeriodType>().primaryKey(),
  // 'excluded' = never counted, 'project' = folds into the Project Work
  // bucket, 'normal' = counts against the subject directly, 'ignored' = not
  // shown/counted at all (e.g. lunch).
  bucket: text('bucket').$type<'excluded' | 'project' | 'normal' | 'ignored'>().notNull(),
})

export const timetableSlots = sqliteTable('timetable_slots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  semester: text('semester').notNull(),
  day: text('day').$type<Weekday>().notNull(),
  period: integer('period').notNull(),
  subjectId: integer('subject_id').references(() => subjects.id, { onDelete: 'cascade' }),
  type: text('type').$type<PeriodType>().notNull().default('class'),
  startTime: text('start_time'),
  endTime: text('end_time'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const attendanceRecords = sqliteTable('attendance_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subjectId: integer('subject_id')
    .notNull()
    .references(() => subjects.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  period: integer('period').notNull(),
  status: text('status').$type<AttendanceStatus>().notNull(),
  source: text('source').$type<AttendanceSource>().notNull().default('manual'),
  slotId: integer('slot_id').references(() => timetableSlots.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const holidays = sqliteTable('holidays', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  type: text('type').$type<HolidayType>().notNull(),
  label: text('label'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const leavePlans = sqliteTable('leave_plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  label: text('label'),
  // JSON-encoded array of ISO date strings.
  dates: text('dates', { mode: 'json' }).$type<string[]>().notNull(),
  status: text('status').$type<LeavePlanStatus>().notNull().default('planned'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const yellowForms = sqliteTable('yellow_forms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  subjectId: integer('subject_id')
    .notNull()
    .references(() => subjects.id, { onDelete: 'cascade' }),
  period: integer('period'),
  status: text('status').$type<YellowFormStatus>().notNull().default('pending'),
  reason: text('reason'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

// Singleton row (id = 1) holding app-wide settings.
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  minTarget: real('min_target').notNull().default(75),
  theme: text('theme').notNull().default('system'),
  currentSemester: text('current_semester').notNull().default(''),
  backupIntervalDays: integer('backup_interval_days').notNull().default(7),
  backupDir: text('backup_dir'),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const SETTINGS_SINGLETON_ID = 1

export const schema = {
  subjects,
  periodTypeRules,
  timetableSlots,
  attendanceRecords,
  holidays,
  leavePlans,
  yellowForms,
  settings,
}
