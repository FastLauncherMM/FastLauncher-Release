const fs = require('fs');
const path = require('path');

// Load js-yaml using CommonJS format
const yaml = require('./xmcl-keystone-ui/node_modules/js-yaml/dist/js-yaml.cjs.js');

// Absolute path to locales directory
const localesDir = path.resolve(__dirname, './xmcl-keystone-ui/locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.yaml'));

console.log(`Found ${files.length} YAML files to convert...`);

for (const file of files) {
  const yamlFilePath = path.join(localesDir, file);
  const jsonFilePath = path.join(localesDir, file.replace(/\.yaml$/, '.json'));
  const content = fs.readFileSync(yamlFilePath, 'utf-8');
  const doc = yaml.load(content);
  fs.writeFileSync(jsonFilePath, JSON.stringify(doc, null, 2), 'utf-8');
  console.log(`✓ Converted ${file} -> ${file.replace(/\.yaml$/, '.json')}`);
}

console.log(`\n✓ Done. Converted ${files.length} files.`);