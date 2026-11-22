import type { Instance } from '@xmcl/instance'
import { UserProfile } from '../entities/user.schema'
import { LaunchException, LaunchOptions } from '../services/LaunchService'
import { AUTHORITY_DEV } from './authority'

function tryParseUrl(url: string) {
  try {
    return new URL(url)
  } catch {
    return undefined
  }
}

/**
 * Startup-time JVM flags: skip bytecode verification of local/remote classes.
 * Class verification is pure startup overhead — every class comes from jars
 * the launcher itself installed. `UnlockDiagnosticVMOptions` is required by
 * JDK 21+ where these two became diagnostic flags (verified working and
 * warning-free on JRE 8, 21 and 25).
 */
export const FAST_STARTUP_VM_OPTIONS: string[] = [
  '-XX:+UnlockDiagnosticVMOptions',
  '-XX:-BytecodeVerificationLocal',
  '-XX:-BytecodeVerificationRemote',
]

/**
 * Aikar's flags — a well-known set of JVM arguments that significantly improve
 * Minecraft's in-game performance (GC tuning, pre-touch, string dedup, etc.).
 * Applied only when the user enables the "optimization" launcher setting.
 */
export const OPTIMIZATION_VM_OPTIONS: string[] = [
  '-XX:+UseG1GC',
  '-XX:+ParallelRefProcEnabled',
  '-XX:MaxGCPauseMillis=200',
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+DisableExplicitGC',
  '-XX:+AlwaysPreTouch',
  '-XX:G1NewSizePercent=30',
  '-XX:G1MaxNewSizePercent=40',
  '-XX:G1HeapRegionSize=8M',
  '-XX:G1ReservePercent=20',
  '-XX:G1HeapWastePercent=5',
  '-XX:G1MixedGCCountTarget=4',
  '-XX:InitiatingHeapOccupancyPercent=15',
  '-XX:G1MixedGCLiveThresholdPercent=90',
  '-XX:G1RSetUpdatingPauseTimePercent=5',
  '-XX:SurvivorRatio=32',
  '-XX:+PerfDisableSharedMem',
  '-XX:MaxTenuringThreshold=1',
  '-Dusing.aikars.flags.mc=1',
  '-Daikars.new.flags=true',
]

export interface GenerateLaunchOptions {
  token: string
  operationId: string
  side?: 'client' | 'server'
  overrides?: Partial<LaunchOptions>
  dry?: boolean
  javaPath?: string
  globalEnv: Record<string, string>
  globalVmOptions: string[]
  globalMcOptions: string[]
  globalOptimization?: boolean
  globalPrependCommand: string
  globalAssignMemory: boolean | 'auto'
  globalMinMemory: number
  globalMaxMemory: number
  globalHideLauncher?: boolean
  globalShowLog?: boolean
  globalFastLaunch?: boolean
  globalDisableAuthlibInjector?: boolean
  globalDisableElyByAuthlib?: boolean
  globalPreExecuteCommand?: string
  globalResolution?: { width?: number; height?: number; fullscreen?: boolean }
  modCount: number
  getOrInstallAuthlibInjector: () => Promise<string>
  track: <T, S = string>(token: string, p: Promise<T>, name: S, id: string) => Promise<T>
}

export async function generateLaunchOptionsWithGlobal(
  inst: Instance,
  userProfile: UserProfile,
  version: string | undefined,
  {
    token,
    operationId,
    side = 'client',
    overrides,
    dry,
    javaPath: _javaPath,
    globalEnv,
    globalVmOptions,
    globalMcOptions,
    globalOptimization,
    globalPrependCommand,
    globalAssignMemory,
    globalMinMemory,
    globalMaxMemory,
    globalHideLauncher,
    globalShowLog,
    globalFastLaunch,
    globalDisableAuthlibInjector,
    globalDisableElyByAuthlib,
    globalPreExecuteCommand,
    globalResolution,
    modCount,
    getOrInstallAuthlibInjector,
    track,
  }: GenerateLaunchOptions
) {
  const ver = version

  if (!ver) {
    throw new LaunchException({ type: 'launchNoVersionInstalled' })
  }

  const javaPath = overrides?.java ?? _javaPath
  if (!javaPath) {
    throw new LaunchException({ type: 'launchNoProperJava', javaPath: '' })
  }

  let yggdrasilAgent: LaunchOptions['yggdrasilAgent']

  const authority = tryParseUrl(userProfile.authority)

  const disableAuthlibInjector = inst.disableAuthlibInjector ?? globalDisableAuthlibInjector
  if (
    !disableAuthlibInjector
    && authority
    && (authority.protocol === 'http:' || authority?.protocol === 'https:' || userProfile.authority === AUTHORITY_DEV)
    && !dry
  ) {
    try {
      yggdrasilAgent = {
        jar: await track(token, getOrInstallAuthlibInjector(), 'preparing-authlib', operationId),
        server: userProfile.authority,
      }
    } catch {
      // TODO: notify user
    }
  }

  const assignMemory = inst.assignMemory ?? globalAssignMemory
  const hideLauncher = inst.hideLauncher ?? globalHideLauncher
  const preExecuteCommand = inst.preExecuteCommand ?? globalPreExecuteCommand
  const env = {
    ...globalEnv,
    ...inst.env,
  }
  const showLog = inst.showLog ?? globalShowLog
  const fastLaunch = inst.fastLaunch ?? globalFastLaunch
  const disableElyByAuthlib = inst.disableElybyAuthlib ?? globalDisableElyByAuthlib

  let minMemory: number | undefined = inst.minMemory ?? globalMinMemory
  let maxMemory: number | undefined = inst.maxMemory ?? globalMaxMemory
  if (assignMemory === true && minMemory > 0) {
    // noop
  } else if (assignMemory === 'auto') {
    if (modCount === 0) {
      minMemory = 1024
    } else {
      const level = modCount / 25
      const rounded = Math.floor(level)
      const percentage = level - rounded
      minMemory = rounded * 1024 + (percentage > 0.5 ? 512 : 0) + 1024
    }
  } else {
    minMemory = undefined
  }
  maxMemory = assignMemory === true && maxMemory > 0 ? maxMemory : undefined

  const vmOptions = [
    ...(inst.vmOptions ?? globalVmOptions.filter(v => !!v)),
    ...FAST_STARTUP_VM_OPTIONS.filter(v => !(inst.vmOptions ?? globalVmOptions).includes(v)),
    ...(globalOptimization ? OPTIMIZATION_VM_OPTIONS : []),
  ]
  const mcOptions = inst.mcOptions ?? globalMcOptions.filter(v => !!v)
  const prependCommand = inst.prependCommand ?? globalPrependCommand

  const options: LaunchOptions = {
    operationId,
    version: ver,
    gameDirectory: inst.path,
    user: userProfile,
    java: javaPath,
    hideLauncher,
    env,
    showLog,
    minMemory,
    maxMemory,
    skipAssetsCheck: fastLaunch,
    vmOptions,
    mcOptions,
    yggdrasilAgent,
    disableElyByAuthlib,
    preExecuteCommand,
    prependCommand,
    side,
    resolution: inst.resolution ?? globalResolution,
    server: inst.server ?? undefined,
    ...overrides,
  }
  return options
}