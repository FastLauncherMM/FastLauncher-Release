<template>
  <SettingCard class="mb-4" :title="t('setting.bootSplash')" icon="hourglass_empty">
    <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
      <div class="md:col-span-5 flex justify-center items-center">
        <div class="splash-preview rounded-lg elevation-1">
          <div
            class="splash-preview-box"
            :class="`bs-preview-${splashStyle}`"
            style="--bs-accent: #1565c0"
          >
            <img :src="logo" alt="Logo" />
          </div>
          <div class="text-caption text-center mt-2 grey--text">
            {{ t('setting.livePreview') }}
          </div>
        </div>
      </div>
      <div class="md:col-span-7">
        <v-list class="transparent-list">
          <SettingItem :title="t('setting.bootSplashStyle')" :description="t('setting.bootSplashStyleHint')">
            <template #action>
              <v-btn-toggle
                v-model="splashStyle"
                mandatory
                density="compact"
                color="primary"
                variant="outlined"
                :aria-label="t('setting.bootSplashStyle')"
              >
                <v-btn v-for="s in styles" :key="s.value" size="small" :value="s.value">
                  <v-icon start size="small">{{ s.icon }}</v-icon>
                  {{ t(s.label) }}
                </v-btn>
              </v-btn-toggle>
            </template>
          </SettingItem>
        </v-list>
      </div>
    </div>
  </SettingCard>
</template>

<script setup lang="ts">
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import { kSettingsState } from '@/composables/setting'
import { injection } from '@/util/inject'
import logo from '@/assets/logo.webp'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { state } = injection(kSettingsState)

const styles: { value: 'pulse' | 'rise' | 'spin' | 'glow' | 'none'; icon: string; label: string }[] = [
  { value: 'pulse', icon: 'blur_on', label: 'setting.bootSplashPulse' },
  { value: 'rise', icon: 'vertical_align_top', label: 'setting.bootSplashRise' },
  { value: 'spin', icon: 'rotate_right', label: 'setting.bootSplashSpin' },
  { value: 'glow', icon: 'flare', label: 'setting.bootSplashGlow' },
  { value: 'none', icon: 'visibility_off', label: 'setting.bootSplashNone' },
]

const splashStyle = computed({
  get: () => state.value?.bootSplashStyle ?? 'pulse',
  set: (v) => state.value?.bootSplashStyleSet(v),
})
</script>

<style scoped>
.transparent-list {
  background: transparent;
}

.splash-preview {
  width: 100%;
  height: 220px;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 16px;
}

.splash-preview-box {
  width: 100%;
  height: 170px;
  border-radius: 8px;
  background-color: rgb(18, 18, 18);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.splash-preview-box img {
  max-width: 55%;
  max-height: 55%;
  object-fit: contain;
}

.splash-preview-box.bs-preview-pulse {
  animation: preview-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.splash-preview-box.bs-preview-rise {
  animation: preview-rise 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.splash-preview-box.bs-preview-spin img {
  animation: preview-spin 1.4s ease-in-out infinite;
}

.splash-preview-box.bs-preview-glow img {
  animation: preview-glow 1.6s ease-in-out infinite;
}

@keyframes preview-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

@keyframes preview-rise {
  0% { transform: translateY(20px); opacity: 0; }
  35% { opacity: 1; }
  100% { transform: translateY(0); opacity: 1; }
}

@keyframes preview-spin {
  0% { transform: rotate(0deg); opacity: 0.2; }
  100% { transform: rotate(360deg); opacity: 1; }
}

@keyframes preview-glow {
  0%, 100% { filter: drop-shadow(0 0 4px var(--bs-accent)); }
  50% { filter: drop-shadow(0 0 24px var(--bs-accent)); }
}
</style>
