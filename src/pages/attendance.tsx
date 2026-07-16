import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { useAttendanceStore } from '@/store/attendance-store'
import { useToastStore } from '@/store/toast-store'
import type { AttendanceRecord } from '../../electron/db/repositories/attendance-records'
import type { AttendanceStatus } from '@/db/schema'

function startOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface RecordFormState {
  subjectId: string
  date: string
  period: string
  status: AttendanceStatus
}

function emptyForm(defaultSubjectId: string): RecordFormState {
  return { subjectId: defaultSubjectId, date: today(), period: '1', status: 'present' }
}

export function AttendancePage() {
  const { subjects, load: loadSubjects } = useSubjectsStore()
  const { records, loading, load, create, update, remove } = useAttendanceStore()
  const pushToast = useToastStore((s) => s.push)

  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState(startOfMonth())
  const [dateTo, setDateTo] = useState(today())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AttendanceRecord | null>(null)
  const [form, setForm] = useState<RecordFormState>(emptyForm(''))
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRecord | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSubjects({ includeArchived: false })
  }, [loadSubjects])

  useEffect(() => {
    load({
      subjectId: subjectFilter === 'all' ? undefined : Number(subjectFilter),
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })
  }, [load, subjectFilter, dateFrom, dateTo])

  const subjectsById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.period - b.period)),
    [records],
  )

  function openCreateDialog() {
    setEditing(null)
    setForm(emptyForm(subjects[0] ? String(subjects[0].id) : ''))
    setDialogOpen(true)
  }

  function openEditDialog(record: AttendanceRecord) {
    setEditing(record)
    setForm({
      subjectId: String(record.subjectId),
      date: record.date,
      period: String(record.period),
      status: record.status,
    })
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.subjectId) return

    setSaving(true)
    try {
      if (editing) {
        await update(editing.id, {
          subjectId: Number(form.subjectId),
          date: form.date,
          period: Number(form.period),
          status: form.status,
        })
        pushToast({ title: 'Attendance updated' })
      } else {
        await create({
          subjectId: Number(form.subjectId),
          date: form.date,
          period: Number(form.period),
          status: form.status,
          source: 'manual',
          slotId: null,
        })
        pushToast({ title: 'Attendance recorded' })
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
    pushToast({
      title: 'Record deleted',
      action: {
        label: 'Undo',
        onClick: () => {
          create({
            subjectId: target.subjectId,
            date: target.date,
            period: target.period,
            status: target.status,
            source: target.source,
            slotId: target.slotId,
          })
        },
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <Button onClick={openCreateDialog} disabled={subjects.length === 0}>
          <Plus /> Mark Attendance
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="subject-filter">Subject</Label>
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger id="subject-filter" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="date-from">From</Label>
          <Input id="date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date-to">To</Label>
          <Input id="date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRecords.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No attendance records in this range.
                  </TableCell>
                </TableRow>
              )}
              {sortedRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.date}</TableCell>
                  <TableCell>{record.period}</TableCell>
                  <TableCell>{subjectsById.get(record.subjectId)?.name ?? `#${record.subjectId}`}</TableCell>
                  <TableCell>
                    <Badge variant={record.status === 'present' ? 'success' : 'destructive'}>
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{record.source}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEditDialog(record)} aria-label="Edit">
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteTarget(record)}
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
              <DialogTitle>{editing ? 'Edit attendance' : 'Mark attendance'}</DialogTitle>
              <DialogDescription>
                {editing ? 'Update this attendance record.' : 'Record attendance for a subject and period.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="record-subject">Subject</Label>
              <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })}>
                <SelectTrigger id="record-subject">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="record-date">Date</Label>
                <Input
                  id="record-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="record-period">Period</Label>
                <Input
                  id="record-period"
                  type="number"
                  min={1}
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="record-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as AttendanceStatus })}
              >
                <SelectTrigger id="record-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {editing ? 'Save changes' : 'Mark attendance'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this record?</DialogTitle>
            <DialogDescription>You can undo this immediately after deleting.</DialogDescription>
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
