<template>
  <component
    :is="to ? 'router-link' : 'div'"
    v-shared-tooltip="tooltip"
    v-context-menu="contextMenu"
    :to="to"
    :id="id"
    class="sidebar-notch-item non-moveable"
    :class="{ 'sidebar-notch-item--link': !!to || clickable, 'sidebar-notch-item--active': active }"
    @click="onClick"
  >
    <slot>
      <img
        v-if="image"
        class="sidebar-notch-item__image"
        :src="image"
        :width="28"
        :height="28"
      >
      <v-icon v-else class="sidebar-notch-item__icon" :size="iconSize">{{ icon }}</v-icon>
    </slot>
  </component>
</template>

<script lang="ts" setup>
import { VSharedTooltipParam, vSharedTooltip } from '@/directives/sharedTooltip'
import { vContextMenu } from '@/directives/contextMenu'
import { ContextMenuItem } from '@/composables/contextMenu'

const props = defineProps<{
  icon?: string
  iconSize?: number
  image?: string
  tooltip?: () => VSharedTooltipParam
  to?: string
  id?: string
  clickable?: boolean
  active?: boolean
  contextMenu?: () => ContextMenuItem[]
}>()

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

function onClick(event: MouseEvent) {
  emit('click', event)
}
</script>

<style scoped>
.sidebar-notch-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid transparent;
  border-radius: 13px;
  cursor: pointer;
  background: rgba(var(--v-theme-on-surface), 0.02);
  transition:
    transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.25s ease,
    color 0.2s ease;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  text-decoration: none;
  color: inherit;
}

.sidebar-notch-item::before {
  content: '';
  position: absolute;
  inset: 0;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-notch-item:hover::before {
  opacity: 0.06;
}

.sidebar-notch-item:active::before {
  opacity: 0.12;
}

.sidebar-notch-item--link:hover {
  border-color: rgba(var(--v-theme-primary), 0.18);
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgb(var(--v-theme-primary));
  transform: translateY(-2px) scale(1.035);
}

.sidebar-notch-item--link:active {
  transform: scale(0.96);
}

.sidebar-notch-item__icon {
  position: relative;
  z-index: 1;
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.sidebar-notch-item__image {
  position: relative;
  z-index: 1;
  border-radius: 8px;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.dark .sidebar-notch-item .theme--dark.v-icon {
  color: var(--icon-color);
}

.dark .sidebar-notch-item:hover .theme--dark.v-icon {
  color: var(--icon-color-hovered);
}

.sidebar-notch-item.router-link-active,
.sidebar-notch-item--active {
  border-color: rgba(var(--v-theme-primary), 0.46);
  background: linear-gradient(145deg, rgba(var(--v-theme-primary), 0.24), rgba(var(--v-theme-primary), 0.11));
  color: rgb(var(--v-theme-primary));
  box-shadow:
    0 9px 22px -13px rgba(var(--v-theme-primary), 0.75),
    inset 0 1px rgba(255, 255, 255, 0.06);
}

.sidebar-notch-item.router-link-active .v-icon,
.sidebar-notch-item--active .v-icon {
  color: rgb(var(--v-theme-primary));
}

.sidebar-notch-item.router-link-active::before,
.sidebar-notch-item--active::before {
  opacity: 0.08;
  background: var(--color-primary);
}

.sidebar-notch-item--link:hover .sidebar-notch-item__icon,
.sidebar-notch-item--link:hover .sidebar-notch-item__image {
  transform: scale(1.08);
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-notch-item,
  .sidebar-notch-item__icon,
  .sidebar-notch-item__image {
    transition: none;
  }
}
</style>
