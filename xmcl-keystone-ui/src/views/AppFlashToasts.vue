<template>
  <div class="flash-container">
    <TransitionGroup name="flash">
      <AppFlashToast v-for="f in flashes" :key="f.key" :flash="f" @dismiss="dismiss(f.key)" />
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useAppFlashQueue } from '@/composables/appFlash'
import type { AppFlash } from '@/composables/appFlash'
import AppFlashToast from './AppFlashToast.vue'

const { flashes, push, dismiss } = useAppFlashQueue()

const handler = (flash: AppFlash) => push(flash)

onMounted(() => {
  windowController.on('app-flash', handler)
})

onUnmounted(() => {
  windowController.removeListener('app-flash', handler)
})
</script>

<style scoped>
.flash-container {
  position: fixed;
  top: 48px;
  right: 16px;
  z-index: 4000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  pointer-events: none;
}

.flash-enter-active {
  transition: opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1), transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.flash-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.flash-move {
  transition: transform 0.35s ease;
}

.flash-enter-from {
  opacity: 0;
  transform: translateX(70px) scale(0.94);
}

.flash-leave-to {
  opacity: 0;
  transform: translateX(40px) scale(0.96);
}
</style>
