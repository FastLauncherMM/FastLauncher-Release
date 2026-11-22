import { injection } from '@/util/inject'
import { DriveStep } from 'driver.js'
import { InjectionKey, Ref } from 'vue'
import { useSettingsState } from './setting'

export const kTutorial: InjectionKey<ReturnType<typeof useTutorialModel>> = Symbol('tutorial')

export function useTutorialModel(settings: Pick<ReturnType<typeof useSettingsState>, 'state'>) {
  const { t } = useI18n()
  const state = settings.state
  const steps = ref([] as DriveStep[])
  async function start() {
    if (steps.value.length === 0) return
    const { driver } = await import('driver.js')
    await import('driver.js/dist/driver.css')
    await import('../assets/driver.css')
    const driverObj = driver({
      popoverClass: 'driverjs-theme',
      nextBtnText: t('shared.next'),
      animate: true,
      prevBtnText: t('shared.previous'),
      doneBtnText: t('tutorial.done'),
      allowClose: true,
      showButtons: ['previous', 'next', 'close'],
      steps: steps.value,
      onPopoverRender: (popover) => {
        // Add a proper, framed "Skip" button (not the floating X icon) into the
        // popover footer, styled like the Prev/Next buttons by the theme CSS.
        const footerBtns = popover.footerButtons
        if (footerBtns && !footerBtns.querySelector('.driver-skip-btn')) {
          const skip = document.createElement('button')
          skip.type = 'button'
          skip.className = 'driver-skip-btn'
          skip.textContent = t('tutorial.skip')
          skip.addEventListener('click', () => popover.closeButton.click())
          footerBtns.insertBefore(skip, footerBtns.firstChild)
        }
      },
      onDestroyed: () => {
        // Remember the tutorial was seen/skipped so it doesn't auto-run
        // again, while staying re-runnable from the system bar / settings.
        state.value?.tutorialShownSet(true)
      },
    })
    driverObj.drive()
  }
  return {
    steps,
    start,
  }
}

export function useTutorial(steps: Ref<DriveStep[]>) {
  const tutor = injection(kTutorial)
  onMounted(() => {
    tutor.steps.value = steps.value
    watch(steps, () => {
      tutor.steps.value = steps.value
    })
  })
  onUnmounted(() => {
    tutor.steps.value = []
  })
}
