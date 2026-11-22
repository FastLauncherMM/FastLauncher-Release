<script lang="ts" setup>
import VersionInput, { VersionItem } from './VersionInput.vue'
import { useLabyModManifest } from '@/composables/version'
import { BuiltinImages } from '../constant'
import type { LabyMod4Manifest } from '@xmcl/runtime-api'
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  minecraft: string
  value?: string
}>()

const { data: remoteData, isValidating, mutate, error: remoteError } = useLabyModManifest()

const localManifest = ref<LabyMod4Manifest | null>(null)
const localError = ref<unknown>(undefined)
const loaded = ref(false)

async function loadLocalManifest() {
  localManifest.value = null
  localError.value = undefined
  loaded.value = false
  try {
    localManifest.value = await windowController.getLabyMod4Manifest()
  } catch (e) {
    localError.value = e
  } finally {
    loaded.value = true
  }
}

onMounted(loadLocalManifest)

const manifest = computed(() => {
  const local = localManifest.value
  if (local && local.minecraftVersions.length > 0) return local
  return remoteData.value ?? local ?? null
})
const error = computed(() => {
  // Only surface an error when neither the bundled nor the remote manifest
  // produced any data. A blocked remote fallback must not red-flag the field
  // when the bundled LabyMod 4 manifest is available.
  const local = localManifest.value
  if ((local && local.minecraftVersions.length > 0) || remoteData.value) return undefined
  return localError.value ?? remoteError.value
})
const refreshing = computed(() => !loaded.value || isValidating.value)

const items = computed(() => {
  const manifestValue = manifest.value
  if (!manifestValue) { return [] }
  const mcVersion = manifestValue.minecraftVersions.find(v => v.tag === props.minecraft)
  if (!mcVersion) { return [] }
  const result: VersionItem[] = [markRaw({
    name: manifestValue.labyModVersion,
    status: 'remote',
  })]
  return result
})
const { t } = useI18n()

const emit = defineEmits<{
  (event: 'input', value: string): void
}>()
</script>
<template>
  <VersionInput
    :icon="BuiltinImages.labyMod"
    title="LabyMod"
    url="https://www.labymod.net"
    :is-clearable="true"
    :items="items"
    :error="error"
    :clear-text="t('labyMod.disable')"
    :empty-text="t('labyMod.empty', { version: minecraft })"
    :refreshing="refreshing"
    :placeholder="t('labyMod.disable')"
    :value="value"
    @refresh="loadLocalManifest(); mutate()"
    @input="emit('input', $event)"
  />
</template>
