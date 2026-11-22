import wildLogo from '@/assets/wild-logo.png'
import deltaLogo from '@/assets/delta-logo.png'
import celestialLogo from '@/assets/celestial-logo.png'
import essenceLogo from '@/assets/essence-logo.png'
import leonwareLogo from '@/assets/leonware-logo.png'
import liminarpremiumLogo from '@/assets/liminarpremium-logo.png'
import systemdlcLogo from '@/assets/systemdlc-logo.png'
import rockstarLogo from '@/assets/rockstar-logo.png'
import deadcodeLogo from '@/assets/deadcode-logo.png'
import nursultanLogo from '@/assets/nursultan-logo.png'
import pulsevisualLogo from '@/assets/pulsevisual-logo.png'
import reallyvisualLogo from '@/assets/reallyvisual-logo.png'
import cabbitvisualLogo from '@/assets/cabbitrecode-logo.png'
import fevervisualLogo from '@/assets/fevervisual-logo.png'
import fastvisualLogo from '@/assets/fastvisual-logo.png'

export interface ResourceMeta {
  name: string
  logo?: string
}

const RESOURCE_META: Record<string, ResourceMeta> = {
  wild: { name: 'Wild', logo: wildLogo },
  delta: { name: 'Delta', logo: deltaLogo },
  celestial: { name: 'Celestial', logo: celestialLogo },
  essence: { name: 'Essence', logo: essenceLogo },
  leonware: { name: 'LeonWare', logo: leonwareLogo },
  liminarpremium: { name: 'Liminar Premium', logo: liminarpremiumLogo },
  systemdlc: { name: 'System DLC', logo: systemdlcLogo },
  rockstar: { name: 'RockStar', logo: rockstarLogo },
  deadcode: { name: 'DeadCode', logo: deadcodeLogo },
  nursultan: { name: 'Nursultan', logo: nursultanLogo },
  pulsevisual: { name: 'PulseVisuals', logo: pulsevisualLogo },
  reallyvisual: { name: 'ReallyVisuals', logo: reallyvisualLogo },
  cabbitvisual: { name: 'Cabbit Visual', logo: cabbitvisualLogo },
  fevervisual: { name: 'FeverVisuals', logo: fevervisualLogo },
  fastvisual: { name: 'FastVisual', logo: fastvisualLogo },
}

export function getResourceMeta(id?: string): ResourceMeta {
  if (!id) return { name: '' }
  return RESOURCE_META[id.toLowerCase()] ?? { name: id }
}
