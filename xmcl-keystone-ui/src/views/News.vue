<template>
  <div class="news-page" data-testid="news-page">
    <!-- Hero -->
    <section class="news-hero news-rise" :style="{ '--d': '0ms' }">
      <div class="news-hero__bg" />
      <div class="news-hero__content">
        <div class="news-hero__badge">
          <span class="news-hero__badge-dot" />
          FastLauncher {{ latest.version }} · {{ latest.date }}
        </div>
        <h1 class="news-hero__title">
          Что нового
        </h1>
        <p class="news-hero__subtitle">
          Обновления, исправления и новости лаунчера — всё в одном месте.
        </p>
        <div class="news-hero__actions">
          <v-btn color="primary" variant="flat" prepend-icon="play_arrow" @click="router.push('/')">
            К экземплярам
          </v-btn>
          <v-btn variant="tonal" prepend-icon="diamond" @click="router.push('/cheats')">
            Читы
          </v-btn>
          <v-btn variant="tonal" prepend-icon="palette" @click="router.push('/visuals')">
            Визуалы
          </v-btn>
        </div>
      </div>
      <div class="news-hero__art">
        <div class="news-hero__orb" />
        <v-icon class="news-hero__rocket" icon="rocket_launch" size="64" />
        <span
          v-for="n in 5"
          :key="n"
          class="news-hero__spark"
          :class="`news-hero__spark--${n}`"
        />
      </div>
    </section>

    <!-- Continue playing -->
    <section v-if="lastCheat" class="news-rise" :style="{ '--d': '60ms' }" data-testid="news-continue">
      <div class="news-continue">
        <div class="news-continue__glow" />
        <div class="news-continue__logo">
          <img v-if="lastCheat.logo" :src="lastCheat.logo" alt="" />
          <v-icon v-else size="34" color="primary">diamond</v-icon>
        </div>
        <div class="news-continue__info">
          <span class="news-continue__label">
            <v-icon size="14">bolt</v-icon>
            Продолжить играть
          </span>
          <div class="news-continue__name">
            <span class="truncate">{{ lastCheat.name }}</span>
            <span class="news-continue__version">{{ lastCheat.version }}</span>
          </div>
          <div class="news-continue__meta">
            <span v-if="lastLaunchText">Последний запуск: {{ lastLaunchText }}</span>
            <span v-if="playedText">{{ playedText }}</span>
          </div>
        </div>
        <div class="news-continue__actions">
          <template v-if="installed">
            <template v-if="launchingId !== lastCheat.id">
              <v-btn
                color="primary"
                variant="flat"
                size="large"
                prepend-icon="play_arrow"
                @click="launchCheat(lastCheat.id)"
              >
                Играть в {{ lastCheat.name }}
              </v-btn>
            </template>
            <template v-else>
              <v-btn color="primary" variant="flat" size="large" loading>
                Запускается…
              </v-btn>
              <v-btn variant="text" size="large" @click="cancelLaunch">
                Отмена
              </v-btn>
            </template>
          </template>
          <v-btn
            v-else
            variant="tonal"
            size="large"
            prepend-icon="download"
            @click="router.push('/cheats')"
          >
            Установить
          </v-btn>
        </div>
      </div>
    </section>

    <!-- Latest update -->
    <section class="news-rise" :style="{ '--d': '120ms' }">
      <div class="news-feature surface-panel">
        <div class="news-feature__head">
          <span class="news-feature__chip" :style="{ backgroundColor: latest.color }">
            {{ latest.version }}
          </span>
          <span class="news-feature__new">
            <span class="news-feature__new-dot" />
            Последнее обновление
          </span>
          <span class="news-feature__date">
            <v-icon size="14">calendar_today</v-icon>
            {{ latest.date }}
          </span>
        </div>
        <h2 class="news-feature__title">
          {{ latest.title }}
        </h2>
        <ul class="news-feature__list">
          <li v-for="change in latest.changes" :key="change" class="news-feature__item">
            <span class="news-feature__dot" :style="{ backgroundColor: latest.color }" />
            <span>{{ change }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- Earlier updates -->
    <section class="news-history news-rise" :style="{ '--d': '180ms' }">
      <div class="news-history__head">
        <v-icon size="18" class="opacity-60">history</v-icon>
        <span class="news-history__title">История обновлений</span>
        <v-btn
          class="ml-auto"
          variant="text"
          size="small"
          prepend-icon="open_in_full"
          @click="showDevLog()"
        >
          Открыть DevLog
        </v-btn>
      </div>
      <div class="news-grid">
        <button
          v-for="(entry, i) in older"
          :key="entry.version"
          type="button"
          class="news-card news-rise"
          :style="{ '--d': `${200 + i * 35}ms`, '--accent': entry.color }"
          @click="showDevLog()"
        >
          <div class="news-card__head">
            <span class="news-card__chip" :style="{ backgroundColor: entry.color }">
              {{ entry.version }}
            </span>
            <span class="news-card__date">{{ entry.date }}</span>
          </div>
          <div class="news-card__title">
            {{ entry.title }}
          </div>
          <ul class="news-card__preview">
            <li v-for="change in entry.changes.slice(0, 2)" :key="change">
              {{ change }}
            </li>
          </ul>
          <div v-if="entry.changes.length > 2" class="news-card__more">
            ещё {{ entry.changes.length - 2 }}
          </div>
          <v-icon class="news-card__arrow" size="18">arrow_forward</v-icon>
        </button>
      </div>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue'
import { useDialog } from '@/composables/dialog'
import { devLogEntries } from '@/composables/devLog'
import { cheats } from '@/composables/cheatCatalog'
import { useCheatPrefs } from '@/composables/cheatPrefs'
import { useCheatStats } from '@/composables/cheatStats'
import { useCheatDownload } from '@/composables/useCheatDownload'
import { useCheatLaunch } from '@/composables/useCheatLaunch'

const router = useRouter()
const { show: showDevLog } = useDialog('devlog')

const latest = devLogEntries[0]
const older = devLogEntries.slice(1)

const { recents } = useCheatPrefs('cheat')
const { entries } = useCheatStats()
const { checkInstalled, getState } = useCheatDownload()
const { launchingId, launchCheat, cancelLaunch } = useCheatLaunch()

const lastRecent = computed(() => recents.value[0] ?? null)
const lastCheat = computed(() => {
  const r = lastRecent.value
  if (!r) return null
  return cheats.find(c => c.id === r.id) ?? null
})
const installed = computed(() => (lastCheat.value ? getState(lastCheat.value.id).installed : false))

const lastLaunchText = computed(() => (lastRecent.value ? formatRelativeTime(lastRecent.value.at) : ''))
const playedText = computed(() => {
  const c = lastCheat.value
  if (!c) return ''
  const e = entries.value[c.id]
  if (!e || !e.totalMs) return ''
  return `Сыграно: ${formatPlayed(e.totalMs)} · сессий: ${e.sessions}`
})

onMounted(() => {
  if (lastCheat.value) {
    checkInstalled(lastCheat.value.id)
  }
})

function formatRelativeTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (days <= 0) return `сегодня в ${time}`
  if (days === 1) return `вчера в ${time}`
  if (days < 7) return `${days} дн. назад`
  return d.toLocaleDateString('ru-RU')
}

function formatPlayed(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'меньше минуты'
  if (minutes < 60) return minutes + ' мин'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
}
</script>

<style scoped>
.news-page {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: 16px 24px 32px;
}

.news-rise {
  opacity: 0;
  transform: translateY(18px);
  animation: news-rise 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: var(--d, 0ms);
}

@keyframes news-rise {
  to {
    opacity: 1;
    transform: none;
  }
}

/* ---------------------------------------------------------------- hero */

.news-hero {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  padding: 32px 36px;
  min-height: 210px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  box-shadow: 0 24px 55px -30px rgba(0, 0, 0, 0.55);
  isolation: isolate;
}

.news-hero__bg {
  position: absolute;
  inset: -45%;
  z-index: -1;
  background:
    radial-gradient(45% 60% at 15% 25%, color-mix(in srgb, rgb(var(--v-theme-primary)) 55%, transparent) 0%, transparent 70%),
    radial-gradient(40% 55% at 85% 25%, rgba(96, 165, 250, 0.42) 0%, transparent 70%),
    radial-gradient(45% 60% at 60% 95%, rgba(167, 139, 250, 0.38) 0%, transparent 70%);
  animation: hero-drift 16s ease-in-out infinite alternate;
}

@keyframes hero-drift {
  from { transform: translate3d(-3%, -2%, 0) scale(1); }
  to { transform: translate3d(3%, 2%, 0) scale(1.1); }
}

.news-hero__content {
  position: relative;
  max-width: 560px;
}

.news-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: rgba(var(--v-theme-on-surface), 0.85);
  background: rgba(var(--v-theme-surface), 0.55);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  backdrop-filter: blur(8px);
}

.news-hero__badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #34d399;
  box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.55);
  animation: badge-pulse 2.2s ease-out infinite;
}

@keyframes badge-pulse {
  0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.55); }
  70% { box-shadow: 0 0 0 8px rgba(52, 211, 153, 0); }
  100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
}

.news-hero__title {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.8px;
  line-height: 1.1;
  margin: 14px 0 8px;
  color: rgba(var(--v-theme-on-surface), 0.95);
}

.news-hero__subtitle {
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 18px;
  color: rgba(var(--v-theme-on-surface), 0.66);
}

.news-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.news-hero__art {
  position: relative;
  width: 150px;
  height: 150px;
  flex: 0 0 150px;
  display: grid;
  place-items: center;
}

.news-hero__orb {
  position: absolute;
  inset: 8px;
  border-radius: 999px;
  background: conic-gradient(
    from 0deg,
    rgba(96, 165, 250, 0.45),
    transparent 40%,
    rgba(167, 139, 250, 0.45) 70%,
    transparent
  );
  filter: blur(4px);
  animation: hero-spin 14s linear infinite;
}

@keyframes hero-spin {
  to { transform: rotate(360deg); }
}

.news-hero__rocket {
  position: relative;
  color: #fff;
  filter: drop-shadow(0 16px 30px rgba(0, 0, 0, 0.45));
  animation: hero-floaty 5s ease-in-out infinite;
}

@keyframes hero-floaty {
  0%, 100% { transform: translateY(-7px); }
  50% { transform: translateY(7px); }
}

.news-hero__spark {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  opacity: 0;
  animation: spark-rise 4.5s ease-in-out infinite;
}

.news-hero__spark--1 { left: 18%; bottom: 12%; animation-delay: 0.3s; }
.news-hero__spark--2 { left: 74%; bottom: 8%; animation-delay: 1.4s; width: 4px; height: 4px; }
.news-hero__spark--3 { left: 44%; bottom: 2%; animation-delay: 2.2s; }
.news-hero__spark--4 { left: 8%; bottom: 36%; animation-delay: 3.1s; width: 3px; height: 3px; }
.news-hero__spark--5 { left: 90%; bottom: 40%; animation-delay: 3.9s; width: 4px; height: 4px; }

@keyframes spark-rise {
  0% { transform: translateY(12px); opacity: 0; }
  30% { opacity: 0.9; }
  100% { transform: translateY(-70px); opacity: 0; }
}

/* ---------------------------------------------------------- continue */

.news-continue {
  position: relative;
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 20px;
  padding: 18px 22px;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, rgb(var(--v-theme-primary)) 40%, transparent);
  background:
    linear-gradient(
      120deg,
      color-mix(in srgb, rgb(var(--v-theme-primary)) 16%, transparent),
      rgba(var(--v-theme-surface), 0.6) 55%
    );
  box-shadow: 0 22px 46px -28px color-mix(in srgb, rgb(var(--v-theme-primary)) 70%, transparent);
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
}

.news-continue:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, rgb(var(--v-theme-primary)) 62%, transparent);
  box-shadow: 0 26px 54px -26px color-mix(in srgb, rgb(var(--v-theme-primary)) 80%, transparent);
}

.news-continue__glow {
  position: absolute;
  inset: -60% -20%;
  background: radial-gradient(
    40% 65% at 8% 30%,
    color-mix(in srgb, rgb(var(--v-theme-primary)) 30%, transparent) 0%,
    transparent 70%
  );
  pointer-events: none;
  animation: hero-drift 14s ease-in-out infinite alternate;
}

.news-continue__logo {
  position: relative;
  width: 62px;
  height: 62px;
  flex: 0 0 62px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: rgba(var(--v-theme-surface), 0.55);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  box-shadow: 0 10px 24px -12px rgba(0, 0, 0, 0.6);
}

.news-continue__logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.news-continue__info {
  position: relative;
  min-width: 0;
  flex: 1;
}

.news-continue__label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: color-mix(in srgb, rgb(var(--v-theme-primary)) 85%, rgba(var(--v-theme-on-surface), 0.5));
}

.news-continue__name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: rgba(var(--v-theme-on-surface), 0.94);
  margin-top: 3px;
  overflow: hidden;
}

.news-continue__version {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 999px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  background: rgba(var(--v-theme-on-surface), 0.08);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  flex-shrink: 0;
}

.news-continue__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 5px;
  font-size: 12.5px;
  color: rgba(var(--v-theme-on-surface), 0.62);
}

.news-continue__actions {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ------------------------------------------------------------- feature */

.news-feature {
  margin-top: 20px;
  border-radius: 20px;
  padding: 22px 26px;
  border: 1px solid color-mix(in srgb, rgb(var(--v-theme-primary)) 45%, transparent);
  background: linear-gradient(
    150deg,
    color-mix(in srgb, rgb(var(--v-theme-primary)) 9%, transparent),
    transparent 55%
  );
  box-shadow: 0 20px 45px -26px color-mix(in srgb, rgb(var(--v-theme-primary)) 60%, transparent);
}

.news-feature__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.news-feature__chip,
.news-card__chip {
  padding: 4px 11px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.5);
}

.news-feature__new {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  padding: 4px 10px;
  border-radius: 999px;
  color: #34d399;
  background: rgba(52, 211, 153, 0.12);
  border: 1px solid rgba(52, 211, 153, 0.3);
}

.news-feature__new-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #34d399;
  animation: badge-pulse 2.2s ease-out infinite;
}

.news-feature__date {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.news-feature__title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.3px;
  margin: 14px 0 14px;
  color: rgba(var(--v-theme-on-surface), 0.92);
}

.news-feature__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 10px 28px;
}

.news-feature__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13.5px;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.8);
}

.news-feature__dot {
  margin-top: 7px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  flex-shrink: 0;
  box-shadow: 0 0 0 3px rgba(var(--v-theme-on-surface), 0.06);
}

/* ------------------------------------------------------------- history */

.news-history {
  margin-top: 28px;
  padding-bottom: 8px;
}

.news-history__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.news-history__title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: rgba(var(--v-theme-on-surface), 0.8);
}

.news-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.news-card {
  position: relative;
  text-align: left;
  padding: 16px;
  border-radius: 16px;
  cursor: pointer;
  background: rgba(var(--v-theme-surface), 0.5);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
  overflow: hidden;
}

.news-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  background: rgba(var(--v-theme-surface), 0.72);
  box-shadow: 0 18px 36px -20px rgba(0, 0, 0, 0.55);
}

.news-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.news-card__date {
  margin-left: auto;
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.news-card__title {
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.35;
  margin-bottom: 8px;
  color: rgba(var(--v-theme-on-surface), 0.9);
}

.news-card__preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.news-card__preview li {
  font-size: 12px;
  line-height: 1.4;
  color: rgba(var(--v-theme-on-surface), 0.62);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-card__more {
  margin-top: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: color-mix(in srgb, var(--accent) 80%, rgba(var(--v-theme-on-surface), 0.6));
}

.news-card__arrow {
  position: absolute;
  right: 12px;
  bottom: 12px;
  opacity: 0;
  transform: translateX(-6px);
  transition: opacity 0.25s ease, transform 0.25s ease;
  color: var(--accent);
}

.news-card:hover .news-card__arrow {
  opacity: 1;
  transform: none;
}
</style>
