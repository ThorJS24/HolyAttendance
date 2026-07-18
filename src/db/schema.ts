import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core'

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

// Denormalized onto yellowForms itself so a list view doesn't need a join
// just to know whether a form is under dispute. Deliberately kept separate
// from YellowFormStatus rather than folded in (e.g. no 'disputed' status
// value) — a dispute is a process layered on top of a decision, not a
// replacement decision, so it gets its own log (yellowFormDisputes) and this
// small flag.
export const YELLOW_FORM_DISPUTE_STATUSES = ['none', 'disputed', 'resolved'] as const
export type YellowFormDisputeStatus = (typeof YELLOW_FORM_DISPUTE_STATUSES)[number]

export const YELLOW_FORM_DISPUTE_OUTCOMES = ['upheld', 'overturned'] as const
export type YellowFormDisputeOutcome = (typeof YELLOW_FORM_DISPUTE_OUTCOMES)[number]

// One entry per period row shown on the Timetable grid for a semester
// (teaching periods + lunch), produced by allocateEvenPeriodTimes() in
// src/lib/period-time-allocation.ts. Shape duplicated there on purpose
// rather than imported, matching how attendance-engine.ts keeps its own
// input types decoupled from the DB schema.
export interface PeriodTime {
  period: number
  startTime: string
  endTime: string
}

// A semester's `label` (e.g. "2026-1") is the key subjects/timetableSlots
// scope against — kept as a plain text match rather than a SQL foreign key
// so existing free-text semester values on those tables keep working
// unchanged; deletion is guarded in the repository layer instead (see
// deleteSemester in electron/db/repositories/semesters.ts).
export const semesters = sqliteTable('semesters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  number: integer('number').notNull(),
  label: text('label').notNull().unique(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  // Total grid rows shown on the Timetable page for this semester (teaching
  // periods + lunch), and which period number defaults to type 'lunch' when
  // a new slot is opened there. See src/lib/timetable-rules.ts for the
  // teaching-period cap these interact with.
  periodsPerDay: integer('periods_per_day').notNull().default(7),
  lunchPeriod: integer('lunch_period').notNull().default(4),
  // Null means "not auto-allocated yet" — the Timetable grid falls back to
  // plain "Period N" labels. Set via "Auto-allocate times" in Grid Settings;
  // changing periodsPerDay, lunchPeriod, or the day start/end time afterward
  // does NOT recompute this — it goes stale until re-run on purpose (see
  // allocateEvenPeriodTimes in src/lib/period-time-allocation.ts).
  periodTimes: text('period_times', { mode: 'json' }).$type<PeriodTime[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const subjects = sqliteTable('subjects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  semester: text('semester').notNull(),
  credits: integer('credits').notNull().default(0),
  faculty: text('faculty'),
  category: text('category'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  // Per-subject override of settings.subjectMinTarget. Null means "inherit
  // the default subject minimum" — resolved via resolveSubjectMinTarget()
  // in the attendance engine, never read as a bare column value elsewhere.
  customMinTarget: real('custom_min_target'),
  // Optional user-chosen accent (hex) used wherever a subject is drawn as a
  // color — Week overview strips, Analytics series. Null means "fall back to
  // the palette slot for this subject's position" (see resolveSubjectColor).
  color: text('color'),
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

export const timetableSlots = sqliteTable(
  'timetable_slots',
  {
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
  },
  (table) => [
    // At most one slot per semester/day/period — a timetable cell is a
    // single thing, not a list.
    uniqueIndex('timetable_slots_semester_day_period_unique').on(table.semester, table.day, table.period),
  ],
)

export const attendanceRecords = sqliteTable(
  'attendance_records',
  {
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
  },
  (table) => [
    // At most one attendance record per subject/date/period — marking the
    // same period twice should edit the existing record, not duplicate it.
    uniqueIndex('attendance_records_subject_date_period_unique').on(table.subjectId, table.date, table.period),
  ],
)

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
  disputeStatus: text('dispute_status').$type<YellowFormDisputeStatus>().notNull().default('none'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

// One dispute per yellow form (a resolved dispute isn't reopened — filing a
// fresh one would mean deleting this row first, which the repository layer
// doesn't expose on purpose). Only an approved or rejected form is
// disputable; outcome/resolvedAt stay null until resolved.
export const yellowFormDisputes = sqliteTable('yellow_form_disputes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  yellowFormId: integer('yellow_form_id')
    .notNull()
    .unique()
    .references(() => yellowForms.id, { onDelete: 'cascade' }),
  note: text('note').notNull(),
  outcome: text('outcome').$type<YellowFormDisputeOutcome>(),
  filedAt: integer('filed_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
})

// Singleton row (id = 1) holding app-wide settings.
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // Used for the dashboard's overall attendance warning/safe-bunk count.
  overallMinTarget: real('overall_min_target').notNull().default(75),
  // Default per-subject target; a subject's own customMinTarget (if set)
  // takes precedence over this. See resolveSubjectMinTarget() in the
  // attendance engine.
  subjectMinTarget: real('subject_min_target').notNull().default(75),
  // How many points above target still counts as "at risk" — drives the
  // amber close-to-target warning (notifications + dashboard color). 0
  // disables the band entirely.
  atRiskMarginPp: real('at_risk_margin_pp').notNull().default(5),
  theme: text('theme').notNull().default('system'),
  currentSemester: text('current_semester').notNull().default(''),
  // JSON-encoded array of NotificationCategory values the user has muted;
  // muted categories are dropped before notifications ever reach the bell.
  // Read/dismissed state for individual alerts is NOT here — that's ephemeral
  // view state kept in localStorage (see notification-state-store.ts), since
  // notifications are derived live and regenerate.
  mutedNotificationCategories: text('muted_notification_categories', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default([]),
  backupIntervalDays: integer('backup_interval_days').notNull().default(7),
  backupDir: text('backup_dir'),
  lastBackupAt: integer('last_backup_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const SETTINGS_SINGLETON_ID = 1

export const schema = {
  semesters,
  subjects,
  periodTypeRules,
  timetableSlots,
  attendanceRecords,
  holidays,
  leavePlans,
  yellowForms,
  yellowFormDisputes,
  settings,
}
