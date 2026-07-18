// Parses the plain text extracted from a digital (text-selectable) exam
// hall-ticket PDF into a set of DRAFT exams the user reviews and edits before
// saving. Deliberately best-effort and permissive: every row is editable in
// the UI, so over-matching a date is cheaper than missing one. Pure + no
// Electron/DOM deps so it can be unit-tested against extracted text.

export interface HallTicketDraftRow {
  /** Best-guess exam name (course title, falling back to the code or line). */
  name: string
  /** Matched subject id, or null when nothing matched confidently. */
  subjectId: number | null
  /** ISO yyyy-mm-dd. */
  date: string
  /** The original source line, kept for display/debugging in the draft. */
  source: string
}

interface SubjectLike {
  id: number
  name: string
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

// Lines whose date is obviously not an exam date — issue/print/birth dates.
const NON_EXAM_DATE_LINE = /\b(date of (issue|print|printing)|printed on|generated on|issued on|d\.?o\.?b|date of birth|valid (up)?to)\b/i

// A course-code token like CSE731, MCA502A, 21MDS131.
const COURSE_CODE = /\b(\d{0,2}[A-Z]{2,4}\d{2,4}[A-Z]?)\b/

interface FoundDate {
  iso: string
  match: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  if (y < 1900 || y > 2100) return false
  return true
}

function fourDigitYear(y: number): number {
  return y < 100 ? 2000 + y : y
}

/** Finds the first plausible date on a line and returns it in ISO form. */
export function findDate(line: string): FoundDate | null {
  // 1. ISO-ish yyyy-mm-dd (4-digit lead) — unambiguous, try first.
  let m = line.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
    if (isValidYmd(y, mo, d)) return { iso: `${y}-${pad(mo)}-${pad(d)}`, match: m[0] }
  }

  // 2. "19 Dec 2026" / "19 December 2026" (day month-name year).
  m = line.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/)
  if (m) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, m[2].length >= 4 ? 4 : 3)] ?? MONTHS[m[2].toLowerCase().slice(0, 3)]
    const y = Number(m[3]), d = Number(m[1])
    if (mo && isValidYmd(y, mo, d)) return { iso: `${y}-${pad(mo)}-${pad(d)}`, match: m[0] }
  }

  // 3. "Dec 19, 2026" (month-name day year).
  m = line.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/)
  if (m) {
    const mo = MONTHS[m[1].toLowerCase().slice(0, 3)]
    const y = Number(m[3]), d = Number(m[2])
    if (mo && isValidYmd(y, mo, d)) return { iso: `${y}-${pad(mo)}-${pad(d)}`, match: m[0] }
  }

  // 4. Numeric day-first d-m-y / d/m/y / d.m.y (Indian convention).
  m = line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/)
  if (m) {
    const d = Number(m[1]), mo = Number(m[2]), y = fourDigitYear(Number(m[3]))
    if (isValidYmd(y, mo, d)) return { iso: `${y}-${pad(mo)}-${pad(d)}`, match: m[0] }
  }

  return null
}

function extractName(line: string, dateMatch: string, code: string | null): string {
  let name = line
  if (code) name = name.replace(code, ' ')
  name = name.replace(dateMatch, ' ')
  // Strip time tokens like "10:00 AM", "2:00PM", "14:30".
  name = name.replace(/\b\d{1,2}:\d{2}\s*(?:[AaPp]\.?[Mm]\.?)?/g, ' ')
  // Strip common table noise and separators.
  name = name.replace(/\b(session|forenoon|afternoon|fn|an|slot|shift)\b/gi, ' ')
  name = name.replace(/[|·•\t]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s\-–—:.]+|[\s\-–—:.]+$/g, '')
  return name.trim()
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function matchSubjectId(line: string, code: string | null, subjects: SubjectLike[]): number | null {
  const lc = line.toLowerCase()

  // 1. Course code appearing inside a subject's name (e.g. "Data Engineering (CSE731)").
  if (code) {
    const byCode = subjects.find((s) => s.name.toLowerCase().includes(code.toLowerCase()))
    if (byCode) return byCode.id
  }

  // 2. A subject's full name appearing in the line — prefer the longest match.
  let best: SubjectLike | null = null
  let bestLen = 0
  for (const s of subjects) {
    const n = normalizeName(s.name)
    if (n.length >= 3 && normalizeName(line).includes(n) && n.length > bestLen) {
      best = s
      bestLen = n.length
    }
  }
  if (best) return best.id

  // 3. Token overlap: most of the subject's significant words appear in the line.
  const lineTokens = new Set(normalizeName(lc).split(' ').filter((t) => t.length >= 4))
  let bestScore = 0
  for (const s of subjects) {
    const words = normalizeName(s.name).split(' ').filter((t) => t.length >= 4)
    if (words.length === 0) continue
    const hit = words.filter((w) => lineTokens.has(w)).length
    const ratio = hit / words.length
    if (hit >= 2 && ratio >= 0.6 && hit > bestScore) {
      best = s
      bestScore = hit
    }
  }
  return best ? best.id : null
}

/**
 * Parses extracted hall-ticket text into draft exam rows. One row per line
 * that carries a plausible exam date; header/footer date lines are skipped.
 * Results are de-duplicated on (date + normalized name).
 */
export function parseHallTicket(text: string, subjects: SubjectLike[]): HallTicketDraftRow[] {
  const rows: HallTicketDraftRow[] = []
  const seen = new Set<string>()

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.length === 0) continue
    if (NON_EXAM_DATE_LINE.test(line)) continue

    const found = findDate(line)
    if (!found) continue

    const codeMatch = line.match(COURSE_CODE)
    const code = codeMatch ? codeMatch[1] : null
    const subjectId = matchSubjectId(line, code, subjects)

    let name = extractName(line, found.match, code)
    if (name.length < 2) name = code ?? 'Exam'

    const key = `${found.iso}::${normalizeName(name)}`
    if (seen.has(key)) continue
    seen.add(key)

    rows.push({ name, subjectId, date: found.iso, source: line })
  }

  // Chronological order for review.
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return rows
}
