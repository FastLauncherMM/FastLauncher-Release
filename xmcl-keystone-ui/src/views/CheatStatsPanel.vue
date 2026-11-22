<template>
  <div class="cheat-stats">
    <button
      class="cheat-stats__toggle"
      :class="{ 'cheat-stats__toggle--pop': pressed }"
      @click="onPressToggle"
    >
      <span class="cheat-stats__badge">
        <v-icon :size="18">insights</v-icon>
      </span>
      <span class="cheat-stats__title">{{ t('cheats.stats.title') }}</span>
      <span v-if="!expanded" class="cheat-stats__mini">
        {{ formatMs(totalPlayedMs) }} ·
        <span class="cheat-stats__mini-today">{{ t('cheats.stats.today') }}: {{ formatMs(todayMs) }}</span>
      </span>
      <span v-else class="cheat-stats__mini">{{ t('cheats.stats.reset') }}</span>
      <v-icon class="cheat-stats__chev" :class="{ 'is-open': expanded }">expand_more</v-icon>
    </button>

    <Transition name="stats-fade">
      <div v-if="expanded" class="cheat-stats__body mt-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div class="stat-card">
            <div class="stat-card__label">{{ t('cheats.stats.totalTime') }}</div>
            <div class="stat-card__value">{{ formatMs(totalPlayedMs) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__label">{{ t('cheats.stats.today') }}</div>
            <div class="stat-card__value">{{ formatMs(todayMs) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__label">{{ t('cheats.stats.sessions') }}</div>
            <div class="stat-card__value">{{ totalSessions }}</div>
          </div>
        </div>

        <div class="stat-card mb-4">
          <div class="stat-card__label mb-2">{{ t('cheats.stats.last7Days') }}</div>
          <div class="bar-chart">
            <div
              v-for="day in week"
              :key="day.date"
              class="bar-chart__col"
              :title="`${formatMs(day.ms)} · ${day.date}`"
            >
              <div class="bar-chart__track">
                <div
                  class="bar-chart__bar"
                  :style="{ height: barHeight(day.ms) + '%' }"
                />
              </div>
              <div class="bar-chart__label">{{ shortDay(day.date) }}</div>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card__label mb-2">{{ t('cheats.stats.perCheat') }}</div>
          <div v-if="ranking.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-2">
            {{ t('cheats.stats.empty') }}
          </div>
          <div v-else class="flex flex-col gap-2.5">
            <div v-for="row in ranking" :key="row.id" class="flex items-center gap-3">
              <span class="stat-row__name w-36 truncate text-sm">{{ row.name }}</span>
              <div class="stat-row__bar flex-1">
                <div
                  class="stat-row__fill"
                  :style="{ width: row.pct + '%' }"
                />
              </div>
              <span class="stat-row__value text-xs text-gray-600 dark:text-gray-400 w-24 text-right">
                {{ formatMs(row.ms) }}
                <span v-if="row.sessions" class="opacity-70">· {{ row.sessions }}×</span>
              </span>
            </div>
          </div>
        </div>

        <div class="flex justify-end mt-3">
          <v-btn
            size="small"
            variant="text"
            color="error"
            :disabled="totalPlayedMs === 0"
            @click="onReset"
          >
            <v-icon start size="14">delete_sweep</v-icon>
            {{ t('cheats.stats.resetButton') }}
          </v-btn>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useCheatStats } from '@/composables/cheatStats'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ cheats: { id: string; name: string }[] }>()

const { t } = useI18n()
const expanded = ref(false)
const pressed = ref(false)
const { entries, totalPlayedMs, dailyMs, reset } = useCheatStats()

function onPressToggle() {
  pressed.value = true
  window.setTimeout(() => { pressed.value = false }, 280)
  expanded.value = !expanded.value
}

const todayMs = computed(() => dailyMs(1)[0]?.ms ?? 0)

const totalSessions = computed(() =>
  Object.values(entries.value).reduce((sum, e) => sum + e.sessions, 0),
)

const week = computed(() => dailyMs(7))

const weekMax = computed(() => Math.max(1, ...week.value.map((d) => d.ms)))

function barHeight(ms: number) {
  if (ms <= 0) return 0
  return Math.max(6, Math.round((ms / weekMax.value) * 100))
}

function shortDay(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  return days[d.getDay()]
}

const ranking = computed(() => {
  const nameMap = Object.fromEntries(props.cheats.map((c) => [c.id, c.name]))
  const rows = Object.entries(entries.value)
    .map(([id, e]) => ({
      id,
      name: nameMap[id] || id,
      ms: e.totalMs,
      sessions: e.sessions,
    }))
    .filter((r) => r.ms > 0)
    .sort((a, b) => b.ms - a.ms)
  const max = Math.max(1, ...rows.map((r) => r.ms))
  return rows.map((r) => ({ ...r, pct: Math.round((r.ms / max) * 100) }))
})

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}ч ${m}м`
  if (m > 0) return `${m}м ${s % 60}с`
  return `${s}с`
}

function onReset() {
  if (window.confirm(t('cheats.stats.confirmReset'))) {
    reset()
  }
}
</script>

<style scoped>
.cheat-stats {
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(128, 128, 128, 0.14);
background:
    radial-gradient(120% 160% at 0% 0%, rgba(var(--v-theme-primary), 0.10), transparent 55%),
    rgb(var(--v-theme-surface));
  box-shadow: 0 6px 22px -8px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  position: relative;
}

.cheat-stats__toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  border: none;
  background: transparent;
  padding: 4px 2px;
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: left center;
}

.cheat-stats__toggle:hover {
  transform: translateY(-1px);
}

.cheat-stats__toggle--pop {
  animation: stats-toggle-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes stats-toggle-pop {
  0% { transform: scale(0.9); }
  55% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.cheat-stats__badge {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  color: rgb(var(--v-theme-on-primary));
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)), rgba(var(--v-theme-primary), 0.7));
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.35);
}

.cheat-stats__title {
  line-height: 1.1;
  white-space: nowrap;
}

.cheat-stats__mini {
  margin-left: auto;
  font-size: 12px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.55);
  white-space: nowrap;
}

.cheat-stats__mini-today {
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

.cheat-stats__chev {
  transition: transform 0.25s ease;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.cheat-stats__chev.is-open {
  transform: rotate(180deg);
}

.stat-card {
  padding: 14px;
  border-radius: 12px;
  background: rgba(128, 128, 128, 0.06);
  border: 1px solid rgba(128, 128, 128, 0.08);
}

.stat-card__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(128, 128, 128, 0.9);
}

.stat-card__value {
  font-size: 20px;
  font-weight: 700;
  margin-top: 4px;
  color: rgb(var(--v-theme-primary));
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 90px;
}

.bar-chart__col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.bar-chart__track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  border-radius: 6px;
  background: rgba(128, 128, 128, 0.1);
  overflow: hidden;
}

.bar-chart__bar {
  width: 100%;
  border-radius: 6px 6px 0 0;
  background: linear-gradient(180deg, rgb(var(--v-theme-primary)), rgba(var(--v-theme-primary), 0.55));
  transition: height 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.bar-chart__label {
  font-size: 10px;
  color: rgba(128, 128, 128, 0.8);
}

.stat-row__name {
  flex-shrink: 0;
}

.stat-row__bar {
  height: 8px;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.12);
  overflow: hidden;
}

.stat-row__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, rgb(var(--v-theme-primary)), rgba(var(--v-theme-primary), 0.6));
  transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.stats-fade-enter-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.stats-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.stats-fade-enter-from,
.stats-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
