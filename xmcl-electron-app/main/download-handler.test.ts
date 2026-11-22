import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { afterEach, describe, expect, test } from 'vitest'
import { copyPreservedUserData } from './download-handler'

const sandbox = resolve(__dirname, '../.test-resource-update')

async function put(root: string, path: string, value: string) {
  const target = join(root, path)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, value)
}

async function text(root: string, path: string) {
  return await readFile(join(root, path), 'utf-8')
}

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true })
})

describe('resource update preservation', () => {
  test('keeps configs, main data, packs, shaders and options but not binaries', async () => {
    const oldRoot = join(sandbox, 'old')
    const newRoot = join(sandbox, 'new')

    await put(oldRoot, 'Visual/main/autoConfig.json', 'player-main-config')
    await put(oldRoot, 'Visual/config/client.json', 'player-minecraft-config')
    await put(oldRoot, 'Visual/resourcepacks/custom.zip', 'player-resource-pack')
    await put(oldRoot, 'Visual/shaderpacks/custom.zip', 'player-shader-pack')
    await put(oldRoot, 'Visual/options.txt', 'player-options')
    await put(oldRoot, 'Visual/bin/client.jar', 'old-client-binary')

    await put(newRoot, 'Visual/main/autoConfig.json', 'release-main-config')
    await put(newRoot, 'Visual/config/client.json', 'release-minecraft-config')
    await put(newRoot, 'Visual/resourcepacks/bundled.zip', 'new-bundled-resource-pack')
    await put(newRoot, 'Visual/shaderpacks/bundled.zip', 'new-bundled-shader-pack')
    await put(newRoot, 'Visual/options.txt', 'release-options')
    await put(newRoot, 'Visual/bin/client.jar', 'new-client-binary')

    await copyPreservedUserData(oldRoot, newRoot)

    expect(await text(newRoot, 'Visual/main/autoConfig.json')).toBe('player-main-config')
    expect(await text(newRoot, 'Visual/config/client.json')).toBe('player-minecraft-config')
    expect(await text(newRoot, 'Visual/resourcepacks/custom.zip')).toBe('player-resource-pack')
    expect(await text(newRoot, 'Visual/resourcepacks/bundled.zip')).toBe('new-bundled-resource-pack')
    expect(await text(newRoot, 'Visual/shaderpacks/custom.zip')).toBe('player-shader-pack')
    expect(await text(newRoot, 'Visual/options.txt')).toBe('player-options')
    expect(await text(newRoot, 'Visual/bin/client.jar')).toBe('new-client-binary')
  })

  test('maps preserved data when an archive wrapper folder changes', async () => {
    const oldRoot = join(sandbox, 'old')
    const newRoot = join(sandbox, 'new')

    await put(oldRoot, 'FastVisual-old/mods/client.jar', 'old-mod')
    await put(oldRoot, 'FastVisual-old/config/visual.json', 'player-config')
    await put(newRoot, 'FastVisual-new/mods/client.jar', 'new-mod')
    await put(newRoot, 'FastVisual-new/config/visual.json', 'release-config')

    await copyPreservedUserData(oldRoot, newRoot)

    expect(await text(newRoot, 'FastVisual-new/config/visual.json')).toBe('player-config')
    expect(await text(newRoot, 'FastVisual-new/mods/client.jar')).toBe('new-mod')
  })
})
