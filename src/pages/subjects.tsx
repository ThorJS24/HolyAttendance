import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { useSubjectsStore } from '@/store/subjects-store'
import { useSettingsStore } from '@/store/settings-store'
import { useToastStore } from '@/store/toast-store'
import { useHotkey } from '@/hooks/use-hotkey'
import type { Subject, NewSubject } from '../../electron/db/repositories/subjects'

const CATEGORIES = ['core', 'elective', 'lab', 'other']

interface SubjectFormState {
  name: string
  semester: string
  credits: string
  faculty: string
  category: string
}

function emptyForm(defaultSemester: string): SubjectFormState {
  return { name: '', semester: defaultSemester, credits: '3', faculty: '', category: 'core' }
}

export function SubjectsPage() {
  const { subjects, loading, load, create, update, setArchived, remove } = useSubjectsStore()
  const currentSemester = useSettingsStore((s) => s.currentSemester)
  const pushToast = useToastStore((s) => s.push)

  const [showArchived, setShowArchived] = useState(false)
  const [semesterFilter, setSemesterFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [form, setForm] = useState<SubjectFormState>(emptyForm(currentSemester))
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load({ includeArchived: true })
  }, [load])

  const semesters = useMemo(() => {
    const set = new Set(subjects.map((s) => s.semester))
    return Array.from(set).sort()
  }, [subjects])

  const visibleSubjects = useMemo(() => {
    return subjects.filter((s) => {
      if (!showArchived && s.archived) return false
      if (semesterFilter !== 'all' && s.semester !== semesterFilter) return false
      return true
    })
  }, [subjects, showArchived, semesterFilter])

  function openCreateDialog() {
    setEditing(null)
    setForm(emptyForm(currentSemester))
    setDialogOpen(true)
  }

  useHotkey('n', openCreateDialog)

  function openEditDialog(subject: Subject) {
    setEditing(subject)
    setForm({
      name: subject.name,
      semester: subject.semester,
      credits: String(subject.credits),
      faculty: subject.faculty ?? '',
      category: subject.category ?? 'core',
    })
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.semester.trim()) return

    setSaving(true)
    try {
      const payload: NewSubject = {
        name: form.name.trim(),
        semester: form.semester.trim(),
        credits: Math.max(0, Number(form.credits) || 0),
        faculty: form.faculty.trim() || null,
        category: form.category || null,
      }
      if (editing) {
        await update(editing.id, payload)
        pushToast({ title: 'Subject updated' })
      } else {
        await create(payload)
        pushToast({ title: 'Subject created' })
      }
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleArchive(subject: Subject) {
    await setArchived(subject.id, !subject.archived)
    pushToast({ title: subject.archived ? 'Subject restored' : 'Subject archived' })
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    await remove(target.id)
    setDeleteTarget(null)
    pushToast({
      title: 'Subject deleted',
      description: `${target.name} and its attendance history were removed.`,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Subjects</h1>
        <Button onClick={openCreateDialog}>
          <Plus /> New Subject
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="semester-filter">Semester</Label>
          <Select value={semesterFilter} onValueChange={setSemesterFilter}>
            <SelectTrigger id="semester-filter" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All semesters</SelectItem>
              {semesters.map((sem) => (
                <SelectItem key={sem} value={sem}>
                  {sem}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
          <Label htmlFor="show-archived">Show archived</Label>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    <Spinner className="mx-auto" />
                  </TableCell>
                </TableRow>
              )}
              {visibleSubjects.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No subjects yet.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                visibleSubjects.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>{subject.semester}</TableCell>
                  <TableCell>{subject.credits}</TableCell>
                  <TableCell>{subject.faculty ?? '—'}</TableCell>
                  <TableCell>{subject.category ?? '—'}</TableCell>
                  <TableCell>
                    {subject.archived ? (
                      <Badge variant="secondary">Archived</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEditDialog(subject)} aria-label="Edit">
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleToggleArchive(subject)}
                        aria-label={subject.archived ? 'Restore' : 'Archive'}
                      >
                        {subject.archived ? <ArchiveRestore /> : <Archive />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteTarget(subject)}
                        aria-label="Delete"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit subject' : 'New subject'}</DialogTitle>
              <DialogDescription>
                {editing ? 'Update the subject details.' : 'Add a subject to track attendance for.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="semester">Semester</Label>
                <Input
                  id="semester"
                  value={form.semester}
                  onChange={(e) => setForm({ ...form, semester: e.target.value })}
                  placeholder="2026-1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="credits">Credits</Label>
                <Input
                  id="credits"
                  type="number"
                  min={0}
                  value={form.credits}
                  onChange={(e) => setForm({ ...form, credits: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="faculty">Faculty</Label>
                <Input
                  id="faculty"
                  value={form.faculty}
                  onChange={(e) => setForm({ ...form, faculty: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {editing ? 'Save changes' : 'Create subject'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the subject and its timetable slots and attendance records. This
              cannot be undone.
            </DialogDescription>
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
