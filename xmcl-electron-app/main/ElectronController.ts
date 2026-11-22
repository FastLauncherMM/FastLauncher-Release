import { HAS_DEV_SERVER, HOST, IS_DEV, WindowsBuild } from '@/constant'
import browsePreload from '@preload/browse'
import indexPreload from '@preload/index'
import migrationPreload from '@preload/migration'
import monitorPreload from '@preload/monitor'
import multiplayerPreload from '@preload/multiplayer'
import browserWinUrl from '@renderer/browser.html'
import loggerWinUrl from '@renderer/logger.html'
import migrateWinUrl from '@renderer/migration.html'
import { InstalledAppManifest, JavaRecord, LaunchOptions, OPTIMIZATION_VM_OPTIONS, FAST_STARTUP_VM_OPTIONS, Settings, findMatchedVersion } from '@xmcl/runtime-api'
import { Client, LauncherAppController, BaseService, kGameDataPath } from '@xmcl/runtime/app'
import { Logger } from '@xmcl/runtime/infra'
import { kSettings } from '@xmcl/runtime/settings'
import { LaunchService, VersionService } from '@xmcl/runtime/launch'
import { UserService } from '@xmcl/runtime/user'
import { PresenceService } from '@xmcl/runtime/presence'
import { JavaService } from '@xmcl/runtime/java'
import { InstallService, VersionMetadataService } from '@xmcl/runtime/install'
import { BrowserWindow, Event, HandlerDetails, Session, Tray, WebContents, app as electronApp, dialog, ipcMain, nativeTheme, protocol, shell } from 'electron'
import { spawn } from 'child_process'
import { join, dirname, basename, isAbsolute, relative, resolve } from 'path'
import { copyFile, mkdir, writeFile, readdir, cp, readFile, rm, stat } from 'fs/promises'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { registerDownloadHandlers } from './download-handler'
import { registerAppUpdateHandlers } from './app-update'
import { flashOrNotify, resourceLabel } from './notifications'
import ElectronLauncherApp from './ElectronLauncherApp'
import { plugins } from './controllers'
import defaultApp from './defaultApp'
import { definedLocales } from './definedLocales'
import { createI18n } from './utils/i18n'
import { darkIcon } from './utils/icons'
import { getLoginSuccessHTML } from './utils/login'
import { createWindowTracker } from './utils/windowSizeTracker'

const LOCKED_VISUAL_IDS = new Set(['fastvisual'])

function contextualError(message: string, cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return new Error(`${message}: ${detail}`, { cause })
}

function assertVisualModsAllowed(visualId: string) {
  if (LOCKED_VISUAL_IDS.has(String(visualId).toLowerCase())) {
    throw new Error('FastVisual является визуалом лаунчера и не поддерживает сторонние моды.')
  }
}

export class ElectronController implements LauncherAppController {
  protected windowsVersion?: { major: number; minor: number; build: number }

  protected mainWin: BrowserWindow | undefined = undefined

  protected loggerWin: BrowserWindow | undefined = undefined

  protected browserRef: BrowserWindow | undefined = undefined

  protected multiplayerRef: BrowserWindow | undefined = undefined

  protected migrationRef: BrowserWindow | undefined = undefined

  protected i18n = createI18n(definedLocales, 'en')

  readonly logger: Logger

  protected tray: Tray | undefined

  /**
   * During the app is parking, even if the all windows are closed, the app will keep open.
   */
  protected parking = false

  /** Wall-clock start of each running cheat/visual session (id → timestamp). */
  private cheatStartTimes = new Map<string, number>()

  protected activatedManifest: InstalledAppManifest | undefined

  protected sharedSession: Session | undefined

  private settings: Settings | undefined

  private migrated: { from: string; to: string } | undefined

  maximized: boolean | undefined

  private windowOpenHandler: Parameters<WebContents['setWindowOpenHandler']>[0] = (detail: HandlerDetails) => {
    const url = new URL(detail.url)
    const features = detail.features.split(',')
    const width = parseInt(features.find(f => f.startsWith('width'))?.split('=')[1] ?? '1024', 10)
    const height = parseInt(features.find(f => f.startsWith('height'))?.split('=')[1] ?? '768', 10)
    const minWidth = parseInt(features.find(f => f.startsWith('min-width'))?.split('=')[1] ?? '600', 10)
    const minHeight = parseInt(features.find(f => f.startsWith('min-height'))?.split('=')[1] ?? '600', 10)
    const man = this.activatedManifest!
    // Determine if translucency should be enabled (from user settings or app manifest)
    const enableTranslucency = this.settings?.windowTranslucent || man.vibrancy
    if (url.host === 'app' || detail.frameName === 'app' || (url.host.startsWith('localhost') && HAS_DEV_SERVER)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          vibrancy: enableTranslucency && this.app.platform.os === 'osx' ? 'sidebar' : undefined, // macOS vibrancy
          icon: nativeTheme.shouldUseDarkColors ? man.iconSets.darkIcon : man.iconSets.icon,
          titleBarStyle: this.getTitlebarStyle(),
          trafficLightPosition: this.app.platform.os === 'osx' ? { x: 14, y: 10 } : undefined,
          minWidth,
          minHeight,
          width,
          height,
          show: false,
          frame: this.getFrameOption(),

          webPreferences: {
            preload: indexPreload,
            devTools: IS_DEV,
          },
        },
      }
    }

    shell.openExternal(detail.url)
    return { action: 'deny' }
  }

  private onWebContentCreateWindow = (window: BrowserWindow) => {
    window.webContents.setWindowOpenHandler(this.windowOpenHandler)
    window.webContents.on('will-navigate', this.onWebContentWillNavigate)
    window.webContents.on('did-create-window', this.onWebContentCreateWindow)
    window.once('ready-to-show', () => {
      window.show()
    })
  }

  private onWebContentWillNavigate = (event: Event, url: string) => {
    if (!url.startsWith(HAS_DEV_SERVER ? 'http://localhost' : ('http://' + HOST))) {
      event.preventDefault()
      shell.openExternal(url)
    }
  }

  constructor(protected app: ElectronLauncherApp) {
    plugins.forEach(p => p.call(this))
    registerDownloadHandlers()
    registerAppUpdateHandlers()

    if (app.platform.os === 'windows') {
      queueMicrotask(() => {
        this.windowsVersion = app.windowsUtils?.getWindowsVersion()
      })
    }

    this.handle('open-multiplayer-window', () => {
      this.openMultiplayerWindow()
    })

    this.handle('launch-wild', async () => {
      try {
        await this.app.waitEngineReady()
        this.logger.log('Wild: engine ready')

        const registry = this.app.registry

        const [launchService, userService, javaService, versionService, installService, settings] = await Promise.all([
          registry.getOrCreate(LaunchService),
          registry.getOrCreate(UserService),
          registry.getOrCreate(JavaService),
          registry.getOrCreate(VersionService),
          registry.getOrCreate(InstallService),
          registry.get(kSettings),
        ])

        const userState = await userService.getUserState()
        const users = Object.values(userState.users)
        if (users.length === 0) throw new Error('No user logged in')

        const refreshedUser = await userService.refreshUser(users[0].id)

        const localVersions = await versionService.getLocalVersions()
        let versionHeader = findMatchedVersion(localVersions.local, '', {
          minecraft: '1.21.8',
          fabricLoader: '0.19.3',
        })
        if (!versionHeader) {
          this.logger.log('Wild: MC 1.21.8 + Fabric not found, installing\u2026')
          const manifestUrl = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'
          const res = await fetch(manifestUrl)
          const manifest = await res.json()
          const mcMeta = manifest.versions.find((v: any) => v.id === '1.21.8')
          if (!mcMeta) throw new Error('MC 1.21.8 not found in version manifest')
          await installService.installMinecraft({ meta: mcMeta })
          await versionService.refreshVersions()
          const fabricVersionId = await installService.installFabric({ minecraft: '1.21.8', loader: '0.19.3' })
          await installService.installDependencies({ version: fabricVersionId, side: 'client' })
          await versionService.refreshVersions()
          const updatedVersions = await versionService.getLocalVersions()
          versionHeader = findMatchedVersion(updatedVersions.local, '', {
            minecraft: '1.21.8',
            fabricLoader: '0.19.3',
          })
        }
        if (!versionHeader) {
          throw new Error('Wild: failed to install MC 1.21.8 + Fabric. Check internet connection.')
        }

        await installService.installDependencies({ version: versionHeader.id, side: 'client' })

        let java = await this.pickCheatJava(javaService, 21)
        if (!java) {
          const javaState = await javaService.getJavaState()
          java = javaState.all.find(j => j.majorVersion >= 21 && j.valid)
        }
        if (!java) throw new Error('No suitable Java 21+ found. Wild requires Java 21.')

        const resourceDir = join(electronApp.getPath('userData'), 'resources', 'wild')
        if (!existsSync(resourceDir)) throw new Error('Wild is not installed. Please download it first.')
        const gameDir = join(electronApp.getPath('userData'), 'cheats', 'wild')
        this.logger.log(`Wild: resourceDir=${resourceDir}, gameDir=${gameDir}`)

        // Refresh launcher-owned mods while preserving the player's Minecraft
        // configs, resource packs and shader packs in the dedicated game dir.
        await this.syncResourceFolders(resourceDir, gameDir, ['mods', 'config', 'resourcepacks', 'shaderpacks'])

        // Apply player-added custom mods on top of bundled ones
        await this.applyCustomMods('cheat_mods', 'wild', gameDir)

        const launchOptions: LaunchOptions = {
          version: versionHeader.id,
          gameDirectory: gameDir,
          side: 'client',
          user: refreshedUser,
          java: java.path,
          hideLauncher: true,
          showLog: false,
          minMemory: 256,
          maxMemory: 4096,
          vmOptions: this.getOptimizedVmOptions(settings),
          mcOptions: settings.globalMcOptions ?? [],
          env: {},
          operationId: `wild-${Date.now().toString(36)}`,
        }

        this.logger.log('Wild: calling launchService.launch()')
        const pid = await launchService.launch(launchOptions)
        this.logger.log(`Wild: got pid ${pid}`)
        if (!pid) throw new Error('LaunchService returned no pid')

        this.beginCheatSession('wild')

        this.parking = true
        if (this.mainWin && !this.mainWin.isDestroyed() && this.mainWin.isVisible()) {
          this.mainWin.hide()
        }

        const presenceService = await registry.getOrCreate(PresenceService).catch(() => null)
        presenceService?.setActivity('В игре', { name: 'Wild' })

        const onExit = (status: { pid: number }) => {
          if (status.pid === pid) {
            presenceService?.clearActivity()
            launchService.removeListener('minecraft-exit', onExit)
            this.parking = false
            if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.isVisible()) {
              this.mainWin.show()
            }
            this.notifyCheatExit('wild')
          }
        }
        launchService.on('minecraft-exit', onExit)
      } catch (e) {
        this.logger.error(contextualError('Wild launch failed', e))
        this.broadcast('cheat-error', { id: 'wild', message: (e as Error).message })
        if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.isVisible()) {
          this.mainWin.show()
        }
      }
    })

    this.handle('cancel-cheat', () => {
      // Cancel is handled by the frontend resetting launchingId
    })

    this.handle('launch-celestial', async () => {
      try {
        this.logger.log('Celestial: starting...')

        const resourceDir = join(electronApp.getPath('userData'), 'resources', 'celestial')
        if (!existsSync(resourceDir)) throw new Error('Celestial is not installed. Please download it first.')

        const scriptPath = join(resourceDir, 'Celestial', 'run-portable.ps1')
        if (!existsSync(scriptPath)) {
          throw new Error(`Celestial launcher script not found: ${scriptPath}`)
        }

        this.logger.log(`Celestial: ps=${scriptPath}`)

        const launchDir = join(resourceDir, 'Celestial')

        // Create a temp VBS wrapper that runs PowerShell fully hidden
        const vbsContent = `Set objShell = CreateObject("WScript.Shell")
objShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""${scriptPath}""", 0, False`
        const vbsPath = join(launchDir, '_launch_hidden.vbs')
        await writeFile(vbsPath, vbsContent)

        const x = spawn('wscript.exe', [vbsPath], {
          cwd: launchDir,
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        } as any)
        x.unref()

        this.parking = true
        if (this.mainWin && !this.mainWin.isDestroyed() && this.mainWin.isVisible()) {
          this.mainWin.hide()
        }

        this.logger.log('Celestial: launched')
        this.broadcast('cheat-exited', 'celestial')
        if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.isVisible()) {
          this.mainWin.show()
        }
      } catch (e) {
        this.logger.error(contextualError('Celestial launch failed', e))
        this.broadcast('cheat-error', { id: 'celestial', message: (e as Error).message })
        if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.isVisible()) {
          this.mainWin.show()
        }
      }
    })

    this.handle('launch-deadcode', async () => {
      try {
        this.logger.log('DeadCode: starting...')

        const resourceDir = join(electronApp.getPath('userData'), 'resources', 'deadcode')
        if (!existsSync(resourceDir)) throw new Error('DeadCode is not installed. Please download it first.')

        const batPath = join(resourceDir, 'DeadCodeSixSeven', 'StartGeyVM.bat')
        if (!existsSync(batPath)) {
          throw new Error(`DeadCode launcher script not found: ${batPath}`)
        }

        this.logger.log(`DeadCode: bat=${batPath}`)

        const launchDir = join(resourceDir, 'DeadCodeSixSeven')

        // Create a temp VBS wrapper that runs the .bat fully hidden
        const vbsContent = `Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "${launchDir}"
objShell.Run "cmd /c StartGeyVM.bat", 0, False`
        const vbsPath = join(launchDir, '_launch_hidden.vbs')
        await writeFile(vbsPath, vbsContent)

        const x = spawn('wscript.exe', [vbsPath], {
          cwd: launchDir,
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        } as any)
        x.unref()

        this.parking = true
        if (this.mainWin && !this.mainWin.isDestroyed() && this.mainWin.isVisible()) {
          this.mainWin.hide()
        }

        this.logger.log('DeadCode: launched')
        this.broadcast('cheat-exited', 'deadcode')
        if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.isVisible()) {
          this.mainWin.show()
        }
      } catch (e) {
        this.logger.error(contextualError('DeadCode launch failed', e))
        this.broadcast('cheat-error', { id: 'deadcode', message: (e as Error).message })
        if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.isVisible()) {
          this.mainWin.show()
        }
      }
    })

    this.handle('launch-nursultan', async () => {
      try {
        this.logger.log('Nursultan: starting...')

        const resourceDir = join(electronApp.getPath('userData'), 'resources', 'nursultan')
        if (!existsSync(resourceDir)) throw new Error('Nursultan is not installed. Please download it first.')

        // The zip may unpack into its own top-level folder (`NursultanClient-fixed`)
        // or straight into the resource root; find `start.bat` in either layout.
        let launchDir = join(resourceDir, 'NursultanClient-fixed')
        let batPath = join(launchDir, 'start.bat')
        if (!existsSync(batPath)) {
          if (existsSync(join(resourceDir, 'start.bat'))) {
            launchDir = resourceDir
            batPath = join(resourceDir, 'start.bat')
          } else {
            const entries = await readdir(resourceDir).catch(() => [] as string[])
            for (const entry of entries) {
              const candidate = join(resourceDir, entry, 'start.bat')
              if (existsSync(candidate)) {
                launchDir = join(resourceDir, entry)
                batPath = candidate
                break
              }
            }
          }
        }
        if (!existsSync(batPath)) {
          throw new Error(`Nursultan launcher script not found in: ${resourceDir}`)
        }

        this.logger.log(`Nursultan: bat=${batPath}`)

        // Create a temp VBS wrapper that runs the .bat fully hidden
        const vbsContent = `Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "${launchDir}"
objShell.Run "cmd /c start.bat", 0, False`
        const vbsPath = join(launchDir, '_launch_hidden.vbs')
        await writeFile(vbsPath, vbsContent)

        const x = spawn('wscript.exe', [vbsPath], {
          cwd: launchDir,
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        } as any)
        x.unref()

        this.parking = true
        if (this.mainWin && !this.mainWin.isDestroyed() && this.mainWin.isVisible()) {
          this.mainWin.hide()
        }

        this.logger.log('Nursultan: launched')
        this.broadcast('cheat-exited', 'nursultan')
        if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.isVisible()) {
          this.mainWin.show()
        }
      } catch (e) {
        this.logger.error(contextualError('Nursultan launch failed', e))
        this.broadcast('cheat-error', { id: 'nursultan', message: (e as Error).message })
        if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.isVisible()) {
          this.mainWin.show()
        }
      }
    })

    this.handle('launch-delta', async () => {
      try {
        await this.app.waitEngineReady()
        this.logger.log('Delta: engine ready')

        const registry = this.app.registry

        const [launchService, userService, javaService, versionService, installService, settings] = await Promise.all([
          registry.getOrCreate(LaunchService),
          registry.getOrCreate(UserService),
          registry.getOrCreate(JavaService),
          registry.getOrCreate(VersionService),
          registry.getOrCreate(InstallService),
          registry.get(kSettings),
        ])

        const userState = await userService.getUserState()
        const users = Object.values(userState.users)
        if (users.length === 0) throw new Error('No user logged in')

        const refreshedUser = await userService.refreshUser(users[0].id)

        const localVersions = await versionService.getLocalVersions()
        let versionHeader = findMatchedVersion(localVersions.local, '', {
          minecraft: '1.21.4',
          fabricLoader: '0.19.3',
        })
        if (!versionHeader) {
          this.logger.log('Delta: MC 1.21.4 + Fabric not found, installing\u2026')
          const manifestUrl = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'
          const res = await fetch(manifestUrl)
          const manifest = await res.json()
          const mcMeta = manifest.versions.find((v: any) => v.id === '1.21.4')
          if (!mcMeta) throw new Error('MC 1.21.4 not found in version manifest')
          await installService.installMinecraft({ meta: mcMeta })
          await versionService.refreshVersions()
          const fabricVersionId = await installService.installFabric({ minecraft: '1.21.4', loader: '0.19.3' })
          await installService.installDependencies({ version: fabricVersionId, side: 'client' })
          await versionService.refreshVersions()
          const updatedVersions = await versionService.getLocalVersions()
          versionHeader = findMatchedVersion(updatedVersions.local, '', {
            minecraft: '1.21.4',
            fabricLoader: '0.19.3',
          })
        }
        if (!versionHeader) {
          throw new Error('Delta: failed to install MC 1.21.4 + Fabric. Check internet connection.')
        }

        await installService.installDependencies({ version: versionHeader.id, side: 'client' })

        let java = await this.pickCheatJava(javaService, 21)
        if (!java) {
          const javaState = await javaService.getJavaState()
          java = javaState.all.find(j => j.majorVersion >= 21 && j.valid)
        }
        if (!java) throw new Error('No suitable Java 21+ found. Delta requires Java 21.')

        const resourceDir = join(electronApp.getPath('userData'), 'resources', 'delta')
        if (!existsSync(resourceDir)) throw new Error('Delta is not installed. Please download it first.')
        const gameDir = join(electronApp.getPath('userData'), 'cheats', 'delta')
        this.logger.log(`Delta: resourceDir=${resourceDir}, gameDir=${gameDir}`)

        // Refresh launcher-owned mods without wiping player settings, packs or
        // shaders. Those folders are merged non-destructively by the helper.
        await this.syncResourceFolders(resourceDir, gameDir, ['mods', 'config', 'resourcepacks', 'shaderpacks'])

        // Apply player-added custom mods on top of bundled ones
        await this.applyCustomMods('cheat_mods', 'delta', gameDir)

        const launchOptions: LaunchOptions = {
          version: versionHeader.id,
          gameDirectory: gameDir,
          side: 'client',
          user: refreshedUser,
          java: java.path,
          hideLauncher: true,
          showLog: false,
          minMemory: 256,
          maxMemory: 4096,
          vmOptions: this.getOptimizedVmOptions(settings),
          mcOptions: settings.globalMcOptions ?? [],
          env: {},
          operationId: `delta-${Date.now().toString(36)}`,
        }

        this.logger.log('Delta: calling launchService.launch()')
        const pid = await launchService.launch(launchOptions)
        this.logger.log(`Delta: got pid ${pid}`)
        if (!pid) throw new Error('LaunchService returned no pid')

        this.beginCheatSession('delta')

        this.parking = true
        if (this.mainWin && !this.mainWin.isDestroyed() && this.mainWin.isVisible()) {
          this.mainWin.hide()
        }

        const presenceService = await registry.getOrCreate(PresenceService).catch(() => null)
        presenceService?.setActivity('В игре', { name: 'Delta' })

        const onExit = (status: { pid: number }) => {
          if (status.pid === pid) {
            presenceService?.clearActivity()
            launchService.removeListener('minecraft-exit', onExit)
            this.parking = false
            if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.isVisible()) {
              this.mainWin.show()
            }
            this.notifyCheatExit('delta')
          }
        }
        launchService.on('minecraft-exit', onExit)
      } catch (e) {
        this.logger.error(contextualError('Delta launch failed', e))
        this.broadcast('cheat-error', { id: 'delta', message: (e as Error).message })
        if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.isVisible()) {
          this.mainWin.show()
        }
      }
    })

    this.handle('launch-pulsevisual', async () => {
      await this.launchVisualClient('pulsevisual', 'PulseVisuals', '1.21.11', '0.19.3', 21)
    })

    this.handle('launch-reallyvisual', async () => {
      await this.launchVisualClient('reallyvisual', 'ReallyVisuals', '1.16.5', '0.16.14', 8)
    })

    this.handle('launch-cabbitvisual', async () => {
      await this.launchVisualClient('cabbitvisual', 'Cabbit Visual', '1.21.4', '0.19.3', 21)
    })

    this.handle('launch-essence', async () => {
      await this.launchDownloadableCheat('essence', 'Essence', '1.21.4', '0.19.3', 21)
    })

    this.handle('launch-leonware', async () => {
      await this.launchDownloadableCheat('leonware', 'LeonWare', '1.21.1', '0.19.3', 21)
    })

    this.handle('launch-liminarpremium', async () => {
      await this.launchDownloadableCheat('liminarpremium', 'Liminar Premium', '1.21.4', '0.19.3', 21)
    })

    this.handle('launch-systemdlc', async () => {
      await this.launchDownloadableCheat('systemdlc', 'SystemDLC', '1.21.4', '0.19.3', 21)
    })

    this.handle('launch-rockstar', async () => {
      await this.launchDownloadableCheat('rockstar', 'Rockstar', '1.21.4', '0.19.3', 21)
    })

    this.handle('launch-fevervisual', async () => {
      await this.launchVisualClient('fevervisual', 'FeverVisuals', '1.21.1', '0.19.3', 21)
    })

    this.handle('launch-fastvisual', async () => {
      await this.launchVisualClient('fastvisual', 'FastVisual', '1.21.4', '0.20.1', 21, {
        allowCustomMods: false,
        resolveResourceRoot: true,
      })
    })

    this.handle('media:resolve-dir', (_e, kind: string, id: string) => {
      return this.#resolveMediaBaseDir(kind, id)
    })

    this.handle('media:list-screenshots', async (_e, dir: string) => {
      return this.#listImages(dir, 'screenshots')
    })

    this.handle('open-external', (_e, url: string) => {
      if (typeof url === 'string' && url.startsWith('https://')) {
        shell.openExternal(url)
      }
    })

    this.handle('media:open-path', async (_e, p: string) => {
      if (!p) return
      try {
        // Screenshots folder may not exist until the game creates it.
        if (!existsSync(p) && p.endsWith('screenshots')) {
          await mkdir(p, { recursive: true })
        }
        const err = await shell.openPath(p)
        if (err) this.logger.warn(`Failed to open ${p}: ${err}`)
      } catch (e) {
        this.logger.warn(`Failed to open ${p}: ${e}`)
      }
    })

    this.handle('media:delete-file', async (_e, p: string) => {
      // Only ever delete a picture, and only from a screenshots folder or from
      // the launcher's own userData. This IPC must never be able to remove an
      // unrelated folder or executable.
      if (typeof p !== 'string' || !p) return
      const lower = p.toLowerCase()
      if (!['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].some((ext) => lower.endsWith(ext))) return
      const parent = basename(dirname(p)).toLowerCase()
      if (parent !== 'screenshots' && !this.isInside(electronApp.getPath('userData'), p)) return
      await rm(p, { force: true }).catch(() => {})
    })

    this.handle('visual-mods:list', async (_e, visualId: string) => {
      if (LOCKED_VISUAL_IDS.has(String(visualId).toLowerCase())) return []
      const dir = join(electronApp.getPath('userData'), 'visual_mods', visualId)
      if (!existsSync(dir)) return []
      const out: Array<{ name: string; path: string; size: number }> = []
      for (const file of await readdir(dir)) {
        if (!file.endsWith('.jar')) continue
        const p = join(dir, file)
        const s = await stat(p)
        out.push({ name: file, path: p, size: s.size })
      }
      return out.sort((a, b) => a.name.localeCompare(b.name))
    })

    this.handle('visual-mods:add-folder', async (_e, visualId: string) => {
      assertVisualModsAllowed(visualId)
      const result = await dialog.showOpenDialog(this.mainWin!, {
        title: 'Выберите папку с модами',
        properties: ['openDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) return 0
      const srcDir = result.filePaths[0]
      const dstDir = join(electronApp.getPath('userData'), 'visual_mods', visualId)
      await mkdir(dstDir, { recursive: true })
      let count = 0
      for (const file of await readdir(srcDir)) {
        if (!file.endsWith('.jar')) continue
        await copyFile(join(srcDir, file), join(dstDir, file)).catch(() => {})
        count++
      }
      this.logger.log(`VisualMods[${visualId}]: added ${count} mods from ${srcDir}`)
      return count
    })

    this.handle('visual-mods:remove', async (_e, visualId: string, fileName: string) => {
      assertVisualModsAllowed(visualId)
      const dir = join(electronApp.getPath('userData'), 'visual_mods', visualId)
      await this.removeInside(dir, fileName, '.jar')
    })

    this.handle('visual-mods:download', async (_e, visualId: string, url: string, fileName: string) => {
      assertVisualModsAllowed(visualId)
      const dstDir = join(electronApp.getPath('userData'), 'visual_mods', visualId)
      await mkdir(dstDir, { recursive: true })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Download failed: ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const safeName = basename(fileName).replace(/[^\w.\-+() ]/g, '_')
      await writeFile(join(dstDir, safeName), buf)
      this.logger.log(`VisualMods[${visualId}]: downloaded ${safeName} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
      return safeName
    })

    this.handle('cheat-mods:list', async (_e, cheatId: string) => {
      const dir = join(electronApp.getPath('userData'), 'cheat_mods', cheatId)
      if (!existsSync(dir)) return []
      const out: Array<{ name: string; path: string; size: number }> = []
      for (const file of await readdir(dir)) {
        if (!file.endsWith('.jar')) continue
        const p = join(dir, file)
        const s = await stat(p)
        out.push({ name: file, path: p, size: s.size })
      }
      return out.sort((a, b) => a.name.localeCompare(b.name))
    })

    this.handle('cheat-mods:add-folder', async (_e, cheatId: string) => {
      const result = await dialog.showOpenDialog(this.mainWin!, {
        title: 'Выберите папку с модами',
        properties: ['openDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) return 0
      const srcDir = result.filePaths[0]
      const dstDir = join(electronApp.getPath('userData'), 'cheat_mods', cheatId)
      await mkdir(dstDir, { recursive: true })
      let count = 0
      for (const file of await readdir(srcDir)) {
        if (!file.endsWith('.jar')) continue
        await copyFile(join(srcDir, file), join(dstDir, file)).catch(() => {})
        count++
      }
      this.logger.log(`CheatMods[${cheatId}]: added ${count} mods from ${srcDir}`)
      return count
    })

    this.handle('cheat-mods:remove', async (_e, cheatId: string, fileName: string) => {
      const dir = join(electronApp.getPath('userData'), 'cheat_mods', cheatId)
      await this.removeInside(dir, fileName, '.jar')
    })

    this.handle('cheat-mods:download', async (_e, cheatId: string, url: string, fileName: string) => {
      const dstDir = join(electronApp.getPath('userData'), 'cheat_mods', cheatId)
      await mkdir(dstDir, { recursive: true })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Download failed: ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const safeName = basename(fileName).replace(/[^\w.\-+() ]/g, '_')
      await writeFile(join(dstDir, safeName), buf)
      this.logger.log(`CheatMods[${cheatId}]: downloaded ${safeName} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
      return safeName
    })

    this.handle('get-labymod4-manifest', async () => {
      const labymod4Dir = this.#getLabymod4ResourceDir()
      const versionsDir = join(labymod4Dir, 'versions')
      const minecraftVersions: Array<{ tag: string; version: string }> = []
      if (existsSync(versionsDir)) {
        const entries = await readdir(versionsDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          const jsonPath = join(versionsDir, entry.name, `${entry.name}.json`)
          if (!existsSync(jsonPath)) continue
          try {
            const profile = JSON.parse(await readFile(jsonPath, 'utf-8')) as { _minecraftVersion?: string }
            minecraftVersions.push({ tag: profile._minecraftVersion || entry.name, version: entry.name })
          } catch (e) {
            this.logger.warn(`Failed to read LabyMod 4 version ${entry.name}: ${e}`)
          }
        }
      }
      this.logger.log(`LabyMod 4 manifest: ${minecraftVersions.length} versions bundled`)
      return { labyModVersion: '4', minecraftVersions }
    })

    this.handle('install-labymod4', async (_e, minecraft: string) => {
      const registry = this.app.registry
      const gameDataPath = await registry.get(kGameDataPath)
      const labymod4Dir = this.#getLabymod4ResourceDir()
      const versionsDir = join(labymod4Dir, 'versions')

      // Prefer the bundled profiles when they exist (instant, offline friendly).
      let versionId: string | undefined
      if (existsSync(versionsDir)) {
        // Find the bundled profile whose `_minecraftVersion` matches the requested
        // Minecraft version (the directory name may differ, e.g. 1.17 -> 1.17.1).
        const entries = await readdir(versionsDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          const jsonPath = join(versionsDir, entry.name, `${entry.name}.json`)
          if (!existsSync(jsonPath)) continue
          try {
            const profile = JSON.parse(await readFile(jsonPath, 'utf-8')) as { _minecraftVersion?: string }
            if (profile._minecraftVersion === minecraft) {
              versionId = entry.name
              break
            }
          } catch (e) {
            this.logger.warn(`Failed to read LabyMod 4 version ${entry.name}: ${e}`)
          }
        }
      }

      if (versionId) {
        const dstVersionDir = gameDataPath('versions', versionId)
        const dstVersionJson = join(dstVersionDir, `${versionId}.json`)
        if (!existsSync(dstVersionJson)) {
          await mkdir(dstVersionDir, { recursive: true })
          const srcVersionJson = join(versionsDir, versionId, `${versionId}.json`)
          await copyFile(srcVersionJson, dstVersionJson)

          // Copy the libraries this profile references from the bundled tree.
          // The version json may point at an artifact path that differs from the
          // Maven path (Gradle turns '+' in version strings into '.'), so fall
          // back to the path derived from the library name.
          const srcLibrariesDir = join(labymod4Dir, 'libraries')
          if (existsSync(srcLibrariesDir)) {
            let profile: { libraries?: Array<{ name?: string; downloads?: { artifact?: { path?: string } } }> } = {}
            try {
              profile = JSON.parse(await readFile(srcVersionJson, 'utf-8'))
            } catch (e) {
              this.logger.warn(`Failed to parse LabyMod 4 profile ${versionId}: ${e}`)
            }
            if (profile.libraries?.length) {
              const dstLibrariesDir = gameDataPath('libraries')
              for (const lib of profile.libraries) {
                const artifactPath = lib.downloads?.artifact?.path
                if (!artifactPath) continue
                const dst = join(dstLibrariesDir, artifactPath)
                if (existsSync(dst)) continue
                let src = join(srcLibrariesDir, artifactPath)
                if (!existsSync(src) && lib.name) {
                  src = this.#resolveBundledLibraryPath(srcLibrariesDir, lib.name)
                }
                if (existsSync(src)) {
                  await mkdir(dirname(dst), { recursive: true })
                  await copyFile(src, dst)
                }
              }
            }
          }

          const srcNeo = join(labymod4Dir, 'labymod-neo')
          if (existsSync(srcNeo)) {
            await cp(srcNeo, gameDataPath('labymod-neo'), { recursive: true, force: true })
          }
          this.logger.log(`Installed LabyMod 4 for Minecraft ${minecraft} (${versionId})`)
        }
        return versionId
      }

      // No bundled profile — install from the LabyMod CDN through the runtime
      // installer so machines without the bundled tree still get LabyMod.
      this.logger.log(`LabyMod 4 for Minecraft ${minecraft} is not bundled, installing from network...`)
      const [metadata, installService] = await Promise.all([
        registry.get(VersionMetadataService),
        registry.get(InstallService),
      ])
      const manifest = await metadata.getLabyModManifest()
      const installedId = await installService.installLabyModVersion({
        manifest,
        minecraftVersion: minecraft,
      })
      this.logger.log(`Installed LabyMod 4 for Minecraft ${minecraft} from network (${installedId})`)
      return installedId
    })

    this.app.on('window-all-closed', () => {
      if (process.platform !== 'darwin' && !this.parking) {
        this.app.quit()
      }
    })

    this.app.on('second-instance', () => {
      if (this.parking) {
        if (this.mainWin) {
          if (this.mainWin.isMinimized()) {
            this.mainWin.restore()
          } else if (!this.mainWin.isVisible()) {
            this.mainWin.show()
          }
          this.mainWin.focus()
        }
      }
    })

    this.logger = this.app.getLogger('Controller')

    protocol.registerSchemesAsPrivileged([{
      scheme: 'image',
      privileges: {
        stream: true,
        corsEnabled: true,
        supportFetchAPI: true,
        bypassCSP: true,
      },
    }])

    protocol.registerSchemesAsPrivileged([{
      scheme: 'video',
      privileges: {
        stream: true,
        corsEnabled: true,
        supportFetchAPI: true,
        bypassCSP: true,
      },
    }])
  }

  handle(channel: string, handler: (event: { sender: Client }, ...args: any[]) => any, once = false) {
    if (!once) {
      return ipcMain.handle(channel, handler)
    }
    return ipcMain.handleOnce(channel, handler)
  }

  broadcast(channel: string, ...payload: any[]): void {
    BrowserWindow.getAllWindows().forEach(w => {
      try {
        w.webContents.send(channel, ...payload)
      } catch (e) {
        this.logger.warn(`Drop message to ${channel} to ${w.getTitle()} as`)
        if (e instanceof Error) {
          this.logger.warn(e)
        }
      }
    })
  }

  private setupBrowserLogger(ref: BrowserWindow, name: string) {
    const logger = this.app.getLogger(name, name)
    ref.webContents.on('console-message', (e, level, message, line, id) => {
      if (message.startsWith("Listener added for a synchronous 'DOMNodeRemoved' DOM Mutation Event. This event type is deprecated")) {
        return
      }
      if (level === 1) {
        logger.log(message)
      } else if (level === 2) {
        logger.warn(message)
      } else if (level === 3) {
        logger.warn(message)
      }
    })
    ref.once('close', () => {
      ref.webContents.removeAllListeners('console-message')
    })
  }

  private getBackgroundMaterial(enableTranslucency: boolean): 'none' | 'mica' | 'acrylic' | 'auto' | undefined {
    return undefined
    // const isWin = this.app.platform.os === 'windows'
    // if (!isWin) {
    //   return undefined
    // }
    // const windowsVersion = this.windowsVersion
    // const win11 = windowsVersion && windowsVersion.build >= WindowsBuild.Windows11
    // if (!enableTranslucency) {
    //   return win11 ? 'mica' : 'auto'
    // }
    // const win10 = windowsVersion && windowsVersion.build >= WindowsBuild.Windows10
    // if (!win10 && !win11) {
    //   return 'auto'
    // }
    // return 'acrylic'
  }

  /**
   * Base color the OS paints behind the page. It must be a valid CSS color and
   * it must match the actual launcher theme: the page itself uses a partly
   * transparent background, so a wrong (or invalid — the old `0x424242` was
   * ignored, leaving the default white) value shows through and the window
   * flashes on load, repaint or color scheme change.
   */
  /** True when `target` is strictly inside `root` (both resolved first). */
  private isInside(root: string, target: string): boolean {
    const rel = relative(resolve(root), resolve(target))
    return !!rel && !rel.startsWith('..') && !isAbsolute(rel)
  }

  /**
   * Remove a single file from `root`. The name is reduced to its basename and
   * the path is verified to stay inside `root`, so a bad name from the renderer
   * (`..\..\Something\app.exe`) can never escape the launcher's own folder.
   */
  private async removeInside(root: string, fileName: string, ext: string) {
    if (typeof fileName !== 'string') return
    const safe = basename(fileName)
    if (safe !== fileName) return
    if (!safe.toLowerCase().endsWith(ext)) return
    const target = join(root, safe)
    if (!this.isInside(root, target)) return
    await rm(target, { force: true }).catch(() => {})
  }

  private getWindowBackgroundColor(): string {
    let dark = nativeTheme.shouldUseDarkColors
    try {
      const themeFile = join(this.app.appDataPath, 'theme.json')
      if (existsSync(themeFile)) {
        // Sync read on purpose: the value is needed before the window paints.
        const value = JSON.parse(readFileSync(themeFile, 'utf-8'))?.settings?.dark
        if (value === true || value === false) dark = value
      }
    } catch {}
    return dark ? '#111318' : '#f5f6f8'
  }

  async startMigrate() {
    // The migration runs from `LauncherApp.setup()`, which races with the
    // engine becoming ready. Creating a BrowserWindow before the app is ready
    // throws, so wait for readiness before showing the progress window.
    await electronApp.whenReady()
    const restoredSession = this.app.session.getSession(defaultApp.url)
    const browser = new BrowserWindow({
      title: 'XMCL Launcher Migrate',
      frame: false,
      resizable: false,
      width: 600,
      height: 400,
      webPreferences: {
        preload: migrationPreload,
        session: restoredSession,
      },
    })
    browser.loadURL(migrateWinUrl)

    this.migrationRef = browser
  }

  async endMigrate(result?: { from: string; to: string }) {
    this.migrated = result
    if (this.migrationRef) {
      this.migrationRef.close()
    }
  }

  async activate(manifest: InstalledAppManifest, isBootstrap = false): Promise<void> {
    this.logger.log(`Activate app ${manifest.name} ${manifest.url}`)
    this.parking = true

    // close the old window
    if (this.mainWin && !this.mainWin.isDestroyed()) {
      this.mainWin.close()
    }

    this.activatedManifest = manifest

    try {
      await this.createAppWindow(isBootstrap)
    } finally {
      this.parking = false
    }
  }

  async createBrowseWindow() {
    // Determine if translucency should be enabled
    const enableTranslucency = this.settings?.windowTranslucent ?? false

    const browser = new BrowserWindow({
      title: 'XMCL Launcher Browser',
      frame: false,
      transparent: true,
      resizable: false,
      width: 860,
      height: 450,
      useContentSize: true,
      vibrancy: enableTranslucency && this.app.platform.os === 'osx' ? 'sidebar' : undefined, // macOS vibrancy
      backgroundMaterial: this.getBackgroundMaterial(enableTranslucency), // Windows mica/acrylic
      icon: darkIcon,
      webPreferences: {
        preload: browsePreload,
      },
    })

    browser.loadURL(browserWinUrl)

    this.browserRef = browser
  }

  async openMultiplayerWindow() {
    if (!this.multiplayerRef || this.multiplayerRef.isDestroyed()) {
      const man = this.activatedManifest!
      const tracker = createWindowTracker(this.app, 'multiplayer', man)
      const config = await tracker.getConfig()

      const win = new BrowserWindow({
        icon: nativeTheme.shouldUseDarkColors ? man.iconSets.darkIcon : man.iconSets.icon,
        titleBarStyle: this.getTitlebarStyle(),
        trafficLightPosition: this.app.platform.os === 'osx' ? { x: 14, y: 10 } : undefined,
        minWidth: 400,
        minHeight: 600,
        width: config.getWidth(400, 400),
        height: config.getHeight(600, 600),
        x: config.x,
        y: config.y,
        show: false,
        frame: this.getFrameOption(),

        webPreferences: {
          session: this.app.session.getSession(this.activatedManifest!.url),
          contextIsolation: true,
          sandbox: false,
          preload: multiplayerPreload,
          devTools: IS_DEV,
        },
      })

      tracker.track(win)

      const url = new URL(man.url)
      url.pathname = '/app.html'
      win.loadURL(url.toString())
      this.onWebContentCreateWindow(win)
      win.once('ready-to-show', () => {
        win.show()
      })
      win.on('close', (e) => {
        if (this.mainWin && !this.mainWin.isDestroyed()) {
          win.hide()
          e.preventDefault()
        }
      })
      this.multiplayerRef = win
    } else {
      this.multiplayerRef.show()
      this.multiplayerRef.focus()
    }
  }

  setWindowTranslucent(enable: boolean) {
    if (this.mainWin && !this.mainWin.isDestroyed()) {
      if (this.app.platform.os === 'osx') {
        this.mainWin.setVibrancy(enable ? 'sidebar' : null)
      } else if (this.app.platform.os === 'windows') {
        this.mainWin.setBackgroundMaterial(this.getBackgroundMaterial(enable) ?? 'auto')
      }
    }
  }

  async createAppWindow(isBootstrap: boolean) {
    const man = this.activatedManifest!
    const tracker = createWindowTracker(this.app, 'app-manager', man)
    const config = await tracker.getConfig()

    const restoredSession = this.app.session.getSession(man.url)
    const minWidth = man.minWidth ?? 800
    const minHeight = man.minHeight ?? 600
    const defaultWidth = man.defaultWidth ?? 800
    const defaultHeight = man.defaultHeight ?? 600

    // Ensure the settings is loaded for translucency and Linux titlebar options
    if (!this.settings) {
      this.settings = await this.app.registry.get(kSettings)
    }

    // Determine if translucency should be enabled (from user settings or app manifest)
    const enableTranslucency = this.settings?.windowTranslucent || man.vibrancy

    const browser = new BrowserWindow({
      title: man.name,
      width: config.getWidth(defaultWidth, minWidth),
      height: config.getHeight(defaultHeight, minHeight),
      x: config.x,
      y: config.y,
      minWidth: man.minWidth,
      minHeight: man.minHeight,
      frame: this.getFrameOption(),
      backgroundColor: enableTranslucency ? undefined : this.getWindowBackgroundColor(), // Transparent when translucency is enabled
      vibrancy: enableTranslucency && this.app.platform.os === 'osx' ? 'sidebar' : undefined, // macOS vibrancy
      backgroundMaterial: this.getBackgroundMaterial(enableTranslucency), // Windows mica/acrylic
      icon: nativeTheme.shouldUseDarkColors ? man.iconSets.darkIcon : man.iconSets.icon,
      titleBarStyle: this.getTitlebarStyle(),
      trafficLightPosition: this.app.platform.os === 'osx' ? { x: 14, y: 10 } : undefined,
      webPreferences: {
        preload: indexPreload,
        session: restoredSession,
        webviewTag: true,
      },
      show: false,
    })

    if (man.ratio) {
      browser.setAspectRatio(minWidth / minHeight)
    }

    browser.on('ready-to-show', () => {
      this.logger.log('App Window is ready to show!')

      if (config.maximized) {
        browser.maximize()
      }

      if (!this.app.deferredWindowOpen) {
        browser.show()
        browser.focus()
      }
    })
    browser.webContents.on('will-navigate', this.onWebContentWillNavigate)
    browser.webContents.on('did-create-window', this.onWebContentCreateWindow)
    browser.webContents.setWindowOpenHandler(this.windowOpenHandler)
    browser.on('closed', () => {
      this.mainWin = undefined
      this.multiplayerRef?.close()
    })

    this.setupBrowserLogger(browser, 'app')
    tracker.track(browser)

    const url = new URL(man.url)
    if (isBootstrap) {
      url.searchParams.append('bootstrap', 'true')
    }
    if (this.migrated) {
      url.searchParams.append('from', this.migrated.from)
      url.searchParams.append('to', this.migrated.to)
    }
    this.logger.log(url.toString())
    browser.loadURL(url.toString())

    this.logger.log(`Load main window url ${url.toString()}`)

    this.mainWin = browser
    browser.on('enter-full-screen', () => {
      this.maximized = true
    })
    browser.on('maximize', () => {
      this.maximized = true
    })
    browser.on('unmaximize', () => {
      this.maximized = false
    })

    this.app.emit('app-booted', man)
  }

  getLoggerWindow() {
    if (this.loggerWin?.isDestroyed()) {
      this.loggerWin = undefined
    }
    return this.loggerWin
  }

  async createMonitorWindow() {
    const tracker = createWindowTracker(this.app, 'monitor', this.activatedManifest!)
    // Determine if translucency should be enabled
    const enableTranslucency = this.settings?.windowTranslucent ?? false

    const config = await tracker.getConfig()
    const browser = new BrowserWindow({
      title: 'KeyStone Monitor',
      width: config.getWidth(600, 600),
      height: config.getHeight(400, 400),
      x: config.x,
      y: config.y,
      minWidth: 600,
      minHeight: 400,
      frame: false,
      transparent: true,
      hasShadow: false,
      maximizable: false,
      icon: darkIcon,
      backgroundMaterial: this.getBackgroundMaterial(enableTranslucency), // Windows mica/acrylic
      webPreferences: {
        preload: monitorPreload,
        session: this.app.session.getSession(this.activatedManifest!.url),
      },
    })

    this.setupBrowserLogger(browser, 'logger')

    browser.loadURL(loggerWinUrl)
    browser.show()

    tracker.track(browser)

    this.loggerWin = browser
  }

  requireFocus(): void {
    if (this.mainWin) {
      if (!this.mainWin.isVisible()) {
        this.mainWin.show()
      } else {
        this.mainWin.focus()
      }
    } else if (this.loggerWin) {
      this.loggerWin.focus()
    }
  }

  async requestOpenExternalUrl(url: string) {
    const { t } = this.i18n
    const result = await dialog.showMessageBox(this.mainWin!, {
      type: 'question',
      title: t('openUrl.title', { url }),
      message: t('openUrl.message', { url }),
      checkboxLabel: t('openUrl.trust'),
      buttons: [t('openUrl.cancel'), t('openUrl.yes')],
    })
    return result.response === 1
  }

  #getLabymod4ResourceDir() {
    return join(electronApp.getPath('userData'), 'resources', 'labymod4')
  }

  /**
   * Resolve the game directory that holds `screenshots` for a cheat / visual /
   * ghost client. Ghost clients live under `instances/<nick><suffix>`, so pick
   * the most recently modified matching folder.
   */
  #resolveMediaBaseDir(kind: string, id: string): string {
    const userData = electronApp.getPath('userData')
    if (kind === 'instance') {
      // Regular instance: `id` carries the absolute instance path.
      return id || ''
    }
    if (kind === 'visual') {
      return join(userData, 'visuals', id)
    }
    if (kind === 'ghost') {
      return ''
    }
    return join(userData, 'cheats', id)
  }

  async #listImages(dir: string, sub: string) {
    const imagesDir = join(dir, sub)
    if (!existsSync(imagesDir)) return []
    const out: Array<{ name: string; path: string; size: number; mtime: number }> = []
    for (const file of await readdir(imagesDir)) {
      if (!/\.(png|jpg|jpeg)$/i.test(file)) continue
      const p = join(imagesDir, file)
      try {
        const s = await stat(p)
        out.push({ name: file, path: p, size: s.size, mtime: s.mtimeMs })
      } catch {}
    }
    return out.sort((a, b) => b.mtime - a.mtime)
  }


  /**
   * Resolve a library file path inside the bundled libraries tree from its
   * Maven coordinates (`groupId:artifactId:version`). Some bundled jars are
   * stored under the original version string (with `+`) while the version json
   * references a normalized path (`.` instead of `+`).
   */
  #resolveBundledLibraryPath(librariesDir: string, libraryName: string) {
    const parts = libraryName.split(':')
    if (parts.length < 3) return ''
    const [groupId, artifactId, version] = parts
    const mavenPath = `${groupId.split('.').join('/')}/${artifactId}/${version}/${artifactId}-${version}.jar`
    const candidate = join(librariesDir, mavenPath)
    return existsSync(candidate) ? candidate : ''
  }
  private getFrameOption() {    if (this.app.platform.os === 'linux') {
      return this.settings?.linuxTitlebar
    } else {
      return true
    }
  }

  private getTitlebarStyle() {
    return this.app.platform.os === 'linux' &&
      this.settings?.linuxTitlebar
      ? 'default'
      : 'hidden'
  }

  private getOptimizedVmOptions(settings: Settings): string[] {
    const base = [...(settings.globalVmOptions ?? [])]
    // Always-on startup flags: skip class bytecode verification (the bulk of
    // JVM boot with mods). Verified against the bundled JRE 8/21/25.
    for (const flag of FAST_STARTUP_VM_OPTIONS) {
      if (!base.includes(flag)) base.push(flag)
    }
    if (settings.globalOptimization) {
      for (const flag of OPTIMIZATION_VM_OPTIONS) {
        if (!base.includes(flag)) base.push(flag)
      }
    }
    return base
  }

  /**
   * Launch a bundled visual client (PulseVisuals / ReallyVisuals).*
   * Reuses the cheat launch pattern but targets the visual's own Minecraft release
   * and stores its instance under `userData/visuals/<id>`.
   */
  private async launchVisualClient(
    id: string,
    displayName: string,
    minecraft: string,
    fabricLoader: string,
    javaMajor: number,
    options: { allowCustomMods?: boolean; resolveResourceRoot?: boolean } = {},
  ) {
    try {
      await this.app.waitEngineReady()
      this.logger.log(`${displayName}: engine ready`)

      const registry = this.app.registry

      const [launchService, userService, javaService, versionService, installService, settings] = await Promise.all([
        registry.getOrCreate(LaunchService),
        registry.getOrCreate(UserService),
        registry.getOrCreate(JavaService),
        registry.getOrCreate(VersionService),
        registry.getOrCreate(InstallService),
        registry.get(kSettings),
      ])

      // Kick off the independent slow steps in parallel: account refresh (network),
      // java resolution, version lookup + dependency install, and the folder copy.
      const refreshPromise = (async () => {
        const userState = await userService.getUserState()
        const users = Object.values(userState.users)
        if (users.length === 0) throw new Error('No user logged in')
        return await userService.refreshUser(users[0].id)
      })()

      const javaPromise = (async () => {
        let java = await this.pickCheatJava(javaService, javaMajor, javaMajor >= 21 ? undefined : 8)
        if (!java) {
          const javaState = await javaService.getJavaState()
          java = javaState.all.find(j => j.majorVersion >= javaMajor && j.valid)
        }
        if (!java) throw new Error(`${displayName}: no suitable Java ${javaMajor}+ found.`)
        return java
      })()

      const resourceDir = join(electronApp.getPath('userData'), 'resources', id)
      if (!existsSync(resourceDir)) throw new Error(`${displayName} is not installed. Please download it first.`)

      const effectiveResourceDir = options.resolveResourceRoot
        ? await this.resolveVisualResourceRoot(resourceDir, displayName)
        : resourceDir
      const gameDir = join(electronApp.getPath('userData'), 'visuals', id)
      this.logger.log(`${displayName}: resourceDir=${effectiveResourceDir}, gameDir=${gameDir}`)

      // Copy the bundled client content (mods, config, resource packs, shader
      // packs) into the dedicated visuals game directory, then apply the
      // player-added custom mods on top. Both are skipped when already in sync.
      // FastVisual used to run directly from resources. On its first launch
      // after this change, migrate the rest of the legacy profile (saves,
      // screenshots, options, logs) so nothing the player made is lost. The
      // four synced folders are left to syncResourceFolders, so they are
      // copied once and get their sync markers.
      const bootstrapVisualDir = options.resolveResourceRoot && !existsSync(gameDir)
        ? (async () => {
          const syncedDirs = new Set(['mods', 'config', 'resourcepacks', 'shaderpacks'])
          await mkdir(gameDir, { recursive: true })
          const entries = await readdir(effectiveResourceDir, { withFileTypes: true })
          for (const entry of entries) {
            if (syncedDirs.has(entry.name)) continue
            await cp(join(effectiveResourceDir, entry.name), join(gameDir, entry.name), { recursive: true, force: true })
              .catch((e) => this.logger.warn(`Failed to migrate ${entry.name}: ${e}`))
          }
          this.logger.log(`${displayName}: migrated legacy profile to ${gameDir}`)
        })()
        : Promise.resolve()
      const syncPromise = bootstrapVisualDir
        .then(() => this.syncResourceFolders(effectiveResourceDir, gameDir, ['mods', 'config', 'resourcepacks', 'shaderpacks']))
        .then(() => options.allowCustomMods === false
          ? undefined
          : this.applyCustomMods('visual_mods', id, gameDir))

      const versionPromise = (async () => {
        const localVersions = await versionService.getLocalVersions()
        let versionHeader = findMatchedVersion(localVersions.local, '', { minecraft, fabricLoader })
        if (!versionHeader) {
          this.logger.log(`${displayName}: MC ${minecraft} + Fabric not found, installing…`)
          const manifestUrl = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'
          const res = await fetch(manifestUrl)
          const manifest = await res.json()
          const mcMeta = manifest.versions.find((v: any) => v.id === minecraft)
          if (!mcMeta) throw new Error(`MC ${minecraft} not found in version manifest`)
          await installService.installMinecraft({ meta: mcMeta })
          await versionService.refreshVersions()
          const fabricVersionId = await installService.installFabric({ minecraft, loader: fabricLoader })
          await installService.installDependencies({ version: fabricVersionId, side: 'client' })
          await versionService.refreshVersions()
          const updatedVersions = await versionService.getLocalVersions()
          versionHeader = findMatchedVersion(updatedVersions.local, '', { minecraft, fabricLoader })
        }
        if (!versionHeader) {
          throw new Error(`${displayName}: failed to install MC ${minecraft} + Fabric. Check internet connection.`)
        }
        await installService.installDependencies({ version: versionHeader.id, side: 'client', quick: true })
        return versionHeader
      })()

      const [refreshedUser, java, versionHeader] = await Promise.all([refreshPromise, javaPromise, versionPromise, syncPromise])

      const launchOptions: LaunchOptions = {
        version: versionHeader.id,
        gameDirectory: gameDir,
        side: 'client',
        user: refreshedUser,
        java: java.path,
        hideLauncher: true,
        showLog: false,
        minMemory: 256,
        maxMemory: 4096,
        vmOptions: this.getOptimizedVmOptions(settings),
        mcOptions: settings.globalMcOptions ?? [],
        env: {},
        operationId: `${id}-${Date.now().toString(36)}`,
      }

      this.logger.log(`${displayName}: calling launchService.launch()`)
      const pid = await launchService.launch(launchOptions)
      this.logger.log(`${displayName}: got pid ${pid}`)
      if (!pid) throw new Error('LaunchService returned no pid')

      this.beginCheatSession(id)

      this.parking = true
      if (this.mainWin && !this.mainWin.isDestroyed() && this.mainWin.isVisible()) {
        this.mainWin.hide()
      }

      const presenceService = await registry.getOrCreate(PresenceService).catch(() => null)
      presenceService?.setActivity('В игре', { name: displayName })

      const onExit = (status: { pid: number }) => {
        if (status.pid === pid) {
          presenceService?.clearActivity()
          launchService.removeListener('minecraft-exit', onExit)
          this.parking = false
          if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.isVisible()) {
            this.mainWin.show()
          }
          this.notifyCheatExit(id)
        }
      }
      launchService.on('minecraft-exit', onExit)
    } catch (e) {
      this.logger.error(contextualError(`${displayName} launch failed`, e))
      this.broadcast('cheat-error', { id, message: (e as Error).message })
      if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.isVisible()) {
        this.mainWin.show()
      }
    }
  }

  /** Locate the actual visual bundle root when a release zip contains wrapper directories. */
  private async resolveVisualResourceRoot(resourceDir: string, displayName: string) {
    const queue: Array<{ dir: string; depth: number }> = [{ dir: resourceDir, depth: 0 }]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (existsSync(join(current.dir, 'instance.json')) || existsSync(join(current.dir, 'mods'))) {
        return current.dir
      }
      if (current.depth >= 2) continue
      const entries = await readdir(current.dir, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (entry.isDirectory()) queue.push({ dir: join(current.dir, entry.name), depth: current.depth + 1 })
      }
    }
    throw new Error(`${displayName}: папка визуала не найдена в скачанном архиве.`)
  }

  /**
   * Fingerprint a directory tree (file count, total bytes, newest mtime).
   * Cheap compared to copying gigabytes, accurate enough to detect a
   * re-downloaded/updated bundle.
   */
  private async fingerprintDir(dir: string): Promise<{ count: number; size: number; mtimeMs: number }> {
    let count = 0
    let size = 0
    let mtimeMs = 0
    const walk = async (d: string) => {
      const entries = await readdir(d, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        const p = join(d, entry.name)
        if (entry.isDirectory()) {
          await walk(p)
        } else {
          const s = await stat(p).catch(() => null)
          if (s) {
            count++
            size += s.size
            if (s.mtimeMs > mtimeMs) mtimeMs = s.mtimeMs
          }
        }
      }
    }
    await walk(dir)
    return { count, size, mtimeMs }
  }

  /**
   * Copy bundled cheat/visual folders into the game directory only when their
   * source changes. `mods` is launcher-owned and replaced so client updates
   * take effect. Configs, resource packs and shaders are merged without
   * overwriting or deleting anything already in the player's game directory.
   * This keeps Minecraft settings and user content across resource updates.
   */
  private async syncResourceFolders(sourceDir: string, gameDir: string, subFolders: string[]) {
    await mkdir(gameDir, { recursive: true }).catch(() => {})
    for (const sub of subFolders) {
      const srcSub = join(sourceDir, sub)
      if (!existsSync(srcSub)) continue
      const dstSub = join(gameDir, sub)
      const marker = join(gameDir, `.fastlauncher-sync-${sub}.json`)
      try {
        const fingerprint = await this.fingerprintDir(srcSub)
        if (existsSync(dstSub) && existsSync(marker)) {
          const prev = JSON.parse(await readFile(marker, 'utf-8')) as { count?: number; size?: number; mtimeMs?: number }
          if (prev.count === fingerprint.count && prev.size === fingerprint.size && prev.mtimeMs === fingerprint.mtimeMs) {
            continue
          }
        }
        if (sub === 'mods') {
          await rm(dstSub, { recursive: true, force: true })
          await cp(srcSub, dstSub, { recursive: true, force: true })
        } else {
          await mkdir(dstSub, { recursive: true })
          await cp(srcSub, dstSub, {
            recursive: true,
            force: false,
            errorOnExist: false,
          })
        }
        await writeFile(marker, JSON.stringify(fingerprint))
        this.logger.log(`Synced ${sub} (${fingerprint.count} files) to ${gameDir}`)
      } catch (e) {
        this.logger.error(contextualError(`Failed to sync ${sub}`, e))
      }
    }
  }

  private async applyCustomMods(modsRoot: string, cheatId: string, gameDir: string) {
    const customModsDir = join(electronApp.getPath('userData'), modsRoot, cheatId)
    if (existsSync(customModsDir)) {
      const dstMods = join(gameDir, 'mods')
      await mkdir(dstMods, { recursive: true })
      let customCount = 0
      for (const file of await readdir(customModsDir)) {
        if (!file.endsWith('.jar')) continue
        await copyFile(join(customModsDir, file), join(dstMods, file)).catch(() => {})
        customCount++
      }
      if (customCount > 0) {
        this.logger.log(`${modsRoot}[${cheatId}]: applied ${customCount} custom mods to game dir`)
      }
    }
  }

  /** Record when a cheat/visual session starts, for the exit notification. */
  private beginCheatSession(id: string) {
    this.cheatStartTimes.set(id, Date.now())
  }

  /**
   * Broadcast a cheat/visual exit and show a colorful notification with the
   * session length. Called after the launcher window is shown again, so the
   * rich in-app toast is used when the user is back in the launcher.
   */
  private notifyCheatExit(id: string) {
    const startedAt = this.cheatStartTimes.get(id)
    this.cheatStartTimes.delete(id)
    const durationMs = startedAt ? Date.now() - startedAt : 0
    this.broadcast('cheat-exited', id)
    const label = resourceLabel(id)
    setTimeout(() => {
      flashOrNotify(
        { kind: 'game-exit', id, durationMs },
        {
          title: 'Игра закрыта',
          body: label + (durationMs > 0 ? ' · сессия ' + ElectronController.formatDuration(durationMs) : ''),
        },
      )
    }, 450)
  }

  private static formatDuration(ms: number) {
    const totalMin = Math.max(1, Math.round(ms / 60000))
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    if (h > 0) return h + ' ч ' + m + ' мин'
    return totalMin + ' мин'
  }

  /**
   * Launch a cheat that may be downloaded on demand (stored in userData/resources/<id>).
   * Falls back to the bundled resources path for backwards compatibility.
   */
  private async launchDownloadableCheat(id: string, displayName: string, minecraft: string, fabricLoader: string, javaMajor: number) {
    try {
      await this.app.waitEngineReady()
      this.logger.log(`${displayName}: engine ready`)

      const registry = this.app.registry

      const [launchService, userService, javaService, versionService, installService, settings] = await Promise.all([
        registry.getOrCreate(LaunchService),
        registry.getOrCreate(UserService),
        registry.getOrCreate(JavaService),
        registry.getOrCreate(VersionService),
        registry.getOrCreate(InstallService),
        registry.get(kSettings),
      ])

      // Kick off the independent slow steps in parallel: account refresh (network),
      // java resolution, version lookup + dependency install, and the folder copy.
      const refreshPromise = (async () => {
        const userState = await userService.getUserState()
        const users = Object.values(userState.users)
        if (users.length === 0) throw new Error('No user logged in')
        return await userService.refreshUser(users[0].id)
      })()

      const javaPromise = (async () => {
        let java = await this.pickCheatJava(javaService, javaMajor, javaMajor >= 21 ? undefined : 8)
        if (!java) {
          const javaState = await javaService.getJavaState()
          java = javaState.all.find(j => j.majorVersion >= javaMajor && j.valid)
        }
        if (!java) throw new Error(`${displayName}: no suitable Java ${javaMajor}+ found.`)
        return java
      })()

      const resourceDir = join(electronApp.getPath('userData'), 'resources', id)
      if (!existsSync(resourceDir)) throw new Error(`${displayName} is not installed. Please download it first.`)

      // Auto-detect nested subfolder: resources/<id>/<id>/mods → use inner dir
      let effectiveResourceDir = resourceDir
      const innerDir = join(resourceDir, id)
      if (!existsSync(join(resourceDir, 'mods')) && existsSync(innerDir)) {
        const innerEntries = await readdir(innerDir).catch(() => [])
        if (innerEntries.some(e => ['mods', 'config', 'resourcepacks', 'shaderpacks'].includes(e))) {
          effectiveResourceDir = innerDir
          this.logger.log(`${displayName}: detected nested subfolder, using ${innerDir}`)
        }
      }

      const gameDir = join(electronApp.getPath('userData'), 'cheats', id)
      this.logger.log(`${displayName}: resourceDir=${effectiveResourceDir}, gameDir=${gameDir}`)

      // Copy the bundled folders into the game dir only when the source
      // changed; apply the player-added custom mods on top.
      const syncPromise = this.syncResourceFolders(effectiveResourceDir, gameDir, ['mods', 'config', 'resourcepacks', 'shaderpacks'])
        .then(() => this.applyCustomMods('cheat_mods', id, gameDir))

      const versionPromise = (async () => {
        const localVersions = await versionService.getLocalVersions()
        let versionHeader = findMatchedVersion(localVersions.local, '', { minecraft, fabricLoader })
        if (!versionHeader) {
          this.logger.log(`${displayName}: MC ${minecraft} + Fabric not found, installing…`)
          const manifestUrl = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'
          const res = await fetch(manifestUrl)
          const manifest = await res.json()
          const mcMeta = manifest.versions.find((v: any) => v.id === minecraft)
          if (!mcMeta) throw new Error(`MC ${minecraft} not found in version manifest`)
          await installService.installMinecraft({ meta: mcMeta })
          await versionService.refreshVersions()
          const fabricVersionId = await installService.installFabric({ minecraft, loader: fabricLoader })
          await installService.installDependencies({ version: fabricVersionId, side: 'client' })
          await versionService.refreshVersions()
          const updatedVersions = await versionService.getLocalVersions()
          versionHeader = findMatchedVersion(updatedVersions.local, '', { minecraft, fabricLoader })
        }
        if (!versionHeader) {
          throw new Error(`${displayName}: failed to install MC ${minecraft} + Fabric. Check internet connection.`)
        }
        await installService.installDependencies({ version: versionHeader.id, side: 'client', quick: true })
        return versionHeader
      })()

      const [refreshedUser, java, versionHeader] = await Promise.all([refreshPromise, javaPromise, versionPromise, syncPromise])

      const launchOptions: LaunchOptions = {
        version: versionHeader.id,
        gameDirectory: gameDir,
        side: 'client',
        user: refreshedUser,
        java: java.path,
        hideLauncher: true,
        showLog: false,
        minMemory: 256,
        maxMemory: 4096,
        vmOptions: this.getOptimizedVmOptions(settings),
        mcOptions: settings.globalMcOptions ?? [],
        env: {},
        operationId: `${id}-${Date.now().toString(36)}`,
      }

      this.logger.log(`${displayName}: calling launchService.launch()`)
      const pid = await launchService.launch(launchOptions)
      this.logger.log(`${displayName}: got pid ${pid}`)
      if (!pid) throw new Error('LaunchService returned no pid')

      this.beginCheatSession(id)

      this.parking = true
      if (this.mainWin && !this.mainWin.isDestroyed() && this.mainWin.isVisible()) {
        this.mainWin.hide()
      }

      const presenceService = await registry.getOrCreate(PresenceService).catch(() => null)
      presenceService?.setActivity('В игре', { name: displayName })

      const onExit = (status: { pid: number }) => {
        if (status.pid === pid) {
          presenceService?.clearActivity()
          launchService.removeListener('minecraft-exit', onExit)
          this.parking = false
          if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.isVisible()) {
            this.mainWin.show()
          }
          this.notifyCheatExit(id)
        }
      }
      launchService.on('minecraft-exit', onExit)
    } catch (e) {
      this.logger.error(contextualError(`${displayName} launch failed`, e))
      this.broadcast('cheat-error', { id, message: (e as Error).message })
      if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.isVisible()) {
        this.mainWin.show()
      }
    }
  }

  /**
   * Prefer the bundled Java runtime (resources/jreXX) over a system scan for cheats.
   * @returns the resolved Java record, or undefined if no bundled runtime exists for that version.
   */
  private async pickCheatJava(javaService: JavaService, minMajor: number, exact?: number): Promise<JavaRecord | undefined> {
    // Given the version requirements, try the newest bundled runtime first.
    const candidates = exact !== undefined
      ? [exact]
      : [25, 21, 8].filter(v => v >= minMajor)
    for (const major of candidates) {
      const exe = this.getBundledJavaExe(major)
      if (exe) {
        const java = await javaService.resolveJava(exe)
        if (java) return { ...java, valid: true } as JavaRecord
      }
    }
    return undefined
  }

  private getBundledJavaExe(major: number): string | undefined {
    const resourcesPath = (process as unknown as { resourcesPath?: string }).resourcesPath
    const base = electronApp.isPackaged && resourcesPath ? resourcesPath : electronApp.getAppPath()
    const dir = join(base, `jre${major}`)
    const exe = join(dir, 'bin', 'java.exe')
    return existsSync(exe) ? exe : undefined
  }

  get activeWindow() {
    return this.mainWin ?? this.loggerWin
  }

  getLoginSuccessHTML() {
    const title = this.i18n.t('urlSuccess')
    const body = this.i18n.t('autoCloseHint').replace('{time}', '<span id="countdown">10</span>')
    return getLoginSuccessHTML(title, body)
  }

  openDevTools() {
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        win.webContents.closeDevTools()
        win.webContents.openDevTools({ mode: 'detach' })
      } catch {

      }
    }
  }
}
