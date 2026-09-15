// src/core/config.js
import settings from '../config/settings.json'
import departments from '../config/departments.json'
import scoring from '../config/scoring.json'
import poster from '../config/poster.json'
import copyZodiac from '../config/copy/zodiac.json'
import copyTenure from '../config/copy/tenure.json'
import copyDepartment from '../config/copy/department.json'
import copyIdentity from '../config/copy/identity.json'
import copyScores from '../config/copy/scores.json'
import copyFortunes from '../config/copy/fortunes.json'
import copyLucky from '../config/copy/lucky.json'
import copyUi from '../config/copy/ui.json'

const copy = {
  zodiac: copyZodiac,
  tenure: copyTenure,
  department: copyDepartment,
  identity: copyIdentity,
  scores: copyScores,
  fortunes: copyFortunes,
  lucky: copyLucky,
  ui: copyUi
}

export const TENURES = ['lt1', '1to3', '3to5', 'gt5']

export const TENURE_LABELS = {
  lt1: '入职不到 1 年',
  '1to3': '入职 1-3 年',
  '3to5': '入职 3-5 年',
  gt5: '入职 5 年以上'
}

export const ZODIACS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
]

export const ZODIAC_LABELS = {
  aries: '白羊座', taurus: '金牛座', gemini: '双子座', cancer: '巨蟹座',
  leo: '狮子座', virgo: '处女座', libra: '天秤座', scorpio: '天蝎座',
  sagittarius: '射手座', capricorn: '摩羯座', aquarius: '水瓶座', pisces: '双鱼座'
}

export const runtimeConfig = {
  settings,
  departments,
  scoring,
  poster,
  tenures: TENURES,
  tenureLabels: TENURE_LABELS,
  zodiacs: ZODIACS,
  zodiacLabels: ZODIAC_LABELS,
  copy
}

/**
 * 校验 6 个部门大类在四处配置中齐备。
 * 返回缺失项描述数组，空数组表示一致。启动时调用，缺失只 warn 不抛。
 */
export function checkConfigConsistency() {
  const problems = []
  const deptKeys = Object.keys(departments)
  const bonusKeys = Object.keys(scoring.deptBonus || {})

  for (const k of deptKeys) {
    if (!bonusKeys.includes(k)) problems.push(`scoring.deptBonus 缺少部门 "${k}"`)
    if (!copy.department[k]) problems.push(`copy/department.json 缺少部门 "${k}"`)
    // keywords 是「自由输入 → 6 大类」的唯一依据。某个大类关键词表空了，
    // 该类就再也匹配不上任何人 —— 用户全被兜到 other，该部门专属的吐槽与身份
    // 标签永远不会出现。属于静默失效（页面正常、只是内容永远不对），必须拦。
    if (!Array.isArray(departments[k]?.keywords) || departments[k].keywords.length === 0) {
      problems.push(`departments.json 的部门 "${k}" 缺少非空 keywords，该类将永远匹配不上`)
    }
  }
  for (const k of bonusKeys) {
    if (!deptKeys.includes(k)) problems.push(`departments.json 缺少部门 "${k}"`)
  }
  for (const z of ZODIACS) {
    if (!copy.zodiac[z]) problems.push(`copy/zodiac.json 缺少星座 "${z}"`)
  }
  for (const t of TENURES) {
    if (!copy.tenure[t]) problems.push(`copy/tenure.json 缺少年限段 "${t}"`)
  }
  for (const dim of scoring.dimensions) {
    if (!copy.scores[dim]) problems.push(`copy/scores.json 缺少维度 "${dim}"`)
  }
  return problems
}

/** 归一化：只保留汉字（含 CJK 扩展 A，同 validators.js 的取法）与 ASCII 字母数字，转小写。 */
const DEPT_NORM_RE = /[^㐀-䶿一-鿿a-z0-9]/g

/**
 * 把用户手打的部门文字归到 6 大类之一，返回大类 key（兜底 `'other'`）。
 *
 * 为什么需要它：部门输入框从下拉框改成了自由文本（用户会打「搞算法的」「大区销售」），
 * 而下游三处——`scoring.deptBonus`、`copy/department.json`、`copy/identity.json`
 * 的部门专属标签——都只认 6 个 key。**匹配只在提交那一刻做一次**，把结果存进
 * `profile.dept`，`profile.deptText` 另存原文供展示。这样下游一行都不用改，
 * `BIAS_TIERS` 的标定也不会因为部门退出打分而失效。
 *
 * 匹配规则：
 *  1. 归一化 —— 去掉全部空白与标点并转小写，所以「技术 / 研发」「技术/研发」
 *     乃至「i t」都能对齐到同一串。关键词也走同一套归一化，两边对称。
 *  2. **最长命中优先**，而不是按配置顺序取第一个命中的：'产品运营' 同时含
 *     「产品」(product) 与「运营」(ops)，应当由更具体的关键词决出胜者。
 *  3. 等长命中时保留先遍历到的（配置顺序），保证同一输入永远给同一答案。
 *  4. 全不命中、空值、关键词表缺失 —— 一律兜底 `'other'`，绝不抛异常。
 *     输入框是自由文本，什么奇怪东西都可能进来。
 */
export function matchDept(text, deptConfig = runtimeConfig.departments) {
  const input = normalizeDept(text)
  if (!input) return 'other'

  let bestKey = 'other'
  let bestLen = 0
  for (const [key, dept] of Object.entries(deptConfig ?? {})) {
    const keywords = Array.isArray(dept?.keywords) ? dept.keywords : []
    for (const raw of keywords) {
      const kw = normalizeDept(raw)
      // 严格大于：等长时不动，先遍历到的胜出
      if (kw && kw.length > bestLen && input.includes(kw)) {
        bestKey = key
        bestLen = kw.length
      }
    }
  }
  return bestKey
}

function normalizeDept(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(DEPT_NORM_RE, '')
}

/**
 * 判断一个 settings 值是否仍是未填写的占位符。
 *
 * 用途：占位符是给运营看的内部批注（如 `【待填写：主办方】`），
 * **绝不能渲染到页面上** —— 在公益活动上显示「待填写：本次筹款将捐至 XX 公益项目」，
 * 比不显示这一行更糟。
 *
 * 之所以用 `startsWith('【待填写')` 而不是只判 `【`：后者会把任何以书名号
 * 开头的正常文案（如 `【官方】`）误判为占位符 —— 那是**假阳性**。
 * 代价是留下**假阴性**：手写变体（`[待填写：X]`、裸 `待填写：X`、`【待定】`）
 * 识不出来，仍会渲染到页面上。
 *
 * 这个残留缺口**故意**不在守卫里补：守卫要精确，不能误伤正常文案；而
 * Task 18 的上线闸门要保守（宁可误报），用更宽的模式兜底。两者不一致是设计，
 * 不是疏漏 —— 不要为了「统一」把守卫放宽。
 */
export function isPlaceholder(value) {
  return !value || String(value).startsWith('【待填写')
}
