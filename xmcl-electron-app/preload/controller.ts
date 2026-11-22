import type { WindowController } from '@xmcl/runtime-api'
import { contextBridge, ipcRenderer, clipboard } from 'electron'
import EventEmitter from 'events'

export enum Operation {
  Minimize = 0,
  Maximize = 1,
  Hide = 2,
  Show = 3,
  Close = 4,
}

function createController(): WindowController {
  function show() {
    return ipcRenderer.invoke('control', Operation.Show)
  }
  function close() {
    return ipcRenderer.invoke('control', Operation.Close)
  }
  function hide() {
    return ipcRenderer.invoke('control', Operation.Hide)
  }
  function minimize() {
    return ipcRenderer.invoke('control', Operation.Minimize)
  }
  function maximize() {
    ipcRenderer.invoke('control', Operation.Maximize)
  }
  function toggleFullscreen() {
    ipcRenderer.invoke('toggle-fullscreen')
  }
  function flashFrame() {
    ipcRenderer.invoke('flash-frame')
  }
  function focus() {
    ipcRenderer.invoke('focus')
  }
  ipcRenderer.on('maximize', (_, v) => {
    emitter.emit('maximize', v)
  })
  ipcRenderer.on('minimize', (_, v) => {
    emitter.emit('minimize', v)
  })
  ipcRenderer.on('cheat-exited', (_, id) => {
    emitter.emit('cheat-exited', id)
  })
  ipcRenderer.on('cheat-error', (_, data) => {
    emitter.emit('cheat-error', data)
  })
  ipcRenderer.on('download-progress', (_, data) => {
    emitter.emit('download-progress', data)
  })
  ipcRenderer.on('download-done', (_, data) => {
    emitter.emit('download-done', data)
  })
  ipcRenderer.on('download-error', (_, data) => {
    emitter.emit('download-error', data)
  })
  ipcRenderer.on('download-cancelled', (_, data) => {
    emitter.emit('download-cancelled', data)
  })
  ipcRenderer.on('app-flash', (_, data) => {
    emitter.emit('app-flash', data)
  })
  ipcRenderer.on('app-update-progress', (_, data) => {
    emitter.emit('app-update-progress', data)
  })
  ipcRenderer.on('app-update-done', (_, data) => {
    emitter.emit('app-update-done', data)
  })
  ipcRenderer.on('app-update-error', (_, data) => {
    emitter.emit('app-update-error', data)
  })
  ipcRenderer.on('app-update-cancelled', (_, data) => {
    emitter.emit('app-update-cancelled', data)
  })
  const emitter = new EventEmitter()

  const writeClipboard =
    clipboard && clipboard.writeText && typeof clipboard.writeText === 'function'
      ? (text: string) => clipboard.writeText(text)
      : (text: string) => ipcRenderer.invoke('write-clipboard', text)

  const writeClipboardImage = (imageUrl: string) => {
    ipcRenderer.invoke('write-clipboard-image', imageUrl)
  }

  return {
    on(channel, listener) {
      emitter.on(channel, listener)
      return this
    },
    writeClipboardImage,
    writeClipboard,
    queryAudioPermission: () => ipcRenderer.invoke('query-audio-permission'),
    openMultiplayerWindow: () => ipcRenderer.invoke('open-multiplayer-window'),
    launchWild: () => ipcRenderer.invoke('launch-wild'),
    launchDelta: () => ipcRenderer.invoke('launch-delta'),
    launchCelestial: () => ipcRenderer.invoke('launch-celestial'),
    launchPulseVisual: () => ipcRenderer.invoke('launch-pulsevisual'),
    launchReallyVisual: () => ipcRenderer.invoke('launch-reallyvisual'),
    launchCabbitVisual: () => ipcRenderer.invoke('launch-cabbitvisual'),
    launchEssence: () => ipcRenderer.invoke('launch-essence'),
    launchLeonWare: () => ipcRenderer.invoke('launch-leonware'),
    launchLiminarPremium: () => ipcRenderer.invoke('launch-liminarpremium'),
    launchSystemDLC: () => ipcRenderer.invoke('launch-systemdlc'),
    launchRockstar: () => ipcRenderer.invoke('launch-rockstar'),
    launchDeadcode: () => ipcRenderer.invoke('launch-deadcode'),
    launchNursultan: () => ipcRenderer.invoke('launch-nursultan'),
    launchFeverVisual: () => ipcRenderer.invoke('launch-fevervisual'),
    launchFastVisual: () => ipcRenderer.invoke('launch-fastvisual'),
    resolveMediaDir: (kind: string, id: string) => ipcRenderer.invoke('media:resolve-dir', kind, id),
    listScreenshots: (dir: string) => ipcRenderer.invoke('media:list-screenshots', dir),
    openMediaPath: (p: string) => ipcRenderer.invoke('media:open-path', p),
    deleteMediaFile: (p: string) => ipcRenderer.invoke('media:delete-file', p),
    openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
    visualModsList: (id: string) => ipcRenderer.invoke('visual-mods:list', id),
    visualModsAddFolder: (id: string) => ipcRenderer.invoke('visual-mods:add-folder', id),
    visualModsRemove: (id: string, fileName: string) => ipcRenderer.invoke('visual-mods:remove', id, fileName),
    visualModsDownload: (id: string, url: string, fileName: string) => ipcRenderer.invoke('visual-mods:download', id, url, fileName),
    cheatModsList: (id: string) => ipcRenderer.invoke('cheat-mods:list', id),
    cheatModsAddFolder: (id: string) => ipcRenderer.invoke('cheat-mods:add-folder', id),
    cheatModsRemove: (id: string, fileName: string) => ipcRenderer.invoke('cheat-mods:remove', id, fileName),
    cheatModsDownload: (id: string, url: string, fileName: string) => ipcRenderer.invoke('cheat-mods:download', id, url, fileName),
    cancelCheat: (id: string) => ipcRenderer.invoke('cancel-cheat', id),
    checkResourceInstalled: (id: string) => ipcRenderer.invoke('check-resource-installed', id),
    checkResourceUpdate: (id: string) => ipcRenderer.invoke('check-resource-update', id),
    downloadResource: (id: string) => ipcRenderer.invoke('download-resource', id),
    cancelDownload: (id: string) => ipcRenderer.invoke('cancel-download', id),
    discardDownload: (id: string) => ipcRenderer.invoke('discard-download', id),
    resourcePartialSize: (id: string) => ipcRenderer.invoke('resource-partial-size', id),
    notifyOs: (title: string, body: string) => ipcRenderer.invoke('notify-os', title, body),
    deleteResource: (id: string) => ipcRenderer.invoke('delete-resource', id),
    resolveResourceDir: (id: string) => ipcRenderer.invoke('resolve-resource-dir', id),
    checkAppUpdate: () => ipcRenderer.invoke('app-update:check'),
    appUpdateCached: (version: string) => ipcRenderer.invoke('app-update:cached', version),
    downloadAppUpdate: () => ipcRenderer.invoke('app-update:download'),
    cancelAppUpdate: () => ipcRenderer.invoke('app-update:cancel'),
    installAppUpdate: () => ipcRenderer.invoke('app-update:install'),
    installLabyMod4: (minecraft: string) => ipcRenderer.invoke('install-labymod4', minecraft),
    getLabyMod4Manifest: () => ipcRenderer.invoke('get-labymod4-manifest'),
    setTranslucent(enable) {
      ipcRenderer.invoke('set-translucent', enable)
    },
    once(channel, listener) {
      emitter.once(channel, listener)
      return this
    },
    removeListener(channel, listener) {
      emitter.removeListener(channel, listener)
      return this
    },
    focus,
    flashFrame,
    minimize,
    maximize,
    toggleFullscreen,
    show,
    close,
    hide,
    showOpenDialog(...options: any[]) {
      return ipcRenderer.invoke('dialog:showOpenDialog', ...options)
    },
    showSaveDialog(...options: any[]) {
      return ipcRenderer.invoke('dialog:showSaveDialog', ...options)
    },
    findInPage(text, options) {
      return ipcRenderer.invoke('find-in-page', text, options)
    },
    stopFindInPage() {
      return ipcRenderer.invoke('stop-find-in-page')
    },
    startProfiling() {
      return ipcRenderer.invoke('start-profiling')
    },
    stopProfiling() {
      return ipcRenderer.invoke('stop-profiling')
    },
  }
}

contextBridge.exposeInMainWorld('windowController', createController())
