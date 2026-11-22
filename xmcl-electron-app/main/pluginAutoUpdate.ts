import { LauncherAppPlugin } from '@xmcl/runtime/app'
import { autoUpdater } from 'electron-updater'
import { kSettings } from '~/settings'

export const pluginAutoUpdate: LauncherAppPlugin = async (app) => {
  // E2E hook: skip the auto-updater entirely when running under Playwright.
  // The updater hits real network endpoints and would otherwise add nondeterminism.
  if (process.env.XMCL_E2E) {
    return
  }
  // The launcher updates itself by downloading FastLauncher-setup.exe straight
  // from the GitHub release and running it (see main/app-update.ts). The old
  // electron-updater must never download or install anything on its own — its
  // silent installs on quit are exactly what we want to avoid.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  const state = await app.registry.get(kSettings)
  state.subscribe('allowPrereleaseSet', (value) => {
    autoUpdater.allowPrerelease = value
  })
}
