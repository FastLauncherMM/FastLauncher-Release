import { ref } from 'vue'
import type { Ref } from 'vue'

export interface RecentEntry {
  id: string
  at: number
}

const MAX_RECENTS = 6

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

interface PrefsBag {
  pins: Ref<string[]>
  recents: Ref<RecentEntry[]>
}

// One shared bag per kind, so every page (Cheats / News / Visuals) sees the
// same pins and recents without re-reading localStorage.
const bags = new Map<string, PrefsBag>()

/**
 * Per-page user preferences for the Cheats / Visuals grids: pinned ids and
 * recently launched ids, persisted in localStorage.
 */
export function useCheatPrefs(kind: 'cheat' | 'visual') {
  const pinKey = `fastlauncher.${kind}Pins`
  const recentKey = `fastlauncher.${kind}Recents`

  let bag = bags.get(kind)
  if (!bag) {
    bag = {
      pins: ref(readJSON<string[]>(pinKey, [])),
      recents: ref(readJSON<RecentEntry[]>(recentKey, [])),
    }
    bags.set(kind, bag)
  }
  const { pins, recents } = bag

  function isPinned(id: string) {
    return pins.value.includes(id)
  }

  function togglePin(id: string) {
    if (isPinned(id)) {
      pins.value = pins.value.filter((p) => p !== id)
    } else {
      pins.value = [id, ...pins.value]
    }
    localStorage.setItem(pinKey, JSON.stringify(pins.value))
  }

  function markRecent(id: string) {
    recents.value = [
      { id, at: Date.now() },
      ...recents.value.filter((r) => r.id !== id),
    ].slice(0, MAX_RECENTS)
    localStorage.setItem(recentKey, JSON.stringify(recents.value))
  }

  function clearRecents() {
    recents.value = []
    localStorage.removeItem(recentKey)
  }

  return { pins, recents, isPinned, togglePin, markRecent, clearRecents }
}
