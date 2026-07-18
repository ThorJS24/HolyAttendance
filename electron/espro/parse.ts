import type { ParsedAttendanceRow } from '../../src/lib/attendance-import'

// Turns a fetched ESPRO attendance page into the SAME row shape the CSV
// importer already consumes (date, subjectName, period, status), so the rest of
// the pipeline — reconcile diff, review, apply — is reused unchanged.
//
// ⛔ STUB: this is deliberately left empty. Writing a correct table extractor
// requires a real ESPRO attendance-page HTML sample; guessing at the markup
// would be worse than doing nothing. It stays a no-op until that sample exists.
export function parseEsproAttendance(_html: string): ParsedAttendanceRow[] {
  // TODO: parse real ESPRO table structure once HTML sample provided
  return []
}
