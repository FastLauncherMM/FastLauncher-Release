import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import yaml from 'js-yaml';

const localesDir = resolve(import.meta.dirname, '../xmcl-keystone-ui/locales');
const files = readdirSync(localesDir).filter(f => f.endsWith('.yaml'));

for (const file of files) {
  const yamlPath = join(localesDir, file);
  const jsonPath = join(localesDir, file.replace(/\.yaml$/, '.json'));
  const doc = yaml.load(readFileSync(yamlPath, 'utf-8'));
  writeFileSync(jsonPath, JSON.stringify(doc, null, 2), 'utf-8');
  console.log(`Converted ${file} -> ${file.replace(/\.yaml$/, '.json')}`);
}

console.log(`\nDone. Converted ${files.length} files.`);
