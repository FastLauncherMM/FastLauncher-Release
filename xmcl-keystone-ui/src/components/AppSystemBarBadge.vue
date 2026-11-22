<template>
  <button
    type="button"
    class="system-bar-badge non-moveable flex flex-grow-0 cursor-pointer items-center rounded px-2 py-1 transition-all"
    :aria-label="ariaLabel || text || undefined"
    @click="$emit('click', $event)"
  >
    <v-icon
      v-if="icon"
      size="22"
      :start="!!text"
      class="badge-icon"
      aria-hidden="true"
    >
      {{ icon }}
    </v-icon>
    <template v-else>
      <slot
        class="badge-icon"
      />
    </template>
    <span
      v-if="text"
      class="whitespace-nowrap"
      :class="{ 'badge-text': canHideText }"
    >
      {{ text }}
    </span>
    <slot name="append" />
  </button>
</template>
<script setup lang="ts">
defineProps<{
  icon?: string
  text?: string
  canHideText?: boolean
  ariaLabel?: string
}>()

</script>
<style scoped>
.system-bar-badge {
  min-height: 28px;
  background: rgba(var(--v-theme-on-surface), 0.025);
  border: 1px solid transparent;
  border-radius: 9px !important;
  color: inherit;
  font: inherit;
  appearance: none;
  transition:
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.system-bar-badge:hover {
  background: rgba(var(--v-theme-primary), 0.1);
  border-color: rgba(var(--v-theme-primary), 0.18);
  color: rgb(var(--v-theme-on-surface));
  transform: translateY(-1px);
}

.system-bar-badge:active {
  transform: translateY(0) scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .system-bar-badge {
    transition: none;
  }
}

.system-bar-badge:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.7);
  outline-offset: 1px;
}

@media (max-width: 880px) {
  .badge-text {
    display: none;
  }

  .badge-icon {
    margin-right: 0;
  }
}
</style>
