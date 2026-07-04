import vue from '@vitejs/plugin-vue'
import { readdirSync, readFileSync } from 'fs'
import { createRequire } from 'module'
import { join, resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig, Plugin } from 'vite'
import vuetify from 'vite-plugin-vuetify'

const require = createRequire(import.meta.url)

function yamlLoader(): Plugin {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const yaml = require('js-yaml')
  return {
    name: 'yaml-loader',
    transform(_code, id) {
      if (!id.endsWith('.yaml')) return null
      // Virtual Vue SFC i18n blocks (e.g. .vue?vue&type=i18n&...lang.yaml)
      // — return empty object since the original @intlify plugin handled these
      if (id.includes('?')) {
        return { code: 'export default {}', map: null }
      }
      const obj = yaml.load(readFileSync(id, 'utf8'))
      return { code: `export default ${JSON.stringify(obj)}`, map: null }
    },
  }
}

// Multi-page renderer — one html entry per launcher window (main /
// app / browser / logger / migration / multiplayer). All html files in
// `src/` are picked up automatically.
const entries = readdirSync(join(__dirname, './src'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => join(__dirname, './src', f))

export default defineConfig({
  server: { port: 3000 },
  root: join(__dirname, './src'),
  base: '',
  build: {
    rolldownOptions: {
      input: entries,
      external: ['electron'],
    },
    minify: 'terser',
    sourcemap: true,
    terserOptions: { keep_classnames: true, keep_fnames: true },
    outDir: resolve(__dirname, './dist'),
    assetsInlineLimit: 0,
  },
  resolve: {
    alias: {
      undici: 'undici-shim',
      '@': join(__dirname, './src'),
      '~main': join(__dirname, './src/windows/main'),
      '~logger': join(__dirname, './src/windows/logger'),
      '~setup': join(__dirname, './src/windows/setup'),
    },
  },
  optimizeDeps: { exclude: ['electron', '@xmcl/utils', '@xmcl/resource'] },
  plugins: [
    yamlLoader(),
    vue(),
    vuetify({ autoImport: true }),
    UnoCSS(),
    AutoImport({
      imports: [
        'vue',
        {
          'vue-i18n': ['useI18n'],
          'vue-router': ['useRouter', 'useRoute'],
        },
      ],
      dts: 'auto-imports.d.ts',
      exclude: ['node_modules', /xmcl\/packages.+/],
      eslintrc: {
        enabled: true,
        filepath: './.eslintrc-auto-import.json',
        globalsPropValue: true,
      },
    }),
  ],
})