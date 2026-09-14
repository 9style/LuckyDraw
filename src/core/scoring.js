// src/core/scoring.js
import { intBetween } from './rng.js'

/** 分数落到哪个等级带。bands 按 max 升序排列，末档兜底。 */
export function bandOf(score, bands) {
  for (const b of bands) {
    if (score <= b.max) return b.key
  }
  return bands[bands.length - 1].key
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

/**
 * 四维打分：星座基础值 + 年限加成 + 部门加成 + 随机波动。
 * rng 决定波动，同一种子结果完全可复现。
 */
export function computeScores(profile, scoringCfg, rng) {
  const { dimensions, zodiacBase, tenureBonus, deptBonus, jitter, bands } = scoringCfg
  const base = zodiacBase[profile.zodiac]
  const tenure = tenureBonus[profile.tenure]
  const dept = deptBonus[profile.dept]

  const scores = {}
  const resultBands = {}

  for (const dim of dimensions) {
    const noise = intBetween(rng, -jitter, jitter)
    const raw = (base?.[dim] ?? 60) + (tenure?.[dim] ?? 0) + (dept?.[dim] ?? 0) + noise
    const score = clamp(Math.round(raw), 0, 100)
    scores[dim] = score
    resultBands[dim] = bandOf(score, bands)
  }

  return { scores, bands: resultBands }
}

export function averageScore(scores, dimensions) {
  if (!dimensions.length) return 0
  const total = dimensions.reduce((sum, d) => sum + (scores[d] ?? 0), 0)
  return total / dimensions.length
}
