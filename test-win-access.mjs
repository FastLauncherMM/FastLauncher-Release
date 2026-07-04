import { spawn } from 'child_process'
import { accessSync, constants, existsSync } from 'fs'
import { join, dirname } from 'path'

console.log('=== Windows X_OK test ===')
// Test with a known executable
const testPaths = [
  'C:\\Windows\\System32\\notepad.exe',
  'C:\\Windows\\System32\\cmd.exe',
]

for (const p of testPaths) {
  console.log(`\nFile: ${p}`)
  console.log(`  exists: ${existsSync(p)}`)
  try {
    accessSync(p, constants.X_OK)
    console.log(`  X_OK: PASS`)
  } catch (e) {
    console.log(`  X_OK: FAIL - ${e.message}`)
  }
  try {
    accessSync(p, constants.F_OK)
    console.log(`  F_OK: PASS`)
  } catch (e) {
    console.log(`  F_OK: FAIL - ${e.message}`)
  }
  try {
    accessSync(p)
    console.log(`  access(): PASS`)
  } catch (e) {
    console.log(`  access(): FAIL - ${e.message}`)
  }
}

console.log('\n=== constants ===')
console.log(`  X_OK = ${constants.X_OK}`)
console.log(`  F_OK = ${constants.F_OK}`)
console.log(`  R_OK = ${constants.R_OK}`)
console.log(`  W_OK = ${constants.W_OK}`)
