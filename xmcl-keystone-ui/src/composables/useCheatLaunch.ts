import { ref } from 'vue'
import { useCheatStats } from './cheatStats'
import { useCheatPrefs } from './cheatPrefs'

/**
 * Shared cheat launch flow: the Cheats grid and the News page both launch
 * from here, so the exit/error handling and play-time stats live in one
 * place and the „launching" state is app-wide.
 */

const launchingId = ref<string | null>(null)

const launchMap: Record<string, () => Promise<void>> = {
  wild: () => windowController.launchWild(),
  delta: () => windowController.launchDelta(),
  celestial: () => windowController.launchCelestial(),
  essence: () => windowController.launchEssence(),
  leonware: () => windowController.launchLeonWare(),
  liminarpremium: () => windowController.launchLiminarPremium(),
  systemdlc: () => windowController.launchSystemDLC(),
  rockstar: () => windowController.launchRockstar(),
  deadcode: () => windowController.launchDeadcode(),
  nursultan: () => windowController.launchNursultan(),
}

let bound = false

function bindListeners() {
  if (bound) return
  bound = true
  const { stop: statsStop } = useCheatStats()
  windowController.on('cheat-exited', (cheatId: string) => {
    statsStop()
    if (launchingId.value === cheatId) launchingId.value = null
    windowController.show()
  })
  windowController.on('cheat-error', (data: { id: string; message: string }) => {
    launchingId.value = null
    windowController.show()
    window.alert('Ошибка запуска ' + data.id + ': ' + data.message)
  })
}

export function useCheatLaunch() {
  bindListeners()
  const { start: statsStart } = useCheatStats()
  const { markRecent } = useCheatPrefs('cheat')

  async function launchCheat(id: string) {
    launchingId.value = id
    try {
      const fn = launchMap[id]
      if (fn) {
        await fn()
        markRecent(id)
        windowController.hide()
      }
      statsStart(id)
    } catch (e: any) {
      if (e?.message === 'canceled') {
        launchingId.value = null
        return
      }
      console.error('Failed to launch cheat:', e)
      window.alert('Ошибка запуска: ' + (e?.message || String(e)))
      launchingId.value = null
    }
  }

  function cancelLaunch() {
    const id = launchingId.value
    launchingId.value = null
    if (id) {
      windowController.cancelCheat(id).catch(() => {})
    }
  }

  return { launchingId, launchCheat, cancelLaunch }
}
