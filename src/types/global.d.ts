import type { BunkMateApi } from '../../electron/preload'

declare global {
  interface Window {
    bunkmate: BunkMateApi
  }
}

export {}
