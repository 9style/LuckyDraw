// scripts/simulate.js
// 用法：node scripts/simulate.js [抽样次数]
// 作用：打印四维分数的等级带分布，供调整 scoring.json 权重时参考。
//
// ⚠️ 这里**直接导入 JSON**（带 import attribute），而不是 `import { runtimeConfig } from '../src/core/config.js'`。
// 原因：Node 的 ESM 要求 JSON 导入必须带 `with { type: 'json' }`，而 `config.js`
// 的裸 JSON 导入是给 Vite 用的 —— 在纯 Node 下会抛 ERR_IMPORT_ATTRIBUTE_MISSING
// （已实测确认）。本脚本是独立的开发脚本、不进 Vite 产物，所以用 attribute 形式
// 既安全又无需为它改动 `config.js`（改了反而要冒构建工具兼容性的风险）。
import scoring from '../src/config/scoring.json' with { type: 'json' }
import departments from '../src/config/departments.json' with { type: 'json' }
import { computeScores } from '../src/core/scoring.js'
import { makeRng } from '../src/core/rng.js'

const N = Number(process.argv[2]) || 10000
const cfg = scoring
const DIMS = cfg.dimensions
const zodiacs = Object.keys(cfg.zodiacBase)
const tenures = Object.keys(cfg.tenureBonus)
const depts = Object.keys(departments)
const rng = makeRng(20260913)

const bandCount = {}
const scoreSum = {}
const scoreMin = {}
const scoreMax = {}
for (const dim of DIMS) {
  bandCount[dim] = { wei: 0, ping: 0, ji: 0, daji: 0 }
  scoreSum[dim] = 0
  scoreMin[dim] = Infinity
  scoreMax[dim] = -Infinity
}

for (let i = 0; i < N; i++) {
  const profile = {
    name: 'x',
    zodiac: zodiacs[Math.floor(rng() * zodiacs.length)],
    tenure: tenures[Math.floor(rng() * tenures.length)],
    dept: depts[Math.floor(rng() * depts.length)]
  }
  const { scores, bands } = computeScores(profile, cfg, rng)
  for (const dim of DIMS) {
    bandCount[dim][bands[dim]] += 1
    scoreSum[dim] += scores[dim]
    scoreMin[dim] = Math.min(scoreMin[dim], scores[dim])
    scoreMax[dim] = Math.max(scoreMax[dim], scores[dim])
  }
}

const pad = (s, n) => String(s).padEnd(n, ' ')
// 分母必须显式传入：分维度行分母是抽样次数 N，
// 而「整体」行是四维计数之和，分母为 N * DIMS.length。
// 早先这里把两者混用，导致整体行打印出 216.1% 这种数字。
const pct = (n, denom = N) => ((n / denom) * 100).toFixed(1) + '%'

console.log(`\n抽样 ${N} 次（seed=20260913）\n`)
console.log(pad('维度', 12) + pad('均值', 8) + pad('区间', 14) + pad('危', 8) + pad('平', 8) + pad('吉', 8) + '大吉')
console.log('-'.repeat(66))
for (const dim of DIMS) {
  const label = cfg.dimensionLabels[dim]
  const b = bandCount[dim]
  console.log(
    pad(label, 12) +
      pad((scoreSum[dim] / N).toFixed(1), 8) +
      pad(`${scoreMin[dim]}~${scoreMax[dim]}`, 14) +
      pad(pct(b.wei), 8) +
      pad(pct(b.ping), 8) +
      pad(pct(b.ji), 8) +
      pct(b.daji)
  )
}

const allBands = { wei: 0, ping: 0, ji: 0, daji: 0 }
for (const dim of DIMS) for (const k of Object.keys(allBands)) allBands[k] += bandCount[dim][k]
const total = N * DIMS.length
console.log('-'.repeat(66))
console.log(
  pad('整体', 12) + pad('', 8) + pad('', 14) +
    pad(pct(allBands.wei, total), 8) + pad(pct(allBands.ping, total), 8) +
    pad(pct(allBands.ji, total), 8) + pct(allBands.daji, total)
)

const missing = Object.entries(allBands).filter(([, v]) => v === 0).map(([k]) => k)
if (missing.length) {
  console.log(`\n⚠️  以下等级带在 ${N} 次抽样中从未出现：${missing.join(', ')}`)
  console.log('   这些档位的文案永远不会被用户看到，请调整 scoring.json。')
} else {
  console.log('\n✅ 四个等级带均可达。')
}
console.log('')
