import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useSubjectsStore } from '@/store/subjects-store'
import { useTimetableStore } from '@/store/timetable-store'
import { useSettingsStore } from '@/store/settings-store'
import { useToastStore } from '@/store/toast-store'
import { WEEKDAYS, PERIOD_TYPES, type Weekday, type PeriodType } from '@/db/schema'
import type { TimetableSlot } from '../../electron/db/repositories/timetable-slots'
import { cn } from '@/lib/utils'

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

const DAY_LABELS: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
}

const TYPE_VARIANT: Record<PeriodType, 'default' | 'secondary' | 'outline' | 'success' | 'warning'> = {
  class: 'default',
  project: 'secondary',
  mentoring: 'secondary',
  minor: 'secondary',
  meeting: 'warning',
  lunch: 'outline',
}

interface CellFormState {
  subjectId: string
  type: PeriodType
  startTime: string
  endTime: string
}

export function TimetablePage() {
  const currentSemester = useSettingsStore((s) => s.currentSemester)
  const settingsLoaded = useSettingsStore((s) => s.loaded)
  const { subjects, load: loadSubjects } = useSubjectsStore()
  const { slots, load, create, update, remove } = useTimetableStore()
  const pushToast = useToastStore((s) => s.push)

  const [semester, setSemester] = useState('')
  const [dialogTarget, setDialogTarget] = useState<{ day: Weekday; period: number } | null>(null)
  const [form, setForm] = useState<CellFormState>({ subjectId: 'none', type: 'class', startTime: '', endTime: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settingsLoaded && !semester) setSemester(currentSemester || 'default')
  }, [settingsLoaded, currentSemester, semester])

  useEffect(() => {
    loadSubjects({ includeArchived: false })
  }, [loadSubjects])

  useEffect(() => {
    if (semester) load(semester)
  }, [load, semester])

  const subjectsById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  const slotAt = useMemo(() => {
    const map = new Map<string, TimetableSlot>()
    for (const slot of slots) map.set(`${slot.day}:${slot.period}`, slot)
    return map
  }, [slots])

  function openCell(day: Weekday, period: number) {
    const existing = slotAt.get(`${day}:${period}`)
    setForm({
      subjectId: existing?.subjectId ? String(existing.subjectId) : 'none',
      type: existing?.type ?? 'class',
      startTime: existing?.startTime ?? '',
      endTime: existing?.endTime ?? '',
    })
    setDialogTarget({ day, period })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dialogTarget) return
    const { day, period } = dialogTarget
    const existing = slotAt.get(`${day}:${period}`)

    setSaving(true)
    try {
      const payload = {
        semester,
        day,
        period,
        subjectId: form.subjectId === 'none' ? null : Number(form.subjectId),
        type: form.type,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
      }
      if (existing) {
        await update(existing.id, payload)
      } else {
        await create(payload)
      }
      pushToast({ title: 'Timetable updated' })
      setDialogTarget(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!dialogTarget) return
    const existing = slotAt.get(`${dialogTarget.day}:${dialogTarget.period}`)
    if (existing) {
      await remove(existing.id)
      pushToast({ title: 'Slot cleared' })
    }
    setDialogTarget(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Timetable</h1>
        <div className="flex items-center gap-2">
          <Label htmlFor="semester">Semester</Label>
          <Input id="semester" className="w-32" value={semester} onChange={(e) => setSemester(e.target.value)} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-20 p-2 text-left font-medium text-muted-foreground">Period</th>
              {WEEKDAYS.map((day) => (
                <th key={day} className="p-2 text-left font-medium text-muted-foreground">
                  {DAY_LABELS[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <tr key={period} className="border-b last:border-0">
                <td className="p-2 font-medium text-muted-foreground">{period}</td>
                {WEEKDAYS.map((day) => {
                  const slot = slotAt.get(`${day}:${period}`)
                  const subjectName = slot?.subjectId ? subjectsById.get(slot.subjectId)?.name : undefined
                  return (
                    <td key={day} className="p-1 align-top">
                      <button
                        type="button"
                        onClick={() => openCell(day, period)}
                        className={cn(
                          'flex h-16 w-full flex-col items-start justify-center gap-1 rounded-md border border-dashed p-2 text-left transition-colors hover:bg-accent',
                          slot && 'border-solid bg-card',
                        )}
                      >
                        {slot ? (
                          <>
                            <Badge variant={TYPE_VARIANT[slot.type as PeriodType] ?? 'default'}>{slot.type}</Badge>
                            {subjectName && <span className="truncate text-xs">{subjectName}</span>}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">+ Add</span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogTarget !== null} onOpenChange={(open) => !open && setDialogTarget(null)}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {dialogTarget && `${DAY_LABELS[dialogTarget.day]} · Period ${dialogTarget.period}`}
              </DialogTitle>
              <DialogDescription>Assign a period type and, if applicable, a subject.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="slot-type">Period type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as PeriodType })}>
                <SelectTrigger id="slot-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slot-subject">Subject</Label>
              <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })}>
                <SelectTrigger id="slot-subject">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="slot-start">Start time</Label>
                <Input
                  id="slot-start"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slot-end">End time</Label>
                <Input
                  id="slot-end"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="ghost" onClick={handleClear}>
                <Trash2 /> Clear slot
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  Save
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
