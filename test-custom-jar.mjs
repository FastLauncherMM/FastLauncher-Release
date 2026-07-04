import { spawn } from 'child_process'
import { accessSync, constants, existsSync } from 'fs'
import { join, dirname } from 'path'

// Simulate what LaunchService does for custom jar launch

const customJarPath = process.argv[2] || ''
const customJavaPath = process.argv[3] || ''

if (!customJarPath) {
  console.error('Usage: node test-custom-jar.mjs <jar-path> [java-path]')
  process.exit(1)
}

console.log('=== Custom Jar Launch Test ===')
console.log('JAR:', customJarPath)
console.log('Java:', customJavaPath || '(auto-detect)')

const jarDir = dirname(customJarPath)
console.log('JAR dir:', jarDir)

let effectiveJavaPath = customJavaPath || undefined

if (!effectiveJavaPath) {
  const candidates = [
    join(jarDir, 'jre-1.8', 'bin', 'javaw.exe'),
    join(jarDir, 'jre-1.8', 'bin', 'java'),
    join(jarDir, 'jre', 'bin', 'javaw.exe'),
    join(jarDir, 'jre', 'bin', 'java'),
    join(jarDir, 'jdk-17', 'bin', 'javaw.exe'),
    join(jarDir, 'jdk-17', 'bin', 'java'),
    join(jarDir, 'jdk', 'bin', 'javaw.exe'),
    join(jarDir, 'jdk', 'bin', 'java'),
  ]
  for (const c of candidates) {
    console.log('  check:', c, '->', existsSync(c))
    if (existsSync(c)) {
      effectiveJavaPath = c
      break
    }
  }
}

console.log('Effective Java:', effectiveJavaPath)

if (!effectiveJavaPath) {
  console.error('ERROR: No Java found!')
  process.exit(1)
}

try {
  accessSync(effectiveJavaPath, constants.X_OK)
  console.log('X_OK check: PASS')
} catch (e) {
  console.log('X_OK check: FAIL -', e.message, '(Windows may still work)')
}

console.log('Launching:', effectiveJavaPath, '-jar', customJarPath)
console.log('  cwd:', jarDir)

const child = spawn(effectiveJavaPath, ['-jar', customJarPath], {
  cwd: jarDir,
  detached: true,
  stdio: 'pipe',
  env: process.env,
})

console.log('PID:', child.pid)

if (child.pid) {
  console.log('SUCCESS: Process spawned with PID', child.pid)
  setTimeout(() => {
    child.kill()
    console.log('Process killed')
    process.exit(0)
  }, 3000)
} else {
  console.error('FAILED: No PID')
  process.exit(1)
}

child.on('error', (err) => {
  console.error('SPAWN ERROR:', err)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  console.log(`Process exited: code=${code}, signal=${signal}`)
})

child.stdout.on('data', (d) => process.stdout.write(d))
child.stderr.on('data', (d) => process.stderr.write(d))
