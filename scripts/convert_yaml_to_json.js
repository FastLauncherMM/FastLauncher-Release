const fs = require('fs');
const path = require('path');

// Resolve the actual path to js-yaml in xmcl-keystone-ui
// Try to handle the module resolution correctly

// First, try to find if js-yaml exists and can be loaded
try {
  // Try to load js-yaml from the correct location
  const jsYamlPath = path.resolve(__dirname, 'xmcl-keystone-ui/node_modules/js-yaml/dist/js-yaml.cjs.js');
  
  let yaml;
  try {
    yaml = require(jsYamlPath);
    console.log('✓ Successfully loaded js-yaml from: ' + jsYamlPath);
  } catch (err) {
    console.error('✗ Failed to load js-yaml from: ' + jsYamlPath);
    console.error('Error: ' + err.message);
    // Try alternative path
    const jsYamlAltPath = path.resolve(__dirname, 'xmcl-keystone-ui/node_modules/js-yaml/lib/yaml.js');
    try {
      yaml = require(jsYamlAltPath);
      console.log('✓ Successfully loaded js-yaml from alternative: ' + jsYamlAltPath);
    } catch (altErr) {
      console.error('✗ All attempts to load js-yaml failed');
      process.exit(1);
    }
  }

  function convertFile(filePath, outputPath) {
    const content = fs.readFileSync(filePath, 'utf8');
    let jsonData;
    
    try {
      jsonData = yaml.load(content);
      fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf8');
      console.log(`✓ Converted ${filePath.replace(/^.*\//, '')} -> ${outputPath.replace(/^.*\//, '')}`);
      return true;
    } catch (error) {
      console.error(`✗ Failed to convert ${filePath}: ${error.message}`);
      return false;
    }
  }

  function convertAll() {
    const localesDir = path.join(__dirname, 'xmcl-keystone-ui/locales');
    const yamlFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.yaml'));
    
    console.log(`\n🔄 Converting ${yamlFiles.length} YAML files to JSON...\n`);
    
    let successCount = 0;
    for (const file of yamlFiles) {
      const yamlPath = path.join(localesDir, file);
      const jsonPath = path.join(localesDir, file.replace('.yaml', '.json'));
      
      if (convertFile(yamlPath, jsonPath)) {
        successCount++;
      }
    }
    
    console.log(`\n✅ Successfully converted ${successCount}/${yamlFiles.length} files to JSON.`);
  }

  convertAll();
} catch (globalError) {
  console.error('✗ Global error in conversion script:');
  console.error(globalError);
  process.exit(1);
}