<template>
  <div class="instance-store h-full flex flex-col overflow-hidden">
    <div class="flex items-center gap-2 px-6 py-3 border-b border-divider/40">
      <v-btn
        v-for="cat in categoryOptions"
        :key="cat.value"
        :variant="projectType === cat.value ? 'flat' : 'text'"
        :color="projectType === cat.value ? 'primary' : undefined"
        @click="selectCategory(cat.value)"
        size="small"
      >
        <v-icon start>{{ cat.icon }}</v-icon>
        {{ cat.label }}
      </v-btn>
    </div>

    <div class="store-search-bar flex-none px-6 lg:px-10 py-5 z-10">
      <div class="max-w-3xl">
        <v-text-field
          v-model="keyword"
          variant="solo"
          flat
          hide-details
          rounded="xl"
          density="comfortable"
          :placeholder="t('shared.search')"
          prepend-inner-icon="search"
          class="elevated-search"
        />
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <aside
        class="w-auto lg:w-72 flex-none border-r border-divider/40 px-4 pt-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar"
      >
        <div class="filter-group">
          <h3 class="filter-title">{{ t('modrinth.gameVersions.name') }}</h3>
          <v-autocomplete
            v-model="gameVersion"
            :items="gameVersions"
            item-title="version"
            item-value="version"
            variant="solo"
            density="compact"
            rounded="lg"
            clearable
            hide-details
            :placeholder="t('modrinth.gameVersions.name')"
          />
        </div>

        <div v-if="projectType === 'mod'" class="filter-group">
          <h3 class="filter-title">{{ t('modrinth.modLoaders.name') }}</h3>
          <div class="flex flex-wrap gap-2">
            <v-chip
              v-for="loader in modLoaderOptions"
              :key="loader.value"
              :variant="modLoaders.includes(loader.value) ? 'flat' : 'outlined'"
              :color="modLoaders.includes(loader.value) ? 'primary' : undefined"
              size="small"
              @click="toggleModLoader(loader.value)"
            >
              {{ loader.label }}
            </v-chip>
          </div>
        </div>

        <FilterCard
          :title="t('modrinth.categories.name')"
          :items="categoryItems"
          :selected="selectedCategories"
          :selected-count="selectedCategories.length"
          @toggle="toggleCategory"
          @clear="selectedCategories = []"
        />
      </aside>

      <div class="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
        <div class="flex items-end justify-between mb-6 gap-2">
          <div>
            <h2 class="text-2xl font-bold flex items-center gap-3">
              <v-icon color="primary" size="large">search</v-icon>
              {{ hasFilters ? t('store.searchResult') : t('store.discover') }}
            </h2>
            <p class="text-gray-500 dark:text-gray-300 text-sm mt-1">
              {{ t('modrinth.projects', { count: items.length }) }}
            </p>
          </div>
        </div>

        <div v-if="loading" class="flex justify-center py-12">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <div
          v-else-if="items.length === 0"
          class="flex flex-col justify-center items-center h-96 text-center opacity-50"
        >
          <v-icon size="96" color="grey">mood_bad</v-icon>
          <h3 class="text-2xl font-bold mt-4">{{ t('store.empty') }}</h3>
          <p class="text-gray-400 mt-2">{{ t('store.emptyHint') }}</p>
        </div>

        <div
          v-else
          v-roving-tabindex
          role="group"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-20"
        >
          <StoreExploreCardModern
            v-for="mod in items"
            :key="mod.id"
            :value="mod"
            @click="openProject(mod)"
          />
        </div>

        <div v-if="pageCount > 1" class="flex justify-center mt-8">
          <v-pagination
            v-model="page"
            :length="pageCount"
            active-color="primary"
            :disabled="loading"
            :total-visible="7"
            rounded="circle"
            density="comfortable"
          />
        </div>
      </div>
    </div>

    <v-dialog v-model="dialogOpen" max-width="640">
      <v-card v-if="selectedProjectData">
        <v-card-title class="flex items-center gap-3 pt-4 px-6">
          <img
            :src="selectedProjectData.iconUrl"
            class="w-10 h-10 rounded-lg object-cover shrink-0"
          />
          <span class="truncate text-lg font-bold">{{ selectedProjectData.title }}</span>
        </v-card-title>
        <v-card-text class="px-6 pb-4">
          <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 mb-4">
            {{ selectedProjectData.description }}
          </p>
          <v-select
            v-model="selectedVersion"
            :items="projectVersions"
            item-title="displayName"
            item-value="id"
            :label="t('modrinth.versions')"
            return-object
            variant="outlined"
            density="compact"
            hide-details
            v-if="projectVersions.length > 0"
          />
          <v-alert v-else type="info" class="mt-2">
            {{ t('modrinth.noCompatibleVersions') }}
          </v-alert>
        </v-card-text>
        <v-card-actions class="px-6 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="dialogOpen = false">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="installing"
            :disabled="!selectedVersion"
            @click="installVersion"
          >
            <v-icon start>download</v-icon>
            {{ t('instanceStore.installToInstance') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import FilterCard from '@/components/FilterCard.vue'
import StoreExploreCardModern, { ExploreProjectModern } from '@/components/StoreExploreCardModern.vue'
import { kInstance } from '@/composables/instance'
import { kModrinthTags } from '@/composables/modrinth'
import { useModrinth } from '@/composables/modrinth'
import { useNotifier } from '@/composables/notifier'
import { useQuery } from '@/composables/query'
import { useService } from '@/composables/service'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import {
  InstanceModsServiceKey,
  InstanceResourcePacksServiceKey,
  InstanceShaderPacksServiceKey,
  MarketType,
} from '@xmcl/runtime-api'
import { useDateString } from '@/composables/date'
import { useSortByItems } from '@/composables/sortBy'

const { t } = useI18n()
const { push } = useRouter()
const { getDateString } = useDateString()
const { notify } = useNotifier()
const { path: instancePath } = injection(kInstance)
const { gameVersions, categories, modLoaders: modrinthLoaders } = injection(kModrinthTags)
const sortByItems = useSortByItems()

const projectType = ref('mod')
const keyword = ref('')
const gameVersion = ref('')
const modLoaders = ref<string[]>([])
const selectedCategories = ref<string[]>([])
const page = ref(1)
const pageSize = 20

const categoryOptions = [
  { value: 'mod', label: t('mod.name', 2), icon: 'extension' },
  { value: 'resourcepack', label: t('resourcepack.name', 2), icon: 'palette' },
  { value: 'shader', label: t('shaderPack.name', 2), icon: 'gradient' },
]

const modLoaderOptions = computed(() =>
  modrinthLoaders.value
    .filter((l) => l.supported_project_types?.includes('mod'))
    .map((l) => ({
      value: l.name,
      label: l.name.charAt(0).toUpperCase() + l.name.slice(1),
    }))
)

const categoryItems = computed(() =>
  categories.value
    .filter((c) => c.project_type === projectType.value)
    .map((c) => ({
      id: c.name,
      text: t(`modrinth.categories.${c.name}`, c.name),
      iconHTML: c.icon,
    }))
)

const hasFilters = computed(() => !!keyword.value || !!gameVersion.value || modLoaders.value.length > 0 || selectedCategories.value.length > 0)

function selectCategory(cat: string) {
  projectType.value = cat
  page.value = 1
  selectedCategories.value = []
  modLoaders.value = []
}

function toggleModLoader(loader: string) {
  const idx = modLoaders.value.indexOf(loader)
  if (idx >= 0) {
    modLoaders.value.splice(idx, 1)
  } else {
    modLoaders.value.push(loader)
  }
}

function toggleCategory(id: string) {
  const idx = selectedCategories.value.indexOf(id)
  if (idx >= 0) {
    selectedCategories.value.splice(idx, 1)
  } else {
    selectedCategories.value.push(id)
  }
}

const {
  projects,
  pageCount,
  refreshing: loading,
} = useModrinth(
  keyword,
  gameVersion,
  '',
  selectedCategories,
  modLoaders,
  '',
  computed(() => undefined),
  projectType,
  page,
  ref(pageSize),
)

const items = computed<ExploreProjectModern[]>(() =>
  projects.value.map((p) => ({
    id: p.project_id,
    type: 'modrinth',
    title: p.title,
    iconUrl: p.icon_url,
    description: p.description,
    author: p.author,
    downloadCount: getExpectedSize(p.downloads, ''),
    updatedAt: getDateString(p.date_modified),
    version: p.versions[p.versions.length - 1],
    gallery: p.gallery,
  }))
)

const dialogOpen = ref(false)
const installing = ref(false)
const selectedProjectData = ref<ExploreProjectModern | null>(null)
const projectVersions = ref<any[]>([])
const selectedVersion = ref<any>(null)

async function openProject(project: ExploreProjectModern) {
  selectedProjectData.value = project
  selectedVersion.value = null
  projectVersions.value = []
  dialogOpen.value = true

  try {
    const versions = await clientModrinthV2.getProjectVersions(project.id, {
      gameVersions: gameVersion.value ? [gameVersion.value] : undefined,
    })
    projectVersions.value = versions.map((v) => ({
      id: v.id,
      displayName: `${v.name} (${v.game_versions?.join(', ') || ''})`,
      versionNumber: v.version_number,
      loaders: v.loaders,
    }))
    if (projectVersions.value.length > 0) {
      selectedVersion.value = projectVersions.value[0]
    }
  } catch (e) {
    console.error('Failed to fetch versions:', e)
    notify({ level: 'error', title: t('instanceStore.fetchVersionsFailed') })
  }
}

async function installVersion() {
  if (!selectedVersion.value || !selectedProjectData.value) return
  installing.value = true
  try {
    let serviceKey: any
    switch (projectType.value) {
      case 'mod':
        serviceKey = InstanceModsServiceKey
        break
      case 'resourcepack':
        serviceKey = InstanceResourcePacksServiceKey
        break
      case 'shader':
        serviceKey = InstanceShaderPacksServiceKey
        break
      default:
        return
    }
    const { installFromMarket } = useService(serviceKey)
    await installFromMarket({
      market: MarketType.Modrinth,
      version: { versionId: selectedVersion.value.id, icon: selectedProjectData.value.iconUrl },
      instancePath: instancePath.value,
    })
    notify({ level: 'success', title: t('instanceStore.installSuccess', { name: selectedProjectData.value.title }) })
    dialogOpen.value = false
  } catch (e) {
    console.error('Failed to install:', e)
    notify({ level: 'error', title: t('instanceStore.installFailed') })
  } finally {
    installing.value = false
  }
}
</script>

<style scoped>
.filter-title {
  @apply font-bold mb-3 text-xs uppercase text-gray-700 dark:text-gray-200 tracking-wider ml-1;
}

.filter-group {
  @apply mb-4;
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

.elevated-search :deep(.v-field) {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.elevated-search.v-input--focused :deep(.v-field),
.elevated-search :deep(.v-field--focused) {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2) !important;
  transform: translateY(-1px);
}

.theme--dark .elevated-search :deep(.v-field) {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
}

.theme--dark .elevated-search :deep(.v-field--focused) {
  box-shadow: 0 8px 30px rgba(var(--v-theme-primary), 0.2) !important;
}
</style>
