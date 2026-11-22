<template>
  <v-dialog
    v-model="isShown"
    width="640"
    :persistent="false"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <div class="flex w-full max-h-[85vh] flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center px-6 pt-6 pb-4">
        <div class="flex items-center gap-3 flex-grow">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style="background-color: rgba(var(--v-theme-primary), 0.12)"
          >
            <v-icon size="22" color="primary">history</v-icon>
          </div>
          <div>
            <div class="text-base font-bold tracking-tight" style="color: rgba(var(--v-theme-on-surface), 0.9);">
              {{ t('devlog.name') }}
            </div>
            <div class="text-xs opacity-60 mt-0.5">
              {{ t('devlog.subtitle') }}
            </div>
          </div>
        </div>
        <v-btn
          icon="close"
          variant="text"
          size="small"
          @click="hide"
        />
      </div>

      <!-- Content -->
      <div class="flex-1 min-h-0 overflow-y-auto invisible-scroll px-6 pb-6">
        <div class="max-w-xl mx-auto">
          <div
            v-for="(entry, index) in entries"
            :key="entry.version"
            class="relative pl-10 pb-8 last:pb-0"
          >
            <div
              v-if="index !== entries.length - 1"
              class="absolute left-[11px] top-8 bottom-0 w-px bg-gray-300/50 dark:bg-gray-600/50"
            />

            <div
              class="absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center"
              style="background-color: rgb(var(--v-theme-surface))"
              :style="{ borderColor: entry.color }"
            >
              <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: entry.color }" />
            </div>

            <div
              class="surface-panel p-5"
              :class="{ 'devlog-card--latest': index === 0 }"
              :style="index === 0 ? { borderColor: entry.color } : undefined"
            >
              <div class="flex items-center flex-wrap gap-2 mb-3">
                <span
                  class="px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-sm"
                  :style="{ backgroundColor: entry.color }"
                >
                  {{ entry.version }}
                </span>
                <span
                  v-if="index === 0"
                  class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                  :style="{ color: entry.color, backgroundColor: `${entry.color}22`, border: `1px solid ${entry.color}44` }"
                >
                  {{ t('devlog.latest') }}
                </span>
                <span class="ml-auto flex items-center gap-1 text-xs opacity-60">
                  <v-icon size="14">calendar_today</v-icon>
                  {{ entry.date }}
                </span>
              </div>

              <h2 class="text-lg font-bold mb-3" style="color: rgba(var(--v-theme-on-surface), 0.9);">
                {{ entry.title }}
              </h2>

              <ul class="space-y-2.5">
                <li
                  v-for="change in entry.changes"
                  :key="change"
                  class="flex items-start gap-3"
                >
                  <span
                    class="mt-[7px] w-1.5 h-1.5 shrink-0 rounded-full bg-white shadow-[0_0_0_2px_rgba(255,255,255,0.15)]"
                  />
                  <span class="text-sm leading-relaxed opacity-80">
                    {{ change }}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useDialog } from '../composables/dialog'
import { devLogEntries } from '../composables/devLog'

const { hide, isShown } = useDialog('devlog')
const { t } = useI18n()

const entries = devLogEntries

watch(isShown, (v) => {
  if (v) {
    windowController.focus()
  }
})
</script>
