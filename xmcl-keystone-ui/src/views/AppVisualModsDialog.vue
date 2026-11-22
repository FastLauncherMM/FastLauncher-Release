<template>
  <v-dialog
    v-model="isShown"
    width="640"
    :persistent="false"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <div class="surface-panel flex flex-col overflow-hidden" style="max-height: 85vh">
      <!-- Header -->
      <div class="flex items-center px-6 pt-6 pb-4">
        <div class="flex items-center gap-3 flex-grow min-w-0">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style="background-color: rgba(var(--v-theme-primary), 0.12)"
          >
            <v-icon size="22" color="primary">extension</v-icon>
          </div>
          <div class="min-w-0">
            <div class="text-base font-bold tracking-tight truncate" style="color: rgba(var(--v-theme-on-surface), 0.9);">
              {{ t('visualMods.title', { name: parameter?.name ?? '' }) }}
            </div>
            <div class="text-xs opacity-60 mt-0.5">
              {{ t('visualMods.subtitle') }}
            </div>
          </div>
        </div>
        <v-btn icon="close" variant="text" size="small" @click="hide" />
      </div>

      <!-- Content -->
      <div class="flex-1 min-h-0 overflow-y-auto invisible-scroll px-6 pb-6">
        <!-- Step 1: open the built-in mod store -->
        <v-btn block color="primary" prepend-icon="storefront" @click="openStore">
          {{ t('visualMods.openStore', { version: parameter?.version ?? '' }) }}
        </v-btn>
        <div class="text-xs opacity-60 mt-2 text-center">{{ t('visualMods.storeHint') }}</div>

        <div class="flex items-center gap-3 my-5">
          <div class="flex-grow h-px bg-gray-500/20" />
          <span class="text-xs uppercase tracking-wider opacity-50">{{ t('visualMods.or') }}</span>
          <div class="flex-grow h-px bg-gray-500/20" />
        </div>

        <!-- Step 2: folder upload -->
        <v-btn block color="primary" variant="tonal" prepend-icon="folder_open" @click="addFolder">
          {{ t('visualMods.addFolder') }}
        </v-btn>
        <div class="text-xs opacity-60 mt-2 text-center">{{ t('visualMods.addFolderHint') }}</div>

        <!-- Installed custom mods -->
        <template v-if="mods.length > 0">
          <div class="text-sm font-bold mt-6 mb-2">
            {{ t('visualMods.yourMods', { count: mods.length }) }}
          </div>
          <div class="flex flex-col gap-2">
            <div
              v-for="mod in mods"
              :key="mod.path"
              class="flex items-center gap-3 rounded-xl px-4 py-2 border border-gray-500/15"
            >
              <v-icon size="18" color="primary">extension</v-icon>
              <div class="min-w-0 flex-grow">
                <div class="text-sm truncate">{{ mod.name }}</div>
                <div class="text-xs opacity-60">{{ sizeMb(mod.size) }}</div>
              </div>
              <v-btn icon="delete" size="x-small" variant="text" color="error" @click="removeMod(mod.name)" />
            </div>
          </div>
          <div class="flex items-start gap-2 mt-4 text-xs opacity-60">
            <v-icon size="14">info</v-icon>
            {{ t('visualMods.applyHint') }}
          </div>
        </template>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useDialog } from '../composables/dialog'

const { t } = useI18n()
const router = useRouter()

const { isShown, hide, parameter } = useDialog<{ id: string; name: string; version: string }>('visualmods')

interface CustomMod {
  name: string
  path: string
  size: number
}

const mods = ref<CustomMod[]>([])

watch(isShown, async (v) => {
  if (v) {
    windowController.focus()
    await refreshMods()
  }
})

function openStore() {
  const param = parameter.value
  if (!param) return
  hide()
  router.push({
    path: '/modstore',
    query: {
      target: `visual:${param.id}:${encodeURIComponent(param.name)}`,
      version: param.version,
      loader: 'fabric',
    },
  })
}

async function addFolder() {
  if (!parameter.value) return
  const count = await windowController.visualModsAddFolder(parameter.value.id)
  if (count > 0) await refreshMods()
}

async function removeMod(name: string) {
  if (!parameter.value) return
  await windowController.visualModsRemove(parameter.value.id, name)
  await refreshMods()
}

async function refreshMods() {
  if (!parameter.value) return
  try {
    mods.value = await windowController.visualModsList(parameter.value.id)
  } catch (e) {
    console.error(e)
  }
}

function sizeMb(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}
</script>
