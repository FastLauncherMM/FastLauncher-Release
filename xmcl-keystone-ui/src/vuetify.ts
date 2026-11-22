import CurseforgeIcon from '@/components/CurseforgeIcon.vue'
import FTBIcon from '@/components/FTBIcon.vue'
import ImageIcon from '@/components/ImageIcon.vue'
import JarFileIcon from '@/components/JarFileIcon.vue'
import ModrinthIcon from '@/components/ModrinthIcon.vue'
import PackageFileIcon from '@/components/PackageFileIcon.vue'
import ZipFileIcon from '@/components/ZipFileIcon.vue'
import { h } from 'vue'
import { IconProps, IconSet, createVuetify } from 'vuetify'
import { aliases, md } from 'vuetify/iconsets/md'
import { ar, ru, zhHans } from 'vuetify/locale'
import 'vuetify/styles'
import { BuiltinImages } from './constant'

const fl: IconSet = {
  component: (props: IconProps) => {
    switch (props.icon) {
      case 'ftb': return h(FTBIcon)
      case 'curseforge': return h(CurseforgeIcon)
      case 'zip': return h(ZipFileIcon)
      case 'jar': return h(JarFileIcon)
      case 'package': return h(PackageFileIcon)
      case 'modrinth': return h(ModrinthIcon)
      case 'forge': return h(ImageIcon, { src: BuiltinImages.forge })
      case 'fabric': return h(ImageIcon, { src: BuiltinImages.fabric })
      case 'quilt': return h(ImageIcon, { src: BuiltinImages.quilt })
      case 'minecraft': return h(ImageIcon, { src: BuiltinImages.minecraft })
      case 'prism': return h(ImageIcon, { src: BuiltinImages.prism })
      case 'neoForged': return h(ImageIcon, { src: BuiltinImages.neoForged })
      case 'optifine': return h(ImageIcon, { src: BuiltinImages.optifine })
      case 'iris': return h(ImageIcon, { src: BuiltinImages.iris })
      case 'oculus': return h(ImageIcon, { src: BuiltinImages.oculus })
      case 'mmc': return h(ImageIcon, { src: BuiltinImages.mmc })
      default: return null
    }
  },
}

export const vuetify = createVuetify({
  locale: {
    locale: 'en',
    fallback: 'en',
    messages: { zhHans, ru, ar },
    rtl: {
      ar: true,
    },
  },
  icons: {
    defaultSet: 'md',
    aliases,
    sets: { md, fl },
  },
  defaults: {
    VSwitch: {
      inset: true,
      color: 'primary',
    },
  },
  theme: {
    defaultTheme: 'dark',
    themes: {
      light: {
        dark: false,
        colors: {
          background: '#eef4ef',
          surface: '#ffffff',
          'surface-bright': '#ffffff',
          'surface-light': '#f6faf6',
          'surface-variant': '#e4ece5',
          'on-surface': '#17241a',
          'on-background': '#17241a',
          primary: '#269c45',
          'on-primary': '#ffffff',
          accent: '#62c84e',
        },
      },
      system: {},
      dark: {
        dark: true,
        colors: {
          background: '#060a07',
          surface: '#101812',
          'surface-bright': '#18221b',
          'surface-light': '#1d2920',
          'surface-variant': '#202c23',
          'on-surface': '#f3f7f4',
          'on-background': '#f3f7f4',
          primary: '#75e85b',
          'on-primary': '#071008',
          accent: '#b6ff75',
        },
      },
    },
  },
})
