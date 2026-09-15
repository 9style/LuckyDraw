<script setup>
import { onMounted, defineAsyncComponent } from 'vue'
import { store, setStage, restore } from './core/state.js'
import { runtimeConfig, checkConfigConsistency } from './core/config.js'
import IntroView from './views/IntroView.vue'
import FormView from './views/FormView.vue'
import DivinationView from './views/DivinationView.vue'
import ResultView from './views/ResultView.vue'

// 开发期验收页（?debug=poster）。dev 构建才可能为 true。
const debugPoster = import.meta.env.DEV && new URLSearchParams(location.search).get('debug') === 'poster'

// 刻意写成「条件三元 + 动态 import」，而不是「文件顶部静态 import +
// 模板 v-if="debugPoster"」——后者看着更直白，但**摇不掉**：<script setup> 会把
// 模板里引用的绑定包一层 unref()，条件于是编译成 `unref(false)`；unref 是运行时
// 函数调用，压缩器折不掉这个三元，组件的引用就一直挂着，整个 DebugPoster
// （用例字符串 + 样式）都会进产物。实测过，确实如此。
// 而这里 import.meta.env.DEV 在生产构建被替换成常量 false 后，三元整条被折掉，
// 动态 import 根本不会进依赖图，连它的 chunk 与样式都不会产出。
const DebugPoster = debugPoster
  ? defineAsyncComponent(() => import('./views/DebugPoster.vue'))
  : null

onMounted(() => {
  // 标签页标题取自配置，而不是 index.html 里那句硬编码。
  // `settings.displayTitle` 是页面措辞的**运营旋钮**（规格 §11.2）：运营把它改掉后，
  // 开场页标题与海报标题都会跟着变，只有 <title> 会静默留在旧值上。
  // 浏览器标签页同样是用户可见文案面，必须跟同一份配置走。
  document.title = runtimeConfig.settings.displayTitle
  checkConfigConsistency().forEach((p) => console.warn('[config]', p))
  restore()
})
</script>

<template>
  <div class="app-root">
    <DebugPoster v-if="debugPoster" />
    <Transition v-else name="stage-fade" mode="out-in">
      <IntroView v-if="store.stage === 'intro'" key="intro" @start="setStage('form')" />
      <FormView v-else-if="store.stage === 'form'" key="form" @submitted="setStage('divining')" />
      <DivinationView v-else-if="store.stage === 'divining'" key="divining" @done="setStage('result')" />
      <ResultView v-else key="result" />
    </Transition>
  </div>
</template>

<style scoped>
.app-root {
  /* 用 flex:1 填充 #app 的 content box，不声明 min-height:100vh ——
     见 theme.css 里 #app 的布局约定说明。 */
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 20px;
}
</style>

<style>
.stage-fade-enter-active,
.stage-fade-leave-active {
  transition: opacity 0.32s ease;
}
.stage-fade-enter-from,
.stage-fade-leave-to {
  opacity: 0;
}
</style>
