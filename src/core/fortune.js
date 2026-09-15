// src/core/fortune.js
import { computeScores, averageScore } from './scoring.js'
import { pickText } from './copyEngine.js'
import { pickOne } from './rng.js'

/** 基准权重，对应 PRD 5.2 的四档占比 20% / 45% / 25% / 10%，合计 100 */
export const BASE_WEIGHT = {
  上上签: 8,
  大吉: 12,
  中吉: 22,
  小吉: 23,
  平: 25,
  小凶: 10
}

export const FORTUNE_LEVELS = Object.keys(BASE_WEIGHT)

// ⚠️ 阈值必须落在**实际可达**的均分区间内 —— 这一点曾出错，务必读懂再改。
//
// 穷尽枚举实测（288 画像组合 × 13⁴ 抖动元组 = 8,225,568 次抽取，
// **逐维 clamp(Math.round(…), 0, 100) 后再取四维平均**，即精确复刻 computeScores）：
//   均分范围 64.00 ~ 83.00，均值 73.21，中位数 73.25。
//   （范围之所以这么窄，是因为 spec §6.3 的公平性要求把每个星座的四维和
//     归一到恰好 280（均分 70），再叠加幅度有限的年限/部门加成与 ±6 抖动。）
//
// 早先照 spec §7.1 写的 80 / 60 是**错的**：60 低于可达最小值，那一档永不触发（死代码）；
// 80 只在 **0.32%** 的抽取中触发 —— 等于整个偏置机制对 **99.68%** 的用户是惰性的。
// 更根本的是，该机制的设计目的（防止「四维全大吉 + 小凶签」自相矛盾）在此配置下
// **结构上不可能发生**：因公平性归一，任何星座都不可能有四维同时 ≥80
// （实测 8,225,568 次抽取中发生 0 次；可达最大均分 83.00，出现于 market/gt5/aries）。
//
// 现按实测分布重标定，三档占比 **7.41% / 83.13% / 9.46%**（精确值，未取整分类）。
// 低档比高档略多，这是结构性的：加成和接近 0 的画像（lt1+other）中心在 70、
// 最低可到 64 却几乎够不到 77，而成家和大的画像（gt5+market = +28）中心就在 77。
//
// ⚠️ 统计占比时必须用**未取整**的均分：pickLevel 收到的是原始浮点值，
//    avg 76.9 属基准档、77.0 才进高档。先 Math.round 再分桶会得出
//    10.7% / 82.9% / 6.4% 的偏差数字（低档被显著低估）。
//
// **若将来调整 scoring.json 的 jitter 或加成幅度，必须重跑测量并重标定本阈值** ——
// 否则又会退化成「某一档永不触发」或「某档过窄」。
const BIAS_TIERS = [
  {
    min: 77,
    w: { 上上签: 1.6, 大吉: 1.6, 中吉: 1.3, 小吉: 1.3, 平: 0.7, 小凶: 0.3 }
  },
  {
    min: 70,
    w: { 上上签: 1, 大吉: 1, 中吉: 1, 小吉: 1, 平: 1, 小凶: 1 }
  },
  {
    min: 0,
    w: { 上上签: 0.6, 大吉: 0.6, 中吉: 0.8, 小吉: 0.8, 平: 1.5, 小凶: 1.5 }
  }
]

/** 四维均分对应的档位偏置系数 */
export function biasFor(avg) {
  const tier = BIAS_TIERS.find((t) => avg >= t.min)
  return tier ? tier.w : BIAS_TIERS[BIAS_TIERS.length - 1].w
}

/** 加权抽档位：权重 = 基准权重 × 偏置系数 */
export function pickLevel(avg, rng) {
  const bias = biasFor(avg)
  const levels = FORTUNE_LEVELS
  const weights = levels.map((lv) => BASE_WEIGHT[lv] * bias[lv])

  let total = 0
  for (const w of weights) total += w
  if (total <= 0) return '平'

  let r = rng() * total
  for (let i = 0; i < levels.length; i++) {
    r -= weights[i]
    if (r < 0) return levels[i]
  }
  return levels[levels.length - 1]
}

/**
 * 无可用签时的兜底签（规格 §12：「文案池为空 → 回落到兜底句，**不抛异常**」）。
 *
 * 为什么必须有：`copy/*.json` 是**运营可编辑**的（规格 §14），清空 `fortunes.json`
 * 的数组就会走到空池路径。此前 `drawFortune` 在此时返回 `null`，而
 * `ResultView` → `FortuneSlip`（`required: true`）会立刻解引用 `fortune.level` ——
 * 结果页整块渲染失败。`buildReading` 里其余每一个池都有兜底
 * （`identity` 硬编码、`deptJoke ?? ''`、`lucky ?? '' / ?? 0`），唯独签文没有。
 *
 * 字段与真实签**同构**（level / verse / yi / ji / explain），视图无需任何分支。
 * 文案为内联常量而非取自 `copy/ui.json`：`drawFortune` 是纯函数，只拿到池本身，
 * 为一句兜底话把整个 `runtimeConfig` 穿进来不值得。**本文案不得含禁用词**
 * （清单见 `src/config/lint-rules.json`，`scripts/lint-copy.js` 会扫本文件的中文字符串）。
 */
export const FALLBACK_FORTUNE = Object.freeze({
  level: '平',
  verse: '今日签筒空空，静心做好手边事，也是一种上上签。',
  yi: '把手头的事做完',
  ji: '急于求成',
  explain: '签筒今天空了一支，日子照常过 —— 该来的都会来。'
})

/** 按均分偏置抽一支签，返回拷贝；池为空（或不是数组）时返回兜底签 */
export function drawFortune(avg, pool, rng) {
  const list = Array.isArray(pool) ? pool : []
  const level = pickLevel(avg, rng)
  const candidates = list.filter((f) => f.level === level)
  const source = candidates.length ? candidates : list
  const picked = pickOne(rng, source)
  return picked ? { ...picked } : { ...FALLBACK_FORTUNE }
}

/** 从「本部门专属 + 通用」池中抽一个身份标签 */
export function drawIdentity(profile, identityPool, rng) {
  const pool = identityPool.filter((i) => i.dept === null || i.dept === profile.dept)
  const source = pool.length ? pool : identityPool
  const picked = pickOne(rng, source)
  return picked ? { ...picked } : { text: '安静的职场观察者', dept: null }
}

/**
 * 组装完整结果并冻结。
 * 调用一次即产出全部内容，之后只读 —— 保证页面内分数与签文绝不抖动。
 */
export function buildReading(profile, cfg, rng) {
  const { scores, bands } = computeScores(profile, cfg.scoring, rng)
  const avg = averageScore(scores, cfg.scoring.dimensions)

  const vars = {
    // name 也必须兜底。copyEngine.interpolate 内部用 String(vars[key])，
    // 值为 undefined 时会**原样渲染出字面量 "undefined"**（其余三个变量本就有 ?? ''，
    // 唯独 name 没有）。未走校验的调用路径会打印出「undefined 今天宜早退」。
    name: profile.name ?? '',
    // 部门显示用户手打的原文（「搞算法的」），而不是归一后的规范名（「技术 / 研发」）。
    // 回退分支不是可选项：deptText 是本轮才加的字段，改版前存下的会话里没有它，
    // 刷新恢复后仍得渲染出一个部门名 —— 那时退回规范名。
    dept: profile.deptText || cfg.departments[profile.dept]?.label || '',
    zodiac: cfg.zodiacLabels[profile.zodiac] ?? '',
    tenure: cfg.tenureLabels[profile.tenure] ?? ''
  }

  const zodiacRoasts = cfg.copy.zodiac[profile.zodiac]?.roasts ?? []
  const tenureRoasts = cfg.copy.tenure[profile.tenure] ?? []
  const roastTexts = [
    ...pickText(zodiacRoasts, rng, 1),
    ...pickText(tenureRoasts, rng, 1)
  ]

  const deptJokes = cfg.copy.department[profile.dept] ?? []
  const deptJoke = pickOne(rng, deptJokes) ?? ''

  const luckyPool = cfg.copy.lucky
  const lucky = {
    color: pickOne(rng, luckyPool.colors) ?? '',
    number: pickOne(rng, luckyPool.numbers) ?? 0,
    direction: pickOne(rng, luckyPool.directions) ?? '',
    zodiac: pickOne(rng, luckyPool.zodiacs) ?? ''
  }

  return {
    scores,
    bands,
    avg,
    identity: drawIdentity(profile, cfg.copy.identity, rng),
    roastTexts,
    deptJoke,
    fortune: drawFortune(avg, cfg.copy.fortunes, rng),
    lucky,
    vars
  }
}
