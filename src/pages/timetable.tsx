import { useEffect, useMemo, useState } from 'react'
import { Trash2, Settings2, TriangleAlert, CopyPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { SemesterSwitcher } from '@/components/semester-switcher'
import { useSubjectsStore } from '@/store/subjects-store'
import { useTimetableStore } from '@/store/timetable-store'
import { useSettingsStore } from '@/store/settings-store'
import { useSemestersStore } from '@/store/semesters-store'
import { useToastStore } from '@/store/toast-store'
import { WEEKDAYS, PERIOD_TYPES, type Weekday, type PeriodType, type PeriodTime } from '@/db/schema'
import type { TimetableSlot } from '../../electron/db/repositories/timetable-slots'
import { validateTimetableDay } from '@/lib/timetable-rules'
import { allocateEvenPeriodTimes } from '@/lib/period-time-allocation'
import { cn } from '@/lib/utils'

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

// 'project' is retired: project work is now scheduled as a real Subject
// (type 'class'), not a separate typeless bucket. Kept in PERIOD_TYPES/the
// schema/the attendance engine's bucket table so existing slots still typed
// 'project' keep working until reassigned via the banner below — this list
// only controls what's offered for NEW selections.
const SELECTABLE_PERIOD_TYPES = PERIOD_TYPES.filter((t) => t !== 'project')

interface CellFormState {
  subjectId: string
  type: PeriodType
  startTime: string
  endTime: string
}

export function TimetablePage() {
  const semester = useSettingsStore((s) => s.currentSemester)
  const { subjects, load: loadSubjects } = useSubjectsStore()
  const { slots, load, create, update, remove } = useTimetableStore()
  const { semesters, load: loadSemesters, update: updateSemester } = useSemestersStore()
  const pushToast = useToastStore((s) => s.push)

  const [dialogTarget, setDialogTarget] = useState<{ day: Weekday; period: number } | null>(null)
  const [form, setForm] = useState<CellFormState>({ subjectId: 'none', type: 'class', startTime: '', endTime: '' })
  const [saving, setSaving] = useState(false)
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false)
  const [gridForm, setGridForm] = useState({
    periodsPerDay: '7',
    lunchPeriod: '4',
    dayStartTime: '',
    dayEndTime: '',
  })
  // Only set once "Auto-allocate times" succeeds in the currently-open
  // dialog session — kept separate from the semester's saved periodTimes so
  // editing periodsPerDay/lunchPeriod without re-running allocation doesn't
  // overwrite the existing (still valid until reassigned) stored times.
  const [pendingPeriodTimes, setPendingPeriodTimes] = useState<PeriodTime[] | null>(null)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [reassignChoice, setReassignChoice] = useState<Record<number, string>>({})
  const [copyDayOpen, setCopyDayOpen] = useState(false)
  const [copySourceDay, setCopySourceDay] = useState<Weekday>('mon')
  const [copyTargetDays, setCopyTargetDays] = useState<Partial<Record<Weekday, boolean>>>({})
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    loadSubjects({ includeArchived: false })
    loadSemesters()
  }, [loadSubjects, loadSemesters])

  useEffect(() => {
    if (semester) load(semester)
  }, [load, semester])

  const activeSemester = useMemo(() => semesters.find((s) => s.label === semester), [semesters, semester])
  const periodsPerDay = activeSemester?.periodsPerDay ?? 7
  const lunchPeriod = activeSemester?.lunchPeriod ?? 4
  const PERIODS = useMemo(() => Array.from({ length: periodsPerDay }, (_, i) => i + 1), [periodsPerDay])

  const periodTimeByPeriod = useMemo(
    () => new Map((activeSemester?.periodTimes ?? []).map((pt) => [pt.period, pt])),
    [activeSemester],
  )

  const subjectsById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  // Slots still using the retired 'project' type, for this semester — the
  // reassignment banner's whole reason to exist. Sorted so the list reads
  // top-to-bottom the same way the grid does.
  const projectSlots = useMemo(
    () =>
      slots
        .filter((s) => s.type === 'project')
        .sort((a, b) => a.period - b.period || WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day)),
    [slots],
  )

  async function reassignSlot(slot: TimetableSlot) {
    const subjectId = Number(reassignChoice[slot.id])
    if (!subjectId) return
    await update(slot.id, { type: 'class', subjectId })
    setReassignChoice((prev) => {
      const next = { ...prev }
      delete next[slot.id]
      return next
    })
    pushToast({ title: 'Period reassigned', description: `${DAY_LABELS[slot.day]} · Period ${slot.period}` })
  }

  async function copyDay() {
    const sourceSlots = slots.filter((s) => s.day === copySourceDay)
    const sourceDaySlots = sourceSlots.map((s) => ({ period: s.period, type: s.type }))
    const targets = WEEKDAYS.filter((d) => copyTargetDays[d] && d !== copySourceDay)
    if (targets.length === 0) return

    setCopying(true)
    try {
      const skipped: Weekday[] = []
      for (const targetDay of targets) {
        const validation = validateTimetableDay(sourceDaySlots, { maxTeachingPeriods: periodsPerDay })
        if (!validation.ok) {
          skipped.push(targetDay)
          continue
        }
        // A copy replaces the target day outright — clear anything there
        // that the source day doesn't also have at that period, then
        // upsert every source slot onto it (createTimetableSlot already
        // upserts on semester/day/period, so matching periods just update).
        const sourcePeriods = new Set(sourceSlots.map((s) => s.period))
        const staleOnTarget = slots.filter((s) => s.day === targetDay && !sourcePeriods.has(s.period))
        for (const stale of staleOnTarget) await remove(stale.id)
        for (const s of sourceSlots) {
          await create({
            semester,
            day: targetDay,
            period: s.period,
            subjectId: s.subjectId,
            type: s.type,
            startTime: s.startTime,
            endTime: s.endTime,
          })
        }
      }
      const copiedTo = targets.filter((d) => !skipped.includes(d))
      if (copiedTo.length > 0) {
        pushToast({
          title: 'Day copied',
          description: `${DAY_LABELS[copySourceDay]} → ${copiedTo.map((d) => DAY_LABELS[d]).join(', ')}`,
        })
      }
      if (skipped.length > 0) {
        pushToast({
          title: "Couldn't copy to every target",
          description: `${skipped.map((d) => DAY_LABELS[d]).join(', ')} would exceed the ${periodsPerDay}-period cap.`,
        })
      }
      setCopyDayOpen(false)
      setCopyTargetDays({})
    } finally {
      setCopying(false)
    }
  }

  const slotAt = useMemo(() => {
    const map = new Map<string, TimetableSlot>()
    for (const slot of slots) map.set(`${slot.day}:${slot.period}`, slot)
    return map
  }, [slots])

  function openCell(day: Weekday, period: number) {
    const existing = slotAt.get(`${day}:${period}`)
    setForm({
      subjectId: existing?.subjectId ? String(existing.subjectId) : 'none',
      type: existing?.type ?? (period === lunchPeriod ? 'lunch' : 'class'),
      startTime: existing?.startTime ?? '',
      endTime: existing?.endTime ?? '',
    })
    setDialogTarget({ day, period })
  }

  function openGridSettings() {
    setGridForm({ periodsPerDay: String(periodsPerDay), lunchPeriod: String(lunchPeriod), dayStartTime: '', dayEndTime: '' })
    setPendingPeriodTimes(null)
    setGridSettingsOpen(true)
  }

  function handleAutoAllocate() {
    try {
      const times = allocateEvenPeriodTimes({
        periodsPerDay: Math.max(1, Number(gridForm.periodsPerDay) || 1),
        dayStartTime: gridForm.dayStartTime,
        dayEndTime: gridForm.dayEndTime,
      })
      setPendingPeriodTimes(times)
    } catch (err) {
      setPendingPeriodTimes(null)
      pushToast({ title: "Can't auto-allocate times", description: err instanceof Error ? err.message : String(err) })
    }
  }

  async function handleGridSettingsSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeSemester) return
    await updateSemester(activeSemester.id, {
      periodsPerDay: Math.max(1, Number(gridForm.periodsPerDay) || 1),
      lunchPeriod: Math.max(1, Number(gridForm.lunchPeriod) || 1),
      ...(pendingPeriodTimes ? { periodTimes: pendingPeriodTimes } : {}),
    })
    pushToast({ title: 'Grid settings updated' })
    setGridSettingsOpen(false)
    setPendingPeriodTimes(null)
  }

  // When Grid Settings has auto-allocated a time for this period, the
  // per-slot start/end inputs below are redundant — the row already shows
  // the real time for every day at once. Hide them in favor of a plain
  // readout instead of asking for the same time twice.
  const dialogAutoTime = dialogTarget ? periodTimeByPeriod.get(dialogTarget.period) : undefined

  const subjectRequired = form.type !== 'lunch'
  const subjectMissing = subjectRequired && form.subjectId === 'none'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dialogTarget) return
    if (subjectMissing) return
    const { day, period } = dialogTarget
    const existing = slotAt.get(`${day}:${period}`)

    const daySlots = slots
      .filter((s) => s.day === day && s.period !== period)
      .map((s) => ({ period: s.period, type: s.type }))
    daySlots.push({ period, type: form.type })
    const validation = validateTimetableDay(daySlots, { maxTeachingPeriods: periodsPerDay })
    if (!validation.ok) {
      pushToast({ title: "Can't save this slot", description: validation.errors[0] })
      return
    }

    setSaving(true)
    try {
      const payload = {
        semester,
        day,
        period,
        subjectId: form.subjectId === 'none' ? null : Number(form.subjectId),
        type: form.type,
        // The period-level auto-allocated time is the source of truth once
        // it exists — don't also persist a per-slot value that could drift
        // out of sync with it.
        startTime: dialogAutoTime ? null : form.startTime || null,
        endTime: dialogAutoTime ? null : form.endTime || null,
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

  if (!semester) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Timetable</h1>
        <p className="text-sm text-muted-foreground">
          No semester is set up yet. Create one on the{' '}
          <a href="#/semesters" className="underline">
            Semesters
          </a>{' '}
          page to start building a timetable.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Timetable</h1>
        <div className="flex items-center gap-3">
          <SemesterSwitcher />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCopySourceDay('mon')
              setCopyTargetDays({})
              setCopyDayOpen(true)
            }}
            disabled={!activeSemester || slots.length === 0}
          >
            <CopyPlus /> Copy day
          </Button>
          <Button variant="outline" size="sm" onClick={openGridSettings} disabled={!activeSemester}>
            <Settings2 /> Grid settings
          </Button>
        </div>
      </div>

      {projectSlots.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4 shrink-0 text-warning" />
            <span>
              {projectSlots.length === 1
                ? '1 period still uses the retired "project" type — reassign it to a real subject.'
                : `${projectSlots.length} periods still use the retired "project" type — reassign them to a real subject.`}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setReassignOpen(true)}>
            Reassign now
          </Button>
        </div>
      )}

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
            {PERIODS.map((period) => {
              const time = periodTimeByPeriod.get(period)
              return (
              <tr key={period} className="border-b last:border-0">
                <td className="p-2 font-medium text-muted-foreground">
                  {time ? `P${period} · ${time.startTime}–${time.endTime}` : `Period ${period}`}
                </td>
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
              )
            })}
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
                  {SELECTABLE_PERIOD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slot-subject">
                Subject{subjectRequired && <span className="text-destructive"> *</span>}
              </Label>
              <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })}>
                <SelectTrigger id="slot-subject">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!subjectRequired && <SelectItem value="none">None</SelectItem>}
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subjectMissing && (
                <p className="text-xs text-destructive">
                  A subject is required so attendance can be marked for this period — only lunch can be left
                  unassigned.
                </p>
              )}
            </div>

            {dialogAutoTime ? (
              <p className="text-xs text-muted-foreground">
                Time: {dialogAutoTime.startTime}–{dialogAutoTime.endTime} (auto-allocated — change it from Grid
                settings, not here).
              </p>
            ) : (
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
            )}

            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="ghost" onClick={handleClear}>
                <Trash2 /> Clear slot
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || subjectMissing}>
                  Save
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={gridSettingsOpen} onOpenChange={setGridSettingsOpen}>
        <DialogContent>
          <form onSubmit={handleGridSettingsSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Grid settings</DialogTitle>
              <DialogDescription>
                Controls the Timetable grid size and lunch position for {semester}. Also editable from the{' '}
                Semesters page.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="grid-periods">Periods per day</Label>
                <Input
                  id="grid-periods"
                  type="number"
                  min={1}
                  value={gridForm.periodsPerDay}
                  onChange={(e) => setGridForm({ ...gridForm, periodsPerDay: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grid-lunch">Lunch period</Label>
                <Input
                  id="grid-lunch"
                  type="number"
                  min={1}
                  value={gridForm.lunchPeriod}
                  onChange={(e) => setGridForm({ ...gridForm, lunchPeriod: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <Label className="text-xs text-muted-foreground">
                Auto-allocate times — evenly splits the day across all {gridForm.periodsPerDay || periodsPerDay}{' '}
                periods (lunch included). Re-run this after changing periods/lunch/times above; it won't happen
                automatically.
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="grid-day-start">Day start time</Label>
                  <Input
                    id="grid-day-start"
                    type="time"
                    value={gridForm.dayStartTime}
                    onChange={(e) => setGridForm({ ...gridForm, dayStartTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grid-day-end">Day end time</Label>
                  <Input
                    id="grid-day-end"
                    type="time"
                    value={gridForm.dayEndTime}
                    onChange={(e) => setGridForm({ ...gridForm, dayEndTime: e.target.value })}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!gridForm.dayStartTime || !gridForm.dayEndTime}
                onClick={handleAutoAllocate}
              >
                Auto-allocate times
              </Button>
              {pendingPeriodTimes && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {pendingPeriodTimes.map((pt) => (
                    <span key={pt.period}>
                      P{pt.period} {pt.startTime}–{pt.endTime}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGridSettingsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save{pendingPeriodTimes ? ' & apply times' : ''}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign retired "project" periods</DialogTitle>
            <DialogDescription>
              Project work is now scheduled as a real subject (type "class"), not this typeless bucket. Pick a
              subject for each period below — it'll switch to type "class" and start counting toward that
              subject's own attendance instead of the generic Project Work total.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {projectSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">All periods have been reassigned.</p>
            ) : (
              projectSlots.map((slot) => (
                <div key={slot.id} className="flex items-center gap-2 rounded-md border p-2">
                  <span className="w-28 shrink-0 text-sm font-medium">
                    {DAY_LABELS[slot.day]} · P{slot.period}
                  </span>
                  <Select
                    value={reassignChoice[slot.id] ?? ''}
                    onValueChange={(v) => setReassignChoice((prev) => ({ ...prev, [slot.id]: v }))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Choose a subject…" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" disabled={!reassignChoice[slot.id]} onClick={() => reassignSlot(slot)}>
                    Reassign
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReassignOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={copyDayOpen} onOpenChange={setCopyDayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy day's schedule</DialogTitle>
            <DialogDescription>
              Replaces every period on the day(s) you pick below with an exact copy of the source day —
              same type, same subject. Anything currently on a target day that the source day doesn't
              also have gets cleared.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="copy-source">Copy from</Label>
            <Select value={copySourceDay} onValueChange={(v) => setCopySourceDay(v as Weekday)}>
              <SelectTrigger id="copy-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((day) => {
                  const count = slots.filter((s) => s.day === day).length
                  return (
                    <SelectItem key={day} value={day}>
                      {DAY_LABELS[day]} ({count} period{count === 1 ? '' : 's'})
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Copy to</Label>
            <div className="grid grid-cols-3 gap-2">
              {WEEKDAYS.filter((d) => d !== copySourceDay).map((day) => (
                <label key={day} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <Checkbox
                    checked={copyTargetDays[day] ?? false}
                    onCheckedChange={(checked) =>
                      setCopyTargetDays((prev) => ({ ...prev, [day]: checked === true }))
                    }
                  />
                  {DAY_LABELS[day]}
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCopyDayOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={copying || Object.values(copyTargetDays).every((v) => !v)}
              onClick={copyDay}
            >
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
