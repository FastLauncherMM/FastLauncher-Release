<template>
  <div class="flash-toast" :class="`flash-${flash.kind}`" @mouseenter="pause" @mouseleave="resume">
    <div class="flash-shine" />
    <div class="flash-head">
      <div class="flash-media">
        <img v-if="meta.logo && showLogo" :src="meta.logo" class="flash-logo" alt="" />
        <v-icon v-else :icon="fallbackIcon" size="22" />
      </div>
      <div class="flash-text">
        <div class="flash-title">{{ title }}</div>
        <div class="flash-body">{{ body }}</div>
        <div v-if="metaLine" class="flash-meta">{{ metaLine }}</div>
        <button v-if="flash.action" class="flash-action" type="button" @click="runAction">
          <v-icon size="15">restart_alt</v-icon>
          {{ flash.action.label }}
        </button>
      </div>
      <button class="flash-close" type="button" aria-label="close" @click="dismiss">
        <v-icon icon="close" size="16" />
      </button>
    </div>
    <div v-if="autoClose" class="flash-progress-track">
      <div class="flash-progress" :style="{ width: progress + '%' }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getResourceMeta } from '@/composables/resourceMeta'
import type { AppFlashItem } from '@/composables/appFlash'

const props = defineProps<{ flash: AppFlashItem }>()
const emit = defineEmits<{ dismiss: [] }>()

const DURATION = 7000

const remaining = ref(DURATION)
const progress = ref(100)
let frame = 0
let startedAt = 0
let paused = false

const meta = computed(() => getResourceMeta(props.flash.id))
const showLogo = computed(() => props.flash.kind !== 'download-error')
const autoClose = computed(() => props.flash.kind !== 'update-ready' && props.flash.kind !== 'update-available')

const title = computed(() => {
  switch (props.flash.kind) {
    case 'download-done': return 'Загрузка завершена'
    case 'download-error': return 'Не удалось скачать'
    case 'game-exit': return 'Игра закрыта'
    case 'update-ready': return 'Обновление готово'
    case 'update-available': return 'Доступно обновление'
    default: return 'FastLauncher'
  }
})

const body = computed(() => {
  const name = meta.value.name
  switch (props.flash.kind) {
    case 'download-done': return name ? `${name} готов к запуску` : 'Файлы готовы к запуску'
    case 'download-error': return (name ? name + ': ' : '') + (props.flash.message ?? 'Неизвестная ошибка')
    case 'game-exit': return name || 'Сессия завершена'
    case 'update-ready':
      return props.flash.message
        ? `FastLauncher ${props.flash.message} скачан — перезапусти, чтобы применить`
        : 'Новая версия скачана — перезапусти лаунчер'
    case 'update-available':
      return props.flash.message
        ? `FastLauncher ${props.flash.message} уже в GitHub — обнови, когда удобно`
        : 'Вышла новая версия — обнови, когда удобно'
    default: return ''
  }
})

const metaLine = computed(() => {
  if (props.flash.kind === 'download-done') {
    const parts: string[] = []
    if (props.flash.sizeBytes) parts.push(formatSize(props.flash.sizeBytes))
    if (props.flash.durationMs) parts.push('за ' + Math.max(1, Math.round(props.flash.durationMs / 1000)) + ' сек')
    return parts.join(' · ')
  }
  if (props.flash.kind === 'game-exit') {
    return props.flash.durationMs ? 'Сессия: ' + formatDuration(props.flash.durationMs) : ''
  }
  return ''
})

const fallbackIcon = computed(() => {
  switch (props.flash.kind) {
    case 'download-done': return 'download_done'
    case 'download-error': return 'error'
    case 'game-exit': return 'sports_esports'
    case 'update-ready': return 'system_update'
    case 'update-available': return 'new_releases'
    default: return 'notifications'
  }
})

function runAction() {
  const action = props.flash.action
  emit('dismiss')
  action?.handler()
}

function formatSize(b: number) {
  if (b < 1024) return b + ' Б'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' КБ'
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' МБ'
  return (b / 1073741824).toFixed(2) + ' ГБ'
}

function formatDuration(ms: number) {
  if (ms < 60000) return 'меньше минуты'
  const m = Math.round(ms / 60000)
  if (m < 60) return m + ' мин'
  return Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин'
}

function tick() {
  const now = Date.now()
  remaining.value = Math.max(0, remaining.value - (now - startedAt))
  startedAt = now
  progress.value = (remaining.value / DURATION) * 100
  if (remaining.value <= 0) {
    dismiss()
    return
  }
  frame = requestAnimationFrame(tick)
}

function start() {
  if (!autoClose.value) return
  startedAt = Date.now()
  paused = false
  frame = requestAnimationFrame(tick)
}

function pause() {
  if (paused) return
  remaining.value = Math.max(0, remaining.value - (Date.now() - startedAt))
  progress.value = (remaining.value / DURATION) * 100
  paused = true
  cancelAnimationFrame(frame)
}

function resume() {
  if (!paused || remaining.value <= 0) return
  start()
}

function dismiss() {
  paused = true
  cancelAnimationFrame(frame)
  emit('dismiss')
}

onMounted(start)
onUnmounted(() => cancelAnimationFrame(frame))
</script>

<style scoped>
.flash-toast {
  position: relative;
  width: 380px;
  max-width: calc(100vw - 32px);
  border-radius: 18px;
  overflow: hidden;
  color: #fff;
  pointer-events: auto;
  background:
    radial-gradient(140% 120% at 0% 0%, color-mix(in srgb, var(--accent) 20%, transparent) 0%, transparent 55%),
    linear-gradient(160deg, rgba(28, 30, 44, 0.97), rgba(13, 14, 22, 0.97));
  border: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow:
    0 22px 50px -12px rgba(0, 0, 0, 0.65),
    0 8px 30px -10px var(--glow);
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
}

.flash-toast:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.17);
}

.flash-toast::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  box-shadow: 0 0 18px 2px var(--glow);
}

.flash-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(255, 255, 255, 0.07) 50%, transparent 60%);
  transform: translateX(-100%);
  animation: flash-shine 2.8s ease 0.5s infinite;
  pointer-events: none;
}

@keyframes flash-shine {
  0% { transform: translateX(-100%); }
  55% { transform: translateX(100%); }
  100% { transform: translateX(100%); }
}

.flash-head {
  display: flex;
  gap: 12px;
  padding: 14px 14px 12px;
  position: relative;
}

.flash-media {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: var(--accent-2);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 26%, transparent),
    color-mix(in srgb, var(--accent-2) 16%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  box-shadow: 0 6px 18px -6px var(--glow);
  overflow: hidden;
}

.flash-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.flash-text {
  flex: 1;
  min-width: 0;
}

.flash-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.flash-body {
  font-size: 12.5px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.78);
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.flash-meta {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.52);
  margin-top: 4px;
}

.flash-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.55);
  opacity: 0;
  transition: opacity 0.2s ease, background 0.2s ease, color 0.2s ease;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}

.flash-toast:hover .flash-close {
  opacity: 1;
}

.flash-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.flash-progress-track {
  position: relative;
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
}

.flash-progress {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  box-shadow: 0 0 12px 0 var(--glow);
}

.flash-download-done {
  --accent: #34d399;
  --accent-2: #22d3ee;
  --glow: rgba(52, 211, 153, 0.4);
}

.flash-download-error {
  --accent: #fb7185;
  --accent-2: #f59e0b;
  --glow: rgba(251, 113, 133, 0.4);
}

.flash-game-exit {
  --accent: #a78bfa;
  --accent-2: #60a5fa;
  --glow: rgba(167, 139, 250, 0.4);
}

.flash-download-cancelled {
  --accent: #94a3b8;
  --accent-2: #64748b;
  --glow: rgba(148, 163, 184, 0.35);
}

.flash-update-ready {
  --accent: #38bdf8;
  --accent-2: #818cf8;
  --glow: rgba(56, 189, 248, 0.45);
}

.flash-update-available {
  --accent: #38bdf8;
  --accent-2: #34d399;
  --glow: rgba(52, 211, 153, 0.45);
}

.flash-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 6px 14px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #0b1220;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease, filter 0.2s ease;
  box-shadow: 0 6px 16px -6px var(--glow);
}

.flash-action:hover {
  transform: translateY(-1px);
  filter: brightness(1.08);
}

.flash-action:active {
  transform: scale(0.97);
}
</style>
