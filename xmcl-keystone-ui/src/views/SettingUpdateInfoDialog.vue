<template>
  <v-dialog
    v-model="isShown"
    width="800"
    @input="$emit('input', $event)"
  >
    <v-card
      v-if="updateInfo"
      outlined
      class="visible-scroll max-h-90vh overflow-auto flex flex-col"
    >
      <v-alert
        v-if="isAppX"
        variant="tonal"
        type="warning"
      >
        {{ t('setting.appxUpdateHint') }}
      </v-alert>
      <v-card-item>
        <v-card-title>
          {{ updateInfo.name }}
        </v-card-title>
        <v-card-subtitle>
          {{ getLocalDateString(updateInfo.date) }}
        </v-card-subtitle>
      </v-card-item>
      <v-card-text class="markdown-body flex flex-col overflow-auto">
        <div v-html="body" />
      </v-card-text>
      <v-alert
        v-if="updateError"
        variant="tonal"
        type="error"
        class="mx-4 mb-2"
      >
        {{ updateError }}
      </v-alert>
      <div
        v-if="updateProgress"
        class="px-4 pb-3"
      >
        <div class="d-flex justify-space-between text-caption mb-1 opacity-70">
          <span>{{ progressLabel }}</span>
          <span>{{ updateProgress.percent }}%</span>
        </div>
        <v-progress-linear
          :model-value="updateProgress.percent"
          color="primary"
          height="6"
          rounded
        />
      </div>
      <v-alert
        v-if="hintRedownload"
        variant="tonal"
        type="warning"
      >
        {{ t('setting.maunalUpdateHint') }}
      </v-alert>
      <v-card-actions>
        <v-btn
          @click="openDiscord()"
         variant="text">
          <v-icon
            start
          >
            discord
          </v-icon>
          Discord: @f0rcaj
        </v-btn>
        <v-spacer />
        <template v-if="!hintRedownload">
          <v-btn
            v-if="downloadingUpdate"
            variant="text"
            @click="cancelDownload()"
          >
            Отмена
          </v-btn>
          <v-btn
            v-if="updateStatus === 'pending'"
            color="primary"
            :loading="downloadingUpdate"
            :disabled="downloadingUpdate"
            @click="downloadUpdate()"
           variant="text">
            <v-icon
              start
            >
              cloud_download
            </v-icon>
            {{ t('launcherUpdate.updateToThisVersion') }}
          </v-btn>
          <v-btn
            v-else
            color="primary"
            :loading="installing"
            @click="quitAndInstall()"
          >
            <v-icon
              start
            >
              refresh
            </v-icon>
            {{ t('launcherUpdate.installAndQuit') }}
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
    <v-card
      v-else
      hover

      style="width: 100%"
      push
    >
      <div class="m-8 flex h-full items-center justify-around">
        <h3 v-if="!checkingUpdate">
          {{ t('launcherUpdate.noUpdateAvailable') }}
        </h3>
        <v-progress-circular
          v-else
          indeterminate
        />
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>
import { kEnvironment } from '@/composables/environment'
import { useMarkdown } from '@/composables/markdown'
import { kUpdateSettings } from '@/composables/setting'
import { formatBytesRu } from '@/composables/useCheatDownload'
import { getLocalDateString } from '@/util/date'
import { injection } from '@/util/inject'
import { useDialog } from '../composables/dialog'

const { isShown } = useDialog('update-info')
const { t } = useI18n()
const { render } = useMarkdown()
const {
  installing, downloadingUpdate, checkingUpdate, updateInfo, updateStatus,
  downloadUpdate, quitAndInstall, cancelDownload, updateProgress, updateError,
} = injection(kUpdateSettings)

const body = computed(() => render(updateInfo.value?.body ?? ''))
const env = injection(kEnvironment)
const isAppX = computed(() => env.value?.env === 'appx')
const isAppImage = computed(() => env.value?.env === 'appimage')
const hintRedownload = computed(() => updateInfo.value?.operation === 'manual')

const progressLabel = computed(() => {
  const p = updateProgress.value
  if (!p) return ''
  const done = formatBytesRu(p.bytes)
  const base = p.total > 0 ? `${done} / ${formatBytesRu(p.total)}` : done
  return p.rateBytes > 0 ? `${base} · ${formatBytesRu(p.rateBytes)}/с` : base
})

const openDiscord = () => {
  window.open('https://discord.com/users/f0rcaj', 'browser')
}
</script>

<style>
</style>
