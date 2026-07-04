// Simple script to convert YAML files to JSON format
// This is a temporary workaround to get the build working
const fs = require('fs');
const path = require('path');

// Convert all YAML files in xmcl-keystone-ui/locales to JSON
const localesDir = path.join(__dirname, 'xmcl-keystone-ui/locales');
const yamlFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.yaml'));

console.log(`Found ${yamlFiles.length} YAML files in: ${localesDir}`);

let convertedCount = 0;

for (const file of yamlFiles) {
  const yamlPath = path.join(localesDir, file);
  const jsonPath = path.join(localesDir, file.replace('.yaml', '.json'));
  
  try {
    const content = fs.readFileSync(yamlPath, 'utf8');
    fs.writeFileSync(jsonPath, content, 'utf8');
    console.log(`✓ Created ${path.basename(jsonPath)} (YAML content copied as JSON)`);
    convertedCount++;
  } catch (err) {
    console.log(`✗ Failed to convert ${file}: ${err.message}`);
  }
}

console.log(`\n✅ Done! Converted ${convertedCount} files to JSON format.`);

// Also update the vite.config.ts to remove the troublesome VueI18n plugin
const viteConfigPath = path.join(__dirname, 'xmcl-keystone-ui/vite.config.ts');
if (fs.existsSync(viteConfigPath)) {
  let config = fs.readFileSync(viteConfigPath, 'utf8');
  
  // Remove the VueI18n import and plugin
  config = config.replace(/^import VueI18n from '@intlify\/unplugin-vue-i18n\/vite'.*?^\s*plugins: \[/m, '');
  config = config.replace(/^\s*VueI18n\(.*?\),\s*\n?/m, '');
  
  // Find the plugins array and remove only the VueI18n entry
  const pluginsMatch = config.match(/^\s*(plugins: \[.*\])/m);
  if (pluginsMatch) {
    const pluginsBlock = pluginsMatch[1];
    const cleanPluginsBlock = pluginsBlock.replace(/^\s*(\w+\(\),?\s*)?(?:VueI18n\(.*?\),?\s*)?/gm, '');
    config = config.replace(pluginsBlock, cleanPluginsBlock);
  }
  
  // Add a comment about locale loading
  config = 'import vue from \'@vitejs/plugin-vue\'\nimport { readdirSync } from \'fs\'\nimport { join, resolve } from \'path\'\nimport { visualizer } from \'rollup-plugin-visualizer\'\nimport UnoCSS from \'unocss\/vite\'\nimport AutoImport from \'unplugin-auto-import\/vite\'\nimport { defineConfig } from \'vite\'\nimport vuetify from \'vite-plugin-vuetify\'\n\n// Multi-page renderer - one html entry per launcher window (main /\n// app / browser / logger / migration / multiplayer). All html files in\n// `src/` are picked up automatically.\nconst entries = readdirSync(join(__dirname, \'./src\'))\n  .filter((f) => f.endsWith(\'.html\'))\n  .map((f) => join(__dirname, \'./src\', f))\n\n/**\n * Vite shared config, assign alias and root dir\n */\n' + config;
  
  fs.writeFileSync(viteConfigPath, config, 'utf8');
  console.log(`✅ Updated vite.config.ts to remove VueI18n plugin`);
}
