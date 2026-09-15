// src/core/poster/measure.test.js
//
// 海报上唯一会「静静坏掉」的部分：中文只能用系统字体，不同机型字宽不同，
// 文字溢出画布时页面上没有任何提示。这里把测量做成注入的纯函数，
// 就是为了一旦改动版式就能在 node 下立刻发现溢出。
import { describe, it, expect } from 'vitest'
import { defaultMeasure, fitFontSize, wrapText } from './measure.js'

/** 假测量器：中文/全角 1em，ASCII 0.5em，其余 1em —— 与 defaultMeasure 同约定。
    单独写一份而不是直接用 defaultMeasure，是为了测试不会因为后者被改而一起变绿。 */
function fakeMeasure(text, fontPx) {
  let em = 0
  for (const ch of String(text)) {
    em += /[㐀-䶿一-鿿　-〿＀-￯]/.test(ch) ? 1 : /[!-~]/.test(ch) ? 0.5 : 1
  }
  return em * fontPx
}

describe('defaultMeasure', () => {
  it('中文按 1em、ASCII 按 0.5em', () => {
    expect(defaultMeasure('中', 100)).toBe(100)
    expect(defaultMeasure('ab', 100)).toBe(100)
  })

  it('全角标点算 1em（不会把「，」当成半个字）', () => {
    expect(defaultMeasure('，', 100)).toBe(100)
  })

  it('空串为 0', () => {
    expect(defaultMeasure('', 100)).toBe(0)
  })
})

describe('fitFontSize', () => {
  const opts = { max: 64, min: 16, step: 2 }

  it('放得下就用最大字号', () => {
    expect(fitFontSize('张三', 620, opts, fakeMeasure)).toBe(64)
  })

  it('放不下就逐档降，返回第一个放得下的', () => {
    // 8 个全角字 = 8em；620 / 8 = 77.5 → 64 放得下 → 仍是 64
    expect(fitFontSize('一二三四五六七八', 620, opts, fakeMeasure)).toBe(64)
    // 限宽 400：8em ≤ 400 → 需 fontPx ≤ 50 → 降到 50
    expect(fitFontSize('一二三四五六七八', 400, opts, fakeMeasure)).toBe(50)
  })

  it('降到 min 仍放不下时返回 min（交由 wrapText 折行）', () => {
    expect(fitFontSize('一二三四五六七八', 10, opts, fakeMeasure)).toBe(16)
  })

  it('max ≤ min 时直接返回 max，不进入死循环', () => {
    expect(fitFontSize('张三', 1, { max: 16, min: 16 }, fakeMeasure)).toBe(16)
  })

  it('长英文名不会被字数分档误伤', () => {
    // 「Alexander」9 字符，9 × 0.5em = 4.5em；620 / 4.5 ≈ 137 → 64 就够，
    // 不该像按字数分档那样降到最小档
    expect(fitFontSize('Alexander', 620, opts, fakeMeasure)).toBe(64)
  })
})

describe('wrapText', () => {
  it('中文按字折行', () => {
    // 每字 20px，限宽 60 → 每行 3 字
    expect(wrapText('一二三四五六七', 60, 20, fakeMeasure)).toEqual(['一二三', '四五六', '七'])
  })

  it('ASCII 按空格断词，不把单词劈开', () => {
    // 每字符 10px，限宽 100 → 每行 10 字符
    expect(wrapText('hello world foo', 100, 20, fakeMeasure)).toEqual(['hello ', 'world foo'])
  })

  it('单个超宽单词硬切，不产生超框行', () => {
    const lines = wrapText('abcdefghijklmnop', 50, 20, fakeMeasure) // 每行 5 字符
    expect(lines).toEqual(['abcde', 'fghij', 'klmno', 'p'])
    for (const l of lines) expect(fakeMeasure(l, 20)).toBeLessThanOrEqual(50)
  })

  it('中英混排：每行都不超宽', () => {
    const lines = wrapText('今天 review 一下 PR 吧', 80, 20, fakeMeasure)
    for (const l of lines) expect(fakeMeasure(l, 20)).toBeLessThanOrEqual(80)
    expect(lines.join('').replace(/\s/g, '')).toBe('今天review一下PR吧')
  })

  it('行首不留空格', () => {
    for (const l of wrapText('abc def ghi', 40, 20, fakeMeasure)) {
      expect(l.startsWith(' ')).toBe(false)
    }
  })

  // 下面三条覆盖的是上面那条例不到的路径：行首空格只在 line 为空时才会被吃掉，
  // 而 'abc def ghi' 的每个空格前都有词，永远走不到 —— 正是这个盲区让
  // 「行首缩进 / 纯空白行」的缺陷在测试全绿的情况下活着。
  it('开头的空格被丢弃，不留行首缩进', () => {
    expect(wrapText('  张三', 620, 64)).toEqual(['张三'])
    for (const l of wrapText('  张三', 620, 64)) {
      expect(l === '' || !l.startsWith(' ')).toBe(true)
    }
  })

  it('纯空白行不可能出现（空白会把行撑满并折出一个空行）', () => {
    const lines = wrapText(' BDO ', 40, 32)
    for (const l of lines) {
      expect(l.trim() === '').toBe(false)
      expect(l === '' || !l.startsWith(' ')).toBe(true)
    }
  })

  it('换行符产生的新行也不以空格开头', () => {
    const lines = wrapText('甲\n 乙', 200, 20)
    for (const l of lines) {
      expect(l === '' || !l.startsWith(' ')).toBe(true)
    }
  })

  it('空串返回空数组（而不是含一个空串的数组）', () => {
    expect(wrapText('', 100, 20, fakeMeasure)).toEqual([])
  })
})
