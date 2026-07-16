import { useEffect } from 'react'
import { Bell, AlertTriangle, Info, TriangleAlert } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/hooks/use-notifications'
import { useSubjectsStore } from '@/store/subjects-store'
import { useHolidaysStore } from '@/store/holidays-store'
import { cn } from '@/lib/utils'

const SEVERITY_ICON = { critical: AlertTriangle, warning: TriangleAlert, info: Info } as const
const SEVERITY_CLASS = {
  critical: 'text-destructive',
  warning: 'text-warning',
  info: 'text-muted-foreground',
} as const

export function NotificationCenter() {
  const loadSubjects = useSubjectsStore((s) => s.load)
  const loadHolidays = useHolidaysStore((s) => s.load)
  useEffect(() => {
    loadSubjects({ includeArchived: false })
    loadHolidays()
  }, [loadSubjects, loadHolidays])

  const notifications = useNotifications()
  const criticalCount = notifications.filter((n) => n.severity === 'critical').length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell />
          {notifications.length > 0 && (
            <span
              className={cn(
                'absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-medium text-white',
                criticalCount > 0 ? 'bg-destructive' : 'bg-warning',
              )}
            >
              {notifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="mb-2 text-sm font-semibold">Notifications</p>
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">You're all caught up.</p>
        ) : (
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {notifications.map((n) => {
              const Icon = SEVERITY_ICON[n.severity]
              return (
                <div key={n.id} className="flex gap-2">
                  <Icon className={cn('mt-0.5 size-4 shrink-0', SEVERITY_CLASS[n.severity])} />
                  <div>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
