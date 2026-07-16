import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useHolidaysStore } from '@/store/holidays-store'
import { useToastStore } from '@/store/toast-store'
import type { Holiday } from '../../electron/db/repositories/holidays'
import type { HolidayType } from '@/db/schema'
import { HOLIDAY_TYPES } from '@/db/schema'
import { todayIso } from '@/lib/date-utils'

interface FormState {
  date: string
  type: HolidayType
  label: string
}

function emptyForm(): FormState {
  return { date: todayIso(), type: 'public', label: '' }
}

export function HolidaysTab() {
  const { holidays, load, create, update, remove } = useHolidaysStore()
  const pushToast = useToastStore((s) => s.push)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Holiday | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [load])

  const sorted = useMemo(() => [...holidays].sort((a, b) => (a.date < b.date ? -1 : 1)), [holidays])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(h: Holiday) {
    setEditing(h)
    setForm({ date: h.date, type: h.type, label: h.label ?? '' })
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { date: form.date, type: form.type, label: form.label.trim() || null }
      if (editing) {
        await update(editing.id, payload)
        pushToast({ title: 'Holiday updated' })
      } else {
        await create(payload)
        pushToast({ title: 'Holiday added' })
      }
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await remove(deleteTarget.id)
    setDeleteTarget(null)
    pushToast({ title: 'Holiday removed' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Public, university, and custom holidays, plus working Saturdays.</p>
        <Button onClick={openCreate}>
          <Plus /> Add holiday
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No holidays on record.
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{h.date}</TableCell>
                  <TableCell className="capitalize">{h.type.replace('_', ' ')}</TableCell>
                  <TableCell>{h.label ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(h)} aria-label="Edit">
                        <Pencil />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(h)} aria-label="Delete">
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
              <DialogTitle>{editing ? 'Edit holiday' : 'Add holiday'}</DialogTitle>
              <DialogDescription>
                Holidays exclude scheduled periods that day, except working Saturdays.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="holiday-date">Date</Label>
                <Input
                  id="holiday-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="holiday-type">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as HolidayType })}>
                  <SelectTrigger id="holiday-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOLIDAY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday-label">Label</Label>
              <Input
                id="holiday-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Independence Day"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {editing ? 'Save changes' : 'Add holiday'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this holiday?</DialogTitle>
            <DialogDescription>Scheduled periods on this date will count normally again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
