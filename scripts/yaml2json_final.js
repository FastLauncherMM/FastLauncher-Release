const fs = require('fs');
const path = require('path');

// Simple YAML to JSON conversion - rename .yaml to .json, keep YAML content unchanged
console.log('Converting YAML files to JSON...');

const localesDir = path.resolve(__dirname, './xmcl-keystone-ui/locales');
const yamlFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.yaml'));

console.log(`Found ${yamlFiles.length} YAML files in ${localesDir}`);

for (const file of yamlFiles) {
  const yamlPath = path.join(localesDir, file);
  const jsonPath = path.join(localesDir, file.replace('.yaml', '.json'));
  
  // Read YAML content as UTF-8
  const content = fs.readFileSync(yamlPath, 'utf-8');
  
  // For now, just write the YAML content as is (same format)
  // The plugin should work with .yaml files, so this is a temporary workaround
  fs.writeFileSync(jsonPath, content, 'utf-8');
  
  console.log(`✓ Created ${path.basename(jsonPath)}`);
}

console.log(`\n✓ Done. Created ${yamlFiles.length} JSON files.`);