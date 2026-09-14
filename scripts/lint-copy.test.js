// scripts/lint-copy.test.js
import { describe, it, expect } from 'vitest'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { lintText, lintObject, findPlaceholders, lintSource, stripComments } from './lint-copy.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('lintText', () => {
  it('干净文案返回空数组', () => {
    expect(lintText('今天宜早退，忌开会。')).toEqual([])
  })

  it('命中负面预言词', () => {
    expect(lintText('小心破财').length).toBe(1)
    expect(lintText('当心被裁').length).toBe(1)
  })

  it('命中迷信话术词', () => {
    expect(lintText('今日占卜结果').length).toBe(1)
    expect(lintText('可以改运').length).toBe(1)
  })

  it('命中去空白后才显形的禁用词（JSON 路径同样必须压缩空白）', () => {
    // 这是本任务最重要的回归保护之一。字间距在本项目里是通用约定
    // （`填 4 个空，摇一支签`、`解 锁`），不只在模板里 —— 只压缩模板路径，
    // 会让承载绝大多数用户可见文案的 JSON 路径留一条逃逸通道。
    expect(lintText('占 卜').length).toBe(1)
    expect(lintText('今 日 破 财').length).toBe(1)
    expect(lintText('开 始 占 卜').length).toBe(1)
  })

  it('长度按原始文本计，不因压缩空白而放宽', () => {
    // 60 个字符里含空格时仍算 60 字 —— 空格确实占版面
    const withSpaces = '字 '.repeat(30) + '字' // 61 个字符
    expect(lintText(withSpaces).some((m) => m.includes('60'))).toBe(true)
  })

  it('超过 60 字报错', () => {
    const long = '字'.repeat(61)
    expect(lintText(long).some((m) => m.includes('60'))).toBe(true)
  })

  it('恰好 60 字不报错', () => {
    expect(lintText('字'.repeat(60))).toEqual([])
  })

  it('非字符串输入安全跳过', () => {
    expect(lintText(123)).toEqual([])
    expect(lintText(null)).toEqual([])
  })
})

describe('lintObject', () => {
  it('递归检查嵌套对象与数组，并给出路径', () => {
    const obj = { a: { b: ['干净', '这里破财了'] } }
    const issues = lintObject(obj, 'root')
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toContain('root.a.b[1]')
  })

  it('全部干净时返回空数组', () => {
    expect(lintObject({ a: ['好的', '也好'] }, 'root')).toEqual([])
  })
})

describe('findPlaceholders', () => {
  it('找出含【待填写 的字符串', () => {
    expect(findPlaceholders({ a: '【待填写：项目名】' }, 'root')).toHaveLength(1)
  })

  it('无占位符返回空', () => {
    expect(findPlaceholders({ a: '正常文案' }, 'root')).toEqual([])
  })
})

describe('stripComments', () => {
  it('剥掉行注释、块注释、HTML 注释', () => {
    expect(stripComments('a // 占卜\nb')).toBe('a \nb')
    expect(stripComments('a /* 占卜 */ b')).toBe('a  b')
    expect(stripComments('<p>好的</p><!-- 占卜 -->')).toBe('<p>好的</p>')
    expect(stripComments('<!-- 多行\n占卜\n-->剩下')).toBe('剩下')
  })

  it('字符串里的注释记号不被剥（`//` 出现在 URL 里是常见情形）', () => {
    // 否则 'https://example.com' 会被从 // 处截断，后续文本拼接错位
    expect(stripComments("const u = 'https://example.com/x'")).toBe("const u = 'https://example.com/x'")
    expect(stripComments('const u = "a // b"')).toBe('const u = "a // b"')
  })

  it('字符串里的转义引号不会提前关闭字符串状态', () => {
    expect(stripComments("const q = 'it\\'s' // 占卜")).toBe("const q = 'it\\'s' ")
  })

  it('未闭合的块注释 / HTML 注释直接吃到文件末尾', () => {
    expect(stripComments('a /* 占卜')).toBe('a ')
    expect(stripComments('a <!-- 占卜')).toBe('a ')
  })
})

describe('lintSource（整个源文件：`.vue` 全文 + 非测试 `.js`）', () => {
  it('捕获模板里被字间距拆开的禁用词', () => {
    // 这是子串式合规检查的经典逃逸路径：模板用字面空格实现字间距，
    // 源码里不含连续子串「占卜」，但用户读到的就是「开始占卜」。
    const raw = '<template><button>开 始 占 卜</button></template>'
    expect(lintSource(raw).length).toBe(1)
    expect(lintSource(raw)[0].message).toContain('占卜')
  })

  it('捕获未加空格的禁用词', () => {
    expect(lintSource('<template><p>今日占卜结果</p></template>').length).toBe(1)
  })

  it('捕获 `<script setup>` 里的字面量文案（本轮扩展的扫描面）', () => {
    // 此前只扫 `<template>` 块，`<script setup>` 里的中文字符串整块在边界之外。
    // Disclaimer.vue 就是这种形状：免责声明逐字写在 script 的常量里。
    const raw = [
      '<script setup>',
      "const TEXT = '本页面为纯娱乐互动，可以改运。'",
      '</script>',
      '<template><p>{{ TEXT }}</p></template>'
    ].join('\n')
    expect(lintSource(raw).length).toBe(1)
    expect(lintSource(raw)[0].message).toContain('改运')
  })

  it('捕获 `src/` 下 `.js` 里的中文字符串（另一块新增扫描面）', () => {
    const raw = "export const hint = '今日占卜结果仅供娱乐'"
    expect(lintSource(raw, 'src/core/x.js').length).toBe(1)
  })

  it('注释里的禁用词**不得**被捕获（禁用词治理的是面向用户的文案）', () => {
    // 真实案例：src/core/rng.js 的注释里写着「同一次占卜」，
    // 它是给维护者看的说明，页面上永远不会出现。不剥注释就会误报。
    expect(lintSource('// 用于让「同一次占卜」的结果可复现', 'src/core/rng.js')).toEqual([])
    expect(lintSource('/* 这里是占卜的说明 */\nconst a = 1', 'src/core/x.js')).toEqual([])
    expect(lintSource('<script setup>\n// 免责声明示例：可以改运\n</script>', 'src/x.vue')).toEqual([])
    expect(lintSource('<template><!-- 占卜 --><p>好的</p></template>', 'src/x.vue')).toEqual([])
  })

  it('注释里的禁用词被剥掉，但同一文件里的真文案仍会被捕获', () => {
    const raw = '// 占卜说明\nconst t = "可以改运"'
    const issues = lintSource(raw, 'src/x.js')
    expect(issues.length).toBe(1)
    expect(issues[0].message).toContain('改运')
  })

  it('正常源码文案不报错', () => {
    expect(lintSource('<template><button>开 始 摇 签</button></template>')).toEqual([])
    // 注意：这里**不**断言「工位风水」被豁免 —— 它本来就不含禁用词，
    // 断言它会永远通过，属于假验证（此前确有此问题）。
    expect(lintSource('<template><p>工位风水研究员</p></template>')).toEqual([])
  })

  it('路径会带进问题描述', () => {
    const issues = lintSource('<template><p>占卜</p></template>', 'src/views/X.vue')
    expect(issues[0].path).toBe('src/views/X.vue')
  })
})

describe('构建接线与闸门阻断（端到端）', () => {
  it('package.json 的 build 脚本以 && 串联 linter 与打包', () => {
    // 这是整套合规机制的**单点**：若 build 不再调用 linter，所有检查都会
    // 静默失效，而本文件其余测试**一条都不会红** —— 它们测的是纯函数，
    // 不是「闸门是否接在构建上」。这一条就是为那个单点立的。
    //
    // 变异验证：把 package.json 的 build 改回 `"vite build"`，本测试必须失败。
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.scripts.build).toMatch(/lint-copy\.js\s*&&\s*vite build/)
  })

  it('四种情形各自的退出码正确（真跑子进程，不靠断言源码文本）', () => {
    // 为什么要真跑：`lintText` 返回问题数组 ≠ 进程以非零码退出，
    // 而「违规时阻断构建」正是本脚本存在的全部意义。
    //
    // 为什么不用源码文本断言：先前试过「数 process.exit(1) 出现次数 >= 2」，
    // 但文件里有 **3** 处 exit，把违规分支改成 exit(0) 后仍剩 2 处、照样通过 ——
    // 计数下限无法指出是哪一条分支被改。而带字符偏移的「有界窗口」断言会随
    // 无关格式调整误报。两者都不如直接跑一次。
    const tmp = mkdtempSync(join(tmpdir(), 'lint-copy-'))
    const run = () => {
      try {
        execFileSync(process.execPath, [join(ROOT, 'scripts', 'lint-copy.js'), `--root=${tmp}`], { stdio: 'pipe' })
        return 0
      } catch (e) {
        return e.status ?? -1
      }
    }
    const writeSettings = (donationText) =>
      writeFileSync(join(tmp, 'src/config/settings.json'), JSON.stringify({ passcode: 'x', donationText }))

    try {
      mkdirSync(join(tmp, 'src/config/copy'), { recursive: true })
      mkdirSync(join(tmp, 'src/views'), { recursive: true })
      writeFileSync(
        join(tmp, 'src/config/lint-rules.json'),
        JSON.stringify({ maxLength: 60, banned: ['破财', '占卜'], placeholderMark: '【待填写' })
      )
      // 空的 copy 目录不是「干净项目」，而是**退化**项目：linter 对「一个文案 json 都没有」
      // 有专门的兜底分支（防止扫描范围被清空后静默放行），会直接 exit(1)。
      // 所以干净场景必须真的放一条干净文案，才与真实仓库同构 —— 否则 ① 会因这条
      // 与合规无关的兜底而变红，正是「因无关原因失败」的那种坏测试。
      writeFileSync(join(tmp, 'src/config/copy/ui.json'), JSON.stringify({ a: '正常文案' }))

      // ① 干净 → 退出 0
      writeSettings('本次筹款将捐至儿童助学项目')
      expect(run()).toBe(0)

      // ② 存在未填占位符 → 非零（这正是从警告升级为阻断的那个行为）
      writeSettings('【待填写：公益项目】')
      expect(run()).not.toBe(0)

      // ③ JSON 文案命中禁用词 → 非零
      writeSettings('本次筹款将捐至儿童助学项目')
      writeFileSync(join(tmp, 'src/config/copy/ui.json'), JSON.stringify({ a: '今天宜破财' }))
      expect(run()).not.toBe(0)

      // ④ 模板里命中被字间距拆开的禁用词 → 非零
      writeFileSync(join(tmp, 'src/config/copy/ui.json'), JSON.stringify({ a: '正常文案' }))
      writeFileSync(join(tmp, 'src/views/X.vue'), '<template><button>开 始 占 卜</button></template>')
      expect(run()).not.toBe(0)

      // ⑤ `.vue` 的 `<script setup>` 里命中禁用词 → 非零
      // （此前只扫 `<template>` 块，这块整段在扫描面之外）
      writeFileSync(
        join(tmp, 'src/views/X.vue'),
        '<script setup>\nconst t = "今日占卜结果"\n</script>\n<template><p>{{ t }}</p></template>'
      )
      expect(run()).not.toBe(0)

      // ⑥ 同一个词只出现在注释里 → 退出 0（注释不面向用户，不得误报）
      writeFileSync(
        join(tmp, 'src/views/X.vue'),
        '<script setup>\n// 说明：页面上不要说「占卜」\nconst t = "好的"\n</script>\n<template><p>{{ t }}</p></template>'
      )
      expect(run()).toBe(0)

      // ⑦ `src/` 下的非测试 `.js` 里命中禁用词 → 非零（本轮新增的第二块扫描面）
      writeFileSync(join(tmp, 'src/views/X.vue'), '<template><p>好的</p></template>')
      mkdirSync(join(tmp, 'src/core'), { recursive: true })
      writeFileSync(join(tmp, 'src/core/helper.js'), "export const t = '今日占卜'")
      expect(run()).not.toBe(0)

      // ⑧ `*.test.js` 被排除在外 → 退出 0
      // （src/core/config.test.js 把禁用词表本身当测试数据硬编码，那是测试必需品）
      writeFileSync(join(tmp, 'src/core/helper.js'), "export const t = '好的'")
      writeFileSync(join(tmp, 'src/core/helper.test.js'), "const banned = ['占卜']")
      expect(run()).toBe(0)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
