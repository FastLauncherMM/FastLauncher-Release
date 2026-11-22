import { ref } from 'vue'

export interface AppFlashAction {
  label: string
  handler: () => void
}

export interface AppFlash {
  kind: 'download-done' | 'download-error' | 'download-cancelled' | 'game-exit' | 'update-ready' | 'update-available'
  id?: string
  durationMs?: number
  sizeBytes?: number
  message?: string
  /** Optional action button (renderer-created toasts only). */
  action?: AppFlashAction
}

export interface AppFlashItem extends AppFlash {
  key: number
}

const flashes = ref<AppFlashItem[]>([])
const MAX_FLASHES = 4
let nextKey = 1

export function useAppFlashQueue() {
  function push(f: AppFlash) {
    // A cancel is already reflected inline in the download card; no toast.
    if (f.kind === 'download-cancelled') return
    flashes.value.push({ ...f, key: nextKey++ })
    while (flashes.value.length > MAX_FLASHES) flashes.value.shift()
  }

  function dismiss(key: number) {
    flashes.value = flashes.value.filter((f) => f.key !== key)
  }

  return { flashes, push, dismiss }
}
