<template>
  <div
    v-if="!shouldHideLaunchButton"
    v-roving-tabindex
    role="group"
    aria-orientation="horizontal"
    :aria-label="text"
    class="flex flex-grow-0 items-center"
  >
    <v-badge
      :model-value="count !== 0"
      location="top start"
      color="primary"
      :content="count"
    >
      <div
        class="relative inline-flex launch-pill"
        :class="{ short: !top }"
      >
        <div
          v-if="streak > 0"
          class="streak-badge"
          :title="`Streak: ${streak} days`"
        >
          <v-icon size="small">whatshot</v-icon>
          <span class="streak-count">{{ streak }}</span>
        </div>
        <v-btn
          id="launch-button"
          data-testid="launch-button"
          :disabled="isValidating"
          :color="color"
          :size="compact ? 'large' : 'x-large'"
          rounded="pill"
          class="pl-24 pr-24 text-xl transition-all btn-launch"
          :aria-label="text"
          @click="onClick()"
          @mouseenter="onHoverEnter"
          @mouseleave="onHoverLeave"
        >
          {{ text }}
        </v-btn>

        <!-- Left circular play button: launches the game on click -->
        <v-btn
          :disabled="isValidating"
          data-testid="launch-button-play"
          icon
          rounded="circle"
          :size="compact ? 'small' : 'default'"
          variant="flat"
          class="btn-play-inset"
          :aria-label="text"
          @click="onPlayClick"
          @mouseenter="onHoverEnter"
          @mouseleave="onHoverLeave"
        >
          <v-progress-circular
            v-if="loading"
            indeterminate
            :size="20"
            :width="2"
          />
          <v-icon
            v-else
            aria-hidden="true"
            class="nested-icon"
            :class="{ spin: isSpinning }"
            @animationend="isSpinning = false"
          >
            {{ leftIcon || icon || 'play_arrow' }}
          </v-icon>
        </v-btn>

        <!-- Right circular settings button: hover opens the unified menu,
             click navigates to the instance setting page -->
        <v-menu
          v-model="isShown"
          :location="top ? 'top end' : 'bottom end'"
          :open-on-hover="true"
          :open-on-click="false"
          transition="scroll-y-transition"
        >
          <template #activator="{ props: activatorProps }">
            <v-btn
              :disabled="isValidating"
              data-testid="launch-button-menu"
              icon
              rounded="circle"
              :size="compact ? 'small' : 'default'"
              variant="flat"
              class="btn-menu-inset"
              :aria-label="t('baseSetting.title', 2)"
              :aria-haspopup="'menu'"
              :aria-expanded="isShown"
              to="/base-setting"
              v-bind="activatorProps"
              @mouseenter="onHoverEnter"
              @mouseleave="onHoverLeave"
            >
              <v-icon
                aria-hidden="true"
                class="nested-icon"
                :class="{ 'is-active': isShown }"
              >
                settings
              </v-icon>
            </v-btn>
          </template>
          <HomeLaunchButtonMenuList />
        </v-menu>
      </div>
    </v-badge>
  </div>
</template>
<script lang="ts" setup>
import { kLaunchButton } from '@/composables/launchButton'
import { injection } from '@/util/inject'
import HomeLaunchButtonMenuList from './HomeLaunchButtonMenuList.vue'
import { kInstances } from '@/composables/instances'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { kInstance } from '@/composables/instance'
import { useHasMinecraftLicense } from '@/composables/minecraftLicense'
import { isBedrockInstance } from '@xmcl/instance'
import { streak, refreshStreak } from '@/composables/launchStreak'

defineProps<{ compact?: boolean; top?: boolean }>()

const emit = defineEmits(['mouseenter', 'mouseleave'])
const { isValidating } = injection(kInstances)

const { onClick, color, icon, text, loading, leftIcon, count } = injection(kLaunchButton)
const { t } = useI18n()

const { instance } = injection(kInstance)
const { hasMinecraftLicense } = useHasMinecraftLicense()
const isBedrock = computed(() => isBedrockInstance(instance.value))
const shouldHideLaunchButton = computed(() => isBedrock.value && !hasMinecraftLicense.value)

const isShown = ref(false)
const isSpinning = ref(false)

function onHoverEnter() {
  emit('mouseenter')
}
function onHoverLeave() {
  emit('mouseleave')
}
function onPlayClick() {
  isSpinning.value = true
  onClick()
}

onMounted(refreshStreak)
</script>

<style scoped>
.streak-badge {
  position: absolute;
  top: -16px;
  right: -8px;
  display: flex;
  align-items: center;
  gap: 2px;
  background: linear-gradient(135deg, #ff6b35, #ff4444);
  color: white;
  padding: 1px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  z-index: 10;
  box-shadow: 0 2px 6px rgba(255, 68, 68, 0.4);
}
.streak-count {
  line-height: 1;
}
</style>
<style scoped>
.btn-launch {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  border-radius: 9999px;
  height: 64px;
  background: linear-gradient(120deg, rgb(var(--v-theme-primary)), rgb(var(--v-theme-primary)) 56%, rgb(var(--v-theme-accent))) !important;
  color: rgb(var(--v-theme-on-primary)) !important;
  box-shadow:
    0 16px 38px -16px rgba(var(--v-theme-primary), 0.72),
    inset 0 1px rgba(255, 255, 255, 0.34),
    inset 0 -1px rgba(0, 0, 0, 0.12) !important;
  font-weight: 800;
  letter-spacing: -0.02em;
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.35s ease,
    filter 0.25s ease;
}

.btn-launch::after {
  content: '';
  position: absolute;
  top: -130%;
  left: -36%;
  width: 28%;
  height: 360%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.34), transparent);
  transform: rotate(24deg);
  transition: left 0.72s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

.launch-pill:hover .btn-launch {
  filter: brightness(1.055) saturate(1.08);
  transform: translateY(-3px) scale(1.012);
  box-shadow:
    0 22px 48px -16px rgba(var(--v-theme-primary), 0.82),
    inset 0 1px rgba(255, 255, 255, 0.36),
    inset 0 -1px rgba(0, 0, 0, 0.12) !important;
}

.launch-pill:hover .btn-launch::after {
  left: 112%;
}

.launch-pill:active .btn-launch {
  transform: translateY(0) scale(0.985);
}

/* Embed the play button inside the pill at its leading edge. */
.btn-play-inset {
  position: absolute;
  inset-inline-start: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 52px;
  height: 52px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background-color: rgba(255, 255, 255, 0.2) !important;
  color: rgb(var(--v-theme-on-primary)) !important;
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.18);
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease;
}

.btn-play-inset :deep(.v-icon) {
  font-size: 28px;
}

/* Embed the menu button inside the pill at its trailing edge. */
.btn-menu-inset {
  position: absolute;
  inset-inline-end: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 52px !important;
  height: 52px !important;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background-color: rgba(0, 0, 0, 0.26) !important;
  color: rgb(var(--v-theme-on-primary)) !important;
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.08);
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease;
}

.btn-menu-inset :deep(.v-icon) {
  font-size: 28px;
}

/* Animate the nested-button icons when their menu is open. */
.nested-icon {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-menu-inset .nested-icon.is-active {
  transform: rotate(90deg);
}

.btn-play-inset:hover,
.btn-menu-inset:hover {
  background-color: rgba(255, 255, 255, 0.28) !important;
  transform: translateY(-50%) scale(1.06);
}

/* Play icon does a single full spin when clicked. */
.btn-play-inset .nested-icon.spin {
  animation: play-spin 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes play-spin {
  from {
    transform: rotate(0deg) scale(1);
  }
  50% {
    transform: rotate(180deg) scale(1.15);
  }
  to {
    transform: rotate(360deg) scale(1);
  }
}

/* Header (extension) placement: a shorter pill than the focus-mode footer. */
.launch-pill.short .btn-launch {
  height: 52px !important;
}

.launch-pill.short .btn-play-inset,
.launch-pill.short .btn-menu-inset {
  width: 40px !important;
  height: 40px !important;
}

.launch-pill.short .btn-play-inset :deep(.v-icon),
.launch-pill.short .btn-menu-inset :deep(.v-icon) {
  font-size: 22px;
}

@media (max-width: 850px) {
  .btn-launch {
    max-width: 300px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn-launch,
  .btn-launch::after,
  .btn-play-inset,
  .btn-menu-inset,
  .nested-icon {
    transition: none;
  }
}
</style>
