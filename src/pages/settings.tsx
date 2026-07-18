import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen, Save, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useSettingsStore } from '@/store/settings-store'
import { useSemestersStore } from '@/store/semesters-store'
import { useToastStore } from '@/store/toast-store'
import { NOTIFICATION_CATEGORY_LABELS, type NotificationCategory } from '@/lib/notifications'

export function SettingsPage() {
  const {
    overallMinTarget,
    subjectMinTarget,
    theme,
    density,
    atRiskMarginPp,
    mutedNotificationCategories,
    classReminders,
    classReminderLeadMinutes,
    currentSemester,
    backupIntervalDays,
    backupDir,
    lastBackupAt,
    setOverallMinTarget,
    setSubjectMinTarget,
    setAtRiskMarginPp,
    setTheme,
    setDensity,
    setMutedNotificationCategories,
    setClassReminders,
    setClassReminderLeadMinutes,
    setBackupIntervalDays,
    setBackupDir,
    load,
  } = useSettingsStore()
  const pushToast = useToastStore((s) => s.push)

  const semesters = useSemestersStore((s) => s.semesters)
  const loadSemesters = useSemestersStore((s) => s.load)
  useEffect(() => {
    loadSemesters()
  }, [loadSemesters])
  // Reminders need real clock times, which come from Grid Settings'
  // auto-allocate. If the active semester has none, the feature can't work,
  // so it's disabled with an explanation rather than silently doing nothing.
  const activeSemesterHasTimes =
    (semesters.find((s) => s.label === currentSemester)?.periodTimes?.length ?? 0) > 0

  const [overallMinTargetInput, setOverallMinTargetInput] = useState(String(overallMinTarget))
  const [subjectMinTargetInput, setSubjectMinTargetInput] = useState(String(subjectMinTarget))
  const [atRiskMarginInput, setAtRiskMarginInput] = useState(String(atRiskMarginPp))
  const [leadInput, setLeadInput] = useState(String(classReminderLeadMinutes))
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
          <CardDescription>
            Overall applies to the dashboard's total attendance; the subject default applies to each subject
            unless it has its own override.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="overall-min-target">Overall minimum %</Label>
            <Input
              id="overall-min-target"
              type="number"
              min={0}
              max={100}
              className="w-28"
              value={overallMinTargetInput}
              onChange={(e) => setOverallMinTargetInput(e.target.value)}
              onBlur={() => {
                const clamped = Math.min(100, Math.max(0, Number(overallMinTargetInput) || 0))
                setOverallMinTargetInput(String(clamped))
                setOverallMinTarget(clamped)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject-min-target">Default subject minimum %</Label>
            <Input
              id="subject-min-target"
              type="number"
              min={0}
              max={100}
              className="w-28"
              value={subjectMinTargetInput}
              onChange={(e) => setSubjectMinTargetInput(e.target.value)}
              onBlur={() => {
                const clamped = Math.min(100, Math.max(0, Number(subjectMinTargetInput) || 0))
                setSubjectMinTargetInput(String(clamped))
                setSubjectMinTarget(clamped)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="at-risk-margin">At-risk margin (pts)</Label>
            <Input
              id="at-risk-margin"
              type="number"
              min={0}
              max={50}
              className="w-28"
              value={atRiskMarginInput}
              onChange={(e) => setAtRiskMarginInput(e.target.value)}
              onBlur={() => {
                const clamped = Math.min(50, Math.max(0, Number(atRiskMarginInput) || 0))
                setAtRiskMarginInput(String(clamped))
                setAtRiskMarginPp(clamped)
              }}
            />
            <p className="text-xs text-muted-foreground">Warn when within this many points of target. 0 turns it off.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Semesters</CardTitle>
          <CardDescription>
            Add, edit, and switch between semesters — including period count and lunch position — from the{' '}
            <Link to="/semesters" className="underline">
              Semesters
            </Link>{' '}
            page. The semester shown across Timetable, Subjects, Dashboard, and Analytics is picked from the
            switcher on those pages.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6">
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
          <div className="space-y-2">
            <Label htmlFor="density">Density</Label>
            <Select value={density} onValueChange={setDensity}>
              <SelectTrigger id="density" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">Comfortable</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Turn off any alert category you don't want in the bell. Muted categories stop appearing entirely;
            dismissing or marking individual alerts read is done from the bell itself.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(NOTIFICATION_CATEGORY_LABELS) as NotificationCategory[]).map((category) => {
            const muted = mutedNotificationCategories.includes(category)
            return (
              <div key={category} className="flex items-center justify-between">
                <Label htmlFor={`notif-${category}`} className="font-normal">
                  {NOTIFICATION_CATEGORY_LABELS[category]}
                </Label>
                <Switch
                  id={`notif-${category}`}
                  checked={!muted}
                  onCheckedChange={(enabled) => {
                    const next = enabled
                      ? mutedNotificationCategories.filter((c) => c !== category)
                      : [...mutedNotificationCategories, category]
                    setMutedNotificationCategories(next)
                  }}
                />
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Class reminders</CardTitle>
          <CardDescription>
            A desktop notification before each class starts. Only fires while BunkMate is running — it isn't a
            background service, so nothing is sent when the app is closed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!activeSemesterHasTimes ? (
            <p className="text-sm text-muted-foreground">
              Reminders need real class times. Set them first with{' '}
              <span className="font-medium">Auto-allocate times</span> in the Timetable's Grid settings for the
              active semester, then this option unlocks.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Label htmlFor="class-reminders" className="font-normal">
                  Remind me before class
                </Label>
                <Switch id="class-reminders" checked={classReminders} onCheckedChange={setClassReminders} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reminder-lead">Lead time (minutes)</Label>
                <Input
                  id="reminder-lead"
                  type="number"
                  min={1}
                  max={120}
                  className="w-28"
                  value={leadInput}
                  disabled={!classReminders}
                  onChange={(e) => setLeadInput(e.target.value)}
                  onBlur={() => {
                    const clamped = Math.min(120, Math.max(1, Number(leadInput) || 10))
                    setLeadInput(String(clamped))
                    setClassReminderLeadMinutes(clamped)
                  }}
                />
              </div>
            </>
          )}
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
                onBlur={() => {
                  const clamped = Math.max(1, Number(intervalInput) || 1)
                  setIntervalInput(String(clamped))
                  setBackupIntervalDays(clamped)
                }}
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
