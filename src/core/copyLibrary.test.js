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
import posterCfg from '../config/poster.json'
import scoringCfg from '../config/scoring.json'
import { ZODIACS, TENURES } from './config.js'
import { defaultMeasure, wrapText, fitFontSize } from './poster/measure.js'
import { FORTUNE_LAYOUT, LINE_HEIGHT, formatYiJi } from './poster/poster.js'

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

// ── 海报版式容量 ────────────────────────────────────────────────
//
// 「配置就是输入面」：运营直接改 copy/*.json，而唯一的自动守卫是 lint-rules.json
// 的「单条 ≤ 60 字」。60 字的身份标签或签辞，海报上根本画不下 —— 海报那边既没有
// 折行余量也没有溢出裁剪，超出的部分会直接顶穿卡片边框画到画布上
//（?debug=poster 验收页第 10 张画的就是这个）。所以「内容装得进版式」这件事
// 必须在**改文案的那一刻**就报错，而不是等谁肉眼去验收页上扫。
//
// 这正是 lint-copy.js 的路数：装不下的内容，在构建期就拦掉。
//
// ⚠️ 带宽一律从 poster.json 读、版式偏移一律从 poster.js 读，两边都不手抄。
// 手抄的坐标会和真实版式漂移，而漂移的方向恰好是最坏的那种：
// 测试说没事、海报上压字。
describe('海报版式容量（内容必须装得进版式）', () => {
  const boxOf = (key) => posterCfg.elements.find((e) => e.key === key)
  const IDENTITY_BOX = boxOf('identity')
  const FORTUNE_BOX = boxOf('fortune')

  /**
   * 给定「首行基线中心」与「下方禁区的上沿」（同为卡片内的相对坐标，
   * 因为海报是 textBaseline='middle'：一行文字上下各占 fontPx/2），
   * 返回这段空间最多放得下几行。
   */
  function lineCapacity(firstCenterY, forbiddenTopY, fontPx) {
    const lineH = fontPx * LINE_HEIGHT
    let n = 0
    while (firstCenterY + n * lineH + fontPx / 2 < forbiddenTopY) n++
    return n
  }

  it('容量推导本身是正的（否则下面几条会空转恒真）', () => {
    expect(lineCapacity(FORTUNE_LAYOUT.verseOffset, FORTUNE_BOX.h - FORTUNE_LAYOUT.yiJiOffset, FORTUNE_LAYOUT.verseFont))
      .toBeGreaterThan(0)
    expect(IDENTITY_BOX.maxWidth).toBeGreaterThan(0)
    expect(IDENTITY_BOX.minFont).toBeGreaterThan(0)
  })

  it('四维数值行放得进 scoreRow 带宽', () => {
    // 为什么这一条和身份标签一样，守的是**下限**而不是声明字号：
    // 海报对 scoreRow 走 fitFontSize（与 name / identity 同一套规则）—— 声明的 font 是
    // **上限**，minFont 是**下限**。在声明字号下量得 740px > 带宽 620px 是当前配置的
    // 既成事实（四个维度都到三位数时可达），绘图侧靠降档消化掉；若把守卫也钉在声明
    // 字号上，它就变成了「要求把 font 调到 16」，那是让**每一张**海报都为一个罕见输入
    // 缩小字号，而不是只在装不下时降档。所以守卫钉下限：降到 minFont 仍放不下，
    // 才意味着没有任何合法字号可用 —— 那行字会横穿整张画布。
    //
    // ⚠️ 四维数值行是全项目唯一**三重失守**的文案：标签来自 `scoring.json`，
    // 而 lint-copy.js 只扫 `copy/*.json`、`settings.json`、`.vue` 与非测试 `.js` ——
    // `scoring.json` 整个文件不在扫描面内。所以 `dimensionLabels` 既没有禁用词检查、
    // 也没有 60 字上限检查，更没有容量检查。这条守卫补上第三项。
    const SCORE_BOX = boxOf('scoreRow')
    // 最坏情况：四个维度全部三位数。100 不是假想值 —— taurus(90) + gt5(+8) + tech(+6) = 104，
    // 由 scoring.js 夹到 100，验收页 ?debug=poster 的「满分」那张画的就是它。
    const row = DIMS.map((d) => `${scoringCfg.dimensionLabels[d]} 100`).join('  ·  ')
    const font = fitFontSize(row, SCORE_BOX.maxWidth, {
      max: SCORE_BOX.font, min: SCORE_BOX.minFont
    }, defaultMeasure)

    const w = defaultMeasure(row, font)
    expect(w, `"${row}" 降档到 ${font}px 后宽 ${Math.ceil(w)}px，超过带宽 ${SCORE_BOX.maxWidth}px`)
      .toBeLessThanOrEqual(SCORE_BOX.maxWidth)

    // 降档还必须留有余量：真的顶到 minFont，说明带宽一点富余都没有了，
    // 再长一个字就是上面那条断言报错。让「标签开始变长」在这里先被看见。
    expect(font, `最坏行已降到 minFont(${SCORE_BOX.minFont}px)，带宽 ${SCORE_BOX.maxWidth}px 没有余量`)
      .toBeGreaterThan(SCORE_BOX.minFont)
  })

  it('每条身份标签都能在 ≥ minFont 的字号下放进卡片带宽', () => {
    // 海报对身份标签走 fitFontSize：从 font 逐档降到 minFont。降到 minFont
    // **仍然**放不下，就没有任何合法字号可用了 —— 那串字会顶穿烫金边框。
    // 所以守卫按 minFont 算，而不是按「通常能过」的 font 算。
    const tooWide = []
    for (const { text } of identity) {
      const w = defaultMeasure(text, IDENTITY_BOX.minFont)
      if (w > IDENTITY_BOX.maxWidth) {
        tooWide.push(
          `"${text}" 在 ${IDENTITY_BOX.minFont}px 下宽 ${Math.ceil(w)}px，` +
          `超过卡片带宽 ${IDENTITY_BOX.maxWidth}px`
        )
      }
    }
    expect(tooWide).toEqual([])
  })

  it('每条签辞都放得进签文卡的正文区', () => {
    // 签辞首行画在卡片顶往下 verseOffset 处，宜/忌那行固定在卡片底往上 yiJiOffset 处，
    // 中间就是签辞的全部活动空间。行数上限由这两个偏移推出，不写死「最多 2 行」。
    const yiJiTop = FORTUNE_BOX.h - FORTUNE_LAYOUT.yiJiOffset - FORTUNE_LAYOUT.yiJiFont / 2
    const maxLines = lineCapacity(FORTUNE_LAYOUT.verseOffset, yiJiTop, FORTUNE_LAYOUT.verseFont)
    const over = []
    for (const f of fortunes) {
      const lines = wrapText(f.verse, FORTUNE_BOX.maxWidth, FORTUNE_LAYOUT.verseFont, defaultMeasure)
      if (lines.length > maxLines) {
        over.push(`"${f.verse}" 折成 ${lines.length} 行，超过上限 ${maxLines} 行（会压到宜/忌那行）`)
      }
    }
    expect(over).toEqual([])
  })

  it('每支签的宜/忌行都放得进签文卡', () => {
    // 与签辞同一类风险，同一张卡片：宜/忌也是折行绘制，多折一行就往下压，
    // 越过卡片底边就画到卡外了。它同样只受 lint-rules 的 60 字上限约束。
    const maxLines = lineCapacity(
      FORTUNE_BOX.h - FORTUNE_LAYOUT.yiJiOffset, FORTUNE_BOX.h, FORTUNE_LAYOUT.yiJiFont
    )
    const over = []
    for (const f of fortunes) {
      const line = formatYiJi(f.yi, f.ji)
      const lines = wrapText(line, FORTUNE_BOX.maxWidth, FORTUNE_LAYOUT.yiJiFont, defaultMeasure)
      if (lines.length > maxLines) {
        over.push(`"${line}" 折成 ${lines.length} 行，超过上限 ${maxLines} 行（会压出卡片底边）`)
      }
    }
    expect(over).toEqual([])
  })
})
