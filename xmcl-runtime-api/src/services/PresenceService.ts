import { ServiceKey } from './Service'

export interface PresenceService {
  setActivity(activity: string, options?: { username?: string; server?: string }): Promise<void>
}

export const PresenceServiceKey: ServiceKey<PresenceService> = 'PresenceService'
