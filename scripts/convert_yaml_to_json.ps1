$localesDir = "xmcl-keystone-ui/locales"
$yamlFiles = Get-ChildItem -Path "$localesDir/*.yaml" -File
$yamlCount = ($yamlFiles).Count
Write-Host "Found $yamlCount YAML files in $localesDir"

foreach ($file in $yamlFiles) {
    $jsonFile = $file.FullName.Replace(".yaml", ".json")
    Copy-Item -Path $file.FullName -Destination $jsonFile -Force
    Write-Host "✓ Created $(Split-Path $jsonFile -Leaf)"
}

Write-Host "\n✓ Done. Created $yamlCount JSON files."
