import { app, BrowserWindow, Notification, nativeImage } from 'electron'
import { join } from 'path'

export type AppFlashKind = 'download-done' | 'download-error' | 'download-cancelled' | 'game-exit'

export interface AppFlashPayload {
  kind: AppFlashKind
  id?: string
  durationMs?: number
  sizeBytes?: number
  message?: string
}

export function broadcastToWindows(channel: string, ...args: any[]) {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (w.isDestroyed()) return
    try { w.webContents.send(channel, ...args) } catch {}
  })
}

let cachedIcon: Electron.NativeImage | null | undefined

function getAppIcon(): Electron.NativeImage | null {
  if (cachedIcon !== undefined) return cachedIcon
  try {
    const icon = nativeImage.createFromPath(join(app.getAppPath(), 'dist', 'dark@256x256.png'))
    cachedIcon = icon.isEmpty() ? null : icon
  } catch {
    cachedIcon = null
  }
  return cachedIcon
}

export function showOsNotification(title: string, body: string) {
  try {
    if (!Notification.isSupported()) return
    const icon = getAppIcon()
    new Notification({ title, body, ...(icon ? { icon } : {}) }).show()
  } catch {
    // never let a notification failure break the launcher flow
  }
}

/**
 * Show a rich, animated toast inside the launcher when any of its windows is
 * visible; fall back to a native Windows notification when the launcher is
 * hidden or minimized (e.g. the user is in game).
 */
export function flashOrNotify(payload: AppFlashPayload, os: { title: string; body: string }) {
  const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed())
  const visible = wins.some((w) => w.isVisible() && !w.isMinimized())
  if (visible) {
    wins.forEach((w) => {
      try { w.webContents.send('app-flash', payload) } catch {}
    })
  } else {
    showOsNotification(os.title, os.body)
  }
}

/** Human-readable resource names for notifications. Falls back to the raw id. */
export const RESOURCE_LABELS: Record<string, string> = {
  wild: 'Wild',
  celestial: 'Celestial',
  deadcode: 'DeadCode',
  nursultan: 'Nursultan',
  delta: 'Delta',
  pulsevisual: 'Pulse Visual',
  reallyvisual: 'Really Visual',
  cabbitvisual: 'Cabbit Visual',
  essence: 'Essence',
  leonware: 'LeonWare',
  liminarpremium: 'Liminar Premium',
  systemdlc: 'System DLC',
  rockstar: 'RockStar',
  fevervisual: 'Fever Visual',
  fastvisual: 'FastVisual',
}

export function resourceLabel(id: string, explicit?: string) {
  if (explicit) return explicit
  return RESOURCE_LABELS[id.toLowerCase()] ?? id
}
