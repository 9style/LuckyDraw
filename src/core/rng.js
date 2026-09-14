/**
 * xorshift32 伪随机数生成器。相同种子产生完全相同的序列，
 * 用于让「同一次占卜」的结果可复现、可测试。
 *
 * 种子先经 splitmix32 混淆再进入 xorshift。**这一步不可省略**：
 * 未混淆时相邻小整数种子的首个输出几乎线性递增（makeRng(s)() ≈ 6.295e-5 · s），
 * 实测 makeRng(1..20) 的第一次 rng() 全部落在 [0, 0.0013)，
 * 导致 intBetween 恒定返回区间下界、weightedPick 恒定选中第一项。
 * 生产环境用 Date.now() XOR 随机数（大种子）不受影响，但单元测试与
 * 任何「按计数器取种子」的调用都会踩到。
 *
 * 种子为 0 / NaN / undefined / 2^32 时统一落到 0x9e3779b9
 * （xorshift 的 0 是不动点，必须避开）。
 */
export function makeRng(seed) {
  let s = scramble((Number(seed) >>> 0) || 0x9e3779b9) || 0x9e3779b9
  return function next() {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
}

/** splitmix32 单轮终混：把相邻种子打散到整个 32 位空间 */
function scramble(x) {
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad)
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97)
  return (x ^ (x >>> 15)) >>> 0
}

/** 闭区间 [min, max] 内的随机整数 */
export function intBetween(rng, min, max) {
  if (max <= min) return min
  return min + Math.floor(rng() * (max - min + 1))
}

export function pickOne(rng, arr) {
  if (!arr || arr.length === 0) return null
  return arr[Math.floor(rng() * arr.length)]
}

/**
 * 不重复地取 n 个（洗牌后切片），不修改原数组。
 *
 * 注意：本函数固定消耗 arr.length - 1 个随机数，与 n 无关。
 * 因此 pickMany(rng, arr, 1) 与 pickOne(rng, arr) 在同一条种子流里**不可互换**；
 * 后续任务若改动某个模块级配置数组的长度，其后的所有抽取都会整体位移。
 */
export function pickMany(rng, arr, n) {
  if (!arr || arr.length === 0) return []
  const copy = arr.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy.slice(0, Math.min(n, copy.length))
}

/** 按权重抽样。权重全为 0 或数组为空时返回 null */
export function weightedPick(rng, items, weights) {
  if (!items || items.length === 0) return null
  let total = 0
  for (let i = 0; i < items.length; i++) total += weights[i] || 0
  if (total <= 0) return null
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i] || 0
    if (r < 0) return items[i]
  }
  return items[items.length - 1]
}
