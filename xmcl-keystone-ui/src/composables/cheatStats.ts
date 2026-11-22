import { computed, ref } from 'vue'

export interface CheatStatsEntry {
  totalMs: number
  sessions: number
  daily: Record<string, number>
}

export interface CheatStatsData {
  entries: Record<string, CheatStatsEntry>
  firstPlayedAt?: string
}

interface CheatStatsSession {
  cheatId: string
  startedAt: number
}

const STORAGE_KEY = 'xmcl.cheatStats'
const SESSION_KEY = 'xmcl.cheatStats.session'

function loadData(): CheatStatsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { entries: {} }
  } catch {
    return { entries: {} }
  }
}

function loadSession(): CheatStatsSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const data = ref<CheatStatsData>(loadData())
let activeSession: CheatStatsSession | null = loadSession()

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data.value))
}

function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function addTime(cheatId: string, ms: number) {
  if (ms <= 0) return
  const entry = data.value.entries[cheatId] || { totalMs: 0, sessions: 0, daily: {} }
  entry.totalMs += ms
  entry.sessions += 1
  const day = dayKey(new Date())
  entry.daily[day] = (entry.daily[day] || 0) + ms
  data.value.entries[cheatId] = entry
  if (!data.value.firstPlayedAt) data.value.firstPlayedAt = new Date().toISOString()
  save()
}

// Reconcile a session that was still running when the launcher closed.
// A crash/close leaves a stale open session; attribute only sane-length
// gaps (up to 12h) to avoid inflating stats after a long absence.
function reconcilePendingSession() {
  if (!activeSession) return
  const diff = Date.now() - activeSession.startedAt
  if (diff > 0 && diff < 12 * 60 * 60 * 1000) {
    addTime(activeSession.cheatId, diff)
  }
  activeSession = null
  localStorage.removeItem(SESSION_KEY)
}

export function useCheatStats() {
  const entries = computed(() => data.value.entries)
  const totalPlayedMs = computed(() =>
    Object.values(data.value.entries).reduce((sum, e) => sum + e.totalMs, 0),
  )

  function start(cheatId: string) {
    if (activeSession?.cheatId === cheatId) return
    stop()
    activeSession = { cheatId, startedAt: Date.now() }
    localStorage.setItem(SESSION_KEY, JSON.stringify(activeSession))
  }

  function stop() {
    if (!activeSession) return
    addTime(activeSession.cheatId, Date.now() - activeSession.startedAt)
    activeSession = null
    localStorage.removeItem(SESSION_KEY)
  }

  function reset() {
    stop()
    data.value = { entries: {} }
    localStorage.removeItem(STORAGE_KEY)
  }

  function totalMs(cheatId: string): number {
    return data.value.entries[cheatId]?.totalMs ?? 0
  }

  function dailyMs(days: number): { date: string; ms: number }[] {
    const result: { date: string; ms: number }[] = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const key = dayKey(d)
      let ms = 0
      for (const e of Object.values(data.value.entries)) {
        ms += e.daily[key] || 0
      }
      result.push({ date: key, ms })
    }
    return result
  }

  return { entries, totalPlayedMs, start, stop, reset, totalMs, dailyMs }
}

// Reconcile any stale session immediately when the app boots.
reconcilePendingSession()