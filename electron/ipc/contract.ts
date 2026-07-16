// Single source of truth for the IPC surface between the renderer and the
// Electron main process. Both `preload.ts` (invoke wrappers) and
// `register.ts` (ipcMain handlers) are keyed off `IPC_CHANNELS`, so adding an
// operation means adding one entry here plus one handler + one preload call.
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
import type { LeavePlan, NewLeavePlan, LeavePlanUpdate } from '../db/repositories/leave-plans'
import type { YellowForm, NewYellowForm, YellowFormUpdate } from '../db/repositories/yellow-forms'
import type { Settings, SettingsUpdate } from '../db/repositories/settings'
import type { PeriodTypeRule } from '../db/repositories/period-type-rules'

export const IPC_CHANNELS = {
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

  leavePlansList: 'leavePlans:list',
  leavePlansCreate: 'leavePlans:create',
  leavePlansUpdate: 'leavePlans:update',
  leavePlansDelete: 'leavePlans:delete',

  yellowFormsList: 'yellowForms:list',
  yellowFormsCreate: 'yellowForms:create',
  yellowFormsUpdate: 'yellowForms:update',
  yellowFormsSetStatus: 'yellowForms:setStatus',
  yellowFormsDelete: 'yellowForms:delete',

  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',

  periodTypeRulesList: 'periodTypeRules:list',
  periodTypeRulesSetBucket: 'periodTypeRules:setBucket',

  filesSaveFile: 'files:saveFile',
} as const

export interface BunkMateApi {
  versions: { node: string; electron: string }

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
  }
}
