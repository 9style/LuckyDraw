<script setup>
import { ref, computed, onMounted } from 'vue'
import { runtimeConfig } from '../core/config.js'
import { renderPoster } from '../core/poster/poster.js'
import qrUrl from '../assets/qrcode.png'

/**
 * 13 条用例：第 0 条是**1:1 原尺寸**的常规输入（基线），其余 12 条是极端输入
 * （姓名两端、最长文案、分数两端）。人眼扫查有没有溢出/重叠/压字。
 *
 * 第 0 条为什么单独按原尺寸铺开：栅格里的缩略图最小只有 220px 宽，16px 的免责声明、
 * 二维码静默区、烫金边框的余量，在那个尺寸下都判断不了；而 index.html 的
 * user-scalable=no 让「把浏览器放大」这条退路在手机上根本不成立。
 * 这个页面是本功能唯一的视觉验收工具，所以至少要有一张能按真实像素看的。
 */
const CASES = [
  { label: '常规输入（基线）', full: true },
  { label: '1 字姓名', name: '张' },
  { label: '8 字全角姓名', name: '欧阳司马诸葛上官' },
  { label: '英文长名', name: 'Alexander' },
  { label: '中英混合名', name: '李雷Han' },
  { label: '最低分', scores: { moYu: 0, shengZhi: 0, renMai: 0, caiYun: 0 } },
  { label: '满分', scores: { moYu: 100, shengZhi: 100, renMai: 100, caiYun: 100 } },
  { label: '极端不均', scores: { moYu: 0, shengZhi: 100, renMai: 0, caiYun: 100 } },
  { label: '上上签', fortuneLevel: '上上签' },
  { label: '小凶', fortuneLevel: '小凶' },
  { label: '长身份标签', identity: '群消息已读不回艺术家兼下午茶首席品鉴官' },
  { label: '超长签辞', verse: '风来满座皆春色一举成名天下知前路分明不用猜明日再议未为迟' },
  // ⚠️ 键名必须与下面读取的字段一致（`c.fortuneLevel`）—— 写成 `level` 会永远读不到，
  // 这一条就悄悄退化成「和基线一样」，而它声称测的是空值兜底。
  { label: '空值兜底', name: '', identity: '', verse: '', fortuneLevel: '' }
]

const results = ref([])
const hero = computed(() => results.value.find((r) => r.full) ?? null)
const rest = computed(() => results.value.filter((r) => !r.full))

function baseReading() {
  return {
    vars: { name: '张三', dept: '技术 / 研发', zodiac: '双子座', tenure: '入职 1-3 年' },
    identity: { text: '年假余额守财奴', dept: null },
    scores: { moYu: 73, shengZhi: 78, renMai: 45, caiYun: 94 },
    bands: { moYu: 'ji', shengZhi: 'ji', renMai: 'ping', caiYun: 'daji' },
    fortune: { level: '小吉', verse: '轻舟已过小重山，前路平平未有澜。', yi: '收尾', ji: '加戏' }
  }
}

onMounted(async () => {
  const img = await new Promise((res) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => res(null)
    i.src = qrUrl
  })

  for (const c of CASES) {
    const r = baseReading()
    if (c.name !== undefined) r.vars.name = c.name
    if (c.scores) r.scores = c.scores
    if (c.identity !== undefined) r.identity.text = c.identity
    if (c.fortuneLevel !== undefined) r.fortune.level = c.fortuneLevel
    if (c.verse !== undefined) r.fortune.verse = c.verse
    try {
      const canvas = document.createElement('canvas')
      const out = renderPoster({ reading: r, cfg: runtimeConfig, canvas, qrImage: img })
      results.value.push({ label: c.label, full: !!c.full, src: out.dataURL, format: out.format, error: null })
    } catch (e) {
      results.value.push({ label: c.label, full: !!c.full, src: '', format: '', error: String(e) })
    }
  }
})
</script>

<template>
  <section class="dbg">
    <h2 class="dbg__title">海报极端输入验收（仅 dev）</h2>
    <p class="dbg__hint">人眼扫查：文字溢出、元素重叠、二维码静默区、底部边距</p>

    <figure v-if="hero" class="dbg__hero">
      <figcaption>
        {{ hero.label }}<span v-if="hero.format"> · {{ hero.format }}</span> · 1:1 原尺寸（窄屏可左右拖动）
      </figcaption>
      <p v-if="hero.error" class="dbg__err">{{ hero.error }}</p>
      <div v-else class="dbg__scroller">
        <img :src="hero.src" :alt="hero.label" />
      </div>
    </figure>

    <div class="dbg__grid">
      <figure v-for="r in rest" :key="r.label" class="dbg__item">
        <figcaption>{{ r.label }}<span v-if="r.format"> · {{ r.format }}</span></figcaption>
        <p v-if="r.error" class="dbg__err">{{ r.error }}</p>
        <img v-else :src="r.src" :alt="r.label" />
      </figure>
    </div>
  </section>
</template>

<style scoped>
.dbg { padding: 20px; }
.dbg__title { font-size: 18px; }
.dbg__hint { color: var(--text-dim); font-size: 13px; }
/* 1:1 那张按画布真实宽度（750px）铺开。栅格里的缩略图最小只有 220px 宽，
   小字与静默区在那个尺寸下判断不了 —— 而 viewport 的 user-scalable=no
   让手机上「放大浏览器」这条退路不可用。窄屏改为在本容器内横向拖动：
   溢出必须留在容器里，不能带着整页一起横滚。 */
.dbg__hero { margin: 0 0 20px; }
.dbg__hero figcaption { font-size: 12px; color: var(--text-sub); margin-bottom: 6px; }
.dbg__scroller {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border: 1px solid var(--card-line);
}
.dbg__scroller img { display: block; width: 750px; max-width: none; height: auto; }
.dbg__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.dbg__item { margin: 0; }
.dbg__item figcaption { font-size: 12px; color: var(--text-sub); margin-bottom: 6px; }
.dbg__item img { width: 100%; height: auto; border: 1px solid var(--card-line); }
.dbg__err { color: #ff9a9a; font-size: 11px; }
</style>
