import { useService } from '@/composables'
import { injection } from '@/util/inject'
import { BaseServiceKey, Environment, ReleaseInfo, Settings } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useLocalStorageCacheBool } from './cache'
import { kEnvironment } from './environment'
import { useState } from './syncableState'

export const kUpdateSettings: InjectionKey<ReturnType<typeof useUpdateSettings>> = Symbol('UpdateSettings')

/**
 * Launcher self-update state, shared by the whole window.
 *
 * The updater works like the cheat downloads: FastLauncher-setup.exe is pulled
 * straight from the GitHub release (the only thing that changes between
 * versions is the release tag) and then launched as a normal installer.
 */
const _updateStatus = ref<'none' | 'pending' | 'ready'>('none')
const _updateInfo = ref<ReleaseInfo | null>(null)
const _updateError = ref('')
const _updateProgress = ref<{ percent: number; bytes: number; total: number; rateBytes: number } | null>(null)
let _updateEventsBound = false

/** Turn the raw IPC/network error into a short human message. */
function updateErrorMessage(error: any): string {
  const raw = String(error?.message ?? error ?? '')
  if (/HTTP 404/.test(raw)) return 'Релиз не найден на GitHub'
  if (/HTTP 403|HTTP 429/.test(raw)) return 'GitHub временно ограничил запросы — попробуй позже'
  if (/HTTP 5\d\d/.test(raw)) return 'GitHub недоступен — попробуй позже'
  if (/ERR_|ENOTFOUND|ECONN|net::/i.test(raw)) return 'Нет связи с GitHub — проверь интернет'
  if (/not found in/i.test(raw)) return 'В релизе нет файла FastLauncher-setup.exe'
  if (/Загрузка уже идёт/.test(raw)) return 'Загрузка уже идёт'
  const tail = raw.split(': ').pop() ?? raw
  return tail.length > 160 ? tail.slice(0, 160) + '…' : tail
}

function bindUpdateEvents() {
  if (_updateEventsBound) return
  _updateEventsBound = true
  windowController.on('app-update-progress', (event) => {
    _updateProgress.value = {
      percent: event.percent,
      bytes: event.bytes,
      total: event.total,
      rateBytes: event.rateBytes ?? 0,
    }
    _updateError.value = ''
  })
  windowController.on('app-update-done', () => {
    _updateProgress.value = null
    _updateError.value = ''
    if (_updateInfo.value) _updateStatus.value = 'ready'
  })
  windowController.on('app-update-error', (event) => {
    _updateProgress.value = null
    _updateError.value = event.message || ''
    if (_updateInfo.value) _updateStatus.value = 'pending'
  })
  windowController.on('app-update-cancelled', () => {
    _updateProgress.value = null
    if (_updateInfo.value) _updateStatus.value = 'pending'
  })
}

export function useUpdateSettings() {
  bindUpdateEvents()
  const env: Ref<Environment | undefined> = injection(kEnvironment)
  const version = computed(() => env.value?.version ?? '0.0.0')
  const installing = ref(false)
  const downloadingUpdate = ref(false)
  const checkingUpdate = ref(false)

  async function install() {
    installing.value = true
    try {
      await windowController.installAppUpdate()
    } catch (e: any) {
      _updateError.value = updateErrorMessage(e)
      installing.value = false
    }
  }

  async function download() {
    if (downloadingUpdate.value) return
    downloadingUpdate.value = true
    _updateError.value = ''
    try {
      await windowController.downloadAppUpdate()
    } catch (e: any) {
      _updateError.value = updateErrorMessage(e)
    } finally {
      downloadingUpdate.value = false
    }
  }

  async function cancelDownload() {
    try {
      await windowController.cancelAppUpdate()
    } catch {
      // ignore
    }
  }

  async function check() {
    if (checkingUpdate.value) return
    checkingUpdate.value = true
    try {
      const res = await windowController.checkAppUpdate()
      if (res?.available) {
        _updateInfo.value = {
          name: res.tag.startsWith('v') ? res.tag : 'v' + res.tag,
          body: res.body,
          date: res.date,
          files: [],
          newUpdate: true,
          operation: 'autoupdater',
        }
        const cached = await windowController.appUpdateCached(res.version)
        _updateProgress.value = null
        _updateStatus.value = cached ? 'ready' : 'pending'
      } else {
        _updateInfo.value = null
        _updateProgress.value = null
        _updateStatus.value = 'none'
      }
      _updateError.value = ''
    } catch (e: any) {
      _updateError.value = updateErrorMessage(e)
      if (!_updateInfo.value) _updateStatus.value = 'none'
    } finally {
      checkingUpdate.value = false
    }
  }

  return {
    version,
    quitAndInstall: install,
    downloadUpdate: download,
    cancelDownload,
    checkUpdate: check,
    installing,
    updateStatus: computed(() => _updateStatus.value),
    checkingUpdate,
    downloadingUpdate,
    updateInfo: computed(() => _updateInfo.value),
    updateProgress: computed(() => _updateProgress.value),
    updateError: computed(() => _updateError.value),
  }
}
export const kSettingsState: InjectionKey<ReturnType<typeof useSettingsState>> = Symbol('Settings')

export function useSettingsState() {
  const { getSettings } = useService(BaseServiceKey)
  return useState(getSettings, Settings)
}

export function useGlobalSettings({ state } = injection(kSettingsState)) {
  const globalAssignMemory = computed(() => state.value?.globalAssignMemory ?? false)
  const globalMinMemory = computed(() => state.value?.globalMinMemory ?? 0)
  const globalMaxMemory = computed(() => state.value?.globalMaxMemory ?? 0)
  const globalVmOptions = computed(() => state.value?.globalVmOptions ?? [])
  const globalMcOptions = computed(() => state.value?.globalMcOptions ?? [])
  const globalFastLaunch = computed(() => state.value?.globalFastLaunch ?? false)
  const globalHideLauncher = computed(() => state.value?.globalHideLauncher ?? false)
  const globalShowLog = computed(() => state.value?.globalShowLog ?? false)
  const globalOptimization = computed(() => state.value?.globalOptimization ?? false)
  const globalDisableAuthlibInjector = computed(() => state.value?.globalDisableAuthlibInjector ?? true)
  const globalDisableElyByAuthlib = computed(() => state.value?.globalDisableElyByAuthlib ?? false)
  const globalPrependCommand = computed(() => state.value?.globalPrependCommand ?? '')
  const globalPreExecuteCommand = computed(() => state.value?.globalPreExecuteCommand ?? '')
  const globalEnv = computed(() => state.value?.globalEnv ?? {})
  const globalResolution = computed(() => state.value?.globalResolution)
  const setGlobalSettings = (setting: {
    globalMinMemory: number
    globalMaxMemory: number
    globalAssignMemory: boolean | 'auto'
    globalVmOptions: string[]
    globalMcOptions: string[]
    globalFastLaunch: boolean
    globalHideLauncher: boolean
    globalShowLog: boolean
    globalOptimization: boolean
    globalDisableAuthlibInjector: boolean
    globalDisableElyByAuthlib: boolean
    globalPrependCommand: string
    globalPreExecuteCommand: string
    globalEnv: Record<string, string>
    globalResolution: { width?: number; height?: number; fullscreen?: boolean }
  }) => {
    state.value?.globalInstanceSetting(setting)
  }

  return {
    globalAssignMemory,
    globalMinMemory,
    globalMaxMemory,
    globalVmOptions,
    globalMcOptions,
    globalFastLaunch,
    globalHideLauncher,
    globalShowLog,
    globalOptimization,
    globalDisableAuthlibInjector,
    globalDisableElyByAuthlib,
    globalPrependCommand,
    globalPreExecuteCommand,
    globalEnv,
    globalResolution,
    setGlobalSettings,
  }
}
export function useGameDirectory() {
  const { getGameDataDirectory, migrate, openDirectory } = useService(BaseServiceKey)
  const root = ref('')
  onMounted(() => {
    getGameDataDirectory().then((r) => {
      root.value = r
    })
  })
  const setGameDirectory = async (value: string) => {
    root.value = value
    await migrate({ destination: value })
  }

  function showGameDirectory() {
    if (root.value) {
      openDirectory(root.value)
    }
  }
  return {
    root,
    setGameDirectory,
    showGameDirectory,
  }
}

export function useSettings() {
  const streamerMode = inject('streamerMode', useLocalStorageCacheBool('streamerMode', false))
  const { state, error, isValidating } = injection(kSettingsState)

  const getProxy = () => {
    const proxy = state.value?.httpProxy || ''
    try {
      const url = new URL(proxy)
      return {
        host: url.hostname,
        port: url.port,
      }
    } catch (e) {
      return {
        host: '',
        port: '',
      }
    }
  }

  const locales = computed(() => state.value?.locales || [])
  const selectedLocale = computed({
    get: () => locales.value.find(l => l.locale === state.value?.locale)?.locale || 'en',
    set: v => state.value?.localeSet(v),
  })
  const enableDedicatedGPUOptimization = computed({
    get: () => state.value?.enableDedicatedGPUOptimization ?? false,
    set: v => state.value?.enableDedicatedGPUOptimizationSet(v),
  })
  const apiSetsPreference = computed({
    get: () => state.value?.apiSetsPreference ?? '',
    set: v => state.value?.apiSetsPreferenceSet(v),
  })
  const replaceNative = computed({
    get: () => state.value?.replaceNatives ?? 'legacy-only' as string | false,
    set: v => state.value?.replaceNativesSet(v as any),
  })
  const maxSockets = ref(state.value?.maxSockets)
  const maxAPISockets = ref(state.value?.maxAPISockets)
  const proxy = ref(getProxy())
  const httpProxyEnabled = computed({
    get: () => state.value?.httpProxyEnabled ?? false,
    set: v => state.value?.httpProxyEnabledSet(v),
  })
  const developerMode = computed({
    get: () => state.value?.developerMode ?? false,
    set: v => state.value?.developerModeSet(v),
  })
  const disableTelemetry = computed({
    get: () => state.value?.disableTelemetry ?? false,
    set: v => state.value?.disableTelemetrySet(v),
  })
  const enableDiscord = computed({
    get: () => state.value?.discordPresence ?? false,
    set: (v) => state.value?.discordPresenceSet(v),
  })
  const apiSets = computed(() => state.value?.apiSets || [])

  onMounted(() => {
    const p = getProxy()
    proxy.value.host = p.host
    proxy.value.port = p.port
  })

  watch(computed(() => state.value?.httpProxy), () => {
    const p = getProxy()
    proxy.value.host = p.host
    proxy.value.port = p.port
  })

  onUnmounted(() => {
    const p = proxy.value
    const newValue =
      !p.host && !p.port
        ? ''
        : `http://${p.host}:${p.port}`
    if (newValue !== state.value?.httpProxy) {
      state.value?.httpProxySet(newValue)
    }
    if (state.value?.maxSockets !== maxSockets.value) {
      state.value?.maxSocketsSet(Number(maxSockets.value))
    }
    if (state.value?.maxAPISockets !== maxAPISockets.value) {
      state.value?.maxAPISocketsSet(Number(maxAPISockets.value))
    }
  })

  return {
    enableDedicatedGPUOptimization,
    streamerMode,
    developerMode,
    httpProxyEnabled,
    enableDiscord,
    maxSockets,
    maxAPISockets,
    locales,
    proxy,
    replaceNative,
    selectedLocale,
    apiSetsPreference,
    apiSets,
    disableTelemetry,
    error,
    isValidating,
  }
}
