<template>
  <component
    :is="to ? 'router-link' : clickable ? 'button' : 'div'"
    :id="id"
    :to="to"
    :type="clickable && !to ? 'button' : undefined"
    class="sidebar-item non-moveable"
    :class="{
      'sidebar-item--active': active,
      'sidebar-item--clickable': clickable || !!to,
      'sidebar-item--colored': !!color,
    }"
    :style="color ? { '--sidebar-item-color': color } : undefined"
    @click="onClick"
  >
    <span class="sidebar-item__indicator" />
    <span class="sidebar-item__content">
      <slot>
        <v-icon
          v-if="icon"
          class="sidebar-item__icon"
          :size="iconSize ?? 24"
        >
          {{ icon }}
        </v-icon>
      </slot>
    </span>
  </component>
</template>

<script lang="ts" setup>
const props = defineProps<{
  id?: string
  to?: string
  icon?: string
  iconSize?: number
  active?: boolean
  clickable?: boolean
  color?: string
}>()

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

function onClick(event: MouseEvent) {
  emit('click', event)
}
</script>

<style scoped>
.sidebar-item {
  position: relative;
  display: block;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 0;
  background: transparent;
  margin: 3px auto;
  flex-shrink: 0;
  text-decoration: none;
  color: inherit;
  --sidebar-item-color: var(--color-primary);
}

.sidebar-item__content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: 1px solid transparent;
  border-radius: 15px;
  background: rgba(var(--v-theme-on-surface), 0.025);
  transition:
    transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.22s ease,
    background-color 0.22s ease,
    box-shadow 0.28s ease,
    color 0.2s ease;
  overflow: hidden;
  cursor: default;
}

.sidebar-item--clickable .sidebar-item__content {
  cursor: pointer;
}

.sidebar-item--clickable:hover .sidebar-item__content {
  border-color: rgba(var(--v-theme-primary), 0.2);
  border-radius: 15px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.04);
  transform: translateY(-2px) scale(1.035);
}

.sidebar-item--clickable.sidebar-item--colored:hover .sidebar-item__content {
  background: color-mix(in srgb, var(--sidebar-item-color) 86%, transparent);
  color: white;
}

.sidebar-item--active .sidebar-item__content,
.sidebar-item.router-link-active .sidebar-item__content {
  border-color: color-mix(in srgb, var(--sidebar-item-color) 78%, white);
  border-radius: 15px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--sidebar-item-color) 88%, white 10%), var(--sidebar-item-color));
  color: rgb(var(--v-theme-on-primary));
  box-shadow:
    0 8px 22px -10px color-mix(in srgb, var(--sidebar-item-color) 72%, transparent),
    inset 0 1px rgba(255, 255, 255, 0.2);
}

.sidebar-item__icon {
  position: relative;
  z-index: 1;
  transition: color 0.2s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.sidebar-item--clickable:hover .sidebar-item__icon {
  transform: scale(1.08);
}

/* Discord-style left pill indicator */
.sidebar-item__indicator {
  position: absolute;
  left: -12px;
  top: 50%;
  width: 4px;
  height: 0;
  border-radius: 0 4px 4px 0;
  background-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 10px rgba(var(--v-theme-primary), 0.6);
  transform: translateY(-50%);
  transition:
    height 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.85;
  pointer-events: none;
}

.sidebar-item--clickable:hover .sidebar-item__indicator {
  height: 20px;
}

.sidebar-item--active .sidebar-item__indicator,
.sidebar-item.router-link-active .sidebar-item__indicator {
  height: 36px;
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-item__content,
  .sidebar-item__icon,
  .sidebar-item__indicator {
    transition: none;
  }
}
</style>
