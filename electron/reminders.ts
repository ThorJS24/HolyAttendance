import { Notification, BrowserWindow } from 'electron'
import type { AppDatabase } from './db/client'
import { settingsRepo, semestersRepo, timetableSlotsRepo, subjectsRepo } from './db/repositories'
import { jsDayToWeekday } from '../src/lib/attendance-engine'
import { computeDueReminders } from '../src/lib/class-reminders'
import { todayIso } from '../src/lib/date-utils'

// How often the scheduler re-checks. 30s means a reminder fires within half a
// minute of its lead window opening — fine granularity for a ~10-minute
// heads-up, cheap enough to run continuously.
const TICK_MS = 30_000

function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Starts the class-start reminder loop in the MAIN process. It only fires
 * while the app is running — this is not a background OS service; if the app
 * is closed, no reminders are sent (surfaced to the user in Settings).
 *
 * Each tick: if reminders are enabled and today's active semester has period
 * times, ask computeDueReminders() what's in its lead window right now, and
 * fire a native Notification for any not already sent today. The fired-key
 * set resets when the date rolls over.
 */
export function startClassReminders(db: AppDatabase): () => void {
  const firedToday = new Set<string>()
  let firedDate = todayIso()

  function tick() {
    try {
      const today = todayIso()
      if (today !== firedDate) {
        firedToday.clear()
        firedDate = today
      }

      const settings = settingsRepo.getSettings(db)
      if (!settings.classReminders) return

      const semester = semestersRepo
        .listSemesters(db)
        .find((s) => s.label === settings.currentSemester)
      const periodTimes = semester?.periodTimes ?? []
      if (periodTimes.length === 0) return // no clock times -> nothing to remind against

      const weekday = jsDayToWeekday(today)
      if (!weekday) return

      const slots = timetableSlotsRepo
        .listTimetableSlots(db, { semester: settings.currentSemester })
        .filter((s) => s.day === weekday)
      if (slots.length === 0) return

      const subjectsById = new Map(
        subjectsRepo.listSubjects(db, { includeArchived: true }).map((s) => [s.id, s.name]),
      )

      const due = computeDueReminders({
        slots: slots.map((s) => ({
          period: s.period,
          type: s.type,
          subjectName: s.subjectId !== null ? (subjectsById.get(s.subjectId) ?? null) : null,
        })),
        periodTimes,
        nowMinutes: nowMinutes(),
        leadMinutes: settings.classReminderLeadMinutes,
      })

      for (const reminder of due) {
        const key = `${today}:${reminder.period}`
        if (firedToday.has(key)) continue
        firedToday.add(key)
        if (!Notification.isSupported()) continue
        const notification = new Notification({ title: reminder.title, body: reminder.body })
        notification.on('click', () => {
          const win = BrowserWindow.getAllWindows()[0]
          if (win) {
            if (win.isMinimized()) win.restore()
            win.focus()
          }
        })
        notification.show()
      }
    } catch {
      // A reminder failure must never take down the app — swallow and retry
      // next tick.
    }
  }

  const interval = setInterval(tick, TICK_MS)
  tick() // check once immediately on start
  return () => clearInterval(interval)
}
