<template>
  <section class="about">
    <SettingCard>
      <div>
        <v-card-item>
          <v-card-title class="w-full flex mr-2 title">
          <v-img src="http://launcher/icons/logoDark" alt="FastLauncher" max-width="64" class="mr-4"></v-img>
          <div>
            <span class="text-h5" v-shared-tooltip="() => 'FastLauncher'">FastLauncher</span>
            <div class="flex justify-center items-center gap-2 pt-1">
              <div class="text-caption">Discord: @myfavjuzo</div>
            </div>
          </div>
          <v-spacer />
          <div>
            <div class="flex items-center justify-center flex-grow-0 gap-2">
              <v-icon color="primary" aria-hidden="true">verified</v-icon>
              <div class="text-caption">{{ t('setting.aboutLicense') }}</div>
            </div>
          </div>
        </v-card-title>
        </v-card-item>
      </div>
    </SettingCard>
  </section>
</template>

<script lang="ts" setup>
import SettingCard from '@/components/SettingCard.vue'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const { t } = useI18n()

</script>
<style scoped>

</style>
