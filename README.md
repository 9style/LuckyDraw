# LuckyDraw · 职场运势互动

一个纯前端的 H5 互动页：填写 4 个字段 → 摇签筒 → 得到一份「职场运势」结果。为线下公益摆摊活动而做，扫码即用。

## 技术栈

Vue 3 + Vite。**无后端、无路由、无状态库、无 UI 组件库、无字体文件**。生产依赖只有 `vue`。

## 快速开始

```bash
npm install
npm run dev      # 开发服务器
npm test         # 172 条单元测试
npm run simulate # 打印四维分数的等级带分布（调权重时用）
npm run build    # 构建（前置合规检查）
```

## 上线前必做

`src/config/settings.json` 里有三个占位符，**必须填成真实值**，否则 `npm run build` 会被合规闸门拦下（这是设计）：

| 字段 | 说明 |
|---|---|
| `donationText` | 捐款去向，开场页展示 |
| `eventName` | 活动名称（仅线下物料用，页面不渲染） |
| `organizer` | 主办方，开场页展示 |

填写后运行 `npm run build`，把新生成的 `dist/` 部署到静态托管即可。

## 设计要点

- **零网络请求**：所有输入仅在浏览器本地处理，不上传、不落库。唯一的持久化数据是一个匿名计数器。
- **结果冻结**：动画结束的那一刻一次性算出全部内容并冻结，此后只读。避免 ±6 随机波动让用户眼前的分数跳动。
- **合规闸门**：`scripts/lint-copy.js` 在构建前扫描全部文案与源码，命中禁用词、超长文案或未填占位符即中止构建。规则集中在 `src/config/lint-rules.json`，可单独修改。
- **配置与逻辑分离**：`src/config/` 下全是纯数据 JSON，运营可直接改文案与权重，无需动代码。

## 目录

```
src/
├── core/      纯函数层（不依赖 Vue、不碰 DOM），单元测试的唯一目标
├── config/    纯数据配置，零逻辑
├── views/     四个阶段：开场页 → 填表页 → 摇签筒 → 结果页
├── components/
└── styles/
scripts/
├── lint-copy.js   构建前合规检查
└── simulate.js    分数分布模拟
docs/superpowers/  设计文档与实现计划
```

## 文档

- `docs/superpowers/specs/` —— 设计文档（架构、打分引擎、文案库结构、海报方案、测试策略）
- `docs/superpowers/plans/` —— 实现计划
