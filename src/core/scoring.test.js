// src/core/scoring.test.js
import { describe, it, expect } from 'vitest'
import { bandOf, computeScores, averageScore } from './scoring.js'
import { makeRng } from './rng.js'
import { runtimeConfig } from './config.js'

const cfg = runtimeConfig.scoring
const DIMS = cfg.dimensions
const BANDS = cfg.bands

const profile = { name: '张三', dept: 'tech', tenure: '1to3', zodiac: 'gemini' }

describe('bandOf', () => {
  it('边界值判定正确', () => {
    expect(bandOf(0, BANDS)).toBe('wei')
    expect(bandOf(39, BANDS)).toBe('wei')
    expect(bandOf(40, BANDS)).toBe('ping')
    expect(bandOf(59, BANDS)).toBe('ping')
    expect(bandOf(60, BANDS)).toBe('ji')
    expect(bandOf(79, BANDS)).toBe('ji')
    expect(bandOf(80, BANDS)).toBe('daji')
    expect(bandOf(100, BANDS)).toBe('daji')
  })
})

describe('computeScores', () => {
  it('返回全部四个维度', () => {
    const { scores, bands } = computeScores(profile, cfg, makeRng(1))
    expect(Object.keys(scores).sort()).toEqual([...DIMS].sort())
    expect(Object.keys(bands).sort()).toEqual([...DIMS].sort())
  })

  it('分数恒在 0~100 且为整数', () => {
    const profiles = []
    for (const z of runtimeConfig.zodiacs) {
      for (const t of runtimeConfig.tenures) {
        for (const d of Object.keys(runtimeConfig.departments)) {
          profiles.push({ ...profile, zodiac: z, tenure: t, dept: d })
        }
      }
    }
    for (const p of profiles) {
      const { scores } = computeScores(p, cfg, makeRng(7))
      for (const dim of DIMS) {
        expect(Number.isInteger(scores[dim])).toBe(true)
        expect(scores[dim]).toBeGreaterThanOrEqual(0)
        expect(scores[dim]).toBeLessThanOrEqual(100)
      }
    }
  })

  it('等级带与分数一一对应', () => {
    const { scores, bands } = computeScores(profile, cfg, makeRng(3))
    for (const dim of DIMS) expect(bands[dim]).toBe(bandOf(scores[dim], BANDS))
  })

  it('相同种子结果完全一致', () => {
    const a = computeScores(profile, cfg, makeRng(20260913))
    const b = computeScores(profile, cfg, makeRng(20260913))
    expect(a).toEqual(b)
  })

  it('不同种子结果不同（随机波动生效）', () => {
    const a = computeScores(profile, cfg, makeRng(1))
    const b = computeScores(profile, cfg, makeRng(2))
    expect(a.scores).not.toEqual(b.scores)
  })
})

describe('分数分布', () => {
  it('10000 次抽样中四个等级带都达到可观数量（危档可达回归保护）', () => {
    const rng = makeRng(20260913)
    const zodiacs = runtimeConfig.zodiacs
    const tenures = runtimeConfig.tenures
    const depts = Object.keys(runtimeConfig.departments)
    const counts = { wei: 0, ping: 0, ji: 0, daji: 0 }

    for (let i = 0; i < 10000; i++) {
      const p = {
        ...profile,
        zodiac: zodiacs[Math.floor(rng() * zodiacs.length)],
        tenure: tenures[Math.floor(rng() * tenures.length)],
        dept: depts[Math.floor(rng() * depts.length)]
      }
      const { bands } = computeScores(p, cfg, rng)
      for (const dim of DIMS) counts[bands[dim]] += 1
    }

    // 只断言「出现过」远远不够：实测把全部基础值 +10 后，40000 次抽样里
    // 仍剩 4 次「危」，集合断言照样通过 —— 而那已是近乎致命的漂移。
    // 因此改为数量下限。基准值（seed 20260913）：约 369 / 5279 / 21614 / 12738。
    expect(counts.wei).toBeGreaterThanOrEqual(100)
    expect(counts.ping).toBeGreaterThanOrEqual(100)
    expect(counts.ji).toBeGreaterThanOrEqual(100)
    expect(counts.daji).toBeGreaterThanOrEqual(100)
  })

  it('年限与部门加成确实会改变分数（防止加成表被整体清零）', () => {
    // 回归保护：把 tenureBonus / deptBonus 清零会让引擎退化成「基础值 + 随机波动」，
    // 而当时的 64 条测试无一能发现。同一 seed 下随机波动完全相同，
    // 因此分数的差异只可能来自加成表。
    const base = { name: 'x', zodiac: 'aries', dept: 'other', tenure: '1to3' }

    const tenureLow = computeScores({ ...base, tenure: 'lt1' }, cfg, makeRng(42))
    const tenureHigh = computeScores({ ...base, tenure: 'gt5' }, cfg, makeRng(42))
    expect(tenureLow.scores).not.toEqual(tenureHigh.scores)

    const deptTech = computeScores({ ...base, dept: 'tech' }, cfg, makeRng(42))
    const deptMarket = computeScores({ ...base, dept: 'market' }, cfg, makeRng(42))
    expect(deptTech.scores).not.toEqual(deptMarket.scores)
  })
})

describe('averageScore', () => {
  it('返回四维算术平均', () => {
    expect(averageScore({ moYu: 80, shengZhi: 60, renMai: 70, caiYun: 90 }, DIMS)).toBe(75)
  })
})
