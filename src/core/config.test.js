// src/core/config.test.js
import { describe, it, expect } from 'vitest'
import { runtimeConfig, checkConfigConsistency, isPlaceholder } from './config.js'

const DEPT_KEYS = ['tech', 'product', 'market', 'ops', 'admin', 'other']
const DIMS = ['moYu', 'shengZhi', 'renMai', 'caiYun']

describe('runtimeConfig 装配', () => {
  it('暴露 settings 全部字段', () => {
    const s = runtimeConfig.settings
    expect(s.passcode).toBeTruthy()
    expect(s.displayTitle).toBeTruthy()
    expect(typeof s.donationText).toBe('string')
    expect(typeof s.posterBaseUrl).toBe('string')
    expect(typeof s.enableCount).toBe('boolean')
  })

  it('展示标题不含迷信措辞', () => {
    const banned = ['算命', '占卜', '改运', '改命', '命理', '前世', '因果', '化解', '生辰八字']
    banned.forEach((w) => expect(runtimeConfig.settings.displayTitle).not.toContain(w))
  })

  it('部门为 6 个大类', () => {
    expect(Object.keys(runtimeConfig.departments).sort()).toEqual([...DEPT_KEYS].sort())
  })

  it('年限与星座枚举齐备', () => {
    expect(runtimeConfig.tenures).toEqual(['lt1', '1to3', '3to5', 'gt5'])
    expect(runtimeConfig.zodiacs).toHaveLength(12)
    runtimeConfig.zodiacs.forEach((z) => expect(runtimeConfig.zodiacLabels[z]).toBeTruthy())
  })
})

describe('scoring.json 约束', () => {
  const { zodiacBase, deptBonus, bands, dimensions } = runtimeConfig.scoring

  it('四维 key 一致', () => {
    expect(dimensions).toEqual(DIMS)
  })

  it('每维数值跨度覆盖 45~90', () => {
    for (const dim of DIMS) {
      const vals = Object.values(zodiacBase).map((z) => z[dim])
      expect(Math.min(...vals)).toBeLessThanOrEqual(45)
      expect(Math.max(...vals)).toBeGreaterThanOrEqual(90)
      // 同时钉住取值区间本身。只断言「跨度够宽」会放过越界值：实测配置
      // {moYu:30, shengZhi:100, renMai:100, caiYun:50} 和恰为 280、均分 70、
      // 极差 0，两条现有断言全过 —— 但 moYu=30 意味着该星座用户在该维度
      // **永远无法**达到「吉」以上（30+8+6+6=50 ≤ 59）。这正是 PRD 8.4
      // 「不得贬低任一星座」要防的事。
      expect(Math.min(...vals)).toBeGreaterThanOrEqual(45)
      expect(Math.max(...vals)).toBeLessThanOrEqual(90)
    }
  })

  it('每个星座的四维均分极差 ≤ 5（不得贬低任一星座）', () => {
    const avgs = Object.entries(zodiacBase).map(([z, v]) => {
      const avg = DIMS.reduce((s, d) => s + v[d], 0) / DIMS.length
      return { zodiac: z, avg }
    })
    const values = avgs.map((a) => a.avg)
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(5)
  })

  it('deptBonus 覆盖全部 6 个大类且四维齐备', () => {
    expect(Object.keys(deptBonus).sort()).toEqual([...DEPT_KEYS].sort())
    for (const k of DEPT_KEYS) {
      for (const dim of DIMS) expect(typeof deptBonus[k][dim]).toBe('number')
    }
  })

  it('等级带为四档且上界覆盖到 100', () => {
    expect(bands.map((b) => b.key)).toEqual(['wei', 'ping', 'ji', 'daji'])
    expect(Math.max(...bands.map((b) => b.max))).toBe(100)
  })
})

describe('checkConfigConsistency', () => {
  it('当前配置无缺失，返回空数组', () => {
    expect(checkConfigConsistency()).toEqual([])
  })
})

describe('isPlaceholder', () => {
  it('识别未填写的占位符', () => {
    expect(isPlaceholder('【待填写：主办方】')).toBe(true)
    expect(isPlaceholder('【待填写】')).toBe(true)
  })

  it('空值视为未填写', () => {
    expect(isPlaceholder('')).toBe(true)
    expect(isPlaceholder(null)).toBe(true)
    expect(isPlaceholder(undefined)).toBe(true)
  })

  it('真实值不误判', () => {
    expect(isPlaceholder('XX 公司工会')).toBe(false)
    expect(isPlaceholder('本次筹款将捐至儿童助学项目')).toBe(false)
    // 以书名号开头但并非占位符的正常文案不得被误伤
    expect(isPlaceholder('【官方】公益市集')).toBe(false)
  })
})
