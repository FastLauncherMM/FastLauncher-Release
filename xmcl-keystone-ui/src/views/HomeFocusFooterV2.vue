<template>
  <div class="home-focus-footer w-full">
    <div class="home-command-dock relative footer flex-grow flex items-end">
      <HomeFooterCard />
      <div
        key="launch-button-group"
        class="flex flex-wrap justify-end items-center gap-y-6 gap-x-2 flex-grow"
      >
        <HomeLaunchButtonStatus
          class="mr-4 ml-2"
          :active="active"
        />
        <HomeLaunchButton
          top
          @mouseenter="active = true"
          @mouseleave="active = false"
        />
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import HomeLaunchButton from './HomeLaunchButton.vue'
import HomeLaunchButtonStatus from './HomeLaunchButtonStatus.vue'
import HomeFooterCard from './HomeFooterCard.vue'

const active = ref(false)
</script>

<style>
.tabs>div[role="tablist"] {
  background: var(--color-sidebar-bg) !important;
  backdrop-filter: blur(var(--blur-card));
}
</style>
<style scoped>
.footer {
  @apply mx-6;
}

.home-command-dock {
  gap: 14px;
  padding: 11px;
  overflow: visible;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.09);
  border-radius: 24px;
  background:
    linear-gradient(120deg, rgba(var(--v-theme-surface), 0.72), rgba(var(--v-theme-surface), 0.42));
  box-shadow:
    0 26px 70px -32px rgba(0, 0, 0, 0.72),
    0 8px 28px -22px rgba(var(--v-theme-primary), 0.34),
    inset 0 1px rgba(255, 255, 255, 0.045);
  backdrop-filter: blur(28px) saturate(145%);
  -webkit-backdrop-filter: blur(28px) saturate(145%);
  animation: command-dock-enter 0.68s 0.12s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.home-command-dock::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at 86% 120%, rgba(var(--v-theme-primary), 0.12), transparent 36%);
  pointer-events: none;
}

.home-command-dock :deep(.tabs-card) {
  border-color: rgba(var(--v-theme-on-surface), 0.07) !important;
  background: rgba(var(--v-theme-surface), 0.5) !important;
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.025);
}

@keyframes command-dock-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 850px) {
  .footer {
    @apply mr-2;
  }

  .home-command-dock {
    padding: 7px;
    border-radius: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-command-dock {
    animation: none;
  }
}
</style>
