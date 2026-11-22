import { app as electronApp, BrowserWindow, ipcMain, net } from 'electron'
import type { ClientRequest } from 'electron'
import { appendFile, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'fs/promises'
import { createReadStream, createWriteStream } from 'fs'
import type { WriteStream } from 'fs'
import { createHash } from 'crypto'
import { dirname, isAbsolute, join, relative, resolve } from 'path'
import { execFile } from 'child_process'
import https from 'https'
import http from 'http'
import { flashOrNotify, resourceLabel, showOsNotification } from './notifications'

interface ActiveDownload {
  request: ClientRequest | null
  cancelled: boolean
  /** When set, the partial .part/.zip files are removed once the transfer stops. */
  discard: boolean
}

interface ResourceAsset {
  id: number
  name: string
  url: string
  size: number
  checksumUrl?: string
  checksum?: string
  updatedAt: string
}

interface ResourceInstallMetadata {
  schemaVersion: 1
  resourceId: string
  assetId: number
  assetName: string
  assetSize: number
  assetDigest?: string
  assetUpdatedAt: string
  installedAt: string
}

interface PartialMetadata {
  assetId: number
  assetSize: number
  assetDigest?: string
}

const activeDownloads = new Map<string, ActiveDownload>()

const RESOURCE_ID_RE = /^[a-z0-9-]{1,64}$/
const RESOURCE_META_FILE = '.fastlauncher-resource.json'
const PART_META_SUFFIX = '.zip.part.json'
const RELEASE_CACHE_MS = 60_000

const PRESERVED_DIRECTORY_NAMES = new Set([
  'main',
  'config',
  'configs',
  'resourcepacks',
  'shaderpacks',
  'saves',
  'screenshots',
])

const PRESERVED_FILE_NAMES = new Set([
  'options.txt',
  'optionsof.txt',
  'servers.dat',
  'servers.dat_old',
  'hotbar.nbt',
])

function getLogFile() { return join(electronApp.getPath('userData'), 'download-debug.log') }

async function dbg(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { await appendFile(getLogFile(), line) } catch {}
}

function broadcast(ch: string, ...args: any[]) {
  BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send(ch, ...args) } catch {} })
}

function getResourcesRoot() { return join(electronApp.getPath('userData'), 'resources') }

function getResourceDir(id: string) { return join(getResourcesRoot(), id) }

function normalizeResourceId(rawId: unknown): string {
  const id = String(rawId ?? '').toLowerCase()
  if (!RESOURCE_ID_RE.test(id)) throw new Error('Invalid resource id: ' + String(rawId))
  return id
}

function assertInside(root: string, target: string) {
  const rel = relative(resolve(root), resolve(target))
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('Unsafe resource path')
  }
}

async function isResourceInstalled(id: string): Promise<boolean> {
  const dir = getResourceDir(id)
  try {
    const s = await stat(dir)
    if (!s.isDirectory()) return false
    return (await readdir(dir)).some((name) => name !== RESOURCE_META_FILE)
  } catch {
    return false
  }
}

async function readInstallMetadata(id: string): Promise<ResourceInstallMetadata | null> {
  try {
    const parsed = JSON.parse(await readFile(join(getResourceDir(id), RESOURCE_META_FILE), 'utf-8')) as ResourceInstallMetadata
    if (parsed.schemaVersion !== 1 || parsed.resourceId !== id || !Number.isFinite(parsed.assetSize)) return null
    return parsed
  } catch {
    return null
  }
}

function formatSize(b: number) {
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'
  return (b / 1073741824).toFixed(1) + ' GB'
}

function httpGetJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, { timeout: 30000, headers: { 'User-Agent': 'FastLauncher/2.0' } }, (res: any) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode)); return }
      let d = ''
      res.on('data', (c: Buffer) => { d += c })
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch { reject(new Error('Bad JSON')) } })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

function httpGetText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, { timeout: 30000, headers: { 'User-Agent': 'FastLauncher/2.0' } }, (res: any) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode)); return }
      let d = ''
      res.on('data', (c: Buffer) => { if (d.length < 4096) d += c.toString() })
      res.on('end', () => resolve(d))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('data', (c) => hash.update(c))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject)
  })
}

/** Resource ids whose release asset file name differs from `<id>.zip`. */
const ASSET_NAME_ALIASES: Record<string, string> = {
  deadcode: 'DeadCodeSixSeven',
  nursultan: 'NursultanClient-fixed',
  fastvisual: 'FastVisual',
}

let releaseAssetsCache: { expiresAt: number; assets: any[] } | null = null
let releaseAssetsPromise: Promise<any[]> | null = null

async function getReleaseAssets(): Promise<any[]> {
  if (releaseAssetsCache && releaseAssetsCache.expiresAt > Date.now()) return releaseAssetsCache.assets
  if (!releaseAssetsPromise) {
    releaseAssetsPromise = httpGetJson('https://api.github.com/repos/FastLauncherMM/cheat/releases/tags/cheats')
      .then((release) => {
        const assets = Array.isArray(release?.assets) ? release.assets : []
        releaseAssetsCache = { expiresAt: Date.now() + RELEASE_CACHE_MS, assets }
        return assets
      })
      .finally(() => { releaseAssetsPromise = null })
  }
  return releaseAssetsPromise
}

async function resolveUrl(id: string): Promise<ResourceAsset> {
  const assets = await getReleaseAssets()
  const assetBase = ASSET_NAME_ALIASES[id.toLowerCase()] ?? id
  const asset = assets.find((a: any) => String(a.name).toLowerCase() === assetBase.toLowerCase() + '.zip')
  if (!asset) throw new Error(id + '.zip not found')
  const checksumAsset = assets.find((a: any) => String(a.name).toLowerCase() === String(asset.name).toLowerCase() + '.sha256')
  const digestMatch = typeof asset.digest === 'string'
    ? asset.digest.match(/^sha256:([a-fA-F0-9]{64})$/)
    : null
  return {
    id: Number(asset.id) || 0,
    name: String(asset.name),
    url: asset.browser_download_url as string,
    size: (asset.size as number) || 0,
    checksumUrl: checksumAsset ? (checksumAsset.browser_download_url as string) : undefined,
    checksum: digestMatch?.[1],
    updatedAt: String(asset.updated_at ?? ''),
  }
}

function installMetadata(id: string, asset: ResourceAsset): ResourceInstallMetadata {
  return {
    schemaVersion: 1,
    resourceId: id,
    assetId: asset.id,
    assetName: asset.name,
    assetSize: asset.size,
    assetDigest: asset.checksum,
    assetUpdatedAt: asset.updatedAt,
    installedAt: new Date().toISOString(),
  }
}

function partialMatchesAsset(meta: PartialMetadata | null, asset: ResourceAsset) {
  if (!meta) return false
  if (meta.assetId > 0 && asset.id > 0 && meta.assetId !== asset.id) return false
  if (meta.assetSize !== asset.size) return false
  if (meta.assetDigest && asset.checksum && meta.assetDigest.toLowerCase() !== asset.checksum.toLowerCase()) return false
  return true
}

async function preparePartialDownload(id: string, asset: ResourceAsset, partPath: string) {
  const metaPath = join(getResourcesRoot(), id + PART_META_SUFFIX)
  let meta: PartialMetadata | null = null
  try { meta = JSON.parse(await readFile(metaPath, 'utf-8')) as PartialMetadata } catch {}
  const partExists = await stat(partPath).then((s) => s.isFile()).catch(() => false)
  if (partExists && !partialMatchesAsset(meta, asset)) {
    await rm(partPath, { force: true })
    await dbg('Discarded stale partial download for ' + id)
  }
  await writeFile(metaPath, JSON.stringify({
    assetId: asset.id,
    assetSize: asset.size,
    assetDigest: asset.checksum,
  } satisfies PartialMetadata))
}

function psQuote(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

/** Extract only into a caller-owned staging directory. */
function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((ok, fail) => {
    execFile('powershell', [
      '-NoProfile', '-Command',
      `$ProgressPreference = 'SilentlyContinue'; Expand-Archive -LiteralPath ${psQuote(zipPath)} -DestinationPath ${psQuote(destDir)} -Force`,
    ], { timeout: 300_000, windowsHide: true }, (err) => { if (err) fail(err); else ok() })
  })
}

async function findProfileRoot(root: string): Promise<string | null> {
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (await stat(join(current.dir, 'mods')).then((s) => s.isDirectory()).catch(() => false)
      || await stat(join(current.dir, 'instance.json')).then((s) => s.isFile()).catch(() => false)) {
      return current.dir
    }
    if (current.depth >= 3) continue
    const entries = await readdir(current.dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.isDirectory()) queue.push({ dir: join(current.dir, entry.name), depth: current.depth + 1 })
    }
  }
  return null
}

/**
 * Preserve player-owned data from an older extracted archive. The updater is
 * intentionally conservative: configs, `main`, worlds, screenshots, resource
 * packs, shaders and Minecraft option files always win over release defaults.
 */
export async function copyPreservedUserData(oldRoot: string, newRoot: string) {
  const copyFrom = async (sourceBase: string, targetBase: string) => {
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > 5) return
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (entry.name === RESOURCE_META_FILE) continue
        const source = join(dir, entry.name)
        const rel = relative(sourceBase, source)
        const target = join(targetBase, rel)
        assertInside(targetBase, target)
        const lower = entry.name.toLowerCase()
        if (entry.isDirectory() && PRESERVED_DIRECTORY_NAMES.has(lower)) {
          await mkdir(dirname(target), { recursive: true })
          await cp(source, target, { recursive: true, force: true })
          continue
        }
        if (entry.isFile() && PRESERVED_FILE_NAMES.has(lower)) {
          await mkdir(dirname(target), { recursive: true })
          await cp(source, target, { force: true })
          continue
        }
        if (entry.isDirectory()) await walk(source, depth + 1)
      }
    }
    await walk(sourceBase, 0)
  }

  await copyFrom(oldRoot, newRoot)
  const [oldProfile, newProfile] = await Promise.all([findProfileRoot(oldRoot), findProfileRoot(newRoot)])
  if (oldProfile && newProfile && relative(oldRoot, oldProfile) !== relative(newRoot, newProfile)) {
    await copyFrom(oldProfile, newProfile)
  }
}

async function recoverInterruptedInstall(id: string) {
  const root = getResourcesRoot()
  const resourceDir = getResourceDir(id)
  const backupDir = join(root, `.${id}.backup`)
  assertInside(root, resourceDir)
  assertInside(root, backupDir)
  const [resourceExists, backupExists] = await Promise.all([
    stat(resourceDir).then(() => true).catch(() => false),
    stat(backupDir).then(() => true).catch(() => false),
  ])
  if (!resourceExists && backupExists) {
    await rename(backupDir, resourceDir)
    await dbg('Recovered interrupted install for ' + id)
  } else if (resourceExists && backupExists) {
    await rm(backupDir, { recursive: true, force: true }).catch(() => {})
  }
}

/** Swap a verified extraction into place without exposing a half-written pack. */
async function installExtractedResource(id: string, zipPath: string, asset: ResourceAsset) {
  const root = getResourcesRoot()
  const resourceDir = getResourceDir(id)
  const stagingDir = join(root, `.${id}.staging`)
  const backupDir = join(root, `.${id}.backup`)
  for (const target of [resourceDir, stagingDir, backupDir, zipPath]) assertInside(root, target)

  await recoverInterruptedInstall(id)
  await rm(stagingDir, { recursive: true, force: true })
  await mkdir(stagingDir, { recursive: true })

  try {
    await extractZip(zipPath, stagingDir)
    if ((await readdir(stagingDir)).length === 0) throw new Error('Архив пуст')
    if (await isResourceInstalled(id)) {
      await copyPreservedUserData(resourceDir, stagingDir)
    }
    await writeFile(join(stagingDir, RESOURCE_META_FILE), JSON.stringify(installMetadata(id, asset), null, 2))

    await rm(backupDir, { recursive: true, force: true })
    let oldMoved = false
    try {
      if (await stat(resourceDir).then(() => true).catch(() => false)) {
        await rename(resourceDir, backupDir)
        oldMoved = true
      }
      await rename(stagingDir, resourceDir)
    } catch (error) {
      if (oldMoved && !await stat(resourceDir).then(() => true).catch(() => false)) {
        await rename(backupDir, resourceDir).catch(() => {})
      }
      throw error
    }
    await rm(backupDir, { recursive: true, force: true })
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

/**
 * Download `url` into `partPath`, resuming from the bytes already there.
 * The partial file is kept on cancel/network failure so the next attempt
 * continues instead of starting over. Extracts nothing: the caller does.
 */
async function downloadFile(
  url: string,
  partPath: string,
  expectedSize: number,
  checksumUrl: string | undefined,
  expectedChecksum: string | undefined,
  id: string,
  state: ActiveDownload,
): Promise<{ durationMs: number; sizeBytes: number }> {
  let existing = 0
  try { existing = (await stat(partPath)).size } catch {}
  if (expectedSize > 0 && existing > expectedSize) {
    await rm(partPath, { force: true })
    existing = 0
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    let settled = false

    const finish = (err?: Error, result?: { durationMs: number; sizeBytes: number }) => {
      if (settled) return
      settled = true
      state.request = null
      if (err) reject(err)
      else resolve(result!)
    }

    const failWith = (err: Error) => {
      finish(state.cancelled ? new Error('CANCELLED') : err)
    }

    /** Verify size + optional checksum, then resolve. Keeps the .part on a
     *  short/ interrupted file (it can be resumed), deletes it only when the
     *  file is provably corrupt (checksum mismatch or oversized). */
    const complete = async () => {
      try {
        const s = await stat(partPath).catch(() => null)
        if (!s) { failWith(new Error('Downloaded file missing')); return }
        if (expectedSize > 0 && s.size < expectedSize) {
          failWith(new Error('Соединение прервано: получено ' + formatSize(s.size) + ' из ' + formatSize(expectedSize)))
          return
        }
        if (expectedSize > 0 && s.size > expectedSize) {
          await rm(partPath, { force: true })
          failWith(new Error('Размер файла не совпадает с ожидаемым'))
          return
        }
        let checksum = expectedChecksum
        if (!checksum && checksumUrl) {
          try {
            const text = await httpGetText(checksumUrl)
            const m = text.match(/[a-fA-F0-9]{64}/)
            checksum = m?.[0]
          } catch (e: any) {
            dbg('Checksum check skipped for ' + id + ': ' + (e?.message ?? e))
          }
        }
        if (checksum) {
          const actual = await sha256File(partPath)
          if (actual.toLowerCase() !== checksum.toLowerCase()) {
            dbg('Checksum mismatch for ' + id + ': ' + actual + ' != ' + checksum)
            await rm(partPath, { force: true })
            failWith(new Error('Файл повреждён: не совпала контрольная сумма. Скачайте заново.'))
            return
          }
          dbg('Checksum OK for ' + id)
        }
        finish(undefined, { durationMs: Date.now() - startedAt, sizeBytes: s.size })
      } catch (err: any) {
        failWith(err instanceof Error ? err : new Error(String(err)))
      }
    }

    const attempt = (tryResumeFrom: number) => {
      if (settled) return
      if (state.cancelled) { finish(new Error('CANCELLED')); return }
      try {
        const request = net.request({ url })
        state.request = request

        let stream: WriteStream | null = null
        let streamEnded = false
        let resuming = tryResumeFrom > 0
        let downloaded = tryResumeFrom
        let tickAt = Date.now()
        let tickBytes = tryResumeFrom

        if (resuming) request.setHeader('Range', 'bytes=' + tryResumeFrom + '-')

        const closeStream = (then: () => void) => {
          if (stream && !streamEnded) {
            streamEnded = true
            stream.end(() => then())
            return
          }
          then()
        }

        request.on('response', (response) => {
          const status = response.statusCode
          dbg('Response status: ' + status + (tryResumeFrom > 0 ? ' (resume from ' + tryResumeFrom + ')' : ''))

          if (status === 416) {
            ;(response as any).resume()
            void (async () => {
              const s = await stat(partPath).catch(() => null)
              if (tryResumeFrom > 0 && expectedSize > 0 && s && s.size === expectedSize) {
                // The local file already holds the full resource.
                await complete()
                return
              }
              await rm(partPath, { force: true })
              dbg('HTTP 416: restarting download from scratch')
              attempt(0)
            })()
            return
          }

          const isResume = status === 206 && resuming
          if (status !== 200 && !isResume) {
            ;(response as any).resume()
            failWith(new Error('HTTP ' + status))
            return
          }

          if (isResume) {
            const cr = String((response.headers as any)['content-range'] ?? '')
            const m = cr.match(/bytes\s+(\d+)-/i)
            if (m && Number(m[1]) !== tryResumeFrom) {
              dbg('Content-Range start mismatch (' + m[1] + ' != ' + tryResumeFrom + '); restarting')
              resuming = false
            }
          } else if (tryResumeFrom > 0) {
            dbg('Server ignored Range; restarting from scratch')
            resuming = false
          }

          if (resuming) {
            downloaded = tryResumeFrom
            tickBytes = tryResumeFrom
          } else {
            downloaded = 0
            tickBytes = 0
          }

          stream = createWriteStream(partPath, { flags: resuming ? 'a' : 'w' })
          stream.once('finish', () => { streamEnded = true })

          response.on('data', (chunk: Buffer) => {
            downloaded += chunk.length
            const now = Date.now()
            if (now - tickAt >= 200) {
              const seconds = Math.max(0.2, (now - tickAt) / 1000)
              const rate = (downloaded - tickBytes) / seconds
              const total = expectedSize || 0
              const pct = total > 0 ? Math.min(99, Math.round((downloaded / total) * 100)) : 0
              broadcast('download-progress', {
                id,
                percent: pct,
                speed: formatSize(downloaded) + ' / ' + formatSize(total),
                bytes: downloaded,
                total,
                rate: formatSize(rate) + '/с',
                rateBytes: Math.round(rate),
              })
              tickAt = now
              tickBytes = downloaded
            }
          })

          ;(response as any).pipe(stream)

          response.on('error', (err: Error) => { closeStream(() => failWith(err)) })
          response.on('aborted', () => { closeStream(() => failWith(new Error('Соединение прервано'))) })
          response.on('end', () => {
            if (!stream || stream.writableFinished) { void complete(); return }
            stream.once('finish', () => { void complete() })
          })
        })

        request.on('error', (err) => { closeStream(() => failWith(err)) })

        request.end()
      } catch (err: any) {
        failWith(err instanceof Error ? err : new Error(String(err)))
      }
    }

    if (existing > 0 && expectedSize > 0 && existing === expectedSize) {
      // Already fully downloaded earlier; just verify and finish.
      void complete()
      return
    }

    if (existing > 0 && expectedSize > 0) {
      const pct = Math.min(99, Math.round((existing / expectedSize) * 100))
      broadcast('download-progress', {
        id,
        percent: pct,
        speed: 'Продолжаем: ' + formatSize(existing) + ' / ' + formatSize(expectedSize),
        bytes: existing,
        total: expectedSize,
        rate: '',
      })
    }

    attempt(existing)
  })
}

export function registerDownloadHandlers() {
  dbg('registerDownloadHandlers called')

  ipcMain.handle('resource-dir', (_e, id: string) => getResourceDir(normalizeResourceId(id)))

  ipcMain.handle('check-resource-installed', async (_e, id: string) => {
    try {
      const normalized = normalizeResourceId(id)
      await recoverInterruptedInstall(normalized)
      return await isResourceInstalled(normalized)
    } catch { return false }
  })

  ipcMain.handle('check-resource-update', async (_e, rawId: string) => {
    const id = normalizeResourceId(rawId)
    await recoverInterruptedInstall(id)
    const installed = await isResourceInstalled(id)
    if (!installed) {
      return { installed: false, updateAvailable: false, installedSize: 0, remoteSize: 0 }
    }

    const local = await readInstallMetadata(id)
    // Existing installations predate metadata. Offer one safe refresh so they
    // get the current archive; the completed update records the exact size.
    if (!local) {
      return { installed: true, updateAvailable: true, installedSize: 0, remoteSize: 0, legacy: true }
    }

    const remote = await resolveUrl(id)
    const sizeChanged = remote.size > 0 && remote.size !== local.assetSize
    const digestChanged = !!remote.checksum && !!local.assetDigest
      && remote.checksum.toLowerCase() !== local.assetDigest.toLowerCase()
    return {
      installed: true,
      updateAvailable: sizeChanged || digestChanged,
      installedSize: local.assetSize,
      remoteSize: remote.size,
    }
  })

  ipcMain.handle('download-resource', async (_e, rawId: string) => {
    if (typeof rawId !== 'string') return
    const id = normalizeResourceId(rawId)
    dbg('=== download-resource called for: ' + id + ' ===')

    if (activeDownloads.has(id)) {
      dbg('Already downloading, skipping')
      return
    }
    const state: ActiveDownload = { request: null, cancelled: false, discard: false }
    activeDownloads.set(id, state)

    const resourcesRoot = getResourcesRoot()
    const resDir = getResourceDir(id)
    const partPath = join(resourcesRoot, id + '.zip.part')
    const partMetaPath = join(resourcesRoot, id + PART_META_SUFFIX)
    const tempZip = join(resourcesRoot, id + '.zip')
    for (const target of [resDir, partPath, partMetaPath, tempZip]) assertInside(resourcesRoot, target)
    const label = resourceLabel(id)

    try {
      await mkdir(resourcesRoot, { recursive: true })
      dbg('Resources dir ready')

      dbg('Resolving URL for ' + id + '...')
      const asset = await resolveUrl(id)
      const { url, size, checksumUrl, checksum } = asset
      dbg('URL: ' + url + ' (' + formatSize(size) + ')' + (checksumUrl || checksum ? ' [sha256 available]' : ''))

      await preparePartialDownload(id, asset, partPath)

      broadcast('download-progress', { id, percent: 0, speed: '0 B / ' + formatSize(size), bytes: 0, total: size })

      const { durationMs, sizeBytes } = await downloadFile(url, partPath, size, checksumUrl, checksum, id, state)

      if (state.cancelled) {
        dbg('=== Download cancelled after transfer: ' + id + ' ===')
        if (state.discard) {
          await rm(partPath, { force: true }).catch(() => {})
          await rm(partMetaPath, { force: true }).catch(() => {})
        }
        broadcast('download-cancelled', { id, discarded: state.discard })
        return
      }

      const zipStat = await stat(partPath).catch(() => null)
      dbg('Zip file size: ' + (zipStat ? formatSize(zipStat.size) : 'NOT FOUND'))

      // Expand-Archive wants a .zip suffix, so flip the finished .part over.
      await rm(tempZip, { force: true })
      await rename(partPath, tempZip)
      await rm(partMetaPath, { force: true })

      broadcast('download-progress', { id, percent: 100, speed: 'Распаковка...', bytes: sizeBytes, total: size })

      dbg('Extracting update for ' + resDir)
      try {
        await installExtractedResource(id, tempZip, asset)
        dbg('Extract OK')
      } catch (err: any) {
        dbg('Extract FAILED: ' + err.message)
        throw new Error('Ошибка распаковки: ' + err.message)
      } finally {
        await rm(tempZip, { force: true })
      }

      broadcast('download-done', { id })
      flashOrNotify(
        { kind: 'download-done', id, durationMs, sizeBytes },
        { title: 'Загрузка завершена', body: label + ' готов к запуску · ' + formatSize(sizeBytes) },
      )
      dbg('=== Download complete: ' + id + ' ===')
    } catch (err: any) {
      if (state.cancelled) {
        dbg('=== Download cancelled: ' + id + (state.discard ? ' (discarded)' : '') + ' ===')
        if (state.discard) {
          await rm(partPath, { force: true }).catch(() => {})
          await rm(partMetaPath, { force: true }).catch(() => {})
          await rm(tempZip, { force: true }).catch(() => {})
        }
        broadcast('download-cancelled', { id, discarded: state.discard })
        return
      }
      const msg = err?.message ?? String(err)
      dbg('=== Download FAILED ' + id + ': ' + msg + ' ===')
      broadcast('download-error', { id, message: msg })
      // The .part file is kept on purpose: the next attempt resumes from it.
      flashOrNotify(
        { kind: 'download-error', id, message: msg },
        { title: 'Ошибка загрузки', body: label + ': ' + msg.slice(0, 140) },
      )
    } finally {
      activeDownloads.delete(id)
    }
  })

  ipcMain.handle('cancel-download', (_e, rawId: string) => {
    const id = String(rawId).toLowerCase()
    const st = activeDownloads.get(id)
    dbg('cancel-download: ' + id + (st ? '' : ' (not active)'))
    if (!st) return
    if (!st.request) {
      // Extraction has already started; that phase cannot be interrupted.
      dbg('cancel-download ignored: still preparing files')
      return
    }
    st.cancelled = true
    try { st.request.abort() } catch {}
  })

  /** Stop the download and throw away the partial file (Отмена/Удалить). */
  ipcMain.handle('discard-download', async (_e, rawId: string) => {
    const id = normalizeResourceId(rawId)
    const resourcesRoot = getResourcesRoot()
    const partPath = join(resourcesRoot, id + '.zip.part')
    const partMetaPath = join(resourcesRoot, id + PART_META_SUFFIX)
    const tempZip = join(resourcesRoot, id + '.zip')
    const st = activeDownloads.get(id)
    dbg('discard-download: ' + id + (st ? ' (active)' : ' (idle)'))
    if (st) {
      if (!st.request) {
        // Extraction has already started; that phase cannot be interrupted.
        dbg('discard-download ignored: still preparing files')
        return
      }
      st.discard = true
      st.cancelled = true
      try { st.request.abort() } catch {}
      return
    }
    await rm(partPath, { force: true }).catch(() => {})
    await rm(partMetaPath, { force: true }).catch(() => {})
    await rm(tempZip, { force: true }).catch(() => {})
    broadcast('download-cancelled', { id, discarded: true })
  })

  /** Bytes already downloaded for a resource, 0 when there is no partial file. */
  ipcMain.handle('resource-partial-size', async (_e, rawId: string) => {
    const id = String(rawId).toLowerCase()
    if (!RESOURCE_ID_RE.test(id)) return 0
    try {
      const s = await stat(join(getResourcesRoot(), id + '.zip.part'))
      return s.isFile() ? s.size : 0
    } catch { return 0 }
  })

  /** Native OS notification, used by the renderer when its window is hidden. */
  ipcMain.handle('notify-os', (_e, title: string, body: string) => {
    if (typeof title !== 'string' || typeof body !== 'string') return
    showOsNotification(title, body)
  })

  ipcMain.handle('delete-resource', async (_e, id: string) => {
    id = normalizeResourceId(id)
    dbg('=== delete-resource called for: ' + id + ' ===')
    const active = activeDownloads.get(id)
    if (active) {
      active.cancelled = true
      try { active.request?.abort() } catch {}
    }
    const userData = electronApp.getPath('userData')
    const targets = [
      join(userData, 'resources', id),
      join(userData, 'resources', id + '.zip'),
      join(userData, 'resources', id + '.zip.part'),
      join(userData, 'resources', id + PART_META_SUFFIX),
      join(userData, 'resources', `.${id}.staging`),
      join(userData, 'resources', `.${id}.backup`),
      join(userData, 'cheats', id),
      join(userData, 'cheat_mods', id),
      join(userData, 'visuals', id),
      join(userData, 'visual_mods', id),
    ]
    for (const target of targets) {
      await rm(target, { recursive: true, force: true }).catch((e) => {
        dbg('delete-resource: failed to remove ' + target + ': ' + e?.message)
      })
    }
    dbg('=== delete-resource done: ' + id + ' ===')
  })
}
