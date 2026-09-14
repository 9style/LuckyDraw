import { describe, it, expect } from 'vitest'
import { makeRng, intBetween, pickOne, pickMany, weightedPick } from './rng.js'

// makeRng(20260913) 的前 5 个输出。用以下命令取得后填入：
//   node -e "import('./src/core/rng.js').then(m=>{const r=m.makeRng(20260913);console.log(JSON.stringify([r(),r(),r(),r(),r()]))})"
// 注意：必须在 makeRng 的最终实现（含种子混淆）就位后再采集，否则锁的是错的算法。
const GOLDEN_SEED_20260913 = [0.3275406288448721, 0.8166737153660506, 0.8692838209681213, 0.6655232040211558, 0.9874966989737004]

describe('makeRng', () => {
  it('相同种子产生完全相同的序列', () => {
    const a = makeRng(12345)
    const b = makeRng(12345)
    const seqA = [a(), a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('不同种子产生不同序列', () => {
    const a = makeRng(1)
    const b = makeRng(2)
    expect(a()).not.toBe(b())
  })

  it('输出恒在 [0, 1) 区间内', () => {
    const rng = makeRng(999)
    for (let i = 0; i < 2000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('种子为 0 时不退化（不会永远返回同一个值）', () => {
    const rng = makeRng(0)
    const vals = new Set([rng(), rng(), rng(), rng(), rng()])
    expect(vals.size).toBeGreaterThan(1)
  })

  it('相邻小种子不产生相关序列（种子混淆回归保护）', () => {
    // 回归保护：没有种子混淆时，makeRng(1..20) 的首次 rng() 全部落在 [0, 0.0013)，
    // buckets 会退化成只有 1 个值。这条测试就是为那个缺陷立的。
    const firsts = []
    for (let s = 1; s <= 20; s++) firsts.push(makeRng(s)())
    expect(new Set(firsts).size).toBe(20)

    const buckets = new Set()
    for (let s = 1; s <= 20; s++) buckets.add(intBetween(makeRng(s), 1, 6))
    expect(buckets.size).toBeGreaterThan(1)
  })

  it('固定种子的前 5 个输出恒定（锁死算法，防止被无意替换）', () => {
    // GOLDEN_SEED_20260913 是 makeRng(20260913) 前 5 个输出，由当前实现产出后固定下来。
    // 这条测试若失败，说明 makeRng 的算法或种子混淆被改动过 —— 那会改变全项目每一个
    // 随机结果，属于必须显式决策的变更，不是可以随手改的实现细节。
    const rng = makeRng(20260913)
    expect([rng(), rng(), rng(), rng(), rng()]).toEqual(GOLDEN_SEED_20260913)
  })
})

describe('intBetween', () => {
  it('始终落在闭区间内，且两端可达', () => {
    const rng = makeRng(42)
    const seen = new Set()
    for (let i = 0; i < 2000; i++) {
      const v = intBetween(rng, -6, 6)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(-6)
      expect(v).toBeLessThanOrEqual(6)
      seen.add(v)
    }
    expect(seen.has(-6)).toBe(true)
    expect(seen.has(6)).toBe(true)
  })

  it('min === max 时恒返回该值', () => {
    const rng = makeRng(7)
    expect(intBetween(rng, 5, 5)).toBe(5)
  })
})

describe('pickOne', () => {
  it('从数组中取元素', () => {
    const rng = makeRng(3)
    const arr = ['a', 'b', 'c']
    for (let i = 0; i < 50; i++) expect(arr).toContain(pickOne(rng, arr))
  })

  it('空数组返回 null', () => {
    expect(pickOne(makeRng(1), [])).toBeNull()
  })
})

describe('pickMany', () => {
  it('返回不重复的 n 个元素', () => {
    const rng = makeRng(11)
    const arr = ['a', 'b', 'c', 'd', 'e']
    const out = pickMany(rng, arr, 3)
    expect(out).toHaveLength(3)
    expect(new Set(out).size).toBe(3)
    out.forEach((x) => expect(arr).toContain(x))
  })

  it('n 超过数组长度时返回全部', () => {
    const rng = makeRng(11)
    expect(pickMany(rng, ['a', 'b'], 5)).toHaveLength(2)
  })

  it('不修改原数组', () => {
    const rng = makeRng(11)
    const arr = ['a', 'b', 'c']
    pickMany(rng, arr, 2)
    expect(arr).toEqual(['a', 'b', 'c'])
  })
})

describe('weightedPick', () => {
  it('权重为 0 的项永不被选中', () => {
    const rng = makeRng(5)
    const items = ['x', 'y']
    const weights = [0, 1]
    for (let i = 0; i < 300; i++) expect(weightedPick(rng, items, weights)).toBe('y')
  })

  it('高权重项被选中的频率显著更高', () => {
    const rng = makeRng(20260913)
    const items = ['low', 'high']
    const weights = [1, 9]
    let high = 0
    const N = 5000
    for (let i = 0; i < N; i++) if (weightedPick(rng, items, weights) === 'high') high++
    expect(high / N).toBeGreaterThan(0.85)
    expect(high / N).toBeLessThan(0.95)
  })

  it('权重全为 0 时返回 null', () => {
    expect(weightedPick(makeRng(1), ['a', 'b'], [0, 0])).toBeNull()
  })
})
