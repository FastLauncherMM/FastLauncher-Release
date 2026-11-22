import { GenericEventEmitter } from './events'

/**
 * Port from electron
 */
export interface FileFilter {
  extensions: string[]
  name: string
}
/**
 * Port from electron
 */
export interface OpenDialogOptions {
  title?: string
  defaultPath?: string
  /**
   * Custom label for the confirmation button, when left empty the default label will
   * be used.
   */
  buttonLabel?: string
  filters?: FileFilter[]
  /**
   * Contains which features the dialog should use. The following values are
   * supported:
   */
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory' | 'dontAddToRecent'>
  /**
   * Message to display above input boxes.
   *
   * @platform darwin
   */
  message?: string
  /**
   * Create security scoped bookmarks when packaged for the Mac App Store.
   *
   * @platform darwin,mas
   */
  securityScopedBookmarks?: boolean
}

export interface SaveDialogOptions {
  /**
   * The dialog title. Cannot be displayed on some _Linux_ desktop environments.
   */
  title?: string
  /**
   * Absolute directory path, absolute file path, or file name to use by default.
   */
  defaultPath?: string
  /**
   * Custom label for the confirmation button, when left empty the default label will
   * be used.
   */
  buttonLabel?: string
  filters?: FileFilter[]
  /**
   * Message to display above text fields.
   *
   * @platform darwin
   */
  message?: string
  /**
   * Custom label for the text displayed in front of the filename text field.
   *
   * @platform darwin
   */
  nameFieldLabel?: string
  /**
   * Show the tags input box, defaults to `true`.
   *
   * @platform darwin
   */
  showsTagField?: boolean
  properties?: Array<'showHiddenFiles' | 'createDirectory' | 'treatPackageAsDirectory' | 'showOverwriteConfirmation' | 'dontAddToRecent'>
  /**
   * Create a security scoped bookmark when packaged for the Mac App Store. If this
   * option is enabled and the file doesn't already exist a blank file will be
   * created at the chosen path.
   *
   * @platform darwin,mas
   */
  securityScopedBookmarks?: boolean
}

interface WindowControllerEventMap {
  maximize: boolean
  minimize: boolean
  'cheat-exited': string
  'cheat-error': { id: string; message: string }
  'download-progress': { id: string; percent: number; speed: string; bytes?: number; total?: number; rate?: string; rateBytes?: number }
  'download-done': { id: string }
  'download-error': { id: string; message: string }
  'download-cancelled': { id: string; discarded?: boolean }
  'app-flash': {
    kind: 'download-done' | 'download-error' | 'download-cancelled' | 'game-exit'
    id?: string
    durationMs?: number
    sizeBytes?: number
    message?: string
  }
  'app-update-progress': { percent: number; bytes: number; total: number; rateBytes?: number }
  'app-update-done': { version: string }
  'app-update-error': { message: string }
  'app-update-cancelled': Record<string, unknown>
}

export interface LabyMod4Manifest {
  /**
   * The LabyMod client version string bundled with the launcher
   */
  labyModVersion: string
  /**
   * The list of Minecraft versions that have a bundled LabyMod 4 profile
   */
  minecraftVersions: Array<{
    tag: string
    version: string
  }>
}

export interface WindowController extends GenericEventEmitter<WindowControllerEventMap> {
  /**
   * Show current window
   */
  show(): void
  /**
   * Flash the window's frame and taskbar icon
   */
  flashFrame(): void

  focus(): void
  /**
   * Hide current window
   */
  hide(): void

  close(): void
  /**
   * Minimize current window
   */
  minimize(): void
  /**
   * Maximize current window
   */
  maximize(): void
  /**
   * Toggle the window's fullscreen state (F11).
   */
  toggleFullscreen(): void

  openMultiplayerWindow(): void

  launchWild(): Promise<void>

  launchDelta(): Promise<void>

  launchCelestial(): Promise<void>

  launchPulseVisual(): Promise<void>

  launchReallyVisual(): Promise<void>

  launchCabbitVisual(): Promise<void>

  launchEssence(): Promise<void>

  launchLeonWare(): Promise<void>

  launchLiminarPremium(): Promise<void>

  launchSystemDLC(): Promise<void>

  launchRockstar(): Promise<void>
  launchDeadcode(): Promise<void>

  launchNursultan(): Promise<void>

  launchFeverVisual(): Promise<void>

  launchFastVisual(): Promise<void>

  /**
   * Check if a downloadable resource (cheat/visual) is installed locally.
   */
  checkResourceInstalled(id: string): Promise<boolean>

  /**
   * Compare the installed resource archive metadata with the current GitHub
   * release asset. Legacy installs without metadata request one safe refresh.
   */
  checkResourceUpdate(id: string): Promise<{
    installed: boolean
    updateAvailable: boolean
    installedSize: number
    remoteSize: number
    legacy?: boolean
  }>

  /**
   * Download a resource from GitHub Releases. Progress is broadcast via
   * 'download-progress', 'download-done', 'download-error' events.
   */
  downloadResource(id: string): Promise<void>

  /**
   * Cancel an active download for the given resource. The partial file is
   * kept so the next attempt can resume from it.
   */
  cancelDownload(id: string): Promise<void>

  /**
   * Stop an in-progress download and delete the partial file. When no
   * download is active, removes any leftover partial file instead.
   */
  discardDownload(id: string): Promise<void>

  /**
   * Bytes already downloaded into the partial file, 0 when there is none.
   */
  resourcePartialSize(id: string): Promise<number>

  /**
   * Show a native OS notification. Used by the renderer when its window is
   * hidden and an important event (e.g. update ready) must reach the user.
   */
  notifyOs(title: string, body: string): void

  /**
   * Completely remove a downloaded cheat/visual and all of its configuration
   * (resource, game directory, custom mods).
   */
  deleteResource(id: string): Promise<void>

  /**
   * Check GitHub for a newer launcher release.
   */
  checkAppUpdate(): Promise<{
    available: boolean
    version: string
    tag: string
    body: string
    date: string
    current: string
  }>

  /**
   * True when the setup for the given version was already downloaded.
   */
  appUpdateCached(version: string): Promise<boolean>

  /**
   * Download FastLauncher-setup.exe from the latest GitHub release.
   * Progress is reported via 'app-update-progress' events.
   */
  downloadAppUpdate(): Promise<void>

  /**
   * Stop the active update download. The partial file is kept for resume.
   */
  cancelAppUpdate(): Promise<void>

  /**
   * Run the downloaded setup and quit the launcher.
   */
  installAppUpdate(): Promise<void>

  /**
   * Get the resolved resource directory path for a cheat/visual.
   */
  resolveResourceDir(id: string): Promise<string>

  cancelCheat(id: string): Promise<void>

  resolveMediaDir(kind: string, id: string): Promise<string>
  listScreenshots(dir: string): Promise<Array<{ name: string; path: string; size: number; mtime: number }>>
  openMediaPath(path: string): Promise<void>
  deleteMediaFile(path: string): Promise<void>

  openExternal(url: string): Promise<void>

  visualModsList(visualId: string): Promise<Array<{ name: string; path: string; size: number }>>
  visualModsAddFolder(visualId: string): Promise<number>
  visualModsRemove(visualId: string, fileName: string): Promise<void>
  visualModsDownload(visualId: string, url: string, fileName: string): Promise<string>

  cheatModsList(cheatId: string): Promise<Array<{ name: string; path: string; size: number }>>
  cheatModsAddFolder(cheatId: string): Promise<number>
  cheatModsRemove(cheatId: string, fileName: string): Promise<void>
  cheatModsDownload(cheatId: string, url: string, fileName: string): Promise<string>

  /**
   * Install a bundled LabyMod 4 version profile for the given minecraft version.
   * Returns the installed version id.
   */
  installLabyMod4(minecraft: string): Promise<string>

  /**
   * Get the LabyMod 4 manifest derived from the bundled profiles.
   */
  getLabyMod4Manifest(): Promise<LabyMod4Manifest>

  queryAudioPermission(): Promise<boolean>

  writeClipboard(text: string): void

  writeClipboardImage(imageUrl: string): void

  findInPage(text: string, options?: {
    /**
     * Whether to search forward or backward, defaults to `true`.
     */
    forward?: boolean
    /**
     * Whether to begin a new text finding session with this request. Should be `true`
     * for initial requests, and `false` for follow-up requests. Defaults to `false`.
     */
    findNext?: boolean
    /**
     * Whether search should be case-sensitive, defaults to `false`.
     */
    matchCase?: boolean
  }): void

  startProfiling(): void

  stopProfiling(): void

  stopFindInPage(): void

  showOpenDialog(options: OpenDialogOptions): Promise<{
    /**
     * whether or not the dialog was canceled.
     */
    canceled: boolean
    /**
     * An array of file paths chosen by the user. If the dialog is cancelled this will
     * be an empty array.
     */
    filePaths: string[]
    /**
     * An array matching the `filePaths` array of base64 encoded strings which contains
     * security scoped bookmark data. `securityScopedBookmarks` must be enabled for
     * this to be populated. (For return values, see table here.)
     *
     * @platform darwin,mas
     */
    bookmarks?: string[]
  }>
  showSaveDialog(options: SaveDialogOptions): Promise<{
    /**
     * whether or not the dialog was canceled.
     */
    canceled: boolean
    /**
     * If the dialog is canceled, this will be `undefined`.
     */
    filePath?: string
    /**
     * Base64 encoded string which contains the security scoped bookmark data for the
     * saved file. `securityScopedBookmarks` must be enabled for this to be present.
     * (For return values, see table here.)
     *
     * @platform darwin,mas
     */
    bookmark?: string
  }>

  setTranslucent(enable: boolean): void
}
