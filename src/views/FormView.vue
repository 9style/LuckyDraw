<script setup>
import { ref, computed } from 'vue'
import { runtimeConfig } from '../core/config.js'
import { validateProfile } from '../core/validators.js'
import { setProfile } from '../core/state.js'

const emit = defineEmits(['submitted'])

const deptList = Object.entries(runtimeConfig.departments).map(([key, v]) => ({
  key,
  label: v.label
}))

const form = ref({
  name: '',
  dept: '',
  tenure: '',
  zodiac: ''
})

const touched = ref({})
const submitted = ref(false)

const validation = computed(() => validateProfile(form.value, runtimeConfig))
const errors = computed(() => (submitted.value || Object.keys(touched.value).length ? validation.value.errors : {}))

function blur(field) {
  touched.value = { ...touched.value, [field]: true }
}

function onSubmit() {
  submitted.value = true
  if (!validation.value.ok) return
  setProfile({
    name: form.value.name.trim(),
    dept: form.value.dept,
    tenure: form.value.tenure,
    zodiac: form.value.zodiac
  })
  emit('submitted')
}
</script>

<template>
  <section class="form">
    <h2 class="form__title gold-text">报上名来</h2>

    <div class="field">
      <label for="f-name">名字</label>
      <input
        id="f-name"
        v-model="form.name"
        type="text"
        maxlength="8"
        placeholder="怎么称呼你"
        autocomplete="off"
        @blur="blur('name')"
        @keyup.enter="onSubmit"
      />
      <p v-if="errors.name" class="field__err">{{ errors.name }}</p>
    </div>

    <div class="field">
      <label for="f-dept">部门</label>
      <select id="f-dept" v-model="form.dept" @blur="blur('dept')" @change="blur('dept')">
        <option value="" disabled>选一个</option>
        <option v-for="d in deptList" :key="d.key" :value="d.key">{{ d.label }}</option>
      </select>
      <p v-if="errors.dept" class="field__err">{{ errors.dept }}</p>
    </div>

    <div class="field">
      <label>入职多久了</label>
      <div class="chips">
        <button
          v-for="t in runtimeConfig.tenures"
          :key="t"
          type="button"
          class="chip"
          :class="{ 'chip--on': form.tenure === t }"
          @click="form.tenure = t; blur('tenure')"
        >
          {{ runtimeConfig.tenureLabels[t] }}
        </button>
      </div>
      <p v-if="errors.tenure" class="field__err">{{ errors.tenure }}</p>
    </div>

    <div class="field">
      <label for="f-zodiac">星座</label>
      <select id="f-zodiac" v-model="form.zodiac" @blur="blur('zodiac')" @change="blur('zodiac')">
        <option value="" disabled>选一个</option>
        <option v-for="z in runtimeConfig.zodiacs" :key="z" :value="z">
          {{ runtimeConfig.zodiacLabels[z] }}
        </option>
      </select>
      <p v-if="errors.zodiac" class="field__err">{{ errors.zodiac }}</p>
    </div>

    <button class="btn-gold form__btn" :disabled="!validation.ok" @click="onSubmit">开 始 摇 签</button>
    <p class="form__hint">信息只在你的手机上计算，不会上传</p>
  </section>
</template>

<style scoped>
.form {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
  padding: 28px 0;
}
.form__title { margin: 0 0 6px; font-size: 26px; letter-spacing: 0.12em; text-align: center; }
.field { display: flex; flex-direction: column; gap: 8px; }
.field label { font-size: 14px; color: var(--text-sub); }
.field input,
.field select {
  min-height: var(--tap);
  padding: 0 14px;
  border: 1px solid var(--card-line);
  border-radius: 12px;
  /* 比 --card-bg（5% 白）更实的底色。5% 白在深色渐变上几乎不可见，
     整条控件看着像个"没有内容的深色空洞"。这里只改输入控件本身，
     不动全局 token —— 改 token 会波及开场页与结果页的卡片。 */
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
  font-size: 16px;
  font-family: inherit;
}
/* ⚠️ 原生 <select> 在 Windows Chrome 下会**忽略 CSS 的 color**，
   改用平台主题绘制关闭态文字 —— 在深色背景上就是一行几乎看不见的灰字。
   appearance: none 才让上面的 color 真正生效。
   代价是浏览器不再画下拉箭头，所以紧接着用内联 SVG 自绘一个，
   免得去掉原生外观后丢掉"这里可以点开"的提示。 */
.field select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 38px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5' fill='none' stroke='%23e8c074' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 12px 8px;
}
/* 弹出的选项列表不指定的话走系统默认主题，与深色页面割裂。
   原生弹层不支持半透明，所以这里用 --bg-soft 的实色版本。 */
.field select option {
  background: #241a4a;
  color: var(--text-main);
}
.field input:focus,
.field select:focus { outline: 2px solid var(--gold-dim); outline-offset: 1px; }
/* 原生的 placeholder 用浏览器默认灰 #757575，在深色底上只有 3.03:1 ——
   是全页最难读的文字。这与上面 select 的问题是同一类：颜色没按主题走。
   用 --text-sub 而非 --text-main：既过 WCAG AA（约 6.5:1），
   又与已填内容的近白色有明确区分，不会让人误以为已经填过了。 */
.field input::placeholder { color: var(--text-sub); opacity: 1; }
.field__err { margin: 0; font-size: 12px; color: #ff9a9a; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  padding: 0 14px;
  border: 1px solid var(--card-line);
  background: var(--card-bg);
  color: var(--text-sub);
  font-size: 13px;
  border-radius: 999px;
}
.chip--on { background: var(--gold); color: #2a1a05; border-color: var(--gold); font-weight: 700; }
.form__btn { margin-top: 8px; }
.form__hint { margin: 0; text-align: center; font-size: 12px; color: var(--text-dim); }
</style>
