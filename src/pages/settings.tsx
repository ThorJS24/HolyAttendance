import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen, Save, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useSettingsStore } from '@/store/settings-store'
import { useToastStore } from '@/store/toast-store'

export function SettingsPage() {
  const {
    minTarget,
    currentSemester,
    theme,
    backupIntervalDays,
    backupDir,
    lastBackupAt,
    setMinTarget,
    setCurrentSemester,
    setTheme,
    setBackupIntervalDays,
    setBackupDir,
    load,
  } = useSettingsStore()
  const pushToast = useToastStore((s) => s.push)

  const [minTargetInput, setMinTargetInput] = useState(String(minTarget))
  const [semesterInput, setSemesterInput] = useState(currentSemester)
  const [intervalInput, setIntervalInput] = useState(String(backupIntervalDays))
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)

  async function handleChooseBackupDir() {
    const dir = await window.bunkmate.backup.chooseDir()
    if (dir) await setBackupDir(dir)
  }

  async function handleBackupNow() {
    setBackingUp(true)
    try {
      const path = await window.bunkmate.backup.now()
      if (path) {
        await load()
        pushToast({ title: 'Backup created', description: path })
      }
    } finally {
      setBackingUp(false)
    }
  }

  async function handleRestore() {
    setRestoreConfirmOpen(false)
    setRestoring(true)
    try {
      const didRestore = await window.bunkmate.backup.restore()
      if (!didRestore) setRestoring(false)
      // On success the app relaunches immediately; nothing left to do here.
    } catch {
      setRestoring(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
          <CardDescription>The minimum percentage used for warnings and safe-bunk counts.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="min-target">Target %</Label>
            <Input
              id="min-target"
              type="number"
              min={0}
              max={100}
              className="w-28"
              value={minTargetInput}
              onChange={(e) => setMinTargetInput(e.target.value)}
              onBlur={() => setMinTarget(Number(minTargetInput) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="semester">Current semester</Label>
            <Input
              id="semester"
              className="w-40"
              value={semesterInput}
              onChange={(e) => setSemesterInput(e.target.value)}
              onBlur={() => setCurrentSemester(semesterInput)}
              placeholder="2026-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger id="theme" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Academic calendar</CardTitle>
          <CardDescription>
            Holidays and working Saturdays are managed from the{' '}
            <Link to="/calendar" className="underline">
              Calendar
            </Link>{' '}
            page.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup &amp; restore</CardTitle>
          <CardDescription>
            All data lives in one local SQLite file. Back it up regularly — restoring overwrites it entirely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="backup-interval">Auto-backup every (days)</Label>
              <Input
                id="backup-interval"
                type="number"
                min={1}
                className="w-28"
                value={intervalInput}
                onChange={(e) => setIntervalInput(e.target.value)}
                onBlur={() => setBackupIntervalDays(Number(intervalInput) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label>Auto-backup folder</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{backupDir ?? 'Not set'}</span>
                <Button type="button" variant="outline" size="sm" onClick={handleChooseBackupDir}>
                  <FolderOpen /> Choose folder
                </Button>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {lastBackupAt ? `Last backup: ${new Date(lastBackupAt).toLocaleString()}` : 'No backup has been made yet.'}
          </p>

          <div className="flex gap-2">
            <Button type="button" onClick={handleBackupNow} disabled={backingUp}>
              <Save /> Backup now
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRestoreConfirmOpen(true)}
              disabled={restoring}
            >
              <Upload /> Restore from backup
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore from backup?</DialogTitle>
            <DialogDescription>
              This replaces all current data with the chosen backup file and restarts the app. This cannot be
              undone — make sure your current data is backed up first if you want to keep it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRestore}>
              Choose file &amp; restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
