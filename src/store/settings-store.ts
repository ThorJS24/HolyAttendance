import { create } from 'zustand'

interface SettingsState {
  minTarget: number
  currentSemester: string
  theme: string
  backupIntervalDays: number
  backupDir: string | null
  loaded: boolean
  load: () => Promise<void>
  setMinTarget: (value: number) => Promise<void>
  setCurrentSemester: (value: string) => Promise<void>
  setTheme: (value: string) => Promise<void>
  setBackupIntervalDays: (value: number) => Promise<void>
  setBackupDir: (value: string | null) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  minTarget: 75,
  currentSemester: '',
  theme: 'system',
  backupIntervalDays: 7,
  backupDir: null,
  loaded: false,

  load: async () => {
    const settings = await window.bunkmate.settings.get()
    set({
      minTarget: settings.minTarget,
      currentSemester: settings.currentSemester,
      theme: settings.theme,
      backupIntervalDays: settings.backupIntervalDays,
      backupDir: settings.backupDir ?? null,
      loaded: true,
    })
  },

  setMinTarget: async (minTarget) => {
    await window.bunkmate.settings.update({ minTarget })
    set({ minTarget })
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
