import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FileWarning } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import { useSettingsStore } from '@/store/settings-store'
import { useTimetableStore } from '@/store/timetable-store'
import { useAttendanceStore } from '@/store/attendance-store'
import { useHolidaysStore } from '@/store/holidays-store'
import { useLeavePlansStore } from '@/store/leave-plans-store'
import { useYellowFormsStore } from '@/store/yellow-forms-store'
import { useToastStore } from '@/store/toast-store'
import { jsDayToWeekday } from '@/lib/attendance-engine'
import { resolveDayPeriods, buildPeriodEndMinutesForDay, minutesSinceMidnight } from '@/lib/day-attendance'
import { todayIso } from '@/lib/date-utils'
import { HolidaysTab } from '@/pages/holidays-tab'
import { YellowFormsTab } from '@/pages/yellow-forms-tab'
import { YellowFormDisputeBadge } from '@/components/yellow-form-dispute'
import { cn } from '@/lib/utils'

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

interface DayCell {
  iso: string
  day: number
  inMonth: boolean
}

function buildMonthGrid(year: number, month: number): DayCell[] {
  const startWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const daysInPrevMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7

  const cells: DayCell[] = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startWeekday + 1
    if (dayNum < 1) {
      const day = daysInPrevMonth + dayNum
      const d = new Date(Date.UTC(year, month - 1, day))
      cells.push({ iso: toIso(d.getUTCFullYear(), d.getUTCMonth(), day), day, inMonth: false })
    } else if (dayNum > daysInMonth) {
      const day = dayNum - daysInMonth
      const d = new Date(Date.UTC(year, month + 1, day))
      cells.push({ iso: toIso(d.getUTCFullYear(), d.getUTCMonth(), day), day, inMonth: false })
    } else {
      cells.push({ iso: toIso(year, month, dayNum), day: dayNum, inMonth: true })
    }
  }
  return cells
}

function CalendarGrid() {
  const today = todayIso()
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number)
    return { year: y, month: m - 1 }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const { subjects, load: loadSubjects } = useSubjectsStore()
  const currentSemester = useSettingsStore((s) => s.currentSemester)
  const { slots, load: loadSlots } = useTimetableStore()
  const { records, load: loadRecords, create: createRecord, update: updateRecord } = useAttendanceStore()
  const { holidays, load: loadHolidays, create: createHoliday, remove: removeHoliday } = useHolidaysStore()
  const { plans, load: loadPlans } = useLeavePlansStore()
  const { forms: yellowForms, load: loadYellowForms, create: createYellowForm } = useYellowFormsStore()
  const pushToast = useToastStore((s) => s.push)

  const [yellowFormDialogOpen, setYellowFormDialogOpen] = useState(false)
  const [yellowFormScope, setYellowFormScope] = useState<'day' | 'period'>('day')
  const [yellowFormPeriod, setYellowFormPeriod] = useState('')
  const [yellowFormReason, setYellowFormReason] = useState('')
  const [filingYellowForm, setFilingYellowForm] = useState(false)
  const [markingAll, setMarkingAll] = useState<'present' | 'absent' | null>(null)

  useEffect(() => {
    loadSubjects({ includeArchived: false })
    loadRecords()
    loadHolidays()
    loadPlans()
    loadYellowForms()
  }, [loadSubjects, loadRecords, loadHolidays, loadPlans, loadYellowForms])

  useEffect(() => {
    if (currentSemester) loadSlots(currentSemester)
  }, [loadSlots, currentSemester])

  const subjectsById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])
  const holidaysByDate = useMemo(() => new Map(holidays.map((h) => [h.date, h])), [holidays])
  const recordsByDate = useMemo(() => {
    const map = new Map<string, typeof records>()
    for (const r of records) {
      const list = map.get(r.date) ?? []
      list.push(r)
      map.set(r.date, list)
    }
    return map
  }, [records])
  const leaveDates = useMemo(() => {
    const set = new Set<string>()
    for (const plan of plans) {
      if (plan.status === 'cancelled') continue
      for (const d of plan.dates) set.add(d)
    }
    return set
  }, [plans])

  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor])

  function slotsForDate(iso: string) {
    const weekday = jsDayToWeekday(iso)
    if (!weekday) return []
    return slots.filter((s) => s.day === weekday)
  }

  const selected = selectedDate
    ? {
        iso: selectedDate,
        holiday: holidaysByDate.get(selectedDate),
        slots: slotsForDate(selectedDate),
        records: recordsByDate.get(selectedDate) ?? [],
        onLeave: leaveDates.has(selectedDate),
      }
    : null

  // Classifies each of the selected day's periods so already-finished,
  // unmarked classes can be flagged as auto-present the same way the
  // attendance engine now counts them (see day-attendance.ts).
  const dayPeriodStatusBySlot = useMemo(() => {
    if (!selectedDate) return new Map<number, ReturnType<typeof resolveDayPeriods>[number]['effectiveStatus']>()
    const weekday = jsDayToWeekday(selectedDate)
    if (!weekday) return new Map()
    const daySlots = slots.filter((s) => s.day === weekday)
    const dayRecords = recordsByDate.get(selectedDate) ?? []
    const periodEndMinutes = buildPeriodEndMinutesForDay(slots, weekday)
    const resolved = resolveDayPeriods({
      scheduledPeriods: daySlots.map((s) => ({
        date: selectedDate,
        day: weekday,
        period: s.period,
        subjectId: s.subjectId,
        type: s.type,
        slotId: s.id,
      })),
      records: dayRecords,
      todayIso: todayIso(),
      nowMinutes: minutesSinceMidnight(new Date()),
      periodEndMinutes,
    })
    return new Map(resolved.map((p) => [p.slotId, p.effectiveStatus]))
  }, [selectedDate, slots, recordsByDate])

  /** Writes one period's status, reusing the existing record if there is one.
   * Shared by the per-period buttons and the whole-day batch actions so both
   * paths create/update records identically. */
  async function writeAttendance(subjectId: number, slotId: number, status: 'present' | 'absent') {
    if (!selectedDate) return
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return
    const existing = selected?.records.find((r) => r.subjectId === subjectId && r.period === slot.period)
    if (existing) {
      await updateRecord(existing.id, { status })
    } else {
      await createRecord({
        subjectId,
        date: selectedDate,
        period: slot.period,
        status,
        source: 'manual',
        slotId,
      })
    }
  }

  async function toggleAttendance(subjectId: number, slotId: number, status: 'present' | 'absent') {
    await writeAttendance(subjectId, slotId, status)
    pushToast({ title: `Marked ${status}` })
  }

  // Periods that can actually carry attendance: a real subject is required,
  // which already excludes lunch and the typeless types (meeting/mentoring/
  // minor) since those never have a subject attached.
  const markableSlots = (selected?.slots ?? []).filter((s) => s.type !== 'lunch' && s.subjectId !== null)

  async function markWholeDay(status: 'present' | 'absent') {
    if (markableSlots.length === 0) return
    setMarkingAll(status)
    try {
      for (const slot of markableSlots) {
        await writeAttendance(slot.subjectId as number, slot.id, status)
      }
      pushToast({
        title: `Marked ${markableSlots.length} period${markableSlots.length === 1 ? '' : 's'} ${status}`,
        description: selectedDate ?? undefined,
      })
    } finally {
      setMarkingAll(null)
    }
  }

  const eligibleYellowFormSlots = (selected?.slots ?? []).filter((s) => s.type !== 'lunch' && s.subjectId !== null)

  function yellowFormFor(subjectId: number, period: number) {
    if (!selectedDate) return undefined
    return yellowForms.find((f) => f.date === selectedDate && f.subjectId === subjectId && f.period === period)
  }

  function openYellowFormDialog() {
    setYellowFormScope('day')
    setYellowFormPeriod(eligibleYellowFormSlots[0] ? String(eligibleYellowFormSlots[0].period) : '')
    setYellowFormReason('')
    setYellowFormDialogOpen(true)
  }

  async function handleFileYellowForm() {
    if (!selectedDate) return
    const targets =
      yellowFormScope === 'day'
        ? eligibleYellowFormSlots.filter((s) => !yellowFormFor(s.subjectId as number, s.period))
        : (() => {
            const period = Number(yellowFormPeriod)
            const slot = eligibleYellowFormSlots.find((s) => s.period === period)
            if (!slot || yellowFormFor(slot.subjectId as number, slot.period)) return []
            return [slot]
          })()

    if (targets.length === 0) {
      pushToast({
        title: 'Nothing to file',
        description: 'Every eligible period for this selection already has a yellow form.',
      })
      return
    }

    setFilingYellowForm(true)
    try {
      for (const slot of targets) {
        await createYellowForm({
          date: selectedDate,
          subjectId: slot.subjectId as number,
          period: slot.period,
          reason: yellowFormReason.trim() || null,
        })
      }
      pushToast({ title: `Filed ${targets.length} yellow form${targets.length === 1 ? '' : 's'}` })
      setYellowFormDialogOpen(false)
    } finally {
      setFilingYellowForm(false)
    }
  }

  async function toggleHoliday() {
    if (!selectedDate) return
    if (selected?.holiday) {
      await removeHoliday(selected.holiday.id)
      pushToast({ title: 'Holiday removed' })
    } else {
      await createHoliday({ date: selectedDate, type: 'custom', label: null })
      pushToast({ title: 'Marked as holiday' })
    }
  }

  const monthLabel = new Date(Date.UTC(cursor.year, cursor.month, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))}
            aria-label="Previous month"
          >
            <ChevronLeft />
          </Button>
          <h2 className="w-40 text-center text-lg font-semibold">{monthLabel}</h2>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))}
            aria-label="Next month"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 rounded-lg border p-2">
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label} className="p-1 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {cells.map((cell) => {
          const holiday = holidaysByDate.get(cell.iso)
          const dayRecords = recordsByDate.get(cell.iso) ?? []
          const scheduled = cell.inMonth ? slotsForDate(cell.iso) : []
          const onLeave = leaveDates.has(cell.iso)
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => setSelectedDate(cell.iso)}
              className={cn(
                'flex h-20 flex-col items-start gap-1 rounded-md border border-transparent p-1.5 text-left transition-colors hover:border-border hover:bg-accent',
                !cell.inMonth && 'opacity-40',
                cell.iso === todayIso() && 'ring-1 ring-primary',
              )}
            >
              <span className="text-xs font-medium">{cell.day}</span>
              <div className="flex flex-wrap gap-1">
                {holiday && (
                  <Badge variant={holiday.type === 'working_saturday' ? 'outline' : 'warning'} className="px-1 text-[10px]">
                    {holiday.type === 'working_saturday' ? 'working' : 'holiday'}
                  </Badge>
                )}
                {onLeave && (
                  <Badge variant="secondary" className="px-1 text-[10px]">
                    leave
                  </Badge>
                )}
                {!holiday && scheduled.length > 0 && (
                  <Badge variant="outline" className="px-1 text-[10px]">
                    {scheduled.length} class{scheduled.length === 1 ? '' : 'es'}
                  </Badge>
                )}
                {dayRecords.length > 0 && (
                  <Badge variant="default" className="px-1 text-[10px]">
                    {dayRecords.filter((r) => r.status === 'present').length}/{dayRecords.length}
                  </Badge>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.iso}</DialogTitle>
            <DialogDescription>
              {selected?.onLeave && 'Part of a saved leave plan. '}
              {selected?.holiday
                ? `Holiday: ${selected.holiday.label ?? selected.holiday.type}`
                : 'Not marked as a holiday.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={toggleHoliday} className="w-fit">
              {selected?.holiday ? 'Remove holiday' : 'Mark as holiday'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openYellowFormDialog}
              disabled={eligibleYellowFormSlots.length === 0}
              className="w-fit"
            >
              <FileWarning /> File yellow form
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Scheduled periods</h3>
              {markableSlots.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="mr-1 text-xs text-muted-foreground">Mark all:</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={markingAll !== null}
                    onClick={() => markWholeDay('present')}
                  >
                    Present
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={markingAll !== null}
                    onClick={() => markWholeDay('absent')}
                  >
                    Absent
                  </Button>
                </div>
              )}
            </div>
            {selected?.slots.length === 0 && (
              <p className="text-sm text-muted-foreground">No periods scheduled.</p>
            )}
            {selected?.slots.map((slot) => {
              const subjectName = slot.subjectId ? subjectsById.get(slot.subjectId)?.name : slot.type
              const record = selected.records.find(
                (r) => r.subjectId === slot.subjectId && r.period === slot.period,
              )
              const isLunch = slot.type === 'lunch'
              const yellowForm = slot.subjectId !== null ? yellowFormFor(slot.subjectId, slot.period) : undefined
              const autoPresent = !record && dayPeriodStatusBySlot.get(slot.id) === 'auto_present'
              return (
                <div key={slot.id} className="rounded-md border p-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      P{slot.period} · {subjectName ?? slot.type}
                      {autoPresent && (
                        <Badge variant="outline" className="text-[10px]">
                          Auto-present
                        </Badge>
                      )}
                      {yellowForm && (
                        <Badge
                          variant={
                            yellowForm.status === 'approved'
                              ? 'success'
                              : yellowForm.status === 'rejected'
                                ? 'destructive'
                                : 'warning'
                          }
                          className="text-[10px]"
                        >
                          Yellow form: {yellowForm.status}
                        </Badge>
                      )}
                      {yellowForm && yellowForm.status !== 'pending' && (
                        <YellowFormDisputeBadge form={yellowForm} subjectName={subjectName ?? slot.type} />
                      )}
                    </span>
                    {!isLunch && slot.subjectId !== null && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={record?.status === 'present' || autoPresent ? 'default' : 'outline'}
                          onClick={() => toggleAttendance(slot.subjectId as number, slot.id, 'present')}
                        >
                          Present
                        </Button>
                        <Button
                          size="sm"
                          variant={record?.status === 'absent' ? 'destructive' : 'outline'}
                          onClick={() => toggleAttendance(slot.subjectId as number, slot.id, 'absent')}
                        >
                          Absent
                        </Button>
                      </div>
                    )}
                  </div>
                  {!isLunch && slot.subjectId === null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No subject assigned to this period — assign one in Timetable to mark attendance.
                    </p>
                  )}
                  {slot.type === 'meeting' && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Excluded from attendance % (meetings don't count toward totals), but still logged.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={yellowFormDialogOpen} onOpenChange={setYellowFormDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File yellow form</DialogTitle>
            <DialogDescription>
              {selected?.iso} — periods that already have a yellow form are skipped automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="yf-scope">Scope</Label>
            <Select value={yellowFormScope} onValueChange={(v) => setYellowFormScope(v as 'day' | 'period')}>
              <SelectTrigger id="yf-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Whole day</SelectItem>
                <SelectItem value="period">Specific period</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {yellowFormScope === 'period' && (
            <div className="space-y-2">
              <Label htmlFor="yf-period">Period</Label>
              <Select value={yellowFormPeriod} onValueChange={setYellowFormPeriod}>
                <SelectTrigger id="yf-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eligibleYellowFormSlots.map((slot) => {
                    const alreadyFiled = !!yellowFormFor(slot.subjectId as number, slot.period)
                    const subjectName = subjectsById.get(slot.subjectId as number)?.name
                    return (
                      <SelectItem key={slot.id} value={String(slot.period)} disabled={alreadyFiled}>
                        P{slot.period} · {subjectName}
                        {alreadyFiled ? ' (already filed)' : ''}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="yf-reason">Reason (optional)</Label>
            <Input
              id="yf-reason"
              value={yellowFormReason}
              onChange={(e) => setYellowFormReason(e.target.value)}
              placeholder="Medical, on-duty, etc."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setYellowFormDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleFileYellowForm} disabled={filingYellowForm}>
              File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function CalendarPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Calendar</h1>
      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
          <TabsTrigger value="yellow-forms">Yellow Forms</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <CalendarGrid />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="holidays" className="pt-4">
          <HolidaysTab />
        </TabsContent>
        <TabsContent value="yellow-forms" className="pt-4">
          <YellowFormsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
