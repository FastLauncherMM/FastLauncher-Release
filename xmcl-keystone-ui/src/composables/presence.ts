import { PresenceServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useService } from './service'
import { useEventListener } from '@vueuse/core'

export function usePresence(activity: Ref<string> | string, options?: { username?: Ref<string> | string; server?: Ref<string> | string }) {
  const { setActivity } = useService(PresenceServiceKey)
  function getOptions() {
    const result: { username?: string; server?: string } = {}
    if (options?.username) {
      result.username = isRef(options.username) ? options.username.value : options.username
    }
    if (options?.server) {
      result.server = isRef(options.server) ? options.server.value : options.server
    }
    return result
  }
  onMounted(() => {
    const a = isRef(activity) ? activity.value : activity
    if (a) {
      setActivity(a, getOptions())
    }
  })
  useEventListener('focus', () => {
    const a = isRef(activity) ? activity.value : activity
    if (a) {
      setActivity(a, getOptions())
    }
  })
  if (isRef(activity)) {
    watch(activity, (a) => {
      if (a) {
        setActivity(a, getOptions())
      }
    })
  }
  if (options?.username && isRef(options.username)) {
    watch(options.username, () => {
      const a = isRef(activity) ? activity.value : activity
      if (a) {
        setActivity(a, getOptions())
      }
    })
  }
  if (options?.server && isRef(options.server)) {
    watch(options.server, () => {
      const a = isRef(activity) ? activity.value : activity
      if (a) {
        setActivity(a, getOptions())
      }
    })
  }
}
