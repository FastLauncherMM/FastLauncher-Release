<template>
  <div class="app-background absolute z-0 h-full w-full">
    <transition
      name="fade-transition"
    >
      <video
        v-if="customBackgroundVideo"
        ref="videoRef"
        :key="`custom-video-${customBackgroundVideo}`"
        class="absolute z-0 h-full w-full object-cover"
        :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
        :src="customBackgroundVideo"
        autoplay
        loop
        playsinline
        muted
      />
      <Particles
        v-else-if="backgroundType === BackgroundType.PARTICLE"
        color="#dedede"
        class="absolute z-0 h-full w-full"
        :style="{ filter: `blur(${blur}px)` }"
        :click-mode="particleMode"
      />
      <Halo
        v-else-if="backgroundType === BackgroundType.HALO"
        class="absolute z-0 h-full w-full"
        :style="{ filter: `blur(${blur}px)` }"
      />
      <img
        v-else-if="backgroundImage?.type === 'image' && backgroundType === BackgroundType.IMAGE"
        :key="backgroundImage.url"
        :src="backgroundImage.url"
        class="absolute z-0 h-full w-full"
        :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
      >
      <video
        v-else-if="backgroundImage?.type === 'video' && backgroundType === BackgroundType.VIDEO"
        ref="videoRef"
        :key="`video-${backgroundImage.url}`"
        class="absolute z-0 h-full w-full object-cover"
        :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
        :src="backgroundImage.url"
        autoplay
        loop
        playsinline
        muted
      />
    </transition>

    <transition
      name="fade-transition"
    >
      <div
        v-if="((backgroundColorOverlay && !isHome) || backgroundType === BackgroundType.NONE) && !customBackgroundVideo"
        class="z-3 absolute h-full w-full"
        :style="{ 'background': backgroundColor }"
      />
    </transition>

    <div
      v-if="backgroundType === BackgroundType.NONE && !customBackgroundVideo"
      class="launcher-atmosphere"
      aria-hidden="true"
    >
      <span class="launcher-atmosphere__grid" />
      <span class="launcher-atmosphere__orb launcher-atmosphere__orb--one" />
      <span class="launcher-atmosphere__orb launcher-atmosphere__orb--two" />
      <span class="launcher-atmosphere__vignette" />
    </div>
  </div>
</template>
<script lang="ts" setup>
import Halo from '@/components/Halo.vue'
import Particles from '@/components/Particles.vue'
import { injection } from '@/util/inject'
import { kTheme, BackgroundType } from '@/composables/theme'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kCustomCss } from '@/composables/customCss'
import { inject } from 'vue'

const customCss = inject(kCustomCss)
const customBackgroundVideo = computed(() => customCss?.customBackgroundVideo.value || '')

const { sideBarColor, backgroundColorOverlay, backgroundColor, blur, backgroundImage, backgroundType, particleMode, backgroundImageFit, volume } = injection(kTheme)
const videoRef = ref(null as null | HTMLVideoElement)

const route = useRoute()
const isHome = computed(() => route.path === '/')

watch(volume, (newVolume) => {
  if (videoRef.value) {
    videoRef.value.volume = newVolume
  }
})

const { gameProcesses } = injection(kInstanceLaunch)

watch(computed(() => gameProcesses.value.length), (cur, last) => {
  if (cur > 0 && last === 0) {
    videoRef.value?.pause()
  } else if (cur === 0 && last > 0) {
    videoRef.value?.play()
  }
})

watch(videoRef, (v) => {
  if (v) {
    v.volume = volume.value
  }
})

onMounted(() => {
  if (videoRef.value) {
    videoRef.value.volume = volume.value
  }
})

watch(backgroundType, (t) => {
  console.log(t)
  console.log(backgroundImage.value)
})


</script>
<style scoped>
.app-background {
  overflow: hidden;
  pointer-events: none;
  background: var(--color-bg);
}

.launcher-atmosphere {
  position: absolute;
  inset: 0;
  z-index: 5;
  overflow: hidden;
  opacity: 0.78;
}

.launcher-atmosphere__grid {
  position: absolute;
  inset: -64px;
  opacity: 0.18;
  background-image:
    linear-gradient(rgba(var(--v-theme-on-surface), 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.035) 1px, transparent 1px);
  background-size: 56px 56px;
  -webkit-mask-image: radial-gradient(circle at 58% 28%, black, transparent 74%);
  mask-image: radial-gradient(circle at 58% 28%, black, transparent 74%);
}

.launcher-atmosphere__orb {
  position: absolute;
  display: block;
  width: min(52vw, 720px);
  aspect-ratio: 1;
  border-radius: 9999px;
  background: rgba(var(--v-theme-primary), 0.16);
  filter: blur(92px);
}

.launcher-atmosphere__orb--one {
  top: -36%;
  right: -10%;
}

.launcher-atmosphere__orb--two {
  bottom: -48%;
  left: 12%;
  width: min(44vw, 600px);
  opacity: 0.42;
}

.launcher-atmosphere__vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 58% 34%, transparent 12%, rgba(0, 0, 0, 0.08) 62%, rgba(0, 0, 0, 0.24) 100%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.04), transparent 22%, rgba(0, 0, 0, 0.12));
}

.img-container {
  background: radial-gradient(ellipse at top right, transparent, v-bind(sideBarColor) 72%);
  position: absolute;
  min-width: 100%;
  min-height: 100%;
  z-index: 4;
}

</style>
