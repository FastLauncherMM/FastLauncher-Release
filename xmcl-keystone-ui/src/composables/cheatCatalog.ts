import wildLogo from '@/assets/wild-logo.png'
import wildCover from '@/assets/wild-cover.png'
import deltaLogo from '@/assets/delta-logo.png'
import deltaCover from '@/assets/delta-cover.png'
import celestialLogo from '@/assets/celestial-logo.png'
import celestialCover from '@/assets/celestial-cover.png'
import essenceLogo from '@/assets/essence-logo.png'
import essenceCover from '@/assets/essence-cover.png'
import leonwareLogo from '@/assets/leonware-logo.png'
import leonwareCover from '@/assets/leonware-cover.png'
import liminarpremiumLogo from '@/assets/liminarpremium-logo.png'
import liminarpremiumCover from '@/assets/liminarpremium-cover.png'
import systemdlcLogo from '@/assets/systemdlc-logo.png'
import systemdlcCover from '@/assets/systemdlc-cover.png'
import rockstarLogo from '@/assets/rockstar-logo.png'
import rockstarCover from '@/assets/rockstar-cover.png'
import deadcodeLogo from '@/assets/deadcode-logo.png'
import deadcodeCover from '@/assets/deadcode-cover.png'
import nursultanLogo from '@/assets/nursultan-logo.png'
import nursultanCover from '@/assets/nursultan-cover.png'

export interface CheatEntry {
  id: string
  name: string
  version: string
  description: string
  logo?: string
  cover?: string
  categories: string[]
}

/** Shared cheat catalog: used by the Cheats grid and the News page. */
export const cheats: CheatEntry[] = [
  {
    id: 'wild',
    name: 'Wild',
    version: '1.21.8',
    description: 'Лучшие возможности независимо от стиля игры.',
    logo: wildLogo,
    cover: wildCover,
    categories: ['legit'],
  },
  {
    id: 'delta',
    name: 'Delta Client',
    version: '1.21.4',
    description: 'Delta Client — быстрый и отзывчивый клиент с продвинутыми модулями для серьёзной игры.',
    logo: deltaLogo,
    cover: deltaCover,
    categories: ['hvh'],
  },
  {
    id: 'celestial',
    name: 'Celestial',
    version: '1.16.5',
    description: 'Мы предоставляем вам лучший клиент для комфортной игры.',
    logo: celestialLogo,
    cover: celestialCover,
    categories: ['hvh'],
  },
  {
    id: 'essence',
    name: 'Essence',
    version: '1.21.4',
    description: 'Essence — стабильный и быстрый чит с продвинутыми модулями для PvP и легитимной игры.',
    logo: essenceLogo,
    cover: essenceCover,
    categories: ['legit'],
  },
  {
    id: 'leonware',
    name: 'LeonWare',
    version: '1.21.1',
    description: 'LeonWare — мощный клиент для HvH с широким набором модулей и высокой производительностью.',
    logo: leonwareLogo,
    cover: leonwareCover,
    categories: ['hvh'],
  },
  {
    id: 'liminarpremium',
    name: 'Liminar Premium',
    version: '1.21.4',
    description: 'Liminar Premium — гост-клиент с продвинутой обфускацией и стабильной работой.',
    logo: liminarpremiumLogo,
    cover: liminarpremiumCover,
    categories: ['legit'],
  },
  {
    id: 'systemdlc',
    name: 'SystemDLC',
    version: '1.21.4',
    description: 'SystemDLC — гост-клиент для комфортной игры с базовыми модулями.',
    logo: systemdlcLogo,
    cover: systemdlcCover,
    categories: ['legit'],
  },
  {
    id: 'rockstar',
    name: 'Rockstar',
    version: '1.21.4',
    description: 'Rockstar — выбор тех, кто привык побеждать.',
    logo: rockstarLogo,
    cover: rockstarCover,
    categories: ['legit'],
  },
  {
    id: 'deadcode',
    name: 'DeadCode',
    version: '1.19.4',
    description: 'Модификации следующего поколения, созданные для полного доминирования.',
    logo: deadcodeLogo,
    cover: deadcodeCover,
    categories: ['hvh'],
  },
  {
    id: 'nursultan',
    name: 'Nursultan',
    version: '1.21.11',
    description: 'Лучший клиент для комфортной игры.',
    logo: nursultanLogo,
    cover: nursultanCover,
    categories: ['hvh'],
  },
]
