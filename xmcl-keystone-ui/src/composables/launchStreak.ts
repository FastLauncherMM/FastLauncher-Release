import { ref } from 'vue'

interface StreakData {
  count: number
  lastDate: string
}

const STORAGE_KEY = 'xmcl-streak'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterday(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10)
}

function load(): StreakData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { count: 0, lastDate: '' }
  } catch {
    return { count: 0, lastDate: '' }
  }
}

function save(data: StreakData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const streak = ref(load().count)

export function refreshStreak() {
  const data = load()
  const t = today()
  const y = yesterday()
  if (data.lastDate === t || data.lastDate === y) {
    streak.value = data.count
  } else {
    streak.value = 0
  }
}

export function incrementStreak() {
  const data = load()
  const t = today()
  if (data.lastDate === t) {
    streak.value = data.count
    return data.count
  }
  if (data.lastDate === yesterday()) {
    data.count++
  } else {
    data.count = 1
  }
  data.lastDate = t
  save(data)
  streak.value = data.count
  return data.count
}
