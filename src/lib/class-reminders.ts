// Pure "which class reminders are due right now" calculation, shared shape
// for the main-process scheduler (electron/reminders.ts). Kept here and
// tested directly so the window/exclusion logic doesn't have to be exercised
// by waiting on real timers.

export interface ReminderSlotInput {
  period: number
  type: string
  subjectName: string | null
}

export interface ReminderPeriodTime {
  period: number
  startTime: string
}

export interface DueReminder {
  period: number
  startTime: string
  title: string
  body: string
}

function parseMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

// lunch is the only type excluded from reminders: it's not a class. Meeting,
// mentoring, and minor ARE real scheduled commitments, so they're reminded
// about like a normal class — a deliberate call (they're on your timetable
// for a reason, and a heads-up is exactly as useful as it is for a lecture).
const NO_REMINDER_TYPES = new Set(['lunch'])

/**
 * Reminders whose lead window is currently open: now is in
 * [start - lead, start) for a period that has an allocated start time and
 * isn't excluded by type. The caller is responsible for firing each only
 * once (it knows what it's already sent) — this just reports what's due.
 * Returns [] when there are no period times at all (the graceful-degradation
 * case: no allocated times means no real clock to remind against).
 */
export function computeDueReminders(params: {
  slots: ReminderSlotInput[]
  periodTimes: ReminderPeriodTime[]
  nowMinutes: number
  leadMinutes: number
}): DueReminder[] {
  const { slots, periodTimes, nowMinutes, leadMinutes } = params
  const startByPeriod = new Map<number, number>()
  const startStrByPeriod = new Map<number, string>()
  for (const pt of periodTimes) {
    const mins = parseMinutes(pt.startTime)
    if (mins !== null) {
      startByPeriod.set(pt.period, mins)
      startStrByPeriod.set(pt.period, pt.startTime)
    }
  }

  const due: DueReminder[] = []
  for (const slot of slots) {
    if (NO_REMINDER_TYPES.has(slot.type)) continue
    const start = startByPeriod.get(slot.period)
    if (start === undefined) continue
    const remindAt = start - leadMinutes
    if (nowMinutes < remindAt || nowMinutes >= start) continue

    const startStr = startStrByPeriod.get(slot.period)!
    const minsAway = start - nowMinutes
    const label = slot.subjectName ?? slot.type
    due.push({
      period: slot.period,
      startTime: startStr,
      title: 'Class starting soon',
      body: `${label} starts at ${startStr} (P${slot.period}) — in ${minsAway} min`,
    })
  }
  return due
}
