# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

纯前端 H5 互动页（线下公益摆摊用，扫码即用）：填 4 个字段 → 摇签筒 → 出「职场运势」结果。
Vue 3 + Vite，**无后端、无路由、无状态库、无 UI 组件库、无字体文件**，生产依赖只有 `vue`。

## 常用命令

```bash
npm install
npm run dev              # Vite 开发服务器
npm test                 # 全量单测（vitest run，15 个文件）
npm run test:watch       # 监听模式
npx vitest run src/core/fortune.test.js    # 单个测试文件
npx vitest run -t "文案"                    # 按用例名筛选
npm run simulate         # 打印四维分数等级带分布（调 scoring.json 权重后必跑）
npm run build            # 前置合规闸门 lint-copy.js，通过后才 vite build
npm run preview          # 预览 dist/
```

`npm run build` **当前会失败，这是设计**：`src/config/settings.json` 里有 3 个 `【待填写…】` 占位符，
闸门会中止构建并逐条列出。上线前填真实值即可通过。

⚠️ **只认 `npm run build`，不要用 `npx vite build`** —— 后者会跳过闸门。仓库里现有的 `dist/` 正是这么产生的，
占位符字符串已经躺在 `dist/assets/index-*.js` 里。任何要交付的产物都必须走 `npm run build`。

## 架构

### 阶段机与数据流

`src/core/state.js` 定义四个阶段 `STAGES = ['intro', 'form', 'divining', 'result']`，
`App.vue` 用 `<Transition mode="out-in">` 按 `store.stage` 切换四个视图，视图通过 emit 事件触发 `setStage`：

```
IntroView ──start──▶ FormView ──submitted──▶ DivinationView ──done──▶ ResultView
 (开场/捐款说明)   (4 字段校验)         (算定 + ~3s 动画)        (纯只读渲染)
                        │                      │
                   setProfile()           buildReading() 一次算定 → setReading() 冻结
```

**结果冻结**是核心约定：`DivinationView.vue` 在挂载时一次性调 `buildReading(profile, runtimeConfig, makeRng(seed))`
产出全部内容并写入 `store.reading`，此后只读。不要在渲染层重新计算分数或重抽签文 —— 那会让用户眼前的数字跳动。

种子 = `(Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0`，随 reading 一起存（`reading.seed`），用于事后复现。

### 分层

- `src/core/` —— 纯函数层（不依赖 Vue、不碰 DOM），**单元测试的唯一目标**。
  例外：`state.js` 用 `reactive` 且负责持久化，是全项目唯一消费不可信输入的入口。
- `src/config/` —— 纯数据 JSON，零逻辑。运营可直接改文案与权重，无需动代码。
- `src/core/config.js` —— 所有 JSON 的唯一聚合点，导出 `runtimeConfig`；启动时 `checkConfigConsistency()` 只 warn 不抛。
- `src/views/` `src/components/` —— 只渲染，不承载业务逻辑。

### 会话持久化

- `sessionStorage['ld_session']` 存 stage/profile/reading/unlocked，刷新可回到结果页。
- `localStorage['ld_count']` 是匿名访问计数（受 `settings.enableCount` 开关控制）。
- `state.js#restore()` 按「视图实际解引用的字段」逐项校验形状，**不通过就清会话回开场页**，不做部分恢复。
  新增 reading 字段若被视图解引用，必须同步加进 `isUsableReading`。
  恢复时把 `divining` 归一化成 `result`。
- 每个 setter（`setStage` / `setProfile` / `setReading` / `unlock`）都立刻 `persist()`。
  **新增 store 字段必须同步加进 `persist()`**，否则刷新即静默丢失。
- `restore()` **不累加 `ld_count`** —— 计数只发生在 `DivinationView`。恢复直接进结果页，不该二次计数。
- 两个 key 不可互换：`ld_session` 用 sessionStorage 是刻意的，隔天重新扫码不该白嫖到已解锁状态。

## 配置驱动（改文案 / 加部门 / 加维度）

**所有面向用户的文案都在 `src/config/` 的 JSON 里，不要硬编码进组件。**
刻意例外只有三处：`Disclaimer.vue` 的 `TEXT`（逐字装着 PRD 8.3 的免责声明）、
`fortune.js` 的 `FALLBACK_FORTUNE`（空签池兜底，纯函数拿不到整个 config）、
`FormView.vue`（整屏静态标签「报上名来」「入职多久了」等都是就地硬编码的）。
这三处都在 `lint-copy.js` 的扫描面内（`.vue` 全文 + `src/` 下的非测试 `.js`），
所以硬编码不等于免责 —— 照样过**禁用词**检查（剥注释、去空白后匹配）。
但**长度不查**：60 字上限住在 `lintText` 里，只作用于 JSON 文案；
硬编码的 `.vue`/`.js` 文案没有任何长度守卫（`lintSource` 只匹配禁用词）。
所以往组件里塞长句时，「没过 lint 就是没问题」这个推断是不成立的。

`copyEngine.interpolate` 用 `{key}` 占位替换，vars 由 `buildReading` 组装（`name/dept/zodiac/tenure`）。
未知 key 原样保留，方便运营发现拼写错误。

**加一个部门要动 5 处**（`checkConfigConsistency()` + `copyLibrary.test.js` 会查）：
`departments.json`（含 `keywords`）、`scoring.json#deptBonus`、`copy/department.json`、
`copy/identity.json`（`dept` 字段）、以及 `copyLibrary.test.js` 顶部硬编码的 `DEPT_KEYS`。

**加一个维度**要动 `scoring.json` 的 `dimensions` / `dimensionLabels` / `zodiacBase` / `tenureBonus` / `deptBonus`
以及 `copy/scores.json`。

`copyLibrary.test.js` 硬断言了文案数量（24 支签、40 条身份、12 星座 × 3 条吐槽、彩蛋池 12/9/8/12 等），
改文案 JSON 时数量对不上会直接挂测试。

### 部门是自由输入（不是下拉框）

用户在 `FormView` 手打部门（「搞算法的」「大区销售」），提交时由 `config.js#matchDept`
**一次性**归到 6 大类之一：归一化（去空白与标点、转小写）→ **最长关键词命中**（等长按配置顺序）
→ 兜底 `other`。结果分两处存：

```
profile.dept     = 'tech'        ← 归一后的 key，喂下游
profile.deptText = '搞算法的'     ← 用户原文，**只用于结果页展示**
```

⚠️ **下游三处（`scoring.deptBonus`、`copy/department.json` 吐槽池、`copy/identity.json` 的
`dept` 过滤）只认 `dept` 这个 key，不要把任何一处改成读原文。** 保持这条边界，
`scoring.js` / `fortune.js` / 抽签逻辑就永远不用知道输入框的事。

关键词表在 `departments.json#keywords`：**每类必须非空、且不跨类重复**（两条都有测试钉住）。
某类关键词表空了 → 该类永远匹配不上任何人 → 用户全被兜到 `other`，专属吐槽与身份标签永不出现，
而页面一切正常 —— 是静默失效，所以 `checkConfigConsistency()` 会 warn。

`deptText` 是可选的：改版前存下的会话里没有它，`restore()` 必须仍然放行（`vars.dept` 退回规范名）。

## 合规闸门（重要）

`scripts/lint-copy.js` 挂在 `npm run build` 前置，命中即 `exit 1`、构建中止。三类红线：

1. **禁用词** —— 清单在 `src/config/lint-rules.json#banned`（算命、占卜、改运、命理、失业、被裁、生病、死亡…）。
2. **单条文案 > 60 字**（`lint-rules.json#maxLength`，按原始文本计，空格算数）。
3. **未替换的占位符** `【待填写`。

扫描面不只是 JSON：还包括 `src/` 下**全部 `.vue` 与所有非 `.test.js` 的 `.js`**（`.test.js` 被排除，
因为 `config.test.js` 把禁用词表本身当测试数据）。匹配前会**剥掉注释**（所以注释里写「占卜」不会误报）
并**去掉所有空白**（所以 `占 卜`、`开 始 占 卜` 这种字间距写法照样会被抓）。

规则的单一来源是 `src/config/lint-rules.json` —— `copyLibrary.test.js` 读同一份文件，不要在两处各写一遍。
清单共 23 条（9 条迷信类 + 14 条负面预言类）。计划文档里那句「例外：`工位风水` 允许」**已作废** ——
配置里根本没有 `allowedPhrases` 这一项，以 `lint-rules.json` 为准。

`scripts/lint-copy.js --root=<dir>` 是唯一的命令行开关，只为让测试能在临时目录里跑真实 CLI。

## 打分模型

四维：`moYu` / `shengZhi` / `renMai` / `caiYun`。
`score = clamp(round(zodiacBase + tenureBonus + deptBonus + jitter(±6)), 0, 100)`
带位：`wei ≤39` / `ping ≤59` / `ji ≤79` / `daji ≤100`。

**公平性不变量**：每个星座的四维基础值之和恰好 280（均分 70），这是 spec §6.3 的硬要求，
也是 PRD §8.4「不歧视」保证的算术形式。**任何改动都必须保住每个星座的和 = 280。**
副作用是**四维均分的可达区间极窄**（实测 64.00 ~ 83.00，均值 73.21）—— 这是下面签文阈值那段的全部前提。

加成之和**刻意不为 0**（tenure：lt1 0 / 1to3 +6 / 3to5 +9 / gt5 +15；dept：other 0 / tech +2 / product +6 / ops +4 / admin +8 / market +13），
所以结果整体偏高 —— 实测 10,000 画像 × 4 维（seed 20260913）为 wei 0.92% / ping 13.20% / ji 54.03% / daji 31.85%。
这个偏斜是产品上接受的，**别当 bug 去「修正」**。（设计文档里写的 25~100 与 3/26/52/19 都不符合实况。）

**别按 spec 原稿的 80/60 阈值改 `fortune.js#BIAS_TIERS`**：那是错的 —— 60 低于可达最小值（死代码），
80 只在 0.32% 的抽取中触发。现行 77/70/0 是对 8,225,568 次穷尽抽取实测后重标定的（占比 7.41% / 83.13% / 9.46%）。
**改动 `scoring.json` 的 `jitter` 或任何加成幅度后，必须重跑测量并重标定这三档**，否则又会退化成某档永不触发。
统计占比时要用**未取整**的均分（`avg 76.9` 属基准档、`77.0` 才进高档）。

签文六档 `上上签/大吉/中吉/小吉/平/小凶`（**绝不出现「大凶」**），权重 = `BASE_WEIGHT × biasFor(avg)`。
`npm run simulate` 会打印分布并在某档不可达时告警。

## 随机数与可复现性

`makeRng` 是 xorshift32，种子先经 `splitmix32` 混淆 —— **混这一步不可省**：不混淆时相邻小整数种子的首个输出
几乎线性递增，会让 `intBetween` 恒返回下界、`weightedPick` 恒选第一项，所有按计数器取种子的测试都会崩。

⚠️ `pickMany(rng, arr, n)` **固定消耗 `arr.length - 1` 个随机数，与 n 无关**。
所以它与 `pickOne` 在同一条种子流里不可互换；改动任一模块级配置数组的**长度**，其后所有抽取都会整体位移。
测试里有依赖精确序列的断言。

## 测试约定

- 环境是 `environment: 'node'` —— **没有 jsdom，组件不被测试**，只有 `src/core/` 的纯函数 + `scripts/lint-copy.js` 被测。
- `vite.config.js` 里 `pool: 'forks'` + `singleFork: true` 是**刻意**的：默认 threads 池在 Windows 上会争用
  vitest 自己的 `%TEMP%` 模块缓存，触发 `EBUSY` 假失败（实测 12 次跑 2 次假失败）。不要改回去。
- 用例名与注释均为中文，描述「为什么」而非「是什么」。
- 计划要求每个任务按 TDD 走：先写失败测试、确认失败信息符合预期，再实现。
  其中有几组用例是**回归护栏**（`drawFortune` 的档位过滤、种子混淆、空白压缩、危档可达、占位符阻断），
  它们守的是曾经差点被删掉的代码路径，**不要当成冗余断言清理掉**。
- `scripts/lint-copy.test.js` 真的 fork 子进程跑 CLI（`--root=` 指向临时目录）来断言退出码，
  而不是断言源码文本。

## 其他容易踩的点

- **动画时长在两处重复定义**：`DivinationView.vue` 的 `SHAKE_MS = 1500` / `DRAW_MS = 1050`
  与 `animation.css` 的 `.tube--shaking` `0.42s`（单次周期）/ `.stick--drawn` `1.05s`。
  没有共享 token，改一处必须改另一处。`prefers-reduced-motion` 有单独分支。
- **布局约定**：`#app` 是 flex 纵向容器且带四边安全区内边距，子元素一律用 `flex: 1` 填充，
  **绝不再各自声明 `100vh`**（否则刘海屏上会多出滚动、垂直居中偏心）。
- 深色主题下原生 `<select>` 在 Windows Chrome 会忽略 CSS `color`，必须 `appearance: none` 才生效，
  代价是要自绘下拉箭头（见 `FormView.vue`）。
- `validators.js` 的汉字范围用 CJK 扩展 A + 基本区全段（`㐀-䶿一-鿿`），
  不是老旧的 `一-龥` —— 后者会拒掉扩展 A 的生僻字姓名，现场直接卡死。
- `src/config/settings.json#passcode` 是明文进前端产物的（无后端，口令只能这么校验）。
- **全程不用 `innerHTML`**：DOM 走 Vue 的 `{{ }}` 自动转义，未来的海报走 canvas `fillText`。
  预设文案只做字符串插值，从不解析 HTML。
- **不要硬编码「职场算命」**：页面标题一律走 `settings.json#displayTitle`（默认「职场运势互动」）。
  「职场算命」只允许出现在线下物料、文档、目录名和代码注释里。
- **没有 Service Worker**：断网后**刷新**会失败（只有已经加载过的页面能撑过断网）。
  这是刻意的范围决策（SW 自带缓存版本失效这类问题，留给计划二），别顺手「修」掉。
- **尚未接线的预留脚手架**：`settings.passcode` / `settings.posterBaseUrl` / `copy/ui.json#lock` /
  `store.unlocked` + `unlock()` / `ScoreRadar` 的 `focused` prop / `ScoreBars` 的 `locked` prop /
  `ui.divining.loading` —— 这些都是为「锁定的天命海报」流程预留的，当前没有任何视图消费。
  同理 `copy/scores.json`（四维 × 四档文案）已被测试校验但尚未被 `ResultView` 渲染。

## 文档

- `docs/superpowers/specs/2026-09-13-职场算命-design.md` —— 设计文档（架构、打分引擎、文案库结构、海报方案、测试策略）
- `docs/superpowers/plans/2026-09-13-职场算命-计划一-核心引擎与主链路.md` —— 计划一实现计划

⚠️ 计划文档里有几条**已知过时**，不要照做：

- Global Constraints 里的「本项目不使用版本控制：不要执行 `git init`/`git add`/`git commit`，也不要创建 `.gitignore`」
  —— 仓库事实上已是 git 仓库且已有 `.gitignore`。涉及 git 的操作先与用户确认。
- 「例外：`工位风水` 允许」—— 见上文合规闸门一节。
- Task 18 记录的状态是「不可上线」（占位符未填），且当时的 `dist/` 是绕过闸门构建的。
- **口令解锁 / 锁定蒙层**属于**计划二**，尚未编写也尚未实现（树里没有 `PasscodeGate`、`LockedMask`）。
  `poster` 不是阶段，`unlocked` 是独立的布尔量，不是 `store.stage` 的取值。
- **海报已是实现**（计划二的第一部分，分支 `feat/share-poster`）：`src/config/poster.json`（版式与配色）、
  `src/core/poster/*`（`measure` 测量与降档 / `layout` 元素流 / `draw` canvas 原语 / `poster` 编排与导出 /
  `clipboard` 复制降级）、`src/components/PosterModal.vue`（结果页浮层、长按或下载）、
  `src/views/DebugPoster.vue`（`?debug=poster`，仅 dev 的视觉验收页）。
  海报画布 750×1334，导出 PNG、超 1.2MB 转 JPEG。
  ⚠️ 海报文案的**容量**由 `copyLibrary.test.js` 的「海报版式容量」一节守卫：改 `copy/identity.json`、
  `copy/fortunes.json` 或 `scoring.json#dimensionLabels` 可能让内容装不进版式，改错了当场报错。
  但这条守卫**只管这三处**。`copy/ui.json#poster.*`（subtitle / scanHint / disclaimer）与
  `settings.json#displayTitle` 是画在版式上、却没有任何容量断言的裸奔文案 —— 它们按声明字号直绘、
  不降档，免责声明折行也没有行数上限。往这几处塞长句，测试不会红，海报上会压字。
  （`name` 不在其中：`validators.js#NAME_MAX = 8` 已在输入口封顶，8 个全角字在声明字号下 512px < 620px 带宽。）
