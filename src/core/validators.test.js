// src/core/validators.test.js
import { describe, it, expect } from 'vitest'
import { validateName, validateDept, validateProfile, NAME_MAX, DEPT_MAX } from './validators.js'

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

describe('validateDept', () => {
  it('拒绝空串与纯空格', () => {
    expect(validateDept('').ok).toBe(false)
    expect(validateDept('   ').ok).toBe(false)
    expect(validateDept(null).ok).toBe(false)
    expect(validateDept(undefined).ok).toBe(false)
  })

  // ⚠️ 这条是本模块从下拉框改成自由输入后最容易踩的坑：
  // 6 个规范名里有 3 个自带斜杠（「技术 / 研发」），直接复用 NAME_RE 会把自己人拒掉。
  it('接受带斜杠与空格的规范名', () => {
    expect(validateDept('技术 / 研发').ok).toBe(true)
    expect(validateDept('人力 / 行政 / 财务').ok).toBe(true)
    expect(validateDept('技术/研发').ok).toBe(true)
  })

  it('接受口语化自由文本', () => {
    expect(validateDept('搞算法的').ok).toBe(true)
    expect(validateDept('大区销售').ok).toBe(true)
    expect(validateDept('IT').ok).toBe(true)
  })

  it(`接受 ${DEPT_MAX} 个字，拒绝 ${DEPT_MAX + 1} 个字`, () => {
    const max = '部'.repeat(DEPT_MAX)
    expect([...max]).toHaveLength(DEPT_MAX)
    expect(validateDept(max).ok).toBe(true)

    const over = '部'.repeat(DEPT_MAX + 1)
    const r = validateDept(over)
    expect(r.ok).toBe(false)
    expect(r.error).toContain(String(DEPT_MAX))
  })

  it('拒绝 HTML 相关字符（必须由正则拦截，而非长度）', () => {
    // 与 validateName 同理：载荷要短到必然走正则分支，否则测的是长度而不是正则
    for (const payload of ['a<b', 'a>b', 'a"b', "a'b", 'a&b', 'a=b', 'a`b', 'a＜b']) {
      expect([...payload].length).toBeLessThanOrEqual(DEPT_MAX)
      expect(validateDept(payload).ok, `未拦截 ${payload}`).toBe(false)
    }
  })

  it('接受 CJK 扩展 A 汉字', () => {
    expect(validateDept('䶮组').ok).toBe(true)
  })

  it('拒绝 emoji', () => {
    expect(validateDept('技术😀').ok).toBe(false)
  })

  it('去除首尾空格后返回清洗值', () => {
    const r = validateDept('  技术 / 研发  ')
    expect(r.ok).toBe(true)
    expect(r.value).toBe('技术 / 研发')
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

  // 语义反转：部门既然改成自由输入，就不再受 6 大类枚举约束。
  // 任意合规文字都该放行，由 matchDept 在提交时归到某个大类（兜底 other）。
  it('部门不再受枚举约束：任意合规自由文本都通过', () => {
    expect(validateProfile({ ...good, dept: '搞算法的' }, cfg).ok).toBe(true)
    expect(validateProfile({ ...good, dept: '不是六个大类之一' }, cfg).ok).toBe(true)
  })

  it('部门含非法字符时报错', () => {
    const r = validateProfile({ ...good, dept: '<b>x</b>' }, cfg)
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
    // dept 必须是空串或含非法字符 —— 单纯的 'x' 现在是合法部门了
    const r = validateProfile({ name: '', dept: '', tenure: 'x', zodiac: 'x' }, cfg)
    expect(r.ok).toBe(false)
    expect(Object.keys(r.errors).sort()).toEqual(['dept', 'name', 'tenure', 'zodiac'])
  })
})
