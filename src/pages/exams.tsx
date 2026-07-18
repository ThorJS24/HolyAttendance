import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { SemesterSwitcher } from '@/components/semester-switcher'
import { useExamsStore } from '@/store/exams-store'
import { useSubjectsStore } from '@/store/subjects-store'
import { useSettingsStore } from '@/store/settings-store'
import { useToastStore } from '@/store/toast-store'
import { countdownLabel, daysUntil, todayIso } from '@/lib/date-utils'
import type { Exam } from '../../electron/db/repositories/exams'

const NO_SUBJECT = 'none'

interface ExamFormState {
  name: string
  subjectId: string
  date: string
  notes: string
}

function emptyForm(): ExamFormState {
  return { name: '', subjectId: NO_SUBJECT, date: todayIso(), notes: '' }
}

export function ExamsPage() {
  const semester = useSettingsStore((s) => s.currentSemester)
  const { exams, loading, load, create, update, remove } = useExamsStore()
  const { subjects, load: loadSubjects } = useSubjectsStore()
  const pushToast = useToastStore((s) => s.push)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Exam | null>(null)
  const [form, setForm] = useState<ExamFormState>(emptyForm())
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSubjects({ includeArchived: false })
  }, [loadSubjects])

  useEffect(() => {
    if (semester) load({ semester })
  }, [load, semester])

  const semesterSubjects = useMemo(
    () => subjects.filter((s) => s.semester === semester),
    [subjects, semester],
  )
  const subjectsById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  const visibleExams = useMemo(
    () => [...exams].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [exams],
  )

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(exam: Exam) {
    setEditing(exam)
    setForm({
      name: exam.name,
      subjectId: exam.subjectId === null ? NO_SUBJECT : String(exam.subjectId),
      date: exam.date,
      notes: exam.notes ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.date) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        subjectId: form.subjectId === NO_SUBJECT ? null : Number(form.subjectId),
        date: form.date,
        semester,
        notes: form.notes.trim() || null,
      }
      if (editing) {
        await update(editing.id, payload)
        pushToast({ title: 'Exam updated' })
      } else {
        await create(payload)
        pushToast({ title: 'Exam added' })
      }
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    await remove(target.id)
    setDeleteTarget(null)
    pushToast({ title: 'Exam deleted', description: target.name })
  }

  if (!semester) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Exams</h1>
        <p className="text-sm text-muted-foreground">Set up a semester first to track exams.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Exams</h1>
        <div className="flex items-center gap-3">
          <SemesterSwitcher />
          <Button onClick={openCreate}>
            <Plus /> Add exam
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    <Spinner className="mx-auto" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && visibleExams.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No exams for {semester} yet.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                visibleExams.map((exam) => {
                  const days = daysUntil(exam.date)
                  return (
                    <TableRow key={exam.id} className={days < 0 ? 'opacity-50' : undefined}>
                      <TableCell className="font-medium">{exam.name}</TableCell>
                      <TableCell>
                        {exam.subjectId ? (subjectsById.get(exam.subjectId)?.name ?? '—') : 'All / common'}
                      </TableCell>
                      <TableCell className="tabular-nums">{exam.date}</TableCell>
                      <TableCell>
                        <Badge variant={days < 0 ? 'secondary' : days <= 7 ? 'warning' : 'outline'}>
                          {countdownLabel(exam.date)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-muted-foreground">{exam.notes ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(exam)} aria-label="Edit">
                            <Pencil />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(exam)} aria-label="Delete">
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit exam' : 'Add exam'}</DialogTitle>
              <DialogDescription>Track a test or exam for {semester}.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="exam-name">Name</Label>
              <Input
                id="exam-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mid-semester exam"
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="exam-subject">Subject</Label>
                <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })}>
                  <SelectTrigger id="exam-subject">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SUBJECT}>All / common</SelectItem>
                    {semesterSubjects.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exam-date">Date</Label>
                <Input
                  id="exam-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-notes">Notes (optional)</Label>
              <Input
                id="exam-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Syllabus units 1–3, closed book…"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {editing ? 'Save changes' : 'Add exam'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>This removes the exam. It can't be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
