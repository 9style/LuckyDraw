// src/core/validators.test.js
import { describe, it, expect } from 'vitest'
import { validateName, validateProfile, NAME_MAX } from './validators.js'

const cfg = {
  departments: { tech: { label: '技术/研发' }, other: { label: '其他' } },
  tenures: ['lt1', '1to3', '3to5', 'gt5'],
  zodiacs: ['aries', 'gemini']
}

describe('validateName', () => {
  it('拒绝空串与纯空格', () => {
    expect(validateName('').ok).toBe(false)
    expect(validateName('   ').ok).toBe(false)
    expect(validateName(null).ok).toBe(false)
    expect(validateName(undefined).ok).toBe(false)
  })

  it('接受 1 到 8 个字的中文名', () => {
    expect(validateName('张').ok).toBe(true)
    expect(validateName('张三').ok).toBe(true)
    const eight = '一二三四五六七八'
    expect([...eight]).toHaveLength(NAME_MAX)
    expect(validateName(eight).ok).toBe(true)
  })

  it('拒绝 9 个字', () => {
    const nine = '一二三四五六七八九'
    const r = validateName(nine)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('8')
  })

  it('接受英文、数字与常见符号', () => {
    expect(validateName('Alice').ok).toBe(true)
    expect(validateName('李雷·Han').ok).toBe(true)
    expect(validateName('A-1_2').ok).toBe(true)
  })

  it('拒绝 XSS 注入载荷', () => {
    expect(validateName('<script>alert(1)</script>').ok).toBe(false)
    expect(validateName('<img src=x onerror=alert(1)>').ok).toBe(false)
    expect(validateName('"><svg/onload=1>').ok).toBe(false)
    expect(validateName('张三&李四').ok).toBe(false)
  })

  it('拒绝所有 HTML 相关短字符（必须由正则拦截，而非长度）', () => {
    // ⚠️ 上面那组载荷（25 / 27 / 16 个码点）全部超过 NAME_MAX=8，
    // 在长度分支就被拦下了，**根本没走到正则**。实测把 NAME_RE 放宽到
    // 允许 < > " ' & 后，那组测试依然全绿 —— 即安全测试没测到安全机制本身。
    // 下面这组载荷都 ≤ 8 个码点，必然走到正则，专门补这个洞。
    const dangerous = [
      'a<b', 'a>b', 'a"b', "a'b", 'a&b', 'a/b', 'a=b', 'a`b',
      'a＜b', // 全角小于号 U+FF1C，NFKC 归一化会变成 <
      'a﹤b', // small less-than U+FE64
      'a〈b'  // CJK 左尖括号 U+3008
    ]
    for (const payload of dangerous) {
      expect([...payload].length).toBeLessThanOrEqual(NAME_MAX) // 前提：确实能走到正则
      expect(validateName(payload).ok).toBe(false)
    }
  })

  it('接受 CJK 扩展 A 汉字（生僻字姓名不被误拒）', () => {
    expect(validateName('䶮').ok).toBe(true) // U+4DAE，扩展 A，真实姓名用字
  })

  it('拒绝 emoji', () => {
    expect(validateName('张三😀').ok).toBe(false)
  })

  it('去除首尾空格后返回清洗值', () => {
    const r = validateName('  张三  ')
    expect(r.ok).toBe(true)
    expect(r.value).toBe('张三')
  })
})

describe('validateProfile', () => {
  const good = { name: '张三', dept: 'tech', tenure: '1to3', zodiac: 'aries' }

  it('四项齐备时通过', () => {
    expect(validateProfile(good, cfg).ok).toBe(true)
  })

  it('缺少部门时报错并给出该字段的错误', () => {
    const r = validateProfile({ ...good, dept: '' }, cfg)
    expect(r.ok).toBe(false)
    expect(r.errors.dept).toBeTruthy()
  })

  it('部门不在枚举内时报错', () => {
    const r = validateProfile({ ...good, dept: 'not_a_dept' }, cfg)
    expect(r.ok).toBe(false)
    expect(r.errors.dept).toBeTruthy()
  })

  it('年限不在枚举内时报错', () => {
    const r = validateProfile({ ...good, tenure: 'lt0' }, cfg)
    expect(r.ok).toBe(false)
    expect(r.errors.tenure).toBeTruthy()
  })

  it('星座不在枚举内时报错', () => {
    const r = validateProfile({ ...good, zodiac: 'ophiuchus' }, cfg)
    expect(r.ok).toBe(false)
    expect(r.errors.zodiac).toBeTruthy()
  })

  it('姓名非法时错误挂在 name 上', () => {
    const r = validateProfile({ ...good, name: '<b>x</b>' }, cfg)
    expect(r.ok).toBe(false)
    expect(r.errors.name).toBeTruthy()
  })

  it('全部非法时四项都有错误', () => {
    const r = validateProfile({ name: '', dept: 'x', tenure: 'x', zodiac: 'x' }, cfg)
    expect(r.ok).toBe(false)
    expect(Object.keys(r.errors).sort()).toEqual(['dept', 'name', 'tenure', 'zodiac'])
  })
})
