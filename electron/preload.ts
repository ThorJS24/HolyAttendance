import { contextBridge } from 'electron'

// TODO(phase-1): expose typed IPC methods for CRUD on subjects, timetable
// slots, attendance records, holidays, leave plans, yellow forms, settings.
const api = {
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
  },
}

export type BunkMateApi = typeof api

contextBridge.exposeInMainWorld('bunkmate', api)
