import { Client, type SetActivity } from '@xmcl/discord-rpc'
import { type PresenceService as IPresenceService, type SharedState, PresenceServiceKey, Settings } from '@xmcl/runtime-api'
import { Inject, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { kSettings } from '~/settings'
import { LauncherApp } from '../app/LauncherApp'
import { LaunchService } from '../launch/LaunchService'

@ExposeServiceKey(PresenceServiceKey)
export class PresenceService extends AbstractService implements IPresenceService {
  private discord: Client
  private current: SetActivity = {
  }
  private runningGameCount = 0
  private currentUsername = ''
  private currentServer = ''

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kSettings) private settings: SharedState<Settings>,
    @Inject(LaunchService) launchService: LaunchService,
  ) {
    super(app, async () => {
      if (settings.discordPresence) {
        try {
          await this.discord.connect()
        } catch (e) {
          // Ignore
        }
      }
    })

    this.discord = new Client({
      clientId: '1522239330934980618',
    })

    settings.subscribe('discordPresenceSet', async (state) => {
      if (state) {
        await this.discord.connect().catch((e: any) => {
          this.warn('Fail to connect to discord. %o', e)
        })
      } else {
        await this.discord.destroy()
      }
    })

    launchService.on('minecraft-start', (options: any) => {
      this.runningGameCount++
      this.log(`Game started, setting Discord presence (running games: ${this.runningGameCount})`)

      const username = options?.user?.profiles?.[options?.user?.selectedProfile]?.name || ''
      this.currentUsername = username

      let serverInfo = ''
      if (options?.server?.host) {
        serverInfo = options.server.port
          ? `${options.server.host}:${options.server.port}`
          : options.server.host
      }
      this.currentServer = serverInfo

      this.updatePresence()
    })

    // Listen to stdout to detect server connections
    launchService.on('minecraft-stdout', (data: any) => {
      if (this.runningGameCount <= 0) return
      const line = data?.stdout || ''

      // Detect "Connecting to <host>, <port>" pattern (common in Minecraft/Forge/Fabric)
      const connectMatch = line.match(/Connecting to ([\w.\-]+), (\d+)/i)
      if (connectMatch) {
        const host = connectMatch[1]
        const port = connectMatch[2]
        this.currentServer = port === '25565' ? host : `${host}:${port}`
        this.log(`Detected server connection: ${this.currentServer}`)
        this.updatePresence()
        return
      }

      // Detect "[CHAT] Connecting to server" with IP in same line
      const connectMatch2 = line.match(/(?:Connected to|Connecting to)\s+([\w.\-]+(?::\d+)?)/i)
      if (connectMatch2) {
        this.currentServer = connectMatch2[1]
        this.log(`Detected server connection: ${this.currentServer}`)
        this.updatePresence()
        return
      }

      // Detect disconnect — player went back to menu
      if (line.includes('Disconnected from server') || line.includes('Connection lost')) {
        this.currentServer = ''
        this.log('Detected disconnect, updating presence')
        this.updatePresence()
      }
    })

    launchService.on('minecraft-exit', () => {
      this.runningGameCount = Math.max(0, this.runningGameCount - 1)
      this.currentServer = ''
      this.log(`Game exited, presence will update (running games: ${this.runningGameCount})`)
    })
  }

  private async updatePresence() {
    if (!this.discord.isConnected || !this.settings.discordPresence) return

    const param: SetActivity = {
      name: 'FastLauncher',
      largeImageKey: 'flauncher',
      largeImageText: 'FastLauncher',
      startTimestamp: Date.now(),
      details: this.currentUsername || 'Minecraft',
      state: this.currentServer || 'В игре',
    }

    await this.discord.user?.setActivity(param).catch((e: any) => {
      this.warn('Fail to set discord presence. %o', e)
    })
  }

  async setActivity(activity: string, options?: { username?: string; server?: string }): Promise<void> {
    if (!this.settings.discordPresence) {
      return
    }
    if (this.runningGameCount > 0) {
      this.log('Game is running, skipping Discord presence update')
      return
    }
    if (!this.discord.isConnected) {
      try {
        await this.discord.connect()
      } catch (e) {
        return
      }
    }
    const param = this.current
    param.name = 'FastLauncher'
    param.largeImageKey = 'flauncher'
    param.largeImageText = 'FastLauncher'
    param.startTimestamp = Date.now()

    if (options?.username) {
      param.details = options.username
    } else {
      param.details = activity
    }

    if (options?.server) {
      param.state = options.server
    } else {
      param.state = ''
    }

    await this.discord.user?.setActivity(param).catch((e: any) => {
      this.warn('Fail to set discord presence. %o', e)
    })
  }
}
