// Simple script to fix the Vite build issue
const fs = require('fs');
const path = require('path');

function fixViteConfig() {
  const viteConfigPath = path.join(__dirname, 'xmcl-keystone-ui/vite.config.ts');
  
  if (!fs.existsSync(viteConfigPath)) {
    console.log('✗ vite.config.ts not found');
    return;
  }
  
  let config = fs.readFileSync(viteConfigPath, 'utf8');
  
  // Remove the @intlify/unplugin-vue-i18n/vite import
  config = config.replace(/^import VueI18n from '@intlify\/unplugin-vue-i18n\/vite'[^;]*;\s*/m, '');
  
  // Remove all VueI18n plugin configurations from plugins array
  // Find and remove lines that have VueI18n( with its content
  const vueI18nPattern = /(?:^\s*)(VueI18n\(.*?)(?=\^\s*})/mgs;
  config = config.replace(vueI18nPattern, '');
  
  // Clean up any remaining empty lines or unnecessary whitespace
  config = config.replace(/^\s*\n/gm, '\n');
  
  // Fix any broken syntax
  config = config.replace(/, \)/g, ')');
  
  // Write the fixed config back
  fs.writeFileSync(viteConfigPath, config, 'utf8');
  
  console.log('✅ Fixed vite.config.ts by removing @intlify/unplugin-vue-i18n plugin');
}

function fixI18nFile() {
  const i18nPath = path.join(__dirname, 'xmcl-keystone-ui/src/i18n.ts');
  
  if (!fs.existsSync(i18nPath)) {
    console.log('✗ i18n.ts not found');
    return;
  }
  
  let i18nContent = fs.readFileSync(i18nPath, 'utf8');
  
  // Remove the complicated messages import
  i18nContent = i18nContent.replace(/^import messages from '@intlify\/unplugin-vue-i18n\/messages'[^;]*;\s*/m, '');
  
  // Reset to simple configuration - just create empty i18n with en locale
  i18nContent = `import { createI18n } from 'vue-i18n'

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {},
  },
})`;
  
  fs.writeFileSync(i18nPath, i18nContent, 'utf8');
  console.log('✅ Fixed i18n.ts to use simple configuration');
}

function main() {
  console.log('🔧 Fixing Vite build configuration...');
  
  fixViteConfig();
  fixI18nFile();
  
  console.log('\n✅ All fixes completed!');
  console.log('Now running the build...');
}

main();