// src/core/poster/draw.test.js
//
// canvas 调用本身不做断言（视觉项断言成本高于收益，见设计文档 §591），
// 但几何计算是纯的 —— 星点坐标与雷达顶点必须可测：
// 星点用固定种子，否则用户进出海报页会看到「图片在闪」。
import { describe, it, expect } from 'vitest'
import { starPoints, radarPoints } from './draw.js'
import { makeRng } from '../rng.js'

describe('starPoints', () => {
  it('产出指定数量的星点', () => {
    expect(starPoints(750, 1334, 90, makeRng(20260913))).toHaveLength(90)
  })

  it('全部落在画布内', () => {
    for (const s of starPoints(750, 1334, 90, makeRng(1))) {
      expect(s.x).toBeGreaterThanOrEqual(0)
      expect(s.x).toBeLessThanOrEqual(750)
      expect(s.y).toBeGreaterThanOrEqual(0)
      expect(s.y).toBeLessThanOrEqual(1334)
      expect(s.r).toBeGreaterThan(0)
      expect(s.a).toBeGreaterThan(0)
      expect(s.a).toBeLessThanOrEqual(1)
    }
  })

  it('固定种子产出完全一致的星图（否则进出海报页会「闪」）', () => {
    expect(starPoints(750, 1334, 90, makeRng(20260913))).toEqual(
      starPoints(750, 1334, 90, makeRng(20260913))
    )
  })

  it('不同种子产出不同星图（不是写死的常量）', () => {
    expect(starPoints(750, 1334, 90, makeRng(1))).not.toEqual(
      starPoints(750, 1334, 90, makeRng(2))
    )
  })
})

describe('radarPoints', () => {
  it('四个维度产出四个顶点', () => {
    expect(radarPoints(375, 558, 120, [100, 100, 100, 100], 100)).toHaveLength(4)
  })

  it('满分时顶点落在半径上', () => {
    const pts = radarPoints(0, 0, 100, [100, 100, 100, 100], 100)
    for (const p of pts) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(100, 6)
    }
  })

  it('0 分时顶点落在圆心', () => {
    const pts = radarPoints(10, 20, 100, [0, 0, 0, 0], 100)
    for (const p of pts) {
      expect(p.x).toBeCloseTo(10, 6)
      expect(p.y).toBeCloseTo(20, 6)
    }
  })

  it('第一个顶点在正上方（-90°），与结果页 ScoreRadar 的角度约定一致', () => {
    const [first] = radarPoints(0, 0, 100, [100, 0, 0, 0], 100)
    expect(first.x).toBeCloseTo(0, 6)
    expect(first.y).toBeCloseTo(-100, 6)
  })
})
