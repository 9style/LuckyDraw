// src/core/config.js
import settings from '../config/settings.json'
import departments from '../config/departments.json'
import scoring from '../config/scoring.json'
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
