import { create } from 'zustand'

interface SettingsState {
  minTarget: number
  currentSemester: string
  loaded: boolean
  setMinTarget: (value: number) => void
  setCurrentSemester: (value: string) => void
  // TODO(phase-8): load from and persist to the `settings` table via the DB layer.
  load: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  minTarget: 75,
  currentSemester: '',
  loaded: false,
  setMinTarget: (value) => set({ minTarget: value }),
  setCurrentSemester: (value) => set({ currentSemester: value }),
  load: async () => {
    set({ loaded: true })
  },
}))
