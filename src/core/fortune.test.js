// src/core/fortune.test.js
import { describe, it, expect } from 'vitest'
import {
  BASE_WEIGHT, biasFor, pickLevel, drawFortune,
  drawIdentity, buildReading, FALLBACK_FORTUNE
} from './fortune.js'
import { makeRng } from './rng.js'
import { runtimeConfig } from './config.js'
import rules from '../config/lint-rules.json'

const cfg = runtimeConfig
const DIMS = cfg.scoring.dimensions
const profile = { name: '张三', dept: 'tech', tenure: '1to3', zodiac: 'gemini' }

describe('BASE_WEIGHT', () => {
  it('六档齐备且不含大凶', () => {
    expect(Object.keys(BASE_WEIGHT).sort()).toEqual(
      ['上上签', '大吉', '中吉', '小吉', '平', '小凶'].sort()
    )
    expect(BASE_WEIGHT['大凶']).toBeUndefined()
  })

  it('好签档合计 20%、中吉小吉 45%、平 25%、小凶 10%', () => {
    const total = Object.values(BASE_WEIGHT).reduce((a, b) => a + b, 0)
    expect(total).toBe(100)
    expect((BASE_WEIGHT['上上签'] + BASE_WEIGHT['大吉']) / total).toBeCloseTo(0.2, 5)
    expect((BASE_WEIGHT['中吉'] + BASE_WEIGHT['小吉']) / total).toBeCloseTo(0.45, 5)
    expect(BASE_WEIGHT['平'] / total).toBeCloseTo(0.25, 5)
    expect(BASE_WEIGHT['小凶'] / total).toBeCloseTo(0.1, 5)
  })
})

describe('biasFor', () => {
  it('均分 ≥ 80 时好签系数大于 1、小凶小于 1', () => {
    const b = biasFor(85)
    expect(b['上上签']).toBeGreaterThan(1)
    expect(b['小凶']).toBeLessThan(1)
  })

  it('均分 70~76 时全部为 1（PRD 基准档）', () => {
    const b = biasFor(73)
    Object.values(b).forEach((v) => expect(v).toBe(1))
  })

  it('均分 < 70 时小凶系数大于 1、好签小于 1', () => {
    const b = biasFor(65)
    expect(b['小凶']).toBeGreaterThan(1)
    expect(b['上上签']).toBeLessThan(1)
  })

  it('三档边界按实测分布归位：77 与 70', () => {
    // 阈值来自对实际可达均分区间的穷尽测量（64~83），不是拍脑袋定的。
    expect(biasFor(77)['上上签']).toBeGreaterThan(1) // 上界含 77
    expect(biasFor(76.9)['上上签']).toBe(1) // 77 以下为基准档
    expect(biasFor(70)['上上签']).toBe(1) // 下界含 70
    expect(biasFor(69.9)['上上签']).toBeLessThan(1) // 70 以下为低档
  })
})

describe('pickLevel', () => {
  it('返回值恒为合法标签', () => {
    const rng = makeRng(1)
    for (let i = 0; i < 500; i++) {
      expect(Object.keys(BASE_WEIGHT)).toContain(pickLevel(70, rng))
    }
  })

  it('偏置生效：均分 90 的样本里好签比例高于均分 40', () => {
    const good = (avg) => {
      const rng = makeRng(7)
      let n = 0
      const N = 4000
      for (let i = 0; i < N; i++) {
        const lv = pickLevel(avg, rng)
        if (lv === '上上签' || lv === '大吉') n++
      }
      return n / N
    }
    expect(good(90)).toBeGreaterThan(good(40))
  })

  it('均分 85 时小凶概率约 2.7%（反差保留但稀有）', () => {
    const rng = makeRng(99)
    let n = 0
    const N = 20000
    for (let i = 0; i < N; i++) if (pickLevel(85, rng) === '小凶') n++
    const p = n / N
    expect(p).toBeGreaterThan(0.01)
    expect(p).toBeLessThan(0.05)
  })
})

describe('drawFortune', () => {
  it('抽出的签必须属于 pickLevel 选中的档位', () => {
    // 这条断言必须能捕获「档位滤波器被删掉」。
    // 做法：用同一个种子分别跑 pickLevel 与 drawFortune —— 后者内部第一步就是
    // pickLevel，故两者选中的档位必然相同；随后 drawFortune 从**该档的候选池**抽取。
    // 若滤波器失效（source 退化为全池），抽到的签档位就会与 expectedLevel 不符，
    // 六分之五的概率直接失败。（早先那版只断言「在池中存在」+「不是大凶」，
    // 两条都恒真，删掉滤波器也不会红 —— 属于假验证。）
    for (let i = 0; i < 200; i++) {
      const seed = 1000 + i
      const expectedLevel = pickLevel(73, makeRng(seed))
      const f = drawFortune(73, cfg.copy.fortunes, makeRng(seed))
      expect(f.level).toBe(expectedLevel)
    }
  })

  it('返回的签在池中存在且绝不为大凶', () => {
    const rng = makeRng(5)
    for (let i = 0; i < 100; i++) {
      const f = drawFortune(73, cfg.copy.fortunes, rng)
      expect(cfg.copy.fortunes).toContainEqual(f)
      expect(f.level).not.toBe('大凶')
    }
  })

  it('四个字段齐备', () => {
    const f = drawFortune(70, cfg.copy.fortunes, makeRng(1))
    for (const k of ['level', 'verse', 'yi', 'ji', 'explain']) {
      expect(f[k]).toBeTruthy()
    }
  })

  it('返回的是拷贝，修改它不会污染配置', () => {
    const f = drawFortune(70, cfg.copy.fortunes, makeRng(1))
    f.verse = '被改过了'
    expect(cfg.copy.fortunes.some((x) => x.verse === '被改过了')).toBe(false)
  })

  it('签池为空时返回兜底签，不返回 null（规格 §12）', () => {
    // 触发路径由运营可控：规格 §14 把 copy/*.json 列为运营可编辑，
    // 清空 fortunes.json 的数组就会走到这里。此前返回 null，
    // FortuneSlip（required: true）解引用 fortune.level 即整块结果页失败。
    const f = drawFortune(73, [], makeRng(1))
    expect(f).not.toBeNull()
    for (const k of ['level', 'verse', 'yi', 'ji', 'explain']) {
      expect(f[k], `兜底签缺字段 ${k}`).toBeTruthy()
    }
  })

  it('签池不是数组（被改成对象 / undefined）时同样返回兜底签', () => {
    for (const pool of [undefined, null, {}, 'not-an-array']) {
      const f = drawFortune(73, pool, makeRng(1))
      expect(f).not.toBeNull()
      expect(f.verse).toBeTruthy()
    }
  })

  it('兜底签的文案不含任何禁用词（与 lint-rules.json 同一份清单）', () => {
    // 兜底文案是内联常量，不像 JSON 文案那样天然经过 linter 扫描路径，
    // 这条把它拉回同一把尺子下。
    const text = [FALLBACK_FORTUNE.level, FALLBACK_FORTUNE.verse, FALLBACK_FORTUNE.yi, FALLBACK_FORTUNE.ji, FALLBACK_FORTUNE.explain].join('')
    for (const w of rules.banned) {
      expect(text.includes(w), `兜底签文案命中禁用词「${w}」`).toBe(false)
    }
  })
})

describe('drawIdentity', () => {
  it('只从本部门专属与通用标签中抽取', () => {
    const rng = makeRng(3)
    for (let i = 0; i < 300; i++) {
      const id = drawIdentity(profile, cfg.copy.identity, rng)
      expect(id.dept === null || id.dept === profile.dept).toBe(true)
    }
  })

  it('长期抽样中专属标签会出现（部门代入感生效）', () => {
    const rng = makeRng(3)
    let own = 0
    for (let i = 0; i < 500; i++) {
      if (drawIdentity(profile, cfg.copy.identity, rng).dept === profile.dept) own++
    }
    expect(own).toBeGreaterThan(0)
  })
})

describe('buildReading', () => {
  it('产出完整 reading 结构', () => {
    const r = buildReading(profile, cfg, makeRng(20260913))
    expect(Object.keys(r.scores).sort()).toEqual([...DIMS].sort())
    expect(Object.keys(r.bands).sort()).toEqual([...DIMS].sort())
    expect(r.identity.text).toBeTruthy()
    expect(r.fortune.level).toBeTruthy()
    expect(r.lucky.color).toBeTruthy()
    expect(Number.isInteger(r.lucky.number)).toBe(true)
    expect(r.lucky.direction).toBeTruthy()
    expect(r.lucky.zodiac).toBeTruthy()
  })

  it('吐槽为 2~3 句', () => {
    const r = buildReading(profile, cfg, makeRng(1))
    expect(r.roastTexts.length).toBeGreaterThanOrEqual(2)
    expect(r.roastTexts.length).toBeLessThanOrEqual(3)
  })

  it('吐槽内容互不重复', () => {
    const r = buildReading(profile, cfg, makeRng(1))
    expect(new Set(r.roastTexts).size).toBe(r.roastTexts.length)
  })

  it('部门梗来自本部门大类', () => {
    const r = buildReading(profile, cfg, makeRng(1))
    expect(cfg.copy.department[profile.dept]).toContain(r.deptJoke)
  })

  it('插值变量齐备', () => {
    const r = buildReading(profile, cfg, makeRng(1))
    expect(r.vars.name).toBe('张三')
    expect(r.vars.dept).toBe('技术 / 研发')
    expect(r.vars.zodiac).toBe('双子座')
    expect(r.vars.tenure).toBeTruthy()
  })

  // 部门改成自由输入后，展示用原文（「搞算法的」）、算分用归一的 key（tech）。
  // 回退分支不是可选项：改版前存下的会话里没有 deptText，刷新后仍要能渲染出部门名。
  it('有 deptText 时 vars.dept 用原文，无则回退规范名', () => {
    const withText = buildReading({ ...profile, deptText: '搞算法的' }, cfg, makeRng(1))
    expect(withText.vars.dept).toBe('搞算法的')

    const without = buildReading(profile, cfg, makeRng(1))
    expect(without.vars.dept).toBe('技术 / 研发')
  })

  it('deptText 不影响打分：仍按归一的 dept 算', () => {
    const plain = buildReading(profile, cfg, makeRng(7))
    const texted = buildReading({ ...profile, deptText: '搞算法的' }, cfg, makeRng(7))
    expect(texted.scores).toEqual(plain.scores)
    expect(texted.bands).toEqual(plain.bands)
  })

  it('相同种子产出完全一致', () => {
    const a = buildReading(profile, cfg, makeRng(555))
    const b = buildReading(profile, cfg, makeRng(555))
    expect(a).toEqual(b)
  })

  it('不同种子产出不同', () => {
    const a = buildReading(profile, cfg, makeRng(1))
    const b = buildReading(profile, cfg, makeRng(2))
    expect(a).not.toEqual(b)
  })

  it('抽到的签绝不等于大凶', () => {
    const rng = makeRng(2026)
    for (let i = 0; i < 300; i++) {
      expect(buildReading(profile, cfg, rng).fortune.level).not.toBe('大凶')
    }
  })

  it('fortunes 池为空时仍产出完整 reading，fortune 有全部五个字段', () => {
    // 运营把 copy/fortunes.json 清空后的那天，这条路径必须仍然出结果页。
    const emptyCfg = { ...cfg, copy: { ...cfg.copy, fortunes: [] } }
    const r = buildReading(profile, emptyCfg, makeRng(3))
    for (const k of ['level', 'verse', 'yi', 'ji', 'explain']) {
      expect(r.fortune[k], `fortune 缺字段 ${k}`).toBeTruthy()
    }
    expect(r.identity.text).toBeTruthy()
    expect(r.lucky.color).toBeTruthy()
  })
})
