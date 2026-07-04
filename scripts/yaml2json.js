const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const localesDir = path.resolve(__dirname, '../xmcl-keystone-ui/locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.yaml'));

for (const file of files) {
  const yamlPath = path.join(localesDir, file);
  const jsonPath = path.join(localesDir, file.replace(/\.yaml$/, '.json'));
  const doc = yaml.load(fs.readFileSync(yamlPath, 'utf-8'));
  fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 2), 'utf-8');
  console.log(`Converted ${file} -> ${file.replace(/\.yaml$/, '.json')}`);
}

console.log(`\nDone. Converted ${files.length} files.`);
