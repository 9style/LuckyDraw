<script setup>
import { runtimeConfig, isPlaceholder } from '../core/config.js'
import Disclaimer from '../components/Disclaimer.vue'

defineEmits(['start'])
const { displayTitle, donationText, organizer } = runtimeConfig.settings

// 占位符是给运营看的内部批注，绝不能渲染给参会者。
// 两个字段用同一个判定，不给「一个守卫另一个不守卫」留任何不对称。
const showDonation = !isPlaceholder(donationText)
const showOrganizer = !isPlaceholder(organizer)
</script>

<template>
  <section class="intro">
    <div class="intro__mark">✦</div>
    <h1 class="intro__title gold-text">{{ displayTitle }}</h1>
    <p class="intro__sub">打工人能量图鉴</p>

    <div class="intro__card">
      <p>填 4 个空，摇一支签</p>
      <p>看看今天的你，是哪种职场生物</p>
    </div>

    <div v-if="showDonation || showOrganizer" class="intro__donation">
      <p v-if="showDonation" class="intro__donation-main">{{ donationText }}</p>
      <p v-if="showOrganizer" class="intro__donation-sub">主办：{{ organizer }}</p>
    </div>

    <button class="btn-gold intro__btn" @click="$emit('start')">开 始</button>

    <Disclaimer />
  </section>
</template>

<style scoped>
.intro {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 32px 0 24px;
  text-align: center;
}
.intro__mark { font-size: 40px; color: var(--gold); }
.intro__title { margin: 0; font-size: 34px; letter-spacing: 0.16em; }
.intro__sub { margin: 0; color: var(--text-sub); letter-spacing: 0.3em; font-size: 13px; }
.intro__card {
  margin-top: 22px;
  padding: 20px 26px;
  border: 1px solid var(--card-line);
  border-radius: var(--radius);
  background: var(--card-bg);
  color: var(--text-sub);
  line-height: 1.9;
  font-size: 15px;
}
.intro__card p { margin: 0; }
.intro__donation { margin-top: 8px; }
.intro__donation-main { margin: 0; color: var(--gold); font-size: 14px; }
.intro__donation-sub { margin: 4px 0 0; color: var(--text-dim); font-size: 12px; }
.intro__btn { margin-top: 18px; }
</style>
