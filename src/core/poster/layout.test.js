// src/core/poster/layout.test.js
//
// 设计文档 §10.2 把元素排到 y=1328、底部只剩 6px，而同一节写着「底部保留 ≥16px」——
// 自相矛盾。改成元素流后这个约束可以被断言，本文件就是那条断言的落点：
// 以后谁改 poster.json 的间隙改到溢出版面，这里立刻红。
import { describe, it, expect } from 'vitest'
import { computeLayout, REQUIRED_KEYS } from './layout.js'
import poster from '../../config/poster.json'
import { defaultMeasure } from './measure.js'

const { canvas, boxes } = computeLayout(poster)
const byKey = Object.fromEntries(boxes.map((b) => [b.key, b]))

describe('画布', () => {
  it('固定 750×1334（微信分享标准 2:3 竖版）', () => {
    expect(poster.canvas.w).toBe(750)
    expect(poster.canvas.h).toBe(1334)
  })
})

describe('版式不变式', () => {
  it('底部安全边距 ≥ marginBottom', () => {
    const last = boxes[boxes.length - 1]
    const bottom = canvas.h - (last.y + last.h)
    expect(bottom).toBeGreaterThanOrEqual(canvas.marginBottom)
    expect(canvas.marginBottom).toBeGreaterThanOrEqual(16)
  })

  it('所有元素都落在画布内', () => {
    for (const b of boxes) {
      expect(b.y, `${b.key} 起点越界`).toBeGreaterThanOrEqual(0)
      expect(b.y + b.h, `${b.key} 越出画布底边`).toBeLessThanOrEqual(canvas.h)
    }
  })

  it('元素互不重叠', () => {
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].y, `${boxes[i - 1].key} 与 ${boxes[i].key} 重叠`).toBeGreaterThanOrEqual(
        boxes[i - 1].y + boxes[i - 1].h
      )
    }
  })

  it('必需元素齐备，且无多余元素', () => {
    expect(boxes.map((b) => b.key)).toEqual(REQUIRED_KEYS)
  })
})

describe('元素自身的完整性', () => {
  it('每个元素都有正的占高与可用宽度', () => {
    for (const b of boxes) {
      expect(b.h, `${b.key} 占高非正`).toBeGreaterThan(0)
      expect(b.maxWidth, `${b.key} 缺 maxWidth`).toBeGreaterThan(0)
      expect(b.maxWidth).toBeLessThanOrEqual(canvas.w)
    }
  })

  it('每个元素声明的字号都能被 defaultMeasure 用', () => {
    // 必须用 Number.isFinite 而不是 typeof —— `typeof NaN === 'number'`，
    // 非数字的 font（如 "abc"）会算出 NaN 并让这条断言形同虚设，
    // 而 Task 8 要手工调 poster.json 的字号，那正是最容易键入非数字值的时刻。
    for (const b of boxes) expect(Number.isFinite(defaultMeasure('测试', b.font))).toBe(true)
  })
})

describe('computeLayout 是纯函数', () => {
  it('同样输入产出深相等的输出（不依赖时间/随机）', () => {
    expect(computeLayout(poster)).toEqual(computeLayout(poster))
  })

  it('起始 y 等于 marginTop', () => {
    expect(boxes[0].y).toBe(canvas.marginTop)
  })

  it('每个元素的 y = 上一元素 y + 上一元素 h + 上一元素 gap', () => {
    let y = canvas.marginTop
    for (const el of poster.elements) {
      expect(byKey[el.key].y).toBe(y)
      y += el.h + (el.gap || 0)
    }
  })
})
