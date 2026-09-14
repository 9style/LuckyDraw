<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { runtimeConfig } from '../core/config.js'
import { makeRng } from '../core/rng.js'
import { buildReading } from '../core/fortune.js'
import { store, setReading, setStage } from '../core/state.js'
import { bumpCount } from '../core/storage.js'

const emit = defineEmits(['done'])
const ui = runtimeConfig.copy.ui.divining

// 总时长约 3s：摇签 1.5s → 弹出 1.05s → 定格 0.45s
// ⚠️ DRAW_MS 与 animation.css 中 .stick--drawn 的 `1.05s` 是一对，改一处必须改另一处
//    （两处没有共享 token，只靠这条注释维系）。SHAKE_MS 那边对应的是 .tube--shaking
//    的 `0.42s` 单次周期，而 1500 是**总**摇签时长，二者不是同一个量。
const SHAKE_MS = 1500
const DRAW_MS = 1050

const shaking = ref(true)
const drawn = ref(false)
const glowing = ref(false)
const stepIndex = ref(0)

let timers = []

function later(fn, ms) {
  timers.push(setTimeout(fn, ms))
}

onMounted(() => {
  // 守卫：没有 profile 就无从计算（例如会话被清空后又落到本阶段）。
  // 不守卫的话 buildReading 里的 profile.name 会直接抛异常。
  if (!store.profile) {
    setStage('form')
    return
  }

  // 结果在此刻一次性算定并冻结，与动画抽出的签是同一支
  const profile = store.profile
  const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0
  const reading = buildReading(profile, runtimeConfig, makeRng(seed))
  setReading({ ...reading, seed })

  if (runtimeConfig.settings.enableCount) bumpCount()

  later(() => {
    shaking.value = false
    drawn.value = true
    glowing.value = true
    stepIndex.value = 1
  }, SHAKE_MS)

  later(() => {
    stepIndex.value = 2
  }, SHAKE_MS + DRAW_MS * 0.7)

  later(() => emit('done'), SHAKE_MS + DRAW_MS + 450)
})

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  timers = []
})
</script>

<template>
  <section class="divining">
    <p class="divining__title">{{ ui.title }}</p>

    <div class="tube-stage">
      <div class="starfield" />
      <div class="glow" :class="{ 'glow--on': glowing }" />

      <div class="tube" :class="{ 'tube--shaking': shaking }" />

      <div v-if="drawn" class="stick stick--drawn">
        {{ store.reading?.fortune?.level ?? '' }}
      </div>
    </div>

    <ul class="steps">
      <li
        v-for="(s, i) in ui.steps"
        :key="s"
        class="steps__item"
        :class="{ 'steps__item--on': i <= stepIndex }"
      >
        {{ s }}
      </li>
    </ul>
  </section>
</template>

<style scoped>
.divining {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* 标题底边 → 定格态签顶边 的净空 = gap − 50.96px。50.96 是签顶边高出
     .tube-stage 顶边的固定距离（= 128 × 1.14 / 2 − 36 + 14，与字体、DPR 无关）。
     原 34px 时净空为 −16.96px —— 签会压住标题（实测 rect 相交 16.96px）。
     取 70px → 净空 19.0px，满足 ≥16px。改小前请重新实测两条 rect。 */
  gap: 70px;
}
.divining__title { margin: 0; color: var(--text-sub); letter-spacing: 0.28em; font-size: 14px; }
.steps { display: flex; gap: 18px; margin: 0; padding: 0; list-style: none; }
.steps__item { font-size: 12px; color: var(--text-dim); transition: color 0.3s ease; }
.steps__item--on { color: var(--gold); }
</style>
