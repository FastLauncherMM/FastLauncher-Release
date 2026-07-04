import { ApplicationInsights } from '@microsoft/applicationinsights-web'
import { APP_INSIGHT_KEY } from '@xmcl/runtime-api'
import { i18n } from './i18n'

const appInsights = new ApplicationInsights({
  config: {
    connectionString: APP_INSIGHT_KEY,
    disableCookiesUsage: true,
    disableFetchTracking: true,
    disableAjaxTracking: true,
  },
})

function loadInsights() {
  appInsights.loadAppInsights()

  appInsights.addTelemetryInitializer((envelope: any) => {
    if (envelope.baseType !== 'ExceptionData') return true
    const baseData = envelope.baseData as
      | { exceptions?: Array<{ typeName?: string; message?: string }>; properties?: Record<string, any> }
      | undefined
    const detail = baseData?.exceptions?.[0]
    const message = detail?.message
    if (!message) return true

    if (message.includes('ResizeObserver loop')) return false
    if (message.includes('onMounted is called when there')) return false
    if (message.includes('Failed to fetch')) return false
    if (message === 'The operation was aborted' ||
        message === 'This operation was aborted' ||
        message.startsWith('AbortError')) return false
    if (message === 'Key is required') return false
    if (message ===
        "Failed to execute 'getComputedStyle' on 'Window': parameter 1 is not of type 'Element'.") return false
    if (/^SyntaxError:\s*(?:\{\s*"code"\s*:\s*)?24\b/.test(message)) {
      const properties = (baseData!.properties = baseData!.properties ?? {})
      try { properties.locale = (i18n.global.locale as any).value } catch {}
      try { properties.route = typeof window !== 'undefined' ? window.location.hash : '' } catch {}
      try {
        const original: any = detail as any
        const src = original.location?.source ?? original.source ?? original.codeFrame
        if (typeof src === 'string') properties.snippet = src.slice(0, 80)
        if (typeof original.code === 'number' || typeof original.code === 'string') {
          properties.compileCode = String(original.code)
        }
      } catch {}
    }
    return true
  })
}

if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => loadInsights())
} else {
  setTimeout(() => loadInsights(), 2000)
}

export { appInsights }
