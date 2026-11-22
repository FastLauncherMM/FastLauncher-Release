import { reactive, onMounted, onUnmounted } from 'vue'

interface DownloadState {
  installed: boolean
  updateAvailable: boolean
  installedSize: number
  remoteSize: number
  checkingUpdate: boolean
  downloading: boolean
  paused: boolean
  percent: number
  speed: string
  bytes: number
  total: number
  rate: string
  rateBytes: number
  /** Bytes of a leftover .part file from an earlier (paused/failed) attempt. */
  partialBytes: number
  error: string | null
}

const stateMap = new Map<string, DownloadState>()

function getOrCreateState(id: string): DownloadState {
  let s = stateMap.get(id)
  if (!s) {
    s = reactive({
      installed: false,
      updateAvailable: false,
      installedSize: 0,
      remoteSize: 0,
      checkingUpdate: false,
      downloading: false,
      paused: false,
      percent: 0,
      speed: '0 B/s',
      bytes: 0,
      total: 0,
      rate: '',
      rateBytes: 0,
      partialBytes: 0,
      error: null,
    }) as DownloadState
    stateMap.set(id, s)
  }
  return s
}

function resetDownloadState(s: DownloadState) {
  s.downloading = false
  s.paused = false
  s.percent = 0
  s.speed = ''
  s.bytes = 0
  s.total = 0
  s.rate = ''
  s.rateBytes = 0
  s.partialBytes = 0
  s.error = null
}

/** Bytes to a human string with Russian units and comma decimals. */
export function formatBytesRu(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б'
  if (bytes < 1024) return Math.round(bytes) + ' Б'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1).replace('.', ',') + ' КБ'
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1).replace('.', ',') + ' МБ'
  return (bytes / 1073741824).toFixed(2).replace('.', ',') + ' ГБ'
}

export function useCheatDownload() {
  function getState(id: string): DownloadState {
    return getOrCreateState(id)
  }

  async function checkInstalled(id: string): Promise<boolean> {
    const s = getOrCreateState(id)
    try {
      const [result, partial] = await Promise.all([
        windowController.checkResourceInstalled(id),
        windowController.resourcePartialSize(id).catch(() => 0),
      ])
      s.installed = result
      if (!s.downloading && !s.paused) s.partialBytes = partial
      if (!result) {
        s.updateAvailable = false
        s.installedSize = 0
        s.remoteSize = 0
        return false
      }

      s.checkingUpdate = true
      try {
        const update = await windowController.checkResourceUpdate(id)
        s.updateAvailable = update.updateAvailable
        s.installedSize = update.installedSize
        s.remoteSize = update.remoteSize
      } catch {
        // An offline GitHub check must never make an installed client look
        // missing. Keep the last known update state and allow launching.
      } finally {
        s.checkingUpdate = false
      }
      return result
    } catch {
      s.installed = false
      s.checkingUpdate = false
      return false
    }
  }

  async function checkAllInstalled(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => checkInstalled(id)))
  }

  async function startDownload(id: string): Promise<void> {
    const s = getOrCreateState(id)
    s.downloading = true
    s.paused = false
    s.percent = 0
    s.speed = '0 B/s'
    s.error = null
    try {
      await windowController.downloadResource(id)
    } catch (err: any) {
      s.downloading = false
      s.error = err?.message ?? String(err)
    }
  }

  async function cancelDownload(id: string): Promise<void> {
    try {
      await windowController.cancelDownload(id)
    } catch {
      // swallow
    }
  }

  /** Stop the transfer, keep the partial file: the card offers «Продолжить». */
  async function pauseDownload(id: string): Promise<void> {
    const s = getOrCreateState(id)
    s.downloading = false
    s.paused = true
    s.rate = ''
    s.rateBytes = 0
    try {
      await windowController.cancelDownload(id)
    } catch {
      // swallow
    }
  }

  /** Stop (if running) and delete the partial file: back to the plain «Скачать». */
  async function discardDownload(id: string): Promise<void> {
    const s = getOrCreateState(id)
    resetDownloadState(s)
    try {
      await windowController.discardDownload(id)
    } catch {
      // swallow
    }
  }

  async function removeResource(id: string): Promise<void> {
    await windowController.deleteResource(id)
    const s = getOrCreateState(id)
    s.installed = false
    s.updateAvailable = false
    s.installedSize = 0
    s.remoteSize = 0
    resetDownloadState(s)
  }

  function onDownloadProgress(data: { id: string; percent: number; speed: string; bytes?: number; total?: number; rate?: string; rateBytes?: number }) {
    const s = getOrCreateState(data.id)
    s.downloading = true
    s.paused = false
    s.percent = data.percent
    s.speed = data.speed
    s.bytes = data.bytes ?? s.bytes
    s.total = data.total ?? s.total
    s.rate = data.rate ?? s.rate
    s.rateBytes = data.rateBytes ?? s.rateBytes
    s.partialBytes = 0
    s.error = null
  }

  function onDownloadDone(data: { id: string }) {
    const s = getOrCreateState(data.id)
    s.downloading = false
    s.paused = false
    s.installed = true
    s.updateAvailable = false
    s.installedSize = s.total
    s.remoteSize = s.total
    s.percent = 100
    s.speed = '0 B/s'
    s.rate = ''
    s.rateBytes = 0
    s.partialBytes = 0
    s.error = null
  }

  function onDownloadError(data: { id: string; message: string }) {
    const s = getOrCreateState(data.id)
    s.downloading = false
    s.paused = false
    s.rate = ''
    s.rateBytes = 0
    s.error = data.message
    // Keep the .part: the retry button offers «Продолжить» with its size.
    windowController.resourcePartialSize(data.id).then((n) => { s.partialBytes = n }).catch(() => {})
  }

  function onDownloadCancelled(data: { id: string; discarded?: boolean }) {
    const s = getOrCreateState(data.id)
    if (data.discarded) {
      resetDownloadState(s)
      return
    }
    s.downloading = false
    s.paused = true
    s.rate = ''
    s.rateBytes = 0
    s.speed = ''
    s.error = null
    windowController.resourcePartialSize(data.id).then((n) => { s.partialBytes = n }).catch(() => {})
  }

  onMounted(() => {
    windowController.on('download-progress', onDownloadProgress)
    windowController.on('download-done', onDownloadDone)
    windowController.on('download-error', onDownloadError)
    windowController.on('download-cancelled', onDownloadCancelled)
  })

  onUnmounted(() => {
    windowController.removeListener('download-progress', onDownloadProgress)
    windowController.removeListener('download-done', onDownloadDone)
    windowController.removeListener('download-error', onDownloadError)
    windowController.removeListener('download-cancelled', onDownloadCancelled)
  })

  return {
    checkInstalled,
    checkAllInstalled,
    startDownload,
    cancelDownload,
    pauseDownload,
    discardDownload,
    removeResource,
    getState,
  }
}
