import { ipcMain, dialog } from 'electron'
import fs from 'node:fs'
import type { AppDatabase } from '../db/client'
import { IPC_CHANNELS } from './contract'
import {
  subjectsRepo,
  timetableSlotsRepo,
  attendanceRecordsRepo,
  holidaysRepo,
  leavePlansRepo,
  yellowFormsRepo,
  settingsRepo,
  periodTypeRulesRepo,
} from '../db/repositories'

export function registerIpcHandlers(db: AppDatabase): void {
  ipcMain.handle(IPC_CHANNELS.subjectsList, (_e, opts) => subjectsRepo.listSubjects(db, opts))
  ipcMain.handle(IPC_CHANNELS.subjectsGet, (_e, id: number) => subjectsRepo.getSubject(db, id))
  ipcMain.handle(IPC_CHANNELS.subjectsCreate, (_e, input) => subjectsRepo.createSubject(db, input))
  ipcMain.handle(IPC_CHANNELS.subjectsUpdate, (_e, id: number, input) =>
    subjectsRepo.updateSubject(db, id, input),
  )
  ipcMain.handle(IPC_CHANNELS.subjectsSetArchived, (_e, id: number, archived: boolean) =>
    subjectsRepo.setSubjectArchived(db, id, archived),
  )
  ipcMain.handle(IPC_CHANNELS.subjectsDelete, (_e, id: number) => subjectsRepo.deleteSubject(db, id))

  ipcMain.handle(IPC_CHANNELS.timetableSlotsList, (_e, opts) =>
    timetableSlotsRepo.listTimetableSlots(db, opts),
  )
  ipcMain.handle(IPC_CHANNELS.timetableSlotsCreate, (_e, input) =>
    timetableSlotsRepo.createTimetableSlot(db, input),
  )
  ipcMain.handle(IPC_CHANNELS.timetableSlotsUpdate, (_e, id: number, input) =>
    timetableSlotsRepo.updateTimetableSlot(db, id, input),
  )
  ipcMain.handle(IPC_CHANNELS.timetableSlotsDelete, (_e, id: number) =>
    timetableSlotsRepo.deleteTimetableSlot(db, id),
  )

  ipcMain.handle(IPC_CHANNELS.attendanceRecordsList, (_e, filter) =>
    attendanceRecordsRepo.listAttendanceRecords(db, filter),
  )
  ipcMain.handle(IPC_CHANNELS.attendanceRecordsCreate, (_e, input) =>
    attendanceRecordsRepo.createAttendanceRecord(db, input),
  )
  ipcMain.handle(IPC_CHANNELS.attendanceRecordsUpdate, (_e, id: number, input) =>
    attendanceRecordsRepo.updateAttendanceRecord(db, id, input),
  )
  ipcMain.handle(IPC_CHANNELS.attendanceRecordsDelete, (_e, id: number) =>
    attendanceRecordsRepo.deleteAttendanceRecord(db, id),
  )

  ipcMain.handle(IPC_CHANNELS.holidaysList, () => holidaysRepo.listHolidays(db))
  ipcMain.handle(IPC_CHANNELS.holidaysCreate, (_e, input) => holidaysRepo.createHoliday(db, input))
  ipcMain.handle(IPC_CHANNELS.holidaysUpdate, (_e, id: number, input) =>
    holidaysRepo.updateHoliday(db, id, input),
  )
  ipcMain.handle(IPC_CHANNELS.holidaysDelete, (_e, id: number) => holidaysRepo.deleteHoliday(db, id))

  ipcMain.handle(IPC_CHANNELS.leavePlansList, () => leavePlansRepo.listLeavePlans(db))
  ipcMain.handle(IPC_CHANNELS.leavePlansCreate, (_e, input) => leavePlansRepo.createLeavePlan(db, input))
  ipcMain.handle(IPC_CHANNELS.leavePlansUpdate, (_e, id: number, input) =>
    leavePlansRepo.updateLeavePlan(db, id, input),
  )
  ipcMain.handle(IPC_CHANNELS.leavePlansDelete, (_e, id: number) => leavePlansRepo.deleteLeavePlan(db, id))

  ipcMain.handle(IPC_CHANNELS.yellowFormsList, (_e, opts) => yellowFormsRepo.listYellowForms(db, opts))
  ipcMain.handle(IPC_CHANNELS.yellowFormsCreate, (_e, input) => yellowFormsRepo.createYellowForm(db, input))
  ipcMain.handle(IPC_CHANNELS.yellowFormsUpdate, (_e, id: number, input) =>
    yellowFormsRepo.updateYellowForm(db, id, input),
  )
  ipcMain.handle(IPC_CHANNELS.yellowFormsSetStatus, (_e, id: number, status) =>
    yellowFormsRepo.setYellowFormStatus(db, id, status),
  )
  ipcMain.handle(IPC_CHANNELS.yellowFormsDelete, (_e, id: number) => yellowFormsRepo.deleteYellowForm(db, id))

  ipcMain.handle(IPC_CHANNELS.settingsGet, () => settingsRepo.getSettings(db))
  ipcMain.handle(IPC_CHANNELS.settingsUpdate, (_e, input) => settingsRepo.updateSettings(db, input))

  ipcMain.handle(IPC_CHANNELS.periodTypeRulesList, () => periodTypeRulesRepo.listPeriodTypeRules(db))
  ipcMain.handle(IPC_CHANNELS.periodTypeRulesSetBucket, (_e, type, bucket) =>
    periodTypeRulesRepo.setPeriodTypeRuleBucket(db, type, bucket),
  )

  ipcMain.handle(
    IPC_CHANNELS.filesSaveFile,
    async (
      _e,
      opts: { defaultName: string; content: ArrayBuffer | string; filters: { name: string; extensions: string[] }[] },
    ) => {
      const result = await dialog.showSaveDialog({ defaultPath: opts.defaultName, filters: opts.filters })
      if (result.canceled || !result.filePath) return null
      const data = typeof opts.content === 'string' ? opts.content : Buffer.from(opts.content)
      fs.writeFileSync(result.filePath, data)
      return result.filePath
    },
  )
}
