// src/core/state.js
import { reactive } from 'vue'
import { saveSession, loadSession, clearSession } from './storage.js'

export const STAGES = ['intro', 'form', 'divining', 'result']

export const store = reactive({
  stage: 'intro',
  profile: null,
  reading: null,
  unlocked: false
})

function persist() {
  saveSession({
    stage: store.stage,
    profile: store.profile,
    reading: store.reading,
    unlocked: store.unlocked
  })
}

export function setStage(stage) {
  if (!STAGES.includes(stage)) return
  store.stage = stage
  persist()
}

export function setProfile(profile) {
  store.profile = profile
  persist()
}

export function setReading(reading) {
  store.reading = reading
  persist()
}

export function unlock() {
  store.unlocked = true
  persist()
}

export function resetAll() {
  store.stage = 'intro'
  store.profile = null
  store.reading = null
  store.unlocked = false
  clearSession()
}

/**
 * 会话形状校验 —— 本模块是**全项目唯一消费不可信输入的入口**。
 *
 * 为什么真值判断（`!saved.reading`）不够：sessionStorage 里的内容可能来自旧版本、
 * 被用户手改、或写入时本身就是残缺的（例如 `{ scores: {…} }` 这种**有 scores、无 vars**
 * 的 reading）。对象非空即为真，残缺会话会顺利通过，随后 `ResultView` 渲染
 * `r.vars.name` 抛异常 → 整页空白，且没有跳过、没有错误提示、没有恢复路径。
 *
 * 校验面取「视图**实际解引用**的字段」，而不是全部字段：
 *   · `vars.name / dept / zodiac / tenure` → ResultView 首屏
 *   · `scores`                             → ScoreRadar / ScoreBars
 *   · `identity`                           → ResultView 的 `r.identity.text`
 *   · `fortune` / `lucky`                  → FortuneSlip / LuckyEggs（均为 `required: true`）
 * `bands` 也在两个子组件的 props 里，同样一并校验。
 *
 * 放在核心层而不是模板里：两个入口（`App.vue` 的 `restore()` 与 `DivinationView`
 * 对 `store.reading` 的间接依赖）都由这一处一次性堵住，无需改任何模板。
 * 校验不通过时**清除会话并返回 false**，落回开场页 —— 不做部分恢复：
 * 恢复到一半的结果页与白屏只差一步。
 */
const PROFILE_KEYS = ['name', 'dept', 'tenure', 'zodiac']
const VARS_KEYS = ['name', 'dept', 'zodiac', 'tenure']

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function isUsableProfile(profile) {
  if (!isPlainObject(profile)) return false
  if (!PROFILE_KEYS.every((k) => typeof profile[k] === 'string')) return false
  // deptText 是本轮才加的展示字段（用户手打的部门原文），因此**按可选处理**：
  // 改版前存下的会话里没有它，刷新后仍要能恢复，那时 ResultView 退回规范名渲染。
  // 但一旦它存在，就必须是字符串 —— 否则 vars.dept 会渲染出个对象。
  if ('deptText' in profile && typeof profile.deptText !== 'string') return false
  return true
}

function isUsableReading(reading) {
  if (!isPlainObject(reading)) return false
  if (!isPlainObject(reading.vars)) return false
  if (!VARS_KEYS.every((k) => typeof reading.vars[k] === 'string')) return false
  return (
    isPlainObject(reading.scores) &&
    isPlainObject(reading.bands) &&
    isPlainObject(reading.identity) &&
    isPlainObject(reading.fortune) &&
    isPlainObject(reading.lucky)
  )
}

function isUsableSession(saved) {
  return isPlainObject(saved) && isUsableProfile(saved.profile) && isUsableReading(saved.reading)
}

/**
 * 从 sessionStorage 恢复。会话形状完整才恢复到结果页，
 * 否则**清除会话**并回到开场页 —— 避免恢复到一半的空状态。
 */
export function restore() {
  const saved = loadSession()
  if (!isUsableSession(saved)) {
    // 形状不符（或根本没有会话 / JSON 已损坏）都清一次：残缺会话留着只会在
    // 下一次恢复时再次走到这里。clearSession 自身吞异常，无 storage 时是空操作。
    clearSession()
    return false
  }
  store.profile = saved.profile
  store.reading = saved.reading
  store.unlocked = Boolean(saved.unlocked)
  store.stage = saved.stage === 'result' || saved.stage === 'divining' ? 'result' : 'form'
  // 归一化后的 stage 必须立刻落盘：否则内存里是 'result'、存储里仍是 'divining'，
  // 二者要等到下一次写入（例如用户点「再算一次」）才对齐。
  persist()
  return true
}
