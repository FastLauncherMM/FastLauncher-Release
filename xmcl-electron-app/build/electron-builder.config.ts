/* eslint-disable no-template-curly-in-string */
import { config as dotenv } from 'dotenv'
import type { Configuration } from 'electron-builder'

dotenv()

// Code signing is opt-in: it only kicks in when a certificate is provided via
// the environment (CSC_LINK / WIN_CSC_LINK plus CSC_KEY_PASSWORD, e.g. through
// a .env file beside package.json). Without it, the build stays unsigned and
// everything below keeps working out of the box.
const hasSigningCert = !!(process.env.CSC_LINK || process.env.WIN_CSC_LINK)

export const config = {
  productName: 'FastLauncher',
  appId: 'xmcl',
  directories: {
    output: 'build/output',
    buildResources: 'build',
    app: '.',
  },
  extraResources: [],
  protocols: {
    name: 'XMCL',
    schemes: ['xmcl'],
  },
  // assign publish for auto-updater
  // set this to your own repo!
  publish: [{
    provider: 'github',
    owner: 'FastLauncherMM',
    repo: 'FastLauncher-Release',
  }],
  files: [{
    from: 'dist',
    to: '.',
    filter: ['**/*.js', '**/*.ico', '**/*.png', '**/*.webp', '**/*.svg', '*.node', '**/*.html', '**/*.css', '**/*.woff2'],
  }, {
    from: '.',
    to: '.',
    filter: ['package.json', 'app-update.yml'],
  }],
  artifactName: 'FastLauncher-${version}-${platform}-${arch}.${ext}',
  appx: {
    displayName: 'FastLauncher',
    applicationId: 'xmcl',
    identityName: 'xmcl',
    backgroundColor: 'transparent',
    publisher: process.env.PUBLISHER,
    publisherDisplayName: 'CI010',
    setBuildNumber: true,
  },
  dmg: {
    artifactName: 'FastLauncher-${version}-${arch}.${ext}',
    contents: [
      {
        x: 410,
        y: 150,
        type: 'link',
        path: '/Applications',
      },
      {
        x: 130,
        y: 150,
        type: 'file',
      },
    ],
  },
  mac: {
    icon: 'icons/dark.icns',
    darkModeSupport: true,
    target: [
      {
        target: 'dmg',
        arch: ['arm64', 'x64'],
      },
    ],
    extendInfo: {
      NSMicrophoneUsageDescription: 'A Minecraft mod wants to access your microphone.',
      NSCameraUsageDescription: 'Please give us access to your camera',
      'com.apple.security.device.audio-input': true,
      'com.apple.security.device.camera': true,
    },
  },
  nsis: {
    artifactName: 'FastLauncher-setup.${ext}',
    oneClick: true,
    perMachine: false,
    differentialPackage: true,
    include: 'build/installer.nsh',
  },
  // Highest LZMA (solid) compression for the NSIS installer — shrinks the
  // setup size meaningfully on top of the JRE file filters below.
  compression: 'maximum',
  win: {
    icon: 'icons/dark.ico',
    // RFC 3161 timestamping keeps signatures valid after the certificate
    // expires; only applied when a signing certificate is actually set.
    ...(hasSigningCert
      ? { rfc3161TimeStampServer: 'http://timestamp.digicert.com' }
      : {}),
    target: [
      'nsis',
      {
        target: 'zip',
        arch: [
          'x64',
          'ia32',
        ],
      },
    ],
  },
  linux: {
    executableName: 'FastLauncher',
    desktop: {
      MimeType: 'x-scheme-handler/xmcl',
      StartupWMClass: 'FastLauncher',
    },
    category: 'Game',
    icon: 'icons/dark@256x256.png',
    artifactName: 'FastLauncher-${version}-${arch}.${ext}',
    target: [
      { target: 'deb', arch: ['x64', 'arm64'] },
      { target: 'rpm', arch: ['x64', 'arm64'] },
      { target: 'AppImage', arch: ['x64', 'arm64'] },
      { target: 'tar.xz', arch: ['x64', 'arm64'] },
      { target: 'pacman', arch: ['x64', 'arm64'] },
    ],
  },
  snap: {
    publish: [
      'github',
    ],
  },
} satisfies Configuration
