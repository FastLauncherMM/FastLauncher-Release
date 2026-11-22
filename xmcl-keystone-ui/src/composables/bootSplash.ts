import { watch } from 'vue'
import { kSettingsState } from './setting'
import { injection } from '@/util/inject'

export type BootSplashStyle = 'pulse' | 'rise' | 'spin' | 'glow' | 'none'

export const kBootSplash = Symbol('BootSplash')

/**
 * Mirrors the boot splash settings to localStorage so the pre-mount splash in
 * index.html can pick them up on the *next* launch (index.html runs before
 * Vue and before the backend settings are available).
 */
export function useBootSplash() {
  const { state } = injection(kSettingsState)
  const mirror = () => {
    if (!state.value) return
    localStorage.setItem('xmcl.bootSplash', JSON.stringify({
      style: state.value.bootSplashStyle,
      color: state.value.bootSplashColor,
    }))
  }
  watch(() => [state.value?.bootSplashStyle, state.value?.bootSplashColor], mirror, { immediate: true })
  return { state }
}