// Single source of truth for the IPC surface between the renderer and the
// Electron main process. Both `preload.ts` (invoke wrappers) and
// `register.ts` (ipcMain handlers) are keyed off `IPC_CHANNELS`, so adding an
// operation means adding one entry here plus one handler + one preload call.
import type {
  Semester,
  NewSemester,
  SemesterUpdate,
  SemesterDependents,
  RolloverPreview,
} from '../db/repositories/semesters'
import type { Subject, NewSubject, SubjectUpdate } from '../db/repositories/subjects'
import type {
  TimetableSlot,
  NewTimetableSlot,
  TimetableSlotUpdate,
} from '../db/repositories/timetable-slots'
import type {
  AttendanceRecord,
  NewAttendanceRecord,
  AttendanceRecordUpdate,
  AttendanceRecordFilter,
} from '../db/repositories/attendance-records'
import type { Holiday, NewHoliday, HolidayUpdate } from '../db/repositories/holidays'
import type { Exam, NewExam, ExamUpdate } from '../db/repositories/exams'
import type { LeavePlan, NewLeavePlan, LeavePlanUpdate } from '../db/repositories/leave-plans'
import type {
  YellowForm,
  NewYellowForm,
  YellowFormUpdate,
  YellowFormDispute,
} from '../db/repositories/yellow-forms'
import type { YellowFormDisputeOutcome } from '../../src/db/schema'
import type { Settings, SettingsUpdate } from '../db/repositories/settings'
import type { PeriodTypeRule } from '../db/repositories/period-type-rules'

export const IPC_CHANNELS = {
  semestersList: 'semesters:list',
  semestersCreate: 'semesters:create',
  semestersUpdate: 'semesters:update',
  semestersSetArchived: 'semesters:setArchived',
  semestersDelete: 'semesters:delete',
  semestersRolloverPreview: 'semesters:rolloverPreview',
  semestersCreateWithRollover: 'semesters:createWithRollover',
  semestersGetDependents: 'semesters:getDependents',

  subjectsList: 'subjects:list',
  subjectsGet: 'subjects:get',
  subjectsCreate: 'subjects:create',
  subjectsUpdate: 'subjects:update',
  subjectsSetArchived: 'subjects:setArchived',
  subjectsDelete: 'subjects:delete',

  timetableSlotsList: 'timetableSlots:list',
  timetableSlotsCreate: 'timetableSlots:create',
  timetableSlotsUpdate: 'timetableSlots:update',
  timetableSlotsDelete: 'timetableSlots:delete',

  attendanceRecordsList: 'attendanceRecords:list',
  attendanceRecordsCreate: 'attendanceRecords:create',
  attendanceRecordsUpdate: 'attendanceRecords:update',
  attendanceRecordsDelete: 'attendanceRecords:delete',

  holidaysList: 'holidays:list',
  holidaysCreate: 'holidays:create',
  holidaysUpdate: 'holidays:update',
  holidaysDelete: 'holidays:delete',

  examsList: 'exams:list',
  examsCreate: 'exams:create',
  examsUpdate: 'exams:update',
  examsDelete: 'exams:delete',

  leavePlansList: 'leavePlans:list',
  leavePlansCreate: 'leavePlans:create',
  leavePlansUpdate: 'leavePlans:update',
  leavePlansDelete: 'leavePlans:delete',

  yellowFormsList: 'yellowForms:list',
  yellowFormsCreate: 'yellowForms:create',
  yellowFormsUpdate: 'yellowForms:update',
  yellowFormsSetStatus: 'yellowForms:setStatus',
  yellowFormsDelete: 'yellowForms:delete',
  yellowFormsGetDispute: 'yellowForms:getDispute',
  yellowFormsFileDispute: 'yellowForms:fileDispute',
  yellowFormsResolveDispute: 'yellowForms:resolveDispute',

  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',

  periodTypeRulesList: 'periodTypeRules:list',
  periodTypeRulesSetBucket: 'periodTypeRules:setBucket',

  filesSaveFile: 'files:saveFile',
  filesOpenTextFile: 'files:openTextFile',

  backupNow: 'backup:now',
  backupRestore: 'backup:restore',
  backupChooseDir: 'backup:chooseDir',
} as const

export interface BunkMateApi {
  versions: { node: string; electron: string }

  semesters: {
    list: () => Promise<Semester[]>
    create: (input: NewSemester) => Promise<Semester>
    update: (id: number, input: SemesterUpdate) => Promise<Semester>
    setArchived: (id: number, archived: boolean) => Promise<Semester>
    /** Throws (rejects) with a human-readable message if dependents exist. */
    delete: (id: number) => Promise<void>
    getDependents: (label: string) => Promise<SemesterDependents>
    /** What a rollover from this semester label would copy. */
    rolloverPreview: (fromLabel: string) => Promise<RolloverPreview>
    /** Create a semester, copying subjects + timetable structure from fromLabel. */
    createWithRollover: (input: NewSemester, fromLabel: string) => Promise<Semester>
  }

  subjects: {
    list: (opts?: { semester?: string; includeArchived?: boolean }) => Promise<Subject[]>
    get: (id: number) => Promise<Subject | undefined>
    create: (input: NewSubject) => Promise<Subject>
    update: (id: number, input: SubjectUpdate) => Promise<Subject>
    setArchived: (id: number, archived: boolean) => Promise<Subject>
    delete: (id: number) => Promise<void>
  }

  timetableSlots: {
    list: (opts: { semester: string }) => Promise<TimetableSlot[]>
    create: (input: NewTimetableSlot) => Promise<TimetableSlot>
    update: (id: number, input: TimetableSlotUpdate) => Promise<TimetableSlot>
    delete: (id: number) => Promise<void>
  }

  attendanceRecords: {
    list: (filter?: AttendanceRecordFilter) => Promise<AttendanceRecord[]>
    create: (input: NewAttendanceRecord) => Promise<AttendanceRecord>
    update: (id: number, input: AttendanceRecordUpdate) => Promise<AttendanceRecord>
    delete: (id: number) => Promise<void>
  }

  holidays: {
    list: () => Promise<Holiday[]>
    create: (input: NewHoliday) => Promise<Holiday>
    update: (id: number, input: HolidayUpdate) => Promise<Holiday>
    delete: (id: number) => Promise<void>
  }

  exams: {
    list: (opts?: { semester?: string }) => Promise<Exam[]>
    create: (input: NewExam) => Promise<Exam>
    update: (id: number, input: ExamUpdate) => Promise<Exam>
    delete: (id: number) => Promise<void>
  }

  leavePlans: {
    list: () => Promise<LeavePlan[]>
    create: (input: NewLeavePlan) => Promise<LeavePlan>
    update: (id: number, input: LeavePlanUpdate) => Promise<LeavePlan>
    delete: (id: number) => Promise<void>
  }

  yellowForms: {
    list: (opts?: { subjectId?: number }) => Promise<YellowForm[]>
    create: (input: NewYellowForm) => Promise<YellowForm>
    update: (id: number, input: YellowFormUpdate) => Promise<YellowForm>
    setStatus: (id: number, status: YellowForm['status']) => Promise<YellowForm>
    delete: (id: number) => Promise<void>
    /** Undefined if no dispute has been filed for this form. */
    getDispute: (yellowFormId: number) => Promise<YellowFormDispute | undefined>
    /** Throws if the form is still pending, or already has a dispute on record. */
    fileDispute: (yellowFormId: number, note: string) => Promise<YellowForm>
    /** Throws if there's no filed dispute, or it's already resolved. */
    resolveDispute: (yellowFormId: number, outcome: YellowFormDisputeOutcome) => Promise<YellowForm>
  }

  settings: {
    get: () => Promise<Settings>
    update: (input: SettingsUpdate) => Promise<Settings>
  }

  periodTypeRules: {
    list: () => Promise<PeriodTypeRule[]>
    setBucket: (type: PeriodTypeRule['type'], bucket: PeriodTypeRule['bucket']) => Promise<PeriodTypeRule>
  }

  files: {
    /** Opens a native save dialog; returns the chosen path, or null if cancelled. */
    saveFile: (opts: {
      defaultName: string
      content: ArrayBuffer | string
      filters: { name: string; extensions: string[] }[]
    }) => Promise<string | null>
    /** Opens a native open dialog and returns the file's text, or null if cancelled. */
    openTextFile: (opts: {
      filters: { name: string; extensions: string[] }[]
    }) => Promise<{ name: string; content: string } | null>
  }

  backup: {
    /** Opens a save dialog and writes a checkpointed copy of the live DB there. */
    now: () => Promise<string | null>
    /**
     * Opens an open-file dialog, replaces the live DB with the chosen file,
     * and relaunches the app. Returns false if the user cancelled the
     * dialog (the app is not relaunched in that case).
     */
    restore: () => Promise<boolean>
    /** Opens a directory picker; returns the chosen path, or null if cancelled. */
    chooseDir: () => Promise<string | null>
  }
}
