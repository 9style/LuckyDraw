// src/core/poster/measure.js

// 汉字（含扩展 A）与全角标点/全角形式按 1em 计，ASCII 可见字符按 0.5em，其余（emoji 等）按 1em。
// 这只用于测试与兜底 —— 真机上由 canvas.measureText 提供真实字宽。
const WIDE_RE = /[㐀-䶿一-鿿　-〿＀-￯]/
const ASCII_RE = /[!-~]/

/** 默认测量器：按字符类别估算宽度。 */
export function defaultMeasure(text, fontPx) {
  let em = 0
  for (const ch of String(text)) {
    em += WIDE_RE.test(ch) ? 1 : ASCII_RE.test(ch) ? 0.5 : 1
  }
  return em * fontPx
}

/**
 * 把文本切成不可再分的最小排版单元。
 *
 * ASCII 连续可见字符算**一个词**（不能从中间劈开，否则英文会被拦腰折断）；
 * 空格、汉字、全角标点各自成一个 token。
 */
function tokenize(text) {
  const tokens = []
  let word = ''
  for (const ch of String(text)) {
    if (ch === '\n') {
      if (word) { tokens.push(word); word = '' }
      tokens.push('\n')
    } else if (ASCII_RE.test(ch)) {
      word += ch
    } else {
      if (word) { tokens.push(word); word = '' }
      tokens.push(ch)
    }
  }
  if (word) tokens.push(word)
  return tokens
}

/**
 * 从 max 起逐档降字号，返回第一个能放进 maxWidth 的；降到 min 仍放不下则返回 min，
 * 由调用方交给 wrapText 折行。
 *
 * 为什么不用「按字数分档」（1-3 字 64px / 4-5 字 52px …）：那套规则对非中文名失效 ——
 * 「Alexander」9 个字符会落到最小档，而它在 52px 下本来就放得下。
 */
export function fitFontSize(text, maxWidth, { max, min = 16, step = 2 }, measure = defaultMeasure) {
  if (max <= min) return max
  for (let size = max; size > min; size -= step) {
    if (measure(text, size) <= maxWidth) return size
  }
  return min
}

/**
 * 折行。中文按字累加、ASCII 按空格断词；单个词本身超宽则硬切。
 * 行首不保留空格（否则每行会平白缩进半个字符）。
 */
export function wrapText(text, maxWidth, fontPx, measure = defaultMeasure) {
  if (!text) return []
  const lines = []
  let line = ''

  for (const token of tokenize(text)) {
    if (token === '\n') {
      lines.push(line)
      line = ''
      continue
    }
    // 行首不保留空格：line 为空时丢弃空格 token。
    // 少了这一条，`line && …` 会在空行上短路走 else，把空格追加进空行 ——
    // 产出「行首缩进」或纯空白行，直接违反本函数上面写明的约定。
    if (token === ' ' && !line) continue
    if (line && measure(line + token, fontPx) > maxWidth) {
      lines.push(line)
      line = token === ' ' ? '' : token
    } else {
      line += token
    }
    // 单个 token 本身超宽（超长英文单词 / 连续数字）→ 硬切，保证没有超框行
    while (measure(line, fontPx) > maxWidth && [...line].length > 1) {
      const chars = [...line]
      let cut = chars.length - 1
      while (cut > 0 && measure(chars.slice(0, cut).join(''), fontPx) > maxWidth) cut--
      if (cut === 0) break
      lines.push(chars.slice(0, cut).join(''))
      line = chars.slice(cut).join('')
    }
  }

  if (line) lines.push(line)
  return lines
}
