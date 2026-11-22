import { markRaw } from 'vue'

export interface DownloadHistoryEntry {
  /** File name (basename) of the installed resource. */
  name: string
  /** Market the resource was installed from. */
  market: 'modrinth' | 'curseforge' | 'local'
  /** Unix timestamp (ms) of the install. */
  time: number
}

const STORAGE_KEY = 'xmcl-download-history'
const MAX_ENTRIES = 60

function load(): DownloadHistoryEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (Array.isArray(parsed)) {
      return parsed
        .filter((e) => typeof e?.name === 'string')
        .map((e) => ({ name: e.name, market: e.market || 'local', time: Number(e.time) || Date.now() }))
    }
  } catch {
    /* corrupted storage — start fresh */
  }
  return []
}

const entries = ref<DownloadHistoryEntry[]>(load())

watch(entries, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}, { deep: true })

const basename = (path: string) => path.split(/[\\/]/).pop() || path

export function useDownloadHistory() {
  const add = (name: string, market: DownloadHistoryEntry['market'] = 'local') => {
    const file = basename(name)
    if (!file) return
    entries.value = [
      markRaw({ name: file, market, time: Date.now() }),
      ...entries.value.filter((e) => e.name !== file),
    ].slice(0, MAX_ENTRIES)
  }

  const clear = () => {
    entries.value = []
  }

  return { entries, add, clear }
}
