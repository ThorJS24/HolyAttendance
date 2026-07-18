// ESPRO sync orchestrator (Part D — SCAFFOLDING, not a finished feature).
//
// This wires the pieces together: decrypt the stored credential at sync time,
// log in (Part C), fetch the attendance page, parse it, and hand the rows to
// the SAME reconcile diff machinery the CSV importer already uses and tests.
// Two steps are still stubs because they need a real ESPRO page to write
// correctly (see fetchAttendanceHtml and parse.ts); everything downstream of
// them — building the reconcile inputs and producing the diff — is real and
// reused unchanged, so it "just works" once real rows flow in.
//
// Nothing calls this yet: the follow-up that implements the parser will also
// add the "Sync now" trigger + diff-review UI (which reuses the existing CSV
// review/apply flow). Kept here so that follow-up is a small, obvious edit.
import type { AppDatabase } from '../db/client'
import { subjectsRepo, attendanceRecordsRepo, settingsRepo } from '../db/repositories'
import { loadEsproCredential } from './credential-store'
import { esproLogin, type EsproSession } from './login'
import { parseEsproAttendance } from './parse'
import { reconcileImport, reconcileKey, type ReconcileResult } from '../../src/lib/attendance-import'

// STUB: fetch the authenticated attendance page for this session.
// TODO: request the real attendance URL once its path is confirmed.
async function fetchAttendanceHtml(_session: EsproSession): Promise<string> {
  return ''
}

export type EsproSyncOutcome =
  | { status: 'no-credentials' }
  // Login + reconcile are wired; the HTML→rows parse is still a stub, so the
  // (currently always-empty) diff is reported under this honest status rather
  // than as a successful "nothing changed" sync.
  | { status: 'parse-not-implemented'; result: ReconcileResult }

export async function esproSyncPreview(db: AppDatabase, userDataDir: string): Promise<EsproSyncOutcome> {
  // Decrypt ONLY here, at sync time, and only into a local variable.
  const creds = loadEsproCredential(userDataDir)
  if (!creds) return { status: 'no-credentials' }

  // Part C login mechanism — throws EsproLoginError on failure (surfaced to the
  // caller). NOT verified against the live portal; see login.ts.
  const session = await esproLogin(creds)
  const html = await fetchAttendanceHtml(session)
  const rows = parseEsproAttendance(html) // [] until the stub is implemented

  // --- Reused, tested CSV-import reconcile machinery from here down. ---
  const currentSemester = settingsRepo.getSettings(db).currentSemester
  const subjectIdByName = new Map(
    subjectsRepo.listSubjects(db, { semester: currentSemester }).map((s) => [s.name.toLowerCase(), s.id]),
  )
  const existingStatusByKey = new Map<string, 'present' | 'absent'>()
  for (const r of attendanceRecordsRepo.listAttendanceRecords(db)) {
    existingStatusByKey.set(reconcileKey(r.subjectId, r.date, r.period), r.status)
  }
  const result = reconcileImport({ rows, subjectIdByName, existingStatusByKey })

  return { status: 'parse-not-implemented', result }
}
