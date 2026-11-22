<template>
  <div class="visuals-page h-full flex flex-col overflow-hidden" data-testid="visuals-page">
    <div class="flex-none px-6 lg:px-10 pt-6 pb-2">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="min-w-0">
          <h1 class="text-2xl font-bold flex items-center gap-3">
            <v-icon color="primary" size="large">palette</v-icon>
            {{ t('visuals.name') }}
          </h1>
          <p class="text-gray-500 dark:text-gray-300 text-sm mt-1">
            {{ t('visuals.subtitle') }}
          </p>
        </div>
        <v-menu>
          <template #activator="{ props: menuProps }">
            <v-btn v-bind="menuProps" color="primary" variant="tonal">
              <v-icon start size="18">extension</v-icon>
              {{ t('visualMods.button') }}
            </v-btn>
          </template>
          <v-list>
            <v-list-item
              v-for="v in modifiableVisuals"
              :key="v.id"
              :title="v.name"
              @click="openModsDialog(v)"
            />
          </v-list>
        </v-menu>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="flex-none px-6 lg:px-10 pb-4">
      <div class="visuals-filter-bar">
        <div class="flex flex-wrap items-center gap-3">
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
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
      <div v-if="recentVisuals.length" class="recent-strip mb-6">
        <span class="recent-strip__label">
          <v-icon size="15">history</v-icon>
          Недавние
        </span>
        <div class="recent-strip__items">
          <button
            v-for="r in recentVisuals"
            :key="r.id"
            class="recent-chip"
            :title="`Показать ${r.name}`"
            @click="focusVisual(r.id)"
          >
            <img v-if="r.logo" :src="r.logo" class="recent-chip__logo" alt="" />
            <span class="recent-chip__name">{{ r.name }}</span>
          </button>
        </div>
      </div>

      <div v-if="filteredVisuals.length === 0" class="cheats-empty">
        <div class="cheats-empty__icon">
          <v-icon size="42" color="primary">search_off</v-icon>
        </div>
        <p class="cheats-empty__title">Ничего не найдено</p>
        <p class="cheats-empty__hint">Попробуй изменить запрос или сбросить фильтры</p>
        <button class="cheat-filter-reset" @click="resetFilters">
          <v-icon :size="15">restart_alt</v-icon>
          Сбросить фильтры
        </button>
      </div>

      <TransitionGroup
        name="visual-list"
        tag="div"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6"
      >
        <div
          v-for="visual in filteredVisuals"
          :id="`visual-card-${visual.id}`"
          :key="visual.id"
          class="explore-card surface-card-clickable group relative overflow-hidden flex flex-col h-full rounded-xl"
          :class="{ 'explore-card--launcher': visual.launcherVisual }"
          tabindex="0"
        >
          <div class="explore-card__media aspect-[16/9] relative overflow-hidden bg-surface-variant/30 flex items-center justify-center">
            <img
              v-if="visual.cover"
              :src="visual.cover"
              class="absolute inset-0 w-full h-full object-cover"
              alt=""
            />
            <div v-else class="explore-card__placeholder flex flex-col items-center gap-2 opacity-30">
              <v-icon :size="48" color="primary">palette</v-icon>
              <span class="text-xs font-semibold uppercase tracking-wider">{{ visual.name }}</span>
            </div>
            <div class="explore-card__gradient absolute inset-0 pointer-events-none" />
            <div v-if="visual.launcherVisual" class="launcher-visual-overlay absolute inset-0 pointer-events-none" />
            <button
              class="cheat-star"
              :class="{ 'cheat-star--on': isPinned(visual.id) }"
              :title="isPinned(visual.id) ? 'Открепить' : 'Закрепить'"
              @click.stop="togglePin(visual.id)"
            >
              <v-icon size="18">{{ isPinned(visual.id) ? 'star' : 'star_border' }}</v-icon>
            </button>
            <div class="absolute top-3 right-3">
              <div class="flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 backdrop-blur-md">
                <v-icon size="12" color="white" class="material-icons-outlined">sell</v-icon>
                <span class="text-[10px] font-semibold text-white">{{ visual.version }}</span>
              </div>
            </div>
            <div
              v-if="visual.launcherVisual"
              class="launcher-visual-badge"
              data-testid="fastvisual-launcher-badge"
            >
              <v-icon size="15">check_box</v-icon>
              <span>Визуал лаунчера</span>
            </div>
          </div>

          <div class="explore-card__content p-4 flex flex-col flex-1 gap-2.5">
            <div class="flex items-center gap-3">
              <div class="explore-card__avatar w-12 h-12 rounded-xl shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  v-if="visual.logo"
                  :src="visual.logo"
                  class="w-full h-full object-cover"
                  alt=""
                />
                <v-icon v-else color="primary">palette</v-icon>
              </div>
              <div class="overflow-hidden min-w-0 flex-1">
                <h3 class="my-0 mt-1 font-bold text-base leading-tight truncate text-gray-900 dark:text-white">
                  {{ visual.name }}
                </h3>
              </div>
            </div>

            <p class="text-xs text-gray-700 dark:text-gray-400 line-clamp-3 leading-relaxed">
              {{ visual.description }}
            </p>

            <div class="mt-auto pt-2.5 flex items-center justify-between gap-2 border-t border-gray-200/20">
              <div class="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400 min-w-0">
                <template v-if="getState(visual.id).downloading">
                  <v-icon size="13" color="warning">downloading</v-icon>
                  <span class="truncate">{{ downloadLabel(visual.id) }}</span>
                </template>
                <template v-else-if="getState(visual.id).paused">
                  <v-icon size="13" color="warning">pause_circle</v-icon>
                  <span class="truncate">Пауза · {{ bytesLabel(visual.id) }}</span>
                </template>
                <template v-else-if="getState(visual.id).error">
                  <v-icon size="13" color="error">error</v-icon>
                  <span class="truncate" :title="getState(visual.id).error ?? undefined">{{ getState(visual.id).error }}</span>
                </template>
                <template v-else-if="getState(visual.id).partialBytes > 0">
                  <v-icon size="13" color="warning">downloading</v-icon>
                  <span class="truncate">Недокачано: {{ formatBytesRu(getState(visual.id).partialBytes) }}</span>
                </template>
                <template v-else-if="getState(visual.id).installed && getState(visual.id).updateAvailable">
                  <v-icon size="13" color="primary">system_update_alt</v-icon>
                  <span class="truncate">{{ updateLabel(visual.id) }}</span>
                </template>
                <template v-else-if="getState(visual.id).installed">
                  <v-icon size="13" color="success">check_circle</v-icon>
                  {{ t('visuals.ready') }}
                </template>
                <template v-else>
                  <v-icon size="13" color="grey">cloud_download</v-icon>
                  {{ t('visuals.notInstalled') }}
                </template>
              </div>
              <div class="flex items-center gap-1.5">
                <template v-if="visual.allowCustomMods !== false && !getState(visual.id).downloading && !getState(visual.id).paused && !getState(visual.id).error">
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    :title="t('media.title')"
                    @click.stop="openMedia(visual)"
                  >
                    <v-icon size="18">photo_camera</v-icon>
                  </v-btn>
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    :title="t('visualMods.button')"
                    @click.stop="openModsDialog(visual)"
                  >
                    <v-icon size="18">extension</v-icon>
                  </v-btn>
                </template>

                <!-- Downloading: pause + cancel (and inline progress) -->
                <template v-if="getState(visual.id).downloading">
                  <div class="flex items-center gap-1">
                    <v-progress-linear
                      :model-value="getState(visual.id).percent"
                      color="primary"
                      rounded
                      style="width: 44px; height: 6px;"
                    />
                    <span class="text-[10px] font-medium text-primary">
                      {{ getState(visual.id).percent }}%
                    </span>
                  </div>
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    color="warning"
                    title="Пауза"
                    @click.stop="pauseDownload(visual.id)"
                  >
                    <v-icon size="18">pause</v-icon>
                  </v-btn>
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    color="error"
                    title="Отмена — удалить недокачанное"
                    @click.stop="discardDownload(visual.id)"
                  >
                    <v-icon size="18">close</v-icon>
                  </v-btn>
                </template>

                <!-- Paused: resume + delete partial -->
                <template v-else-if="getState(visual.id).paused">
                  <v-btn
                    color="primary"
                    variant="flat"
                    size="small"
                    @click.stop="startDownload(visual.id)"
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
                    @click.stop="discardDownload(visual.id)"
                  >
                    <v-icon size="18">delete</v-icon>
                  </v-btn>
                </template>

                <!-- Failed: retry (or resume when a partial file is kept) -->
                <template v-else-if="getState(visual.id).error">
                  <v-btn
                    color="error"
                    variant="outlined"
                    size="small"
                    @click.stop="startDownload(visual.id)"
                  >
                    <v-icon start size="16">{{ getState(visual.id).partialBytes > 0 ? 'play_arrow' : 'refresh' }}</v-icon>
                    {{ getState(visual.id).partialBytes > 0 ? 'Продолжить' : t('visuals.retry') }}
                  </v-btn>
                  <v-btn
                    v-if="getState(visual.id).partialBytes > 0"
                    icon
                    variant="text"
                    size="small"
                    color="error"
                    title="Удалить недокачанное"
                    @click.stop="discardDownload(visual.id)"
                  >
                    <v-icon size="18">delete</v-icon>
                  </v-btn>
                </template>

                <!-- Idle with leftover partial file (e.g. after an app restart) -->
                <template v-else-if="getState(visual.id).partialBytes > 0">
                  <v-btn
                    color="primary"
                    variant="flat"
                    size="small"
                    @click.stop="startDownload(visual.id)"
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
                    @click.stop="discardDownload(visual.id)"
                  >
                    <v-icon size="18">delete</v-icon>
                  </v-btn>
                </template>

                <!-- Update: shown when the GitHub asset size/digest changed. -->
                <v-btn
                  v-else-if="getState(visual.id).installed && getState(visual.id).updateAvailable"
                  data-testid="resource-update-button"
                  :data-resource-id="visual.id"
                  color="primary"
                  variant="flat"
                  size="small"
                  @click.stop="startDownload(visual.id)"
                >
                  <v-icon start size="16">system_update_alt</v-icon>
                  Обновить
                </v-btn>

                <!-- Download (not installed) -->
                <v-btn
                  v-else-if="!getState(visual.id).installed"
                  color="primary"
                  variant="flat"
                  size="small"
                  @click.stop="startDownload(visual.id)"
                >
                  <v-icon start size="16">download</v-icon>
                  {{ t('visuals.download') }}
                </v-btn>

                <!-- Launch / cancel launch (installed) -->
                <template v-else>
                  <v-btn
                    v-if="launchingId !== visual.id"
                    color="primary"
                    variant="flat"
                    size="small"
                    @click.stop="launchVisual(visual.id)"
                  >
                    <v-icon start size="16">play_arrow</v-icon>
                    {{ t('visuals.launch') }}
                  </v-btn>
                  <v-btn
                    v-else
                    color="error"
                    variant="flat"
                    size="small"
                    @click.stop="cancelLaunch"
                  >
                    <v-icon start size="16">close</v-icon>
                    {{ t('visuals.cancel') }}
                  </v-btn>

                  <!-- Delete (installed, idle) -->
                  <v-btn
                    v-if="launchingId !== visual.id"
                    icon
                    variant="text"
                    size="small"
                    color="error"
                    title="Удалить визуал"
                    @click.stop="askDelete(visual)"
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
          Удаление визуала
        </v-card-title>
        <v-card-text>
          <p class="mb-3">
            Точно ли ты хочешь полностью удалить визуал
            <b>{{ deleteTarget?.name }}</b>
            со всеми конфигурациями?
          </p>
          <p class="text-sm text-gray-500 mb-4">
            Будут удалены все файлы визуала, настройки и добавленные моды. Скачать его можно будет заново.
          </p>
          <v-checkbox
            v-model="deleteConfirm"
            color="error"
            hide-details
            density="compact"
            label="Я точно хочу удалить визуал со всеми конфигурациями"
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
import pulseLogo from '@/assets/pulsevisual-logo.png'
import pulseCover from '@/assets/pulsevisual-cover.png'
import reallyLogo from '@/assets/reallyvisual-logo.png'
import reallyCover from '@/assets/reallyvisual-cover.png'
import cabbitVisualLogo from '@/assets/cabbitrecode-logo.png'
import cabbitVisualCover from '@/assets/cabbitrecode-cover.png'
import feverLogo from '@/assets/fevervisual-logo.png'
import feverCover from '@/assets/fevervisual-cover.png'
import fastVisualLogo from '@/assets/fastvisual-logo.png'
import fastVisualCover from '@/assets/fastvisual-cover.png'
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialog } from '../composables/dialog'
import { useCheatDownload, formatBytesRu } from '@/composables/useCheatDownload'
import { useCheatPrefs } from '@/composables/cheatPrefs'

const { t } = useI18n()
const { checkAllInstalled, startDownload, pauseDownload, discardDownload, removeResource, getState } = useCheatDownload()
const { pins, recents, isPinned, togglePin, markRecent } = useCheatPrefs('visual')
const launchingId = ref<string | null>(null)
const shotsDialog = useDialog<{ title: string; kind: string; id: string }>('screenshots')
const modsDialog = useDialog<{ id: string; name: string; version: string }>('visualmods')

const search = ref('')
const showPinnedOnly = ref(false)
const pressedPill = ref<string | null>(null)

function animatePress(key: string) {
  pressedPill.value = key
  window.setTimeout(() => {
    if (pressedPill.value === key) pressedPill.value = null
  }, 300)
}

function resetFilters() {
  search.value = ''
  showPinnedOnly.value = false
}

function focusVisual(id: string) {
  const el = document.getElementById(`visual-card-${id}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('cheat-card--flash')
  window.setTimeout(() => el.classList.remove('cheat-card--flash'), 1200)
}

const deleteDialog = ref(false)
const deleteTarget = ref<VisualEntry | null>(null)
const deleteConfirm = ref(false)
const deleting = ref(false)

function askDelete(visual: VisualEntry) {
  deleteTarget.value = visual
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
    window.alert('Не удалось удалить визуал: ' + (e?.message || String(e)))
  } finally {
    deleting.value = false
  }
}

function openMedia(visual: { id: string; name: string }) {
  shotsDialog.show({ title: visual.name, kind: 'visual', id: visual.id })
}

function openModsDialog(visual: { id: string; name: string; version: string; allowCustomMods?: boolean }) {
  if (visual.allowCustomMods === false) return
  modsDialog.show({ id: visual.id, name: visual.name, version: visual.version })
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
  windowController.on('cheat-exited', (visualId: string) => {
    if (launchingId.value === visualId) {
      launchingId.value = null
    }
    windowController.show()
  })
  windowController.on('cheat-error', (data: { id: string; message: string }) => {
    launchingId.value = null
    windowController.show()
    window.alert('Ошибка запуска ' + data.id + ': ' + data.message)
  })
  checkAllInstalled(visuals.map(v => v.id))
})

interface VisualEntry {
  id: string
  name: string
  version: string
  description: string
  logo?: string
  cover?: string
  launcherVisual?: boolean
  allowCustomMods?: boolean
}

const visuals: VisualEntry[] = [
  {
    id: 'fastvisual',
    name: 'FastVisual',
    version: '1.21.4',
    description: 'Лучшее решение в визуалах, оптимизация - наш приоритет.',
    logo: fastVisualLogo,
    cover: fastVisualCover,
    launcherVisual: true,
    allowCustomMods: false,
  },
  {
    id: 'pulsevisual',
    name: 'PulseVisuals',
    version: '1.21.11',
    description: 'Pulse создан для тех, кто ценит стиль, удобство и максимальную производительность.',
    logo: pulseLogo,
    cover: pulseCover,
  },
  {
    id: 'reallyvisual',
    name: 'ReallyVisuals',
    version: '1.16.5',
    description: 'ReallyVisuals — современный Minecraft клиент с продвинутыми визуальными модулями, настраиваемым HUD и полезными игровыми утилитами.',
    logo: reallyLogo,
    cover: reallyCover,
  },
  {
    id: 'cabbitvisual',
    name: 'Cabbit Visual',
    version: '1.21.4',
    description: 'Сabbit Recode - доминируй над всеми',
    logo: cabbitVisualLogo,
    cover: cabbitVisualCover,
  },
  {
    id: 'fevervisual',
    name: 'FeverVisuals',
    version: '1.21.1',
    description: 'Fever - это идеальный мод для тех, кто ценит стиль, удобство и высокую производительность.',
    logo: feverLogo,
    cover: feverCover,
  },
]

const modifiableVisuals = computed(() => visuals.filter(v => v.allowCustomMods !== false))

const filteredVisuals = computed(() => {
  const q = search.value.trim().toLowerCase()
  let list = visuals
  if (q) {
    list = list.filter(v =>
      v.name.toLowerCase().includes(q)
      || v.description.toLowerCase().includes(q)
      || v.id.includes(q),
    )
  }
  if (showPinnedOnly.value) {
    list = list.filter(v => isPinned(v.id))
  }
  const pinned = list.filter(v => isPinned(v.id))
  const rest = list.filter(v => !isPinned(v.id))
  return [...pinned, ...rest]
})

const recentVisuals = computed(() =>
  recents.value
    .map(r => visuals.find(v => v.id === r.id))
    .filter((v): v is VisualEntry => !!v),
)

async function launchVisual(id: string) {
  launchingId.value = id
  try {
    const launchMap: Record<string, () => Promise<void>> = {
      pulsevisual: () => windowController.launchPulseVisual(),
      reallyvisual: () => windowController.launchReallyVisual(),
      cabbitvisual: () => windowController.launchCabbitVisual(),
      fevervisual: () => windowController.launchFeverVisual(),
      fastvisual: () => windowController.launchFastVisual(),
    }
    const fn = launchMap[id]
    if (fn) {
      await fn()
      markRecent(id)
      windowController.hide()
    }
  } catch (e: any) {
    if (e?.message === 'canceled') {
      launchingId.value = null
      return
    }
    console.error('Failed to launch visual:', e)
    window.alert('Ошибка запуска: ' + (e?.message || String(e)))
    launchingId.value = null
  }
}

function cancelLaunch() {
  const id = launchingId.value
  launchingId.value = null
  if (id) {
    windowController.cancelCheat(id).catch(() => {})
  }
}
</script>

<style scoped>
.visuals-filter-bar {
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

.cheat-filter-reset {
  display: inline-flex;
  align-items: center;
  gap: 5px;
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

.explore-card {
  z-index: 1;
  border: 1px solid rgba(128, 128, 128, 0.12);
  cursor: default;
}

.explore-card--launcher {
  border-color: rgba(var(--v-theme-primary), 0.72);
  box-shadow:
    0 0 0 1px rgba(var(--v-theme-primary), 0.28),
    0 16px 38px -22px rgba(var(--v-theme-primary), 0.9);
}

.explore-card--launcher:hover,
.explore-card--launcher:focus-visible {
  border-color: rgb(var(--v-theme-primary));
  box-shadow:
    0 0 0 1px rgba(var(--v-theme-primary), 0.48),
    0 20px 48px -20px rgba(var(--v-theme-primary), 0.95);
}

.launcher-visual-overlay {
  z-index: 1;
  background:
    linear-gradient(135deg, rgba(var(--v-theme-primary), 0.28), transparent 44%),
    linear-gradient(to top, rgba(var(--v-theme-primary), 0.22), transparent 50%);
  box-shadow: inset 0 0 32px rgba(var(--v-theme-primary), 0.2);
}

.launcher-visual-badge {
  position: absolute;
  left: 12px;
  bottom: 11px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 9px;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.01em;
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.96), rgba(var(--v-theme-primary), 0.66));
  border: 1px solid rgba(255, 255, 255, 0.32);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(10px);
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
.visual-list-enter-active {
  transition: all 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.visual-list-leave-active {
  transition: all 0.25s ease;
  position: absolute;
  width: 100%;
}

.visual-list-enter-from {
  opacity: 0;
  transform: translateY(18px) scale(0.96);
}

.visual-list-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}

.visual-list-move {
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
</style>
