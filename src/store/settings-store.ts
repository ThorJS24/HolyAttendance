import { create } from 'zustand'

interface SettingsState {
  overallMinTarget: number
  subjectMinTarget: number
  currentSemester: string
  theme: string
  backupIntervalDays: number
  backupDir: string | null
  lastBackupAt: Date | null
  loaded: boolean
  load: () => Promise<void>
  setOverallMinTarget: (value: number) => Promise<void>
  setSubjectMinTarget: (value: number) => Promise<void>
  setCurrentSemester: (value: string) => Promise<void>
  setTheme: (value: string) => Promise<void>
  setBackupIntervalDays: (value: number) => Promise<void>
  setBackupDir: (value: string | null) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  overallMinTarget: 75,
  subjectMinTarget: 75,
  currentSemester: '',
  theme: 'system',
  backupIntervalDays: 7,
  backupDir: null,
  lastBackupAt: null,
  loaded: false,

  load: async () => {
    const settings = await window.bunkmate.settings.get()
    set({
      overallMinTarget: settings.overallMinTarget,
      subjectMinTarget: settings.subjectMinTarget,
      currentSemester: settings.currentSemester,
      theme: settings.theme,
      backupIntervalDays: settings.backupIntervalDays,
      backupDir: settings.backupDir ?? null,
      lastBackupAt: settings.lastBackupAt ?? null,
      loaded: true,
    })
  },

  setOverallMinTarget: async (overallMinTarget) => {
    await window.bunkmate.settings.update({ overallMinTarget })
    set({ overallMinTarget })
  },
  setSubjectMinTarget: async (subjectMinTarget) => {
    await window.bunkmate.settings.update({ subjectMinTarget })
    set({ subjectMinTarget })
  },
  setCurrentSemester: async (currentSemester) => {
    await window.bunkmate.settings.update({ currentSemester })
    set({ currentSemester })
  },
  setTheme: async (theme) => {
    await window.bunkmate.settings.update({ theme })
    set({ theme })
  },
  setBackupIntervalDays: async (backupIntervalDays) => {
    await window.bunkmate.settings.update({ backupIntervalDays })
    set({ backupIntervalDays })
  },
  setBackupDir: async (backupDir) => {
    await window.bunkmate.settings.update({ backupDir })
    set({ backupDir })
  },
}))
