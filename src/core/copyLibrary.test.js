// src/core/copyLibrary.test.js
import { describe, it, expect } from 'vitest'
import zodiac from '../config/copy/zodiac.json'
import tenure from '../config/copy/tenure.json'
import department from '../config/copy/department.json'
import identity from '../config/copy/identity.json'
import scores from '../config/copy/scores.json'
import fortunes from '../config/copy/fortunes.json'
import lucky from '../config/copy/lucky.json'
import ui from '../config/copy/ui.json'
import rules from '../config/lint-rules.json'
import { ZODIACS, TENURES } from './config.js'

const DEPT_KEYS = ['tech', 'product', 'market', 'ops', 'admin', 'other']
const DIMS = ['moYu', 'shengZhi', 'renMai', 'caiYun']
const BAND_KEYS = ['wei', 'ping', 'ji', 'daji']
const LEVELS = ['上上签', '大吉', '中吉', '小吉', '平', '小凶']

const len = (s) => [...s].length

/** 递归收集 JSON 中所有字符串 */
function collectStrings(node, out = []) {
  if (typeof node === 'string') out.push(node)
  else if (Array.isArray(node)) node.forEach((n) => collectStrings(n, out))
  else if (node && typeof node === 'object') Object.values(node).forEach((n) => collectStrings(n, out))
  return out
}

const ALL_COPY = [zodiac, tenure, department, identity, scores, fortunes, lucky, ui]

describe('通用约束', () => {
  it(`单条文案不超过 ${rules.maxLength} 字`, () => {
    const tooLong = []
    for (const file of ALL_COPY) {
      for (const s of collectStrings(file)) {
        if (len(s) > rules.maxLength) tooLong.push(s)
      }
    }
    expect(tooLong).toEqual([])
  })

  it('不含禁用词（去空白后匹配，与 linter 同一套规则）', () => {
    // 与 scripts/lint-copy.js 的 SQUEEZE 必须一致 —— 两边算法漂移
    // 就等于存在两套标准，而「单一来源」正是 lint-rules.json 存在的理由。
    const hits = []
    for (const file of ALL_COPY) {
      for (const s of collectStrings(file)) {
        const squeezed = s.replace(/\s+/g, '')
        for (const w of rules.banned) if (squeezed.includes(w)) hits.push(`"${w}" in "${s}"`)
      }
    }
    expect(hits).toEqual([])
  })
})

describe('zodiac.json', () => {
  it('12 个星座齐备', () => {
    expect(Object.keys(zodiac).sort()).toEqual([...ZODIACS].sort())
  })

  it('每个星座 3 条吐槽', () => {
    for (const z of ZODIACS) expect(zodiac[z].roasts).toHaveLength(3)
  })

  it('同一星座内 3 条互不相同', () => {
    for (const z of ZODIACS) expect(new Set(zodiac[z].roasts).size).toBe(3)
  })
})

describe('tenure.json', () => {
  it('4 段年限齐备且各有文案', () => {
    expect(Object.keys(tenure).sort()).toEqual([...TENURES].sort())
    for (const t of TENURES) expect(tenure[t].length).toBeGreaterThanOrEqual(1)
  })
})

describe('department.json', () => {
  it('6 个大类齐备，每类至少 3 条', () => {
    expect(Object.keys(department).sort()).toEqual([...DEPT_KEYS].sort())
    for (const k of DEPT_KEYS) expect(department[k].length).toBeGreaterThanOrEqual(3)
  })
})

describe('identity.json', () => {
  it('共 40 条，每部门恰好 3 条专属', () => {
    expect(identity).toHaveLength(40)
    for (const k of DEPT_KEYS) {
      expect(identity.filter((i) => i.dept === k)).toHaveLength(3)
    }
  })

  it('通用标签不少于 20 条', () => {
    expect(identity.filter((i) => i.dept === null).length).toBeGreaterThanOrEqual(20)
  })

  it('每个部门都能凑出至少 20 个候选（专属 + 通用）', () => {
    const generic = identity.filter((i) => i.dept === null).length
    for (const k of DEPT_KEYS) {
      const own = identity.filter((i) => i.dept === k).length
      expect(own + generic).toBeGreaterThanOrEqual(20)
    }
  })

  it('dept 字段只能是 null 或 6 大类之一', () => {
    for (const i of identity) {
      expect(i.dept === null || DEPT_KEYS.includes(i.dept)).toBe(true)
    }
  })

  it('标签文字不重复', () => {
    const texts = identity.map((i) => i.text)
    expect(new Set(texts).size).toBe(texts.length)
  })
})

describe('scores.json', () => {
  it('4 维 × 4 档齐备，每格至少 2 条', () => {
    expect(Object.keys(scores).sort()).toEqual([...DIMS].sort())
    for (const dim of DIMS) {
      expect(Object.keys(scores[dim]).sort()).toEqual([...BAND_KEYS].sort())
      for (const b of BAND_KEYS) expect(scores[dim][b].length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('fortunes.json', () => {
  it('24 支签', () => {
    expect(fortunes).toHaveLength(24)
  })

  it('level 只能是 6 个合法标签，绝不出现大凶', () => {
    for (const f of fortunes) {
      expect(LEVELS).toContain(f.level)
      expect(f.level).not.toBe('大凶')
    }
  })

  it('六档全部有签可抽', () => {
    for (const lv of LEVELS) {
      expect(fortunes.filter((f) => f.level === lv).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('每支签四个字段齐备且非空', () => {
    for (const f of fortunes) {
      for (const k of ['verse', 'yi', 'ji', 'explain']) {
        expect(typeof f[k]).toBe('string')
        expect(f[k].length).toBeGreaterThan(0)
      }
    }
  })

  it('签辞不重复', () => {
    const verses = fortunes.map((f) => f.verse)
    expect(new Set(verses).size).toBe(verses.length)
  })
})

describe('lucky.json', () => {
  it('彩蛋池数量符合预期', () => {
    expect(lucky.colors).toHaveLength(12)
    expect(lucky.numbers).toHaveLength(9)
    expect(lucky.directions).toHaveLength(8)
    expect(lucky.zodiacs).toHaveLength(12)
  })

  it('数字全为 1~99 的整数', () => {
    for (const n of lucky.numbers) {
      expect(Number.isInteger(n)).toBe(true)
      expect(n).toBeGreaterThan(0)
      expect(n).toBeLessThan(100)
    }
  })
})

describe('ui.json', () => {
  it('四个区块齐备', () => {
    for (const k of ['intro', 'divining', 'result', 'lock']) {
      expect(ui[k]).toBeTruthy()
    }
  })

  it('动画文案为 3 步', () => {
    expect(ui.divining.steps).toHaveLength(3)
  })

  it('海报相关文案齐备且非空', () => {
    const keys = ['savePoster', 'posterHint', 'posterDownload', 'posterPending', 'posterFailed', 'copyLink']
    for (const k of keys) {
      expect(typeof ui.result[k], `ui.result.${k} 缺失`).toBe('string')
      expect(ui.result[k].length, `ui.result.${k} 为空`).toBeGreaterThan(0)
    }
  })

  it('海报段落含副标题、扫码引导与免责声明', () => {
    expect(typeof ui.poster.subtitle).toBe('string')
    expect(typeof ui.poster.scanHint).toBe('string')
    expect(ui.poster.disclaimer.length).toBeGreaterThan(0)
  })
})
