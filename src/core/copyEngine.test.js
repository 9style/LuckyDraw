// src/core/copyEngine.test.js
import { describe, it, expect } from 'vitest'
import { interpolate, pickText, pickEntry } from './copyEngine.js'
import { makeRng } from './rng.js'

describe('interpolate', () => {
  it('替换已知变量', () => {
    expect(interpolate('{name} 今天宜早退', { name: '张三' })).toBe('张三 今天宜早退')
  })

  it('替换多个变量', () => {
    expect(interpolate('{name} 在 {dept}', { name: '张三', dept: '技术/研发' }))
      .toBe('张三 在 技术/研发')
  })

  it('未知变量原样保留', () => {
    expect(interpolate('{name} 的 {unknown}', { name: '张三' })).toBe('张三 的 {unknown}')
  })

  it('同一变量出现多次全部替换', () => {
    expect(interpolate('{name}{name}', { name: 'A' })).toBe('AA')
  })

  it('变量值为 0 或空串时正常替换', () => {
    expect(interpolate('{n}', { n: 0 })).toBe('0')
    expect(interpolate('{n}', { n: '' })).toBe('')
  })

  it('不解析 HTML —— 尖括号原样输出', () => {
    expect(interpolate('{name}', { name: '<b>x</b>' })).toBe('<b>x</b>')
  })

  it('空文本返回空串', () => {
    expect(interpolate('', {})).toBe('')
  })
})

describe('pickText', () => {
  const pool = ['a', 'b', 'c', 'd', 'e']

  it('取 n 条且互不重复', () => {
    const out = pickText(pool, makeRng(1), 3)
    expect(out).toHaveLength(3)
    expect(new Set(out).size).toBe(3)
    out.forEach((x) => expect(pool).toContain(x))
  })

  it('n 大于池子大小时返回全部且不重复', () => {
    const out = pickText(['a', 'b'], makeRng(1), 5)
    expect(out.sort()).toEqual(['a', 'b'])
  })

  it('空池返回空数组', () => {
    expect(pickText([], makeRng(1), 2)).toEqual([])
    expect(pickText(null, makeRng(1), 2)).toEqual([])
  })

  it('n 为 0 时返回空数组', () => {
    expect(pickText(pool, makeRng(1), 0)).toEqual([])
  })
})

describe('pickEntry', () => {
  it('返回池中一个对象', () => {
    const pool = [{ id: 1 }, { id: 2 }]
    // 必须用 toContainEqual 而非 toContain：toContain 对对象是按**引用**比较的，
    // 而 pickEntry 刻意返回副本（见下一条测试），用 toContain 会与之直接矛盾。
    expect(pool).toContainEqual(pickEntry(pool, makeRng(1)))
  })

  it('空池返回 null', () => {
    expect(pickEntry([], makeRng(1))).toBeNull()
  })

  it('不返回原对象引用（防止下游修改污染配置）', () => {
    const pool = [{ id: 1, meta: { n: 1 } }]
    const got = pickEntry(pool, makeRng(1))
    expect(got).not.toBe(pool[0])
    expect(got).toEqual(pool[0])
  })
})
