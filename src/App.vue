<script setup>
import { onMounted } from 'vue'
import { store, setStage, restore } from './core/state.js'
import { runtimeConfig, checkConfigConsistency } from './core/config.js'
import IntroView from './views/IntroView.vue'
import FormView from './views/FormView.vue'
import DivinationView from './views/DivinationView.vue'
import ResultView from './views/ResultView.vue'

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
    <Transition name="stage-fade" mode="out-in">
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
