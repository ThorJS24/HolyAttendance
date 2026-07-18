/**
 * The user's current local calendar date as a plain yyyy-mm-dd string.
 * Deliberately NOT `new Date().toISOString().slice(0, 10)` — that reports
 * the UTC calendar date, which is a day ahead of local for anyone west of
 * Greenwich... no, east of it (UTC+ offsets) near midnight, e.g. 11:36pm in
 * India already reads as tomorrow in UTC. Attendance dates are entered and
 * stored as local calendar dates with no time-of-day, so "today" needs to
 * match that same convention.
 */
export function todayIso(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * The calendar day after `dateIso` (yyyy-mm-dd), as a plain date string.
 * UTC-anchored so it never shifts by a timezone offset — matches how dates
 * are stored everywhere (plain date, no time-of-day).
 */
export function nextDayIso(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
