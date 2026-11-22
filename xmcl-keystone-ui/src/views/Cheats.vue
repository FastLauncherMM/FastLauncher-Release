<template>
  <div class="cheats-page h-full flex flex-col overflow-hidden">
    <div class="flex-none px-6 lg:px-10 pt-6 pb-2">
      <h1 class="text-2xl font-bold flex items-center gap-3">
        <v-icon color="primary" size="large">diamond</v-icon>
        {{ t('cheats.name') }}
      </h1>
      <p class="text-gray-500 dark:text-gray-300 text-sm mt-1">
        {{ t('cheats.subtitle') }}
      </p>
    </div>

    <!-- Filter bar -->
    <div class="flex-none px-6 lg:px-10 pb-4">
      <div class="cheats-filter-bar">
        <div class="flex flex-wrap items-center gap-3 mb-3">
          <div class="cheat-search">
            <v-icon size="18" class="cheat-search__icon">search</v-icon>
            <input
              v-model="search"
              class="cheat-search__input"
              type="text"
              placeholder="Поиск по названию или описанию…"
              spellcheck="false"
            />
            <button
              v-if="search"
              class="cheat-search__clear"
              title="Очистить"
              @click="search = ''"
            >
              <v-icon size="16">close</v-icon>
            </button>
          </div>

          <button
            class="cheat-pill cheat-pill--pinned"
            :class="{ 'cheat-pill--active': showPinnedOnly, 'cheat-pill--pop': pressedPill === '__pinned' }"
            @click="animatePress('__pinned'); showPinnedOnly = !showPinnedOnly"
          >
            <span class="cheat-pill__icon">
              <v-icon :size="16">{{ showPinnedOnly ? 'star' : 'star_border' }}</v-icon>
            </span>
            <span class="cheat-pill__label">Закреплённые</span>
            <span class="cheat-pill__count">{{ pins.length }}</span>
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-3 flex-wrap">
            <button
              v-for="cat in categories"
              :key="cat.id"
              class="cheat-pill"
              :class="[`cheat-pill--${cat.id}`, { 'cheat-pill--active': isCategoryActive(cat.id), 'cheat-pill--pop': pressedPill === cat.id }]"
              @click="animatePress(cat.id); toggleCategory(cat.id)"
            >
              <span class="cheat-pill__icon">
                <v-icon :size="16">{{ cat.icon }}</v-icon>
              </span>
              <span class="cheat-pill__label">{{ cat.label }}</span>
              <span class="cheat-pill__count">{{ countFor(cat.id, 'categories') }}</span>
            </button>
          </div>

          <div class="cheat-filter-divider hidden sm:block" />

          <!-- Version filter -->
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {{ t('cheats.version') }}
            </span>
            <button
              v-for="v in versions"
              :key="v"
              class="cheat-pill cheat-pill--version"
              :class="{ 'cheat-pill--active': selectedVersions.includes(v), 'cheat-pill--pop': pressedPill === v }"
              @click="animatePress(v); toggleVersion(v)"
            >
              <span class="cheat-pill__icon">
                <v-icon :size="14">inventory_2</v-icon>
              </span>
              <span class="cheat-pill__label">{{ v }}</span>
              <span class="cheat-pill__count">{{ countFor(v, 'versions') }}</span>
            </button>
          </div>

          <button
            v-if="hasActiveFilters"
            class="cheat-filter-reset"
            :class="{ 'cheat-pill--pop': pressedPill === '__reset' }"
            @click="animatePress('__reset'); resetFilters()"
          >
            <v-icon :size="15">restart_alt</v-icon>
            {{ t('cheats.resetFilters') }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
      <CheatStatsPanel :cheats="cheats" class="mb-6" />

      <div v-if="recentCheats.length" class="recent-strip mb-6">
        <span class="recent-strip__label">
          <v-icon size="15">history</v-icon>
          Недавние
        </span>
        <div class="recent-strip__items">
          <button
            v-for="r in recentCheats"
            :key="r.id"
            class="recent-chip"
            :title="`Показать ${r.name}`"
            @click="focusCheat(r.id)"
          >
            <img v-if="r.logo" :src="r.logo" class="recent-chip__logo" alt="" />
            <span class="recent-chip__name">{{ r.name }}</span>
          </button>
        </div>
      </div>

      <div v-if="filteredCheats.length === 0" class="cheats-empty">
        <div class="cheats-empty__icon">
          <v-icon size="42" color="primary">search_off</v-icon>
        </div>
        <p class="cheats-empty__title">Ничего не найдено</p>
        <p class="cheats-empty__hint">Попробуй изменить запрос или сбросить фильтры</p>
        <button class="cheat-filter-reset cheats-empty__reset" @click="resetFilters">
          <v-icon :size="15">restart_alt</v-icon>
          {{ t('cheats.resetFilters') }}
        </button>
      </div>

      <TransitionGroup
        name="cheat-list"
        tag="div"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6"
      >
        <div
          v-for="cheat in filteredCheats"
          :id="`cheat-card-${cheat.id}`"
          :key="cheat.id"
          class="explore-card surface-card-clickable group relative overflow-hidden flex flex-col h-full rounded-xl"
          tabindex="0"
        >
          <div class="explore-card__media aspect-[16/9] relative overflow-hidden bg-surface-variant/30 flex items-center justify-center">
            <img v-if="cheat.cover" :src="cheat.cover" class="absolute inset-0 w-full h-full object-cover" alt="" />
            <div v-else class="explore-card__placeholder flex flex-col items-center gap-2 opacity-30">
              <v-icon :size="48" color="primary">diamond</v-icon>
              <span class="text-xs font-semibold uppercase tracking-wider">{{ cheat.name }}</span>
            </div>
            <div class="explore-card__gradient absolute inset-0 pointer-events-none" />
            <button
              class="cheat-star"
              :class="{ 'cheat-star--on': isPinned(cheat.id) }"
              :title="isPinned(cheat.id) ? 'Открепить' : 'Закрепить'"
              @click.stop="togglePin(cheat.id)"
            >
              <v-icon size="18">{{ isPinned(cheat.id) ? 'star' : 'star_border' }}</v-icon>
            </button>
            <div class="absolute top-3 right-3">
              <div class="flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 backdrop-blur-md">
                <v-icon size="12" color="white" class="material-icons-outlined">sell</v-icon>
                <span class="text-[10px] font-semibold text-white">{{ cheat.version }}</span>
              </div>
            </div>
          </div>

          <div class="explore-card__content p-4 flex flex-col flex-1 gap-2.5">
            <div class="flex items-center gap-3">
              <div class="explore-card__avatar w-12 h-12 rounded-xl shrink-0 flex items-center justify-center overflow-hidden">
                <img v-if="cheat.logo" :src="cheat.logo" class="w-full h-full object-cover" alt="" />
                <v-icon v-else color="primary">diamond</v-icon>
              </div>
              <div class="overflow-hidden min-w-0 flex-1">
                <h3 class="my-0 mt-1 font-bold text-base leading-tight truncate text-gray-900 dark:text-white">
                  {{ cheat.name }}
                </h3>
              </div>
            </div>

            <p class="text-xs text-gray-700 dark:text-gray-400 line-clamp-2 h-9 leading-relaxed">
              {{ cheat.description }}
            </p>

            <div class="mt-auto pt-2.5 flex items-center justify-between gap-2 border-t border-gray-200/20">
              <div class="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400 min-w-0">
                <template v-if="getState(cheat.id).downloading">
                  <v-icon size="13" color="warning">downloading</v-icon>
                  <span class="truncate">{{ downloadLabel(cheat.id) }}</span>
                </template>
                <template v-else-if="getState(cheat.id).paused">
                  <v-icon size="13" color="warning">pause_circle</v-icon>
                  <span class="truncate">Пауза · {{ bytesLabel(cheat.id) }}</span>
                </template>
                <template v-else-if="getState(cheat.id).error">
                  <v-icon size="13" color="error">error</v-icon>
                  <span class="truncate" :title="getState(cheat.id).error ?? undefined">{{ getState(cheat.id).error }}</span>
                </template>
                <template v-else-if="getState(cheat.id).partialBytes > 0">
                  <v-icon size="13" color="warning">downloading</v-icon>
                  <span class="truncate">Недокачано: {{ formatBytesRu(getState(cheat.id).partialBytes) }}</span>
                </template>
                <template v-else-if="getState(cheat.id).installed && getState(cheat.id).updateAvailable">
                  <v-icon size="13" color="primary">system_update_alt</v-icon>
                  <span class="truncate">{{ updateLabel(cheat.id) }}</span>
                </template>
                <template v-else-if="getState(cheat.id).installed">
                  <v-icon size="13" color="success">check_circle</v-icon>
                  {{ t('cheats.ready') }}
                </template>
                <template v-else>
                  <v-icon size="13" color="grey">cloud_download</v-icon>
                  {{ t('cheats.notInstalled') }}
                </template>
              </div>
              <div class="flex items-center gap-1.5">
                <template v-if="!getState(cheat.id).downloading && !getState(cheat.id).paused && !getState(cheat.id).error">
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    :title="t('media.title')"
                    @click.stop="openMedia(cheat)"
                  >
                    <v-icon size="18">photo_camera</v-icon>
                  </v-btn>
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    :title="t('cheatMods.button')"
                    @click.stop="openModsDialog(cheat)"
                  >
                    <v-icon size="18">extension</v-icon>
                  </v-btn>
                </template>

                <!-- Downloading: pause + cancel (and inline progress) -->
                <template v-if="getState(cheat.id).downloading">
                  <div class="flex items-center gap-1">
                    <v-progress-linear
                      :model-value="getState(cheat.id).percent"
                      color="primary"
                      rounded
                      style="width: 44px; height: 6px;"
                    />
                    <span class="text-[10px] font-medium text-primary">
                      {{ getState(cheat.id).percent }}%
                    </span>
                  </div>
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    color="warning"
                    title="Пауза"
                    @click.stop="pauseDownload(cheat.id)"
                  >
                    <v-icon size="18">pause</v-icon>
                  </v-btn>
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    color="error"
                    title="Отмена — удалить недокачанное"
                    @click.stop="discardDownload(cheat.id)"
                  >
                    <v-icon size="18">close</v-icon>
                  </v-btn>
                </template>

                <!-- Paused: resume + delete partial -->
                <template v-else-if="getState(cheat.id).paused">
                  <v-btn
                    color="primary"
                    variant="flat"
                    size="small"
                    @click.stop="startDownload(cheat.id)"
                  >
                    <v-icon start size="16">play_arrow</v-icon>
                    Продолжить
                  </v-btn>
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    color="error"
                    title="Удалить недокачанное"
                    @click.stop="discardDownload(cheat.id)"
                  >
                    <v-icon size="18">delete</v-icon>
                  </v-btn>
                </template>

                <!-- Failed: retry (or resume when a partial file is kept) -->
                <template v-else-if="getState(cheat.id).error">
                  <v-btn
                    color="error"
                    variant="outlined"
                    size="small"
                    @click.stop="startDownload(cheat.id)"
                  >
                    <v-icon start size="16">{{ getState(cheat.id).partialBytes > 0 ? 'play_arrow' : 'refresh' }}</v-icon>
                    {{ getState(cheat.id).partialBytes > 0 ? 'Продолжить' : t('cheats.retry') }}
                  </v-btn>
                  <v-btn
                    v-if="getState(cheat.id).partialBytes > 0"
                    icon
                    variant="text"
                    size="small"
                    color="error"
                    title="Удалить недокачанное"
                    @click.stop="discardDownload(cheat.id)"
                  >
                    <v-icon size="18">delete</v-icon>
                  </v-btn>
                </template>

                <!-- Idle with leftover partial file (e.g. after an app restart) -->
                <template v-else-if="getState(cheat.id).partialBytes > 0">
                  <v-btn
                    color="primary"
                    variant="flat"
                    size="small"
                    @click.stop="startDownload(cheat.id)"
                  >
                    <v-icon start size="16">play_arrow</v-icon>
                    Продолжить
                  </v-btn>
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    color="error"
                    title="Удалить недокачанное"
                    @click.stop="discardDownload(cheat.id)"
                  >
                    <v-icon size="18">delete</v-icon>
                  </v-btn>
                </template>

                <!-- Update: shown when the GitHub asset size/digest changed. -->
                <v-btn
                  v-else-if="getState(cheat.id).installed && getState(cheat.id).updateAvailable"
                  data-testid="resource-update-button"
                  :data-resource-id="cheat.id"
                  color="primary"
                  variant="flat"
                  size="small"
                  @click.stop="startDownload(cheat.id)"
                >
                  <v-icon start size="16">system_update_alt</v-icon>
                  Обновить
                </v-btn>

                <!-- Download (not installed) -->
                <v-btn
                  v-else-if="!getState(cheat.id).installed"
                  color="primary"
                  variant="flat"
                  size="small"
                  @click.stop="startDownload(cheat.id)"
                >
                  <v-icon start size="16">download</v-icon>
                  {{ t('cheats.download') }}
                </v-btn>

                <!-- Launch / cancel launch (installed) -->
                <template v-else>
                  <v-btn
                    v-if="launchingId !== cheat.id"
                    color="primary"
                    variant="flat"
                    size="small"
                    @click.stop="launchCheat(cheat.id)"
                  >
                    <v-icon start size="16">play_arrow</v-icon>
                    {{ t('cheats.launch') }}
                  </v-btn>
                  <v-btn
                    v-else
                    color="error"
                    variant="flat"
                    size="small"
                    @click.stop="cancelLaunch"
                  >
                    <v-icon start size="16">close</v-icon>
                    {{ t('cheats.cancel') }}
                  </v-btn>

                  <!-- Delete (installed, idle) -->
                  <v-btn
                    v-if="launchingId !== cheat.id"
                    icon
                    variant="text"
                    size="small"
                    color="error"
                    title="Удалить чит"
                    @click.stop="askDelete(cheat)"
                  >
                    <v-icon size="18">delete</v-icon>
                  </v-btn>
                </template>
              </div>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <v-dialog v-model="deleteDialog" max-width="440">
      <v-card>
        <v-card-title class="text-base font-bold">
          Удаление чита
        </v-card-title>
        <v-card-text>
          <p class="mb-3">
            Точно ли ты хочешь полностью удалить чит
            <b>{{ deleteTarget?.name }}</b>
            со всеми конфигурациями?
          </p>
          <p class="text-sm text-gray-500 mb-4">
            Будут удалены все файлы чита, настройки и добавленные моды. Скачать его можно будет заново.
          </p>
          <v-checkbox
            v-model="deleteConfirm"
            color="error"
            hide-details
            density="compact"
            label="Я точно хочу удалить чит со всеми конфигурациями"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">Отмена</v-btn>
          <v-btn
            color="error"
            variant="flat"
            :disabled="!deleteConfirm || deleting"
            :loading="deleting"
            @click="confirmDelete"
          >
            Удалить
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialog } from '../composables/dialog'
import { useCheatDownload, formatBytesRu } from '@/composables/useCheatDownload'
import { useCheatPrefs } from '@/composables/cheatPrefs'
import { useCheatLaunch } from '@/composables/useCheatLaunch'
import { cheats, type CheatEntry } from '@/composables/cheatCatalog'
import CheatStatsPanel from './CheatStatsPanel.vue'

const { t } = useI18n()
const shotsDialog = useDialog<{ title: string; kind: string; id: string }>('screenshots')
const modsDialog = useDialog<{ id: string; name: string; version: string }>('cheatmods')
const { checkAllInstalled, startDownload, pauseDownload, discardDownload, removeResource, getState } = useCheatDownload()
const { pins, recents, isPinned, togglePin } = useCheatPrefs('cheat')
const { launchingId, launchCheat, cancelLaunch } = useCheatLaunch()

const search = ref('')
const showPinnedOnly = ref(false)

const deleteDialog = ref(false)
const deleteTarget = ref<CheatEntry | null>(null)
const deleteConfirm = ref(false)
const deleting = ref(false)

function askDelete(cheat: CheatEntry) {
  deleteTarget.value = cheat
  deleteConfirm.value = false
  deleteDialog.value = true
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target || !deleteConfirm.value) return
  deleting.value = true
  try {
    await removeResource(target.id)
    deleteDialog.value = false
  } catch (e: any) {
    window.alert('Не удалось удалить чит: ' + (e?.message || String(e)))
  } finally {
    deleting.value = false
  }
}

function openMedia(cheat: { id: string; name: string }) {
  shotsDialog.show({ title: cheat.name, kind: 'cheat', id: cheat.id })
}

function openModsDialog(cheat: { id: string; name: string; version: string }) {
  modsDialog.show({ id: cheat.id, name: cheat.name, version: cheat.version })
}

function bytesLabel(id: string) {
  const s = getState(id)
  const done = formatBytesRu(s.bytes)
  return s.total > 0 ? `${done} / ${formatBytesRu(s.total)}` : done
}

function downloadLabel(id: string) {
  const s = getState(id)
  const base = s.total > 0 ? `${formatBytesRu(s.bytes)} / ${formatBytesRu(s.total)}` : formatBytesRu(s.bytes)
  return s.rateBytes > 0 ? `${base} · ${formatBytesRu(s.rateBytes)}/с` : base
}

function updateLabel(id: string) {
  const s = getState(id)
  if (s.installedSize > 0 && s.remoteSize > 0) {
    return `Обновление: ${formatBytesRu(s.installedSize)} → ${formatBytesRu(s.remoteSize)}`
  }
  return 'Доступно обновление'
}

onMounted(() => {
  // Check which cheats are installed
  checkAllInstalled(cheats.map(c => c.id))
})

const categories = [
  { id: 'legit', label: 'Легит', icon: 'verified_user' },
  { id: 'hvh', label: 'ХвХ', icon: 'local_fire_department' },
]

const selectedCategories = ref<string[]>([])
const selectedVersions = ref<string[]>([])
const pressedPill = ref<string | null>(null)

function animatePress(key: string) {
  pressedPill.value = key
  window.setTimeout(() => {
    if (pressedPill.value === key) pressedPill.value = null
  }, 300)
}

const versions = computed(() => {
  const set = new Set(cheats.map(c => c.version))
  return [...set].sort((a, b) => {
    const na = parseFloat(a) || 0
    const nb = parseFloat(b) || 0
    return nb - na
  })
})

const hasActiveFilters = computed(
  () => selectedCategories.value.length > 0
    || selectedVersions.value.length > 0
    || search.value.trim().length > 0
    || showPinnedOnly.value,
)

function isCategoryActive(id: string) {
  return selectedCategories.value.includes(id)
}

function toggleCategory(id: string) {
  const i = selectedCategories.value.indexOf(id)
  if (i >= 0) selectedCategories.value.splice(i, 1)
  else selectedCategories.value.push(id)
}

function toggleVersion(v: string) {
  const i = selectedVersions.value.indexOf(v)
  if (i >= 0) selectedVersions.value.splice(i, 1)
  else selectedVersions.value.push(v)
}

function resetFilters() {
  selectedCategories.value = []
  selectedVersions.value = []
  search.value = ''
  showPinnedOnly.value = false
}

function countFor(key: string, kind: 'categories' | 'versions') {
  if (kind === 'categories') {
    return cheats.filter(c => c.categories.includes(key)).length
  }
  return cheats.filter(c => c.version === key).length
}

const filteredCheats = computed(() => {
  const cats = selectedCategories.value
  const vers = selectedVersions.value
  const q = search.value.trim().toLowerCase()
  let list = cheats
  if (cats.length > 0 || vers.length > 0) {
    list = list.filter(c => {
      const inCat = cats.length === 0 || c.categories.some(cat => cats.includes(cat))
      const inVer = vers.length === 0 || vers.includes(c.version)
      return inCat && inVer
    })
  }
  if (q) {
    list = list.filter(c =>
      c.name.toLowerCase().includes(q)
      || c.description.toLowerCase().includes(q)
      || c.id.includes(q),
    )
  }
  if (showPinnedOnly.value) {
    list = list.filter(c => isPinned(c.id))
  }
  const pinned = list.filter(c => isPinned(c.id))
  const rest = list.filter(c => !isPinned(c.id))
  return [...pinned, ...rest]
})

const recentCheats = computed(() =>
  recents.value
    .map(r => cheats.find(c => c.id === r.id))
    .filter((c): c is CheatEntry => !!c),
)

function focusCheat(id: string) {
  const el = document.getElementById(`cheat-card-${id}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('cheat-card--flash')
  window.setTimeout(() => el.classList.remove('cheat-card--flash'), 1200)
}
</script>

<style scoped>
.cheats-filter-bar {
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid rgba(128, 128, 128, 0.16);
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 1px 0 rgba(128, 128, 128, 0.06);
  backdrop-filter: blur(8px);
}

.cheat-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border-radius: 999px;
  cursor: pointer;
  border: 1px solid rgba(128, 128, 128, 0.18);
  background: rgba(128, 128, 128, 0.06);
  color: rgb(var(--v-theme-on-surface));
  font-size: 13px;
  font-weight: 500;
  transition: all 0.18s ease;
  user-select: none;
}

.cheat-pill:hover {
  background: rgba(128, 128, 128, 0.12);
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
}

.cheat-pill:active {
  transform: translateY(0) scale(0.9);
}

.cheat-pill--pop {
  animation: cheat-pill-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.cheat-pill--pop .cheat-pill__icon {
  animation: cheat-icon-bounce 0.3s ease;
}

.cheat-pill--pop .cheat-pill__count {
  animation: cheat-count-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes cheat-pill-pop {
  0% {
    transform: scale(0.85);
  }
  60% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes cheat-icon-bounce {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.35) rotate(-8deg);
  }
  100% {
    transform: scale(1) rotate(0);
  }
}

@keyframes cheat-count-pop {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.5);
  }
  100% {
    transform: scale(1);
  }
}

/* Animated ping on the active pill */
.cheat-pill--active .cheat-pill__icon {
  animation: cheat-icon-active 1.2s ease-in-out infinite;
}

@keyframes cheat-icon-active {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}

.cheat-pill__icon {
  display: inline-flex;
  align-items: center;
}

.cheat-pill__count {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.18);
  color: inherit;
}

.cheat-pill__label {
  line-height: 1;
  white-space: nowrap;
}

/* Category active states */
.cheat-pill--legit.cheat-pill--active {
  border-color: #10b981;
  background: linear-gradient(135deg, #047857, #10b981);
  color: #fff;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
}
.cheat-pill--legit.cheat-pill--active .cheat-pill__count {
  background: rgba(255, 255, 255, 0.25);
}

.cheat-pill--hvh.cheat-pill--active {
  border-color: #ef4444;
  background: linear-gradient(135deg, #b91c1c, #ef4444);
  color: #fff;
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
}
.cheat-pill--hvh.cheat-pill--active .cheat-pill__count {
  background: rgba(255, 255, 255, 0.25);
}

/* Version active state */
.cheat-pill--version.cheat-pill--active {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  box-shadow: 0 4px 14px rgba(var(--v-theme-primary), 0.35);
}
.cheat-pill--version.cheat-pill--active .cheat-pill__count {
  background: rgba(255, 255, 255, 0.25);
}

.cheat-filter-divider {
  width: 1px;
  height: 26px;
  background: rgba(128, 128, 128, 0.2);
}

.cheat-filter-reset {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--v-theme-error));
  border: 1px solid transparent;
  background: transparent;
  transition: all 0.18s ease;
}

.cheat-filter-reset:hover {
  background: rgba(var(--v-theme-error), 0.12);
  border-color: rgba(var(--v-theme-error), 0.3);
}

.explore-card {
  z-index: 1;
  border: 1px solid rgba(128, 128, 128, 0.12);
  cursor: default;
}

.explore-card__media {
  background-color: rgba(0, 0, 0, 0.05);
}

.explore-card__gradient {
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.65) 0%,
    rgba(0, 0, 0, 0.15) 35%,
    rgba(0, 0, 0, 0) 60%
  );
}

.explore-card__source {
  font-size: 10px;
  letter-spacing: 0.06em;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.explore-card__avatar {
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 2px solid rgb(var(--v-theme-surface));
  background-color: rgb(var(--v-theme-surface));
  position: relative;
  z-index: 1;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 20px;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.4);
}

.theme--dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
}

.theme--dark .custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
}

/* Grid entrance animations */
.cheat-list-enter-active {
  transition: all 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.cheat-list-leave-active {
  transition: all 0.25s ease;
  position: absolute;
  width: 100%;
}

.cheat-list-enter-from {
  opacity: 0;
  transform: translateY(18px) scale(0.96);
}

.cheat-list-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}

.cheat-list-move {
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

/* Search */
.cheat-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 240px;
  max-width: 340px;
  padding: 7px 12px;
  border-radius: 12px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  background: rgba(128, 128, 128, 0.06);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.cheat-search:focus-within {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.15);
}

.cheat-search__icon {
  opacity: 0.55;
}

.cheat-search__input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
}

.cheat-search__input::placeholder {
  color: inherit;
  opacity: 0.45;
}

.cheat-search__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.cheat-search__clear:hover {
  opacity: 1;
  transform: scale(1.1);
}

/* Pinned pill */
.cheat-pill--pinned.cheat-pill--active {
  border-color: #f59e0b;
  background: linear-gradient(135deg, #b45309, #f59e0b);
  color: #fff;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
}

.cheat-pill--pinned.cheat-pill--active .cheat-pill__count {
  background: rgba(255, 255, 255, 0.25);
}

/* Star on cards */
.cheat-star {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: all 0.18s ease;
  opacity: 0.85;
}

.cheat-star:hover {
  transform: scale(1.12);
  opacity: 1;
  background: rgba(0, 0, 0, 0.6);
}

.cheat-star--on {
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.55);
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.35);
}

/* Recents */
.recent-strip {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.recent-strip__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.6;
}

.recent-strip__items {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.recent-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px;
  border-radius: 999px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  background: rgba(128, 128, 128, 0.06);
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
  font-size: 12.5px;
  font-weight: 500;
  transition: all 0.18s ease;
}

.recent-chip:hover {
  transform: translateY(-1px);
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.recent-chip__logo {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  object-fit: cover;
}

/* Card flash when focused from the recents strip */
.cheat-card--flash {
  animation: cheat-card-flash 1.1s ease;
}

@keyframes cheat-card-flash {
  0%,
  100% {
    box-shadow: none;
  }
  30% {
    box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.55), 0 8px 30px rgba(var(--v-theme-primary), 0.3);
  }
}

/* Empty state */
.cheats-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 64px 20px;
  animation: cheat-pill-pop 0.35s ease;
}

.cheats-empty__icon {
  width: 76px;
  height: 76px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-primary), 0.1);
  margin-bottom: 14px;
}

.cheats-empty__title {
  font-weight: 700;
  font-size: 16px;
}

.cheats-empty__hint {
  font-size: 13px;
  opacity: 0.6;
  margin-top: 4px;
}

.cheats-empty__reset {
  margin-left: 0;
}
</style>
