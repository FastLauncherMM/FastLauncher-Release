import { app as electronApp, BrowserWindow, ipcMain, net } from 'electron'
import type { ClientRequest } from 'electron'
import { spawn } from 'child_process'
import { createWriteStream } from 'fs'
import type { WriteStream } from 'fs'
import { appendFile, mkdir, readdir, rename, rm, stat } from 'fs/promises'
import { join, sep } from 'path'

const REPO = 'FastLauncherMM/FastLauncher-Release'
const ASSET_NAME = 'FastLauncher-setup.exe'
const HEADERS = { 'User-Agent': 'FastLauncher' }

const TAG_RE = /^[0-9a-zA-Z._-]{1,64}$/
const VERSION_RE = /^[0-9]+(\.[0-9]+){0,3}$/

interface LatestRelease {
  tag: string
  version: string
  body: string
  date: string
  size: number
}

/** Download stopped by the user on purpose: the `.part` file is kept for resume. */
class CancelledError extends Error {
  constructor() { super('CANCELLED') }
}

let latest: LatestRelease | null = null

interface ActiveAppDownload {
  request: ClientRequest | null
  cancelled: boolean
}

let activeDownload: ActiveAppDownload | null = null
let downloaded: { version: string; tag: string; path: string } | null = null

function getLogFile() { return join(electronApp.getPath('userData'), 'download-debug.log') }

async function dbg(msg: string) {
  const line = `[${new Date().toISOString()}] [app-update] ${msg}\n`
  try { await appendFile(getLogFile(), line) } catch {}
}

function broadcast(ch: string, ...args: any[]) {
  BrowserWindow.getAllWindows().forEach((w) => {
    try { if (!w.isDestroyed()) w.webContents.send(ch, ...args) } catch {}
  })
}/**
 * Directory the new setup is downloaded into. It is always derived here and
 * never taken from the renderer, so this process can only ever execute a file
 * downloaded into FastLauncher's own user-data root. No update file is created
 * or removed outside the launcher-managed directory.
 */
function getUpdateDir() { return join(electronApp.getPath('userData'), 'updates', 'launcher') }

function getSetupPath(tag: string) {
  if (!TAG_RE.test(tag)) throw new Error('Invalid release tag: ' + tag)
  return join(getUpdateDir(), tag, ASSET_NAME)
}

function normalizeVersion(v: string) {
  return v.replace(/^v/i, '').trim()
}

function parseVersion(v: string): number[] {
  return normalizeVersion(v)
    .split('.')
    .map((x) => parseInt(x, 10))
    .map((n) => (Number.isFinite(n) ? n : 0))
}

/** true when `a` is a strictly newer release than `b` (2.2.1 > 2.2.0 > 2.2). */
function isNewerVersion(a: string, b: string) {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

async function fetchJson(url: string): Promise<any> {
  const res = await net.fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

/** Query GitHub for the latest published release of the launcher repo. */
async function fetchLatest(): Promise<LatestRelease> {
  const release = await fetchJson(`https://api.github.com/repos/${REPO}/releases/latest`)
  const tag = String(release.tag_name ?? '')
  if (!TAG_RE.test(tag)) throw new Error('Bad release tag: ' + tag)
  const version = normalizeVersion(tag)
  const asset = (release.assets ?? []).find((a: any) => String(a.name).toLowerCase() === ASSET_NAME.toLowerCase())
  if (!asset) throw new Error(ASSET_NAME + ' not found in ' + tag)
  return {
    tag,
    version,
    body: String(release.body ?? ''),
    date: String(release.published_at ?? new Date().toISOString()),
    size: Number(asset.size) || 0,
  }
}

/**
 * Download `url` into `partPath`, resuming from the bytes already present.
 * Mirrors the cheat download flow: cancel/error keeps the `.part` file so the
 * next attempt continues instead of starting over.
 */
async function downloadFile(url: string, partPath: string, expectedSize: number, finalPath: string): Promise<void> {
  let existing = 0
  try { existing = (await stat(partPath)).size } catch {}
  if (expectedSize > 0 && existing > expectedSize) {
    await rm(partPath, { force: true })
    existing = 0
  }
  if (existing > 0 && expectedSize > 0 && existing === expectedSize) {
    await rename(partPath, finalPath)
    return
  }
  if (existing > 0 && expectedSize > 0) {
    broadcast('app-update-progress', {
      percent: Math.min(99, Math.round((existing / expectedSize) * 100)),
      bytes: existing,
      total: expectedSize,
      rateBytes: 0,
    })
  }

  await new Promise<void>((resolve, reject) => {
    const state: ActiveAppDownload = { request: null, cancelled: false }
    activeDownload = state

    let settled = false
    let stream: WriteStream | null = null

    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      state.request = null
      activeDownload = null
      if (err) {
        try { stream?.destroy() } catch {}
        reject(err)
      } else {
        resolve()
      }
    }

    let request: ClientRequest
    try {
      request = net.request({ url })
    } catch (err: any) {
      finish(err instanceof Error ? err : new Error(String(err)))
      return
    }
    state.request = request

    let total = expectedSize
    let downloadedBytes = existing
    let tickAt = Date.now()
    let tickBytes = existing

    if (existing > 0) request.setHeader('Range', 'bytes=' + existing + '-')

    request.on('response', (response) => {
      const status = response.statusCode
      const isResume = status === 206 && existing > 0
      dbg('app setup response: ' + status + (isResume ? ' (resume from ' + existing + ')' : ''))
      if (status !== 200 && !isResume) {
        ;(response as any).resume()
        finish(new Error('HTTP ' + status))
        return
      }

      const len = Number((response.headers as any)['content-length'] ?? 0) || 0
      if (isResume) {
        total = existing + len
      } else if (len > 0) {
        total = len
        downloadedBytes = 0
        tickBytes = 0
      }

      stream = createWriteStream(partPath, { flags: isResume ? 'a' : 'w' })
      stream.on('error', (err) => finish(err))

      response.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length
        const now = Date.now()
        if (now - tickAt >= 200) {
          const seconds = Math.max(0.2, (now - tickAt) / 1000)
          const rate = (downloadedBytes - tickBytes) / seconds
          const pct = total > 0 ? Math.min(99, Math.round((downloadedBytes / total) * 100)) : 0
          broadcast('app-update-progress', {
            percent: pct,
            bytes: downloadedBytes,
            total,
            rateBytes: Math.round(rate),
          })
          tickAt = now
          tickBytes = downloadedBytes
        }
      })

      response.on('error', (err: Error) => finish(state.cancelled ? new CancelledError() : err))
      response.on('aborted', () => finish(state.cancelled ? new CancelledError() : new Error('Соединение прервано')))

      ;(response as any).pipe(stream)

      stream.on('finish', () => {
        void (async () => {
          try {
            const s = await stat(partPath)
            if (expectedSize > 0 && s.size !== expectedSize) {
              finish(new Error('Размер файла не совпадает: ' + s.size + ' из ' + expectedSize))
              return
            }
            await rename(partPath, finalPath)
            finish()
          } catch (err: any) {
            finish(err instanceof Error ? err : new Error(String(err)))
          }
        })()
      })
    })

    request.on('error', (err) => finish(state.cancelled ? new CancelledError() : err))
    request.end()
  })
}

export function registerAppUpdateHandlers() {
  dbg('registerAppUpdateHandlers called')

  /** Check GitHub for a newer release. Throws on network errors. */
  ipcMain.handle('app-update:check', async () => {
    const current = electronApp.getVersion()
    const rel = await fetchLatest()
    latest = rel
    const available = isNewerVersion(rel.version, current)
    dbg('check: current=' + current + ' latest=' + rel.tag + ' available=' + available)
    return {
      available,
      version: rel.version,
      tag: rel.tag,
      body: rel.body,
      date: rel.date,
      current,
    }
  })

  /** True when the setup for `version` is already downloaded (survives restart). */
  ipcMain.handle('app-update:cached', async (_e, version: string) => {
    if (typeof version !== 'string' || !VERSION_RE.test(version)) return false
    const root = getUpdateDir()
    let tags: string[] = []
    try { tags = await readdir(root) } catch { return false }
    for (const tag of tags) {
      if (!TAG_RE.test(tag) || normalizeVersion(tag) !== version) continue
      const path = getSetupPath(tag)
      try {
        const s = await stat(path)
        if (!s.isFile() || s.size <= 0) continue
        downloaded = { version, tag, path }
        dbg('cached setup found: ' + path + ' (' + s.size + ' bytes)')
        return true
      } catch {}
    }
    return false
  })

  /**
   * Download FastLauncher-setup.exe from the latest GitHub release.
   * Progress is reported through the 'app-update-progress' event.
   */
  ipcMain.handle('app-update:download', async () => {
    if (activeDownload) throw new Error('Загрузка уже идёт')
    const rel = latest ?? (await fetchLatest())
    latest = rel
    const tag = rel.tag
    const finalPath = getSetupPath(tag)
    const partPath = finalPath + '.part'
    const url = `https://github.com/${REPO}/releases/download/${tag}/${ASSET_NAME}`

    await mkdir(join(getUpdateDir(), tag), { recursive: true })
    dbg('downloading ' + url)
    broadcast('app-update-progress', { percent: 0, bytes: 0, total: rel.size, rateBytes: 0 })

    try {
      await downloadFile(url, partPath, rel.size, finalPath)
    } catch (e: any) {
      if (e instanceof CancelledError) {
        dbg('download cancelled; partial file kept')
        broadcast('app-update-cancelled', {})
        return
      }
      const msg = e?.message ?? String(e)
      dbg('download failed: ' + msg)
      broadcast('app-update-error', { message: msg })
      throw e
    }

    downloaded = { version: rel.version, tag, path: finalPath }
    dbg('download done: ' + finalPath)
    broadcast('app-update-done', { version: rel.version })
  })

  /** Stop the active update download. The partial file is kept for resume. */
  ipcMain.handle('app-update:cancel', () => {
    const st = activeDownload
    if (!st) return
    dbg('cancel requested')
    st.cancelled = true
    try { st.request?.abort() } catch {}
  })

  /**
   * Launch the downloaded setup. The path is never taken from the renderer:
   * only the file downloaded into the launcher's own update folder is executed.
   */
  ipcMain.handle('app-update:install', async () => {
    if (!downloaded) throw new Error('Обновление ещё не скачано')
    const path = downloaded.path
    const expectedDir = join(getUpdateDir(), downloaded.tag) + sep
    if (!path.startsWith(expectedDir) || !path.endsWith(ASSET_NAME)) {
      throw new Error('Unsafe update path')
    }
    const s = await stat(path).catch(() => null)
    if (!s || !s.isFile() || s.size <= 0) throw new Error('Установщик не найден')
    dbg('installing ' + path)
    const child = spawn(path, ['--updated', '--force-run'], {
      detached: true,
      stdio: 'ignore',
    })
    // Only quit once the setup process really started, so a blocked
    // installer (antivirus, permissions) leaves the launcher open with the
    // error instead of closing with nothing happening.
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', () => resolve())
      child.once('error', (err) => reject(err))
    })
    child.unref()
    dbg('setup spawned; quitting launcher')
    setTimeout(() => { try { electronApp.quit() } catch {} }, 300)
  })
}
