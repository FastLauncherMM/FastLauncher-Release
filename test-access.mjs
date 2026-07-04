import { accessSync, constants, existsSync } from 'fs'
import { join } from 'path'

console.log('X_OK:', constants.X_OK, 'F_OK:', constants.F_OK, 'R_OK:', constants.R_OK)

const f = join(process.env.WINDIR || 'C:\\Windows', 'notepad.exe')
console.log('Testing:', f, 'exists:', existsSync(f))

try {
  accessSync(f, constants.X_OK)
  console.log('X_OK: PASS')
} catch (e) {
  console.log('X_OK: FAIL', e.message)
}

try {
  accessSync(f, constants.F_OK)
  console.log('F_OK: PASS')
} catch (e) {
  console.log('F_OK: FAIL', e.message)
}

// Test a non-system32 path that definitely exists
const testFile = new URL(import.meta.url).pathname
console.log('\nSelf:', testFile, 'exists:', existsSync(testFile))
try {
  accessSync(testFile, constants.X_OK)
  console.log('X_OK: PASS')
} catch (e) {
  console.log('X_OK: FAIL', e.message)
}
