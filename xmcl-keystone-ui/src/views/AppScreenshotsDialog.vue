<template>
  <v-dialog
    v-model="isShown"
    width="900"
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
            <v-icon size="22" color="primary">photo_library</v-icon>
          </div>
          <div class="min-w-0">
            <div class="text-base font-bold tracking-tight truncate" style="color: rgba(var(--v-theme-on-surface), 0.9);">
              {{ t('media.screenshotsTitle', { name: parameter?.title ?? '' }) }}
            </div>
            <div class="text-xs opacity-60 mt-0.5">
              {{ t('media.subtitle') }}
            </div>
          </div>
        </div>
        <v-btn size="small" variant="tonal" prepend-icon="folder_open" class="mr-2" :disabled="!dir" @click="openScreenshotsFolder">
          {{ t('media.openFolder') }}
        </v-btn>
        <v-btn icon="close" variant="text" size="small" @click="hide" />
      </div>

      <!-- Content -->
      <div class="flex-1 min-h-0 overflow-y-auto invisible-scroll px-6 pb-6">
        <div v-if="shots.length === 0" class="flex flex-col items-center gap-2 py-12 opacity-50">
          <v-icon size="44">image_not_supported</v-icon>
          <span class="text-sm">{{ t('media.noScreenshots') }}</span>
        </div>
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div
            v-for="shot in shots"
            :key="shot.path"
            class="group relative rounded-lg overflow-hidden cursor-pointer border border-gray-500/15"
            @click="openFile(shot.path)"
          >
            <img :src="mediaUrl(shot.path)" class="w-full aspect-video object-cover bg-black/30" loading="lazy" alt="" />
            <div class="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-between gap-1">
              <span class="text-[10px] text-white truncate">{{ shot.name }}</span>
              <span class="text-[10px] text-white/60 whitespace-nowrap">{{ formatDate(shot.mtime) }}</span>
            </div>
            <v-btn
              icon="delete"
              size="x-small"
              variant="flat"
              color="error"
              class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              @click.stop="removeFile(shot)"
            />
          </div>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialog } from '../composables/dialog'

const { t } = useI18n()

interface MediaItem {
  name: string
  path: string
  size: number
  mtime: number
}

const { isShown, hide, parameter } = useDialog<{ title: string; kind: string; id: string }>('screenshots')

const dir = ref('')
const shots = ref<MediaItem[]>([])

watch(isShown, async (v) => {
  if (v) {
    windowController.focus()
    await refresh()
  }
})

async function refresh() {
  const param = parameter.value
  if (!param) return
  try {
    dir.value = await windowController.resolveMediaDir(param.kind, param.id)
    shots.value = dir.value ? await windowController.listScreenshots(dir.value) : []
  } catch (e) {
    console.error('Failed to load screenshots:', e)
  }
}

function mediaUrl(path: string) {
  return `http://launcher/media?path=${encodeURIComponent(path)}`
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function openFile(path: string) {
  windowController.openMediaPath(path)
}

function openScreenshotsFolder() {
  if (dir.value) {
    windowController.openMediaPath(`${dir.value}\\screenshots`)
  }
}

async function removeFile(item: MediaItem) {
  const i = shots.value.indexOf(item)
  if (i >= 0) shots.value.splice(i, 1)
  await windowController.deleteMediaFile(item.path)
}
</script>
