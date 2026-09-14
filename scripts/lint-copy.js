// scripts/lint-copy.js
// 文案合规扫描。挂载为 npm run build 前置：命中红线即构建失败。
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// 项目根可用 `--root=<dir>` 覆盖，**唯一的用途是让测试能在临时目录里跑真实 CLI**。
//
// 为什么需要它：本脚本存在的全部意义是「违规时阻断构建」，而这一点
// **纯函数测试覆盖不到** —— `lintText` 返回问题数组，但「返回了问题数组」
// 与「进程真的以非零码退出」是两回事。没有这个开关时，只能去断言源码文本
// （例如数 process.exit 出现次数），那种断言既会随无关格式调整而误报，
// 又无法指出是哪条分支 —— 两头不讨好。
const rootArg = process.argv.find((a) => a.startsWith('--root='))
const ROOT = rootArg ? resolve(rootArg.slice('--root='.length)) : join(__dirname, '..')
const COPY_DIR = join(ROOT, 'src/config/copy')
const SETTINGS = join(ROOT, 'src/config/settings.json')
const RULES_FILE = join(ROOT, 'src/config/lint-rules.json')
const SRC_DIR = join(ROOT, 'src')

// 合规规则的单一来源。src/core/copyLibrary.test.js 读同一份文件 ——
// 禁用词表若在两处各写一遍，迟早会漂移成两套标准。
const RULES = JSON.parse(readFileSync(RULES_FILE, 'utf8'))
const MAX_LEN = RULES.maxLength
const BANNED = RULES.banned
const PLACEHOLDER_MARK = RULES.placeholderMark

/**
 * 去掉全部空白。
 *
 * ⚠️ **两条路径都必须用它**：JSON 文案与 `.vue` 模板。
 * 字间距在本项目里是通用约定（`填 4 个空，摇一支签`、`解 锁`、`开 始`），
 * 不只出现在模板里 —— 只在模板路径压缩，等于给承载绝大多数用户可见文案的
 * JSON 路径留了一条逃逸通道：`"占 卜"` 会绕过全部检查，而用户读到的就是「占卜」。
 */
const SQUEEZE = (s) => s.replace(/\s+/g, '')

/** 检查单条文本，返回问题描述数组 */
export function lintText(text) {
  if (typeof text !== 'string') return []
  const issues = []

  // 长度按**原始**文本计：空格确实占版面，不该被压缩掉
  if ([...text].length > MAX_LEN) {
    issues.push(`超过 ${MAX_LEN} 字（${[...text].length} 字）：${text.slice(0, 20)}…`)
  }

  // 禁用词按**去空白后**的文本匹配
  const squeezed = SQUEEZE(text)
  for (const word of BANNED) {
    if (squeezed.includes(word)) {
      issues.push(`命中禁用词「${word}」：${text}`)
    }
  }

  return issues
}

/** 递归检查任意 JSON 结构，返回 { path, message } 数组 */
export function lintObject(node, path = 'root', out = []) {
  if (typeof node === 'string') {
    for (const msg of lintText(node)) out.push({ path, message: msg })
  } else if (Array.isArray(node)) {
    node.forEach((child, i) => lintObject(child, `${path}[${i}]`, out))
  } else if (node && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      lintObject(child, `${path}.${key}`, out)
    }
  }
  return out
}

/** 查找未替换的占位符 */
export function findPlaceholders(node, path = 'root', out = []) {
  if (typeof node === 'string') {
    if (node.includes(PLACEHOLDER_MARK)) out.push({ path, message: node })
  } else if (Array.isArray(node)) {
    node.forEach((child, i) => findPlaceholders(child, `${path}[${i}]`, out))
  } else if (node && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      findPlaceholders(child, `${path}.${key}`, out)
    }
  }
  return out
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** 递归收集 src 下需要扫描的源文件：全部 `.vue` + 非测试 `.js` */
function collectSourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) collectSourceFiles(p, out)
    else if (entry.name.endsWith('.vue')) out.push(p)
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) out.push(p)
  }
  return out
}

/**
 * 剥掉注释：`//` 行注释、`/*` 起 `*` + `/` 止的块注释、`<!--` 起 `-->` 止的 HTML 注释。
 *
 * **为什么必须先剥注释**：禁用词治理的是**面向用户的文案**，注释不属于此范畴。
 * 不剥就会误报 —— `src/core/rng.js` 的注释里写着「同一次占卜」，
 * 那是给维护者看的说明，页面上永远不会出现。
 *
 * 单趟扫描并跟踪字符串定界符（`'` / `"` / 反引号），所以字符串里的 `//`
 * （如 `'https://…'`）不会被误当成注释起点。
 *
 * 已知局限：**不识别正则字面量**。若某条正则内部含「双斜杠」或「星号 + 斜杠」
 * 这样的序列（例如一条匹配块注释的正则），会被误当作注释起点而多剥一段。
 * 当前 `src/` 下只有两条正则（`copyEngine.js` 的 `VAR_RE`、`validators.js` 的 `NAME_RE`），
 * 二者都不含该序列，实测无影响；将来若新增此类正则，需回到这里一并处理。
 */
export function stripComments(raw) {
  const src = String(raw)
  let out = ''
  let i = 0
  let quote = null

  while (i < src.length) {
    const c = src[i]
    const next = src[i + 1]

    if (quote) {
      out += c
      if (c === '\\') {
        // 转义序列整体跳过，避免 `'\''` 这类把引号状态提前关掉
        out += next ?? ''
        i += 2
        continue
      }
      if (c === quote) quote = null
      i++
      continue
    }

    if (c === '<' && src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4)
      i = end === -1 ? src.length : end + 3
      continue
    }
    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i)
      i = end === -1 ? src.length : end
      continue
    }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end === -1 ? src.length : end + 2
      continue
    }

    if (c === '"' || c === "'" || c === '`') quote = c
    out += c
    i++
  }
  return out
}

/**
 * 检查一个**整个源文件**（`.vue` 全文，含 `<script setup>`；或 `.js`）里的
 * 硬编码文案。返回问题描述数组。
 *
 * 为什么要扫整个文件，而不是只扫 `<template>` 块：
 *  1. **用户的可见文案不只在 `config/copy/*.json` 与模板里。**
 *     `.vue` 的 `<script setup>` 里大量存在字面量（`Disclaimer.vue` 逐字装着
 *     PRD 8.3 引用的免责声明），`src/` 下的 `.js` 里也有直接渲染的字符串 ——
 *     只扫模板会把这些整块留在边界之外。
 *  2. **必须先去掉所有空白再匹配。** 字间距在本项目里是通用约定
 *     （`填 4 个空，摇一支签`、`解 锁`、`开 始`），源码里 `开 始 占 卜`
 *     **不含**连续子串 `占卜`，逐字子串匹配会全部放行，而用户读到的就是「开始占卜」。
 *     这是子串式合规检查的经典逃逸路径。
 *  3. **注释要先剥掉**，否则 `rng.js` 注释里的「占卜」会误报（见 `stripComments`）。
 *
 * 注意：`*.test.js` 在收集阶段就被排除 —— `src/core/config.test.js` 把禁用词表
 * 本身当作测试数据硬编码在内，扫它等于让测试必需品触发闸门。
 */
export function lintSource(raw, path = 'source') {
  const squeezed = SQUEEZE(stripComments(raw))
  const issues = []
  for (const word of BANNED) {
    if (squeezed.includes(word)) {
      issues.push({ path, message: `源码文案命中禁用词「${word}」（已忽略字间距与注释）` })
    }
  }
  return issues
}

function main() {
  const files = readdirSync(COPY_DIR).filter((f) => f.endsWith('.json'))
  if (files.length === 0) {
    console.error('✗ src/config/copy/ 下没有找到任何 json 文件')
    process.exit(1)
  }

  const violations = []
  const placeholders = []

  for (const file of files) {
    const path = join(COPY_DIR, file)
    let data
    try {
      data = readJson(path)
    } catch (e) {
      violations.push({ path: file, message: `JSON 解析失败：${e.message}` })
      continue
    }
    const name = basename(file, '.json')
    for (const issue of lintObject(data, name)) violations.push(issue)
    for (const ph of findPlaceholders(data, name)) placeholders.push(ph)
  }

  const settings = readJson(SETTINGS)
  for (const issue of lintObject(settings, 'settings')) violations.push(issue)
  for (const ph of findPlaceholders(settings, 'settings')) placeholders.push(ph)

  // 源码里的硬编码用户文案从不经过 JSON 扫描，必须单独过一遍。
  // 扫描面 = **整个 `.vue` 文件**（含 `<script setup>`）+ `src/` 下所有非测试 `.js`；
  // 匹配前剥注释、去全部空白（见 lintSource / stripComments）。
  const sourceFiles = collectSourceFiles(SRC_DIR)
  for (const path of sourceFiles) {
    for (const issue of lintSource(readFileSync(path, 'utf8'), relative(ROOT, path))) {
      violations.push(issue)
    }
  }

  if (violations.length > 0) {
    console.error('\n✗ 文案合规检查未通过：\n')
    for (const v of violations) console.error(`  ${v.path}\n    ${v.message}\n`)
    console.error(`共 ${violations.length} 处问题。构建已中止。\n`)
    process.exit(1)
  }

  if (placeholders.length > 0) {
    console.error('\n✗ 检测到未替换的占位符，构建已中止。\n')
    console.error('  占位符是给运营看的内部批注，绝不能进入交付物。')
    console.error('  填入真实值后重新构建即可通过。\n')
    for (const p of placeholders) console.error(`  ${p.path}  →  ${p.message}`)
    console.error('')
    process.exit(1)
  }

  console.log(`✓ 文案合规检查通过（${files.length} 个文案文件 + ${sourceFiles.length} 个源文件，无占位符残留）`)
}

// 仅在被直接执行时运行 main，被 import 时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
