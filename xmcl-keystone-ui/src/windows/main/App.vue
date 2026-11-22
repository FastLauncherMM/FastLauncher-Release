<template>
  <v-app v-if="!showSetup" class="fastlauncher-shell h-full max-h-screen overflow-hidden" :class="{ 'dark': isDark }">
    <AppBackground />
    <div class="w-full h-full absolute left-0 header-overlay" :style="{
      height: headerHeight + 70 + 'px',
      'background-image': `linear-gradient(${appBarColor} 0%, color-mix(in srgb, ${appBarColor}, transparent) 65%, transparent 100%)`
    }">
    </div>
    <AppSystemBar :back="sidebarStyle === 'notch'" />
    <div
      class="app-layout flex-grow relative flex overflow-auto"
      :class="layoutClasses"
    >
      <AppSideBarClassic v-if="sidebarStyle === 'classic'" />
      <AppSideBarNotch v-else />
      <main class="launcher-content relative flex max-h-full flex-1 flex-col overflow-auto" :class="mainClasses">
        <router-view v-slot="{ Component }">
          <transition name="page-slide" mode="out-in">
            <component :is="Component" class="z-2" />
          </transition>
        </router-view>
      </main>
    </div>
    <AppContextMenu />
    <AppNotifier />
    <AppFlashToasts />
    <AppCommandPalette />
    <AppAgentChat v-if="developerMode" />
    <AppFeedbackDialog />
    <AppDevLogDialog />
    <AppScreenshotsDialog />
    <AppVisualModsDialog />
    <AppCheatModsDialog />
    <AppTaskDialog />
    <AppAddInstanceDialog />
    <AppShareInstanceDialog />
    <AppInstanceDeleteDialog />
    <AppGameExitDialog />
    <AppLaunchBlockedDialog />
    <AppUnauthenticatedWarningDialog />
    <AppImageDialog />
    <AppJoinServerDialog />
    <AppSharedTooltip />
    <AppInstallSkipDialog />
    <AppMigrateWizardDialog />
    <AppMinecraftFriendsDialog />
    <SettingUpdateInfoDialog />
    <UserProfileDialog :value="userProfileDialogShown" @input="userProfileDialogShown = $event" />
    <AppModrinthLoginDialog />
    <InstanceLauncherPage />
    <AppSideBarGroupSettingDialog :default-color="defaultColor" />
  </v-app>
  <v-app v-else class="fastlauncher-shell h-full max-h-screen overflow-hidden" :class="{ 'dark': isDark }">
    <AppSystemBar no-user no-task />
    <div class="app-layout relative flex min-h-0 flex-1 overflow-hidden">
      <Setup @ready="onReady" />
    </div>
    <UserProfileDialog :value="userProfileDialogShown" @input="userProfileDialogShown = $event" />
    <AppFeedbackDialog />
    <AppDevLogDialog />
  </v-app>
</template>

<script lang=ts setup>
import '@/assets/common.css'
import AppImageDialog from '@/components/AppImageDialog.vue'
import AppSharedTooltip from '@/components/AppSharedTooltip.vue'
import { useAuthProfileImportNotification } from '@/composables/authProfileImport'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { useAgentChatHotkey } from '@/composables/agentChat'
import { kAgent, installAgentDevLauncher, useAgent } from '@/composables/agent'
import { useBootSplash } from '@/composables/bootSplash'
import { useCommandPaletteHotkey } from '@/composables/commandPalette'
import { useDefaultErrorHandler } from '@/composables/errorHandler'
import { kInstance } from '@/composables/instance'
import { kLaunchButton, useLaunchButton } from '@/composables/launchButton'
import { kLocalizedContent, useLocalizedContentControl } from '@/composables/localizedContent'
import { useNotifier } from '@/composables/notifier'
import { kCompact } from '@/composables/scrollTop'
import { kSettingsState } from '@/composables/setting'
import { kTheme } from '@/composables/theme'
import { kTutorial } from '@/composables/tutorial'
import { kInFocusMode } from '@/composables/uiLayout'
import { kSidebarSettings, useInjectSidebarSettings, useSidebarSettings } from '@/composables/sidebarSettings'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import AppAddInstanceDialog from '@/views/AppAddInstanceDialog.vue'
import AppBackground from '@/views/AppBackground.vue'
import AppAgentChat from '@/views/AppAgentChat.vue'
import AppCommandPalette from '@/views/AppCommandPalette.vue'
import AppContextMenu from '@/views/AppContextMenu.vue'
import AppFeedbackDialog from '@/views/AppFeedbackDialog.vue'
import AppDevLogDialog from '@/views/AppDevLogDialog.vue'
import AppScreenshotsDialog from '@/views/AppScreenshotsDialog.vue'
import AppVisualModsDialog from '@/views/AppVisualModsDialog.vue'
import AppCheatModsDialog from '@/views/AppCheatModsDialog.vue'
import AppGameExitDialog from '@/views/AppGameExitDialog.vue'
import AppInstallSkipDialog from '@/views/AppInstallSkipDialog.vue'
import AppInstanceDeleteDialog from '@/views/AppInstanceDeleteDialog.vue'
import AppLaunchBlockedDialog from '@/views/AppLaunchBlockedDialog.vue'
import AppUnauthenticatedWarningDialog from '@/views/AppUnauthenticatedWarningDialog.vue'
import AppJoinServerDialog from '@/views/AppJoinServerDialog.vue'
import AppMigrateWizardDialog from '@/views/AppMigrateWizardDialog.vue'
import AppMinecraftFriendsDialog from '@/views/AppMinecraftFriendsDialog.vue'
import UserProfileDialog from '@/components/UserProfileDialog.vue'
import AppModrinthLoginDialog from '@/views/AppModrinthLoginDialog.vue'
import AppNotifier from '@/views/AppNotifier.vue'
import AppFlashToasts from '@/views/AppFlashToasts.vue'
import AppShareInstanceDialog from '@/views/AppShareInstanceDialog.vue'
import AppSideBarClassic from '@/views/AppSideBarClassic.vue'
import AppSideBarNotch from '@/views/AppSideBarNotch.vue'
import AppSystemBar from '@/views/AppSystemBar.vue'
import AppTaskDialog from '@/views/AppTaskDialog.vue'
import InstanceLauncherPage from '@/views/InstanceLauncherPage.vue'
import Setup from '@/views/Setup.vue'
import { useLocalStorage, useMediaQuery, usePreferredColorScheme, usePreferredDark } from '@vueuse/core'
import { kInstanceLauncher, useInstanceLauncher } from '@/composables/instanceLauncher'
import { kMinecraftFriends, useMinecraftFriendsImpl } from '@/composables/minecraftFriends'
import { useUserMenuControl } from '@/composables/userMenu'
import { UserSkinRenderPaused } from '@/composables/userSkin'
import AppSideBarGroupSettingDialog from '@/views/AppSideBarGroupSettingDialog.vue'
import { useInstanceGroupDefaultColor } from '@/composables/instanceGroup'
import SettingUpdateInfoDialog from '@/views/SettingUpdateInfoDialog.vue'
import { kUpdateSettings, useUpdateSettings } from '@/composables/setting'
import { useDialog } from '@/composables/dialog'
import { useAppFlashQueue } from '@/composables/appFlash'
import { devLogEntries } from '@/composables/devLog'

const showSetup = ref(location.search.indexOf('bootstrap') !== -1)
const { state } = injection(kSettingsState)
const developerMode = computed(() => state.value?.developerMode ?? false)


const updateSettings = useUpdateSettings()
provide(kUpdateSettings, updateSettings)
const { show: showUpdateInfoDialog } = useDialog('update-info')
const { show: showDevLog, isShown: devLogIsShown } = useDialog('devlog')
const { push: pushFlash } = useAppFlashQueue()
watch(() => updateSettings.updateStatus.value, (status) => {
  if (status === 'pending' && updateSettings.updateInfo.value?.newUpdate) {
    const versionName = updateSettings.updateInfo.value.name
    // The «Что нового» dialog is showing: don't hijack it, offer the update
    // as a toast instead. The user opens the update card whenever they want.
    if (devLogIsShown.value) {
      const key = 'fastlauncher.updateAvailableToastShown'
      if (localStorage.getItem(key) !== versionName) {
        localStorage.setItem(key, versionName)
        pushFlash({
          kind: 'update-available',
          message: versionName,
          action: {
            label: 'Подробнее',
            handler: () => { showUpdateInfoDialog() },
          },
        })
      }
      return
    }
    showUpdateInfoDialog()
  }
  if (status === 'ready' && updateSettings.updateInfo.value) {
    const versionName = updateSettings.updateInfo.value.name
    const key = 'fastlauncher.updateToastShown'
    if (localStorage.getItem(key) !== versionName) {
      localStorage.setItem(key, versionName)
      pushFlash({
        kind: 'update-ready',
        message: versionName,
        action: {
          label: 'Перезапустить',
          handler: () => { updateSettings.quitAndInstall() },
        },
      })
      if (document.hidden) {
        windowController.notifyOs(
          'Обновление готово',
          `FastLauncher ${versionName} скачан — перезапусти лаунчер, чтобы применить обновление`,
        )
      }
    }
  }
}, { immediate: true })


provide('streamerMode', useLocalStorageCacheBool('streamerMode', false))
provide(kLocalizedContent, useLocalizedContentControl())
// Mirror boot splash settings to localStorage so the pre-mount splash in
// index.html can read them on the next launch.
useBootSplash()
provide(kInstanceLauncher, useInstanceLauncher())
provide(kMinecraftFriends, useMinecraftFriendsImpl())

// Agent must run in App.vue (not Context.ts) because its tool factory
// injects kInstance/kInstanceMods/... which are provided by Context itself,
// and `inject` only resolves on descendants.
const agent = useAgent()
provide(kAgent, agent)
installAgentDevLauncher(agent)

// User profile dialog — moved from AppSystemBarUserMenu to App root
const userProfileDialogShown = ref(false)
const userMenu = useUserMenuControl()
userMenu.on(() => { userProfileDialogShown.value = true })
const route = useRoute()
provide(UserSkinRenderPaused, computed(() => !userProfileDialogShown.value && route.path !== '/me'))

// Bind Ctrl/Cmd+K to toggle the command palette.
useCommandPaletteHotkey()
// Bind Ctrl/Cmd+Shift+A to toggle the agent chat panel.
useAgentChatHotkey(developerMode)

// App-wide keyboard shortcuts: F11 fullscreen, Ctrl/Cmd+1..9 tab switch.
const appRouter = useRouter()
const HOTKEY_ROUTES = ['/', '/modstore', '/cheats', '/store', '/multiplayer', '/me', '/setting']
window.addEventListener('keydown', (e) => {
  if (e.key === 'F11') {
    e.preventDefault()
    windowController.toggleFullscreen()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9' && !e.altKey) {
    const idx = Number(e.key) - 1
    if (idx < HOTKEY_ROUTES.length) {
      e.preventDefault()
      appRouter.push(HOTKEY_ROUTES[idx])
    }
  }
})

const defaultColor = useInstanceGroupDefaultColor()

const modes = useLocalStorage('instanceEnabledDashboard', {} as Record<string, boolean>)
const { path } = injection(kInstance)
const isLessThan490px = useMediaQuery('(max-height: 570px)')
provide(kInFocusMode, computed({
  get() {
    const less = isLessThan490px.value
    const isDashboard = modes.value[basename(path.value)]
    if (isDashboard === undefined) {
      return true // 'focus' is default
    }
    if (less) {
      return false
    }
    return !isDashboard
  },
  set(inFocus) {
    const isDashboard = !inFocus
    modes.value = { ...modes.value, [basename(path.value)]: isDashboard }
  },
}))

provide(kLaunchButton, useLaunchButton())

const sidebarSettings = useSidebarSettings()
provide(kSidebarSettings, sidebarSettings)
const sidebarPosition = computed(() => sidebarSettings.position.value)
const sidebarStyle = computed(() => sidebarSettings.style.value)

const layoutClasses = computed(() => ({
  'flex-row': sidebarPosition.value === 'left' || sidebarPosition.value === 'right',
  'flex-col': sidebarPosition.value === 'top' || sidebarPosition.value === 'bottom',
  'flex-row-reverse': sidebarPosition.value === 'right',
  'flex-col-reverse': sidebarPosition.value === 'bottom',
}))

const mainClasses = computed(() => ({
  'inset-y-0': sidebarPosition.value === 'left' || sidebarPosition.value === 'right',
  'inset-x-0': sidebarPosition.value === 'top' || sidebarPosition.value === 'bottom',
}))

const compact = ref(false)
provide(kCompact, compact)

const headerHeight = ref(0)
provide('headerHeight', headerHeight)

const { appBarColor, dark } = injection(kTheme)

watch(dark, (newVal) => {
  state.value?.themeSet(newVal === 'system' ? newVal : newVal ? 'dark' : 'light')
}, { immediate: true })

const tutor = injection(kTutorial)
// Auto-start the onboarding tutorial on the very first launch (excluding the
// bootstrap flow, which already calls tutor.start() in onReady). Skipping or
// finishing it sets tutorialShown so it won't nag again — the user can always
// re-run it from the system bar / settings.
const autoStartedTutorial = ref(false)
watch(() => state.value?.tutorialShown, (shown) => {
  if (location.search.indexOf('bootstrap') !== -1) return
  if (autoStartedTutorial.value) return
  if (state.value && !shown) {
    autoStartedTutorial.value = true
    setTimeout(() => {
      if (!state.value?.tutorialShown) tutor.start()
    }, 900)
  }
}, { immediate: true })

// On every launch, open the news home page first. The only exception is the
// very first run: the onboarding tutorial lives on the instances page, so the
// user stays there until it has been completed (or skipped). Instances remain
// one click away anytime — "Home" in the sidebar or Ctrl+1.
// The same bootstrap point shows the «Что нового» dialog once after the app
// version changes (fresh installs keep quiet via the tutorialShown guard).
let startupRedirectChecked = false
watch(state, (s) => {
  if (!s || startupRedirectChecked) return
  startupRedirectChecked = true
  const bootstrap = location.search.indexOf('bootstrap') !== -1
  const latestLog = devLogEntries[0]?.version
  const LAST_SEEN_KEY = 'fastlauncher.lastSeenVersion'
  const seenLog = localStorage.getItem(LAST_SEEN_KEY)
  if (latestLog) {
    try { localStorage.setItem(LAST_SEEN_KEY, latestLog) } catch {}
    if (
      !bootstrap
      && s.tutorialShown
      && seenLog !== latestLog
      && updateSettings.updateStatus.value !== 'pending'
    ) {
      setTimeout(() => showDevLog(), 1600)
    }
  }
  if (bootstrap) return
  if (!s.tutorialShown) return
  // Look for a newer launcher build in the background a few seconds after
  // boot. The updater downloads FastLauncher-setup.exe from the GitHub release
  // and runs it — same UX as the cheat downloads.
  setTimeout(() => { void updateSettings.checkUpdate() }, 4000)
  if (appRouter.currentRoute.value.path !== '/') return
  appRouter.replace('/news')
}, { immediate: true })

// Set theme and start tutorial
const onReady = async (data: any) => {
  await nextTick()
  showSetup.value = false
  await nextTick()
  if (state.value) {
    state.value.themeSet(data.theme)
  } else {
    const unwatch = watch(state, (state) => {
      if (state) {
        state.themeSet(data.theme)
      }
      unwatch()
    })
  }
  tutor.start()
}

// color theme sync
const { isDark } = injection(kTheme)

// Notifier
const { notify } = useNotifier()
useDefaultErrorHandler(notify)
useAuthProfileImportNotification(notify)
</script>

<style scoped>
.fastlauncher-shell {
  background: transparent !important;
}

.header-overlay {
  opacity: 0.88;
  filter: saturate(1.15);
  pointer-events: none;
}

.app-layout {
  gap: 10px;
  min-height: 0;
  padding: 10px;
}

.launcher-content {
  isolation: isolate;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.075);
  border-radius: 22px;
  background: transparent;
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.025),
    0 22px 64px -34px rgba(0, 0, 0, 0.5);
}

.clip-head {
  clip-path: inset(0px 30px 30px 0px) !important;
  width: 64px;
  height: auto;
  /*to preserve the aspect ratio of the image*/
}

.v-input__icon--prepend {
  margin-right: 7px;
}

img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

@media (max-width: 900px) {
  .app-layout {
    gap: 6px;
    padding: 6px;
  }

  .launcher-content {
    border-radius: 18px;
  }
}
</style>
