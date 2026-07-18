import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settings-store'

export function useTheme() {
  const theme = useSettingsStore((s) => s.theme)
  const density = useSettingsStore((s) => s.density)

  useEffect(() => {
    const root = document.documentElement
    const apply = (dark: boolean) => root.classList.toggle('dark', dark)

    if (theme === 'dark') {
      apply(true)
      return
    }
    if (theme === 'light') {
      apply(false)
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    apply(media.matches)
    const listener = (e: MediaQueryListEvent) => apply(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('compact', density === 'compact')
  }, [density])
}
