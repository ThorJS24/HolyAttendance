import { create } from 'zustand'
import type {
  YellowForm,
  NewYellowForm,
  YellowFormUpdate,
} from '../../electron/db/repositories/yellow-forms'

interface YellowFormsState {
  forms: YellowForm[]
  loading: boolean
  load: (opts?: { subjectId?: number }) => Promise<void>
  create: (input: NewYellowForm) => Promise<YellowForm>
  update: (id: number, input: YellowFormUpdate) => Promise<YellowForm>
  setStatus: (id: number, status: YellowForm['status']) => Promise<YellowForm>
  remove: (id: number) => Promise<void>
}

export const useYellowFormsStore = create<YellowFormsState>((set, get) => ({
  forms: [],
  loading: false,

  load: async (opts) => {
    set({ loading: true })
    const forms = await window.bunkmate.yellowForms.list(opts)
    set({ forms, loading: false })
  },

  create: async (input) => {
    const form = await window.bunkmate.yellowForms.create(input)
    set({ forms: [...get().forms, form] })
    return form
  },

  update: async (id, input) => {
    const updated = await window.bunkmate.yellowForms.update(id, input)
    set({ forms: get().forms.map((f) => (f.id === id ? updated : f)) })
    return updated
  },

  setStatus: async (id, status) => {
    const updated = await window.bunkmate.yellowForms.setStatus(id, status)
    set({ forms: get().forms.map((f) => (f.id === id ? updated : f)) })
    return updated
  },

  remove: async (id) => {
    await window.bunkmate.yellowForms.delete(id)
    set({ forms: get().forms.filter((f) => f.id !== id) })
  },
}))
