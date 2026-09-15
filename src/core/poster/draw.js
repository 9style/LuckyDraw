// src/core/poster/draw.js
import { intBetween } from '../rng.js'

/**
 * 自写圆角矩形路径。
 * 不用 ctx.roundRect：它要 Chrome 99+ / Safari 16+，微信 XWeb 内核版本不可控。
 * 这里只建路径，填充/描边由调用方决定。
 */
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  ctx.lineTo(x + rr, y + h)
  ctx.arcTo(x, y + h, x, y + h - rr, rr)
  ctx.lineTo(x, y + rr)
  ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}

/**
 * 星点坐标。**纯函数**，随机源由外部传入 —— 这样固定种子才可复现，
 * 否则用户从海报页返回再进入时星空会重排，观感如「图片在闪」。
 */
export function starPoints(w, h, count, rng) {
  const out = []
  for (let i = 0; i < count; i++) {
    out.push({
      x: intBetween(rng, 0, w),
      y: intBetween(rng, 0, h),
      r: 0.6 + rng() * 1.6,
      a: 0.25 + rng() * 0.55
    })
  }
  return out
}

/**
 * 雷达图顶点。**纯函数**。
 * 角度约定与结果页 ScoreRadar 一致：第一个维度在正上方（-90°），顺时针排列。
 */
export function radarPoints(cx, cy, radius, values, max) {
  return values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2
    const ratio = max > 0 ? Math.max(0, Math.min(1, v / max)) : 0
    return {
      x: cx + Math.cos(angle) * radius * ratio,
      y: cy + Math.sin(angle) * radius * ratio
    }
  })
}

export function drawStarfield(ctx, w, h, rng, count = 90) {
  for (const s of starPoints(w, h, count, rng)) {
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${s.a.toFixed(3)})`
    ctx.fill()
  }
}

/**
 * 画雷达图：网格环 → 轴线 → 数据多边形 → 顶点 → 维度标签。
 *
 * `values` 与 `labels` 都必须是**已经按维度顺序排好的数组** —— 让调用方负责
 * 「哪个分数配哪个名字」，这里就不必猜对象的键序（`Object.values` 的顺序
 * 依赖属性定义顺序，是个隐式契约，改一处配置就会静默错位）。
 */
export function drawRadar(ctx, cx, cy, radius, values, labels, palette) {
  // 网格环
  ctx.strokeStyle = palette.cardLine
  ctx.lineWidth = 1
  for (const ratio of [0.25, 0.5, 0.75, 1]) {
    const ring = radarPoints(cx, cy, radius * ratio, values.map(() => 1), 1)
    ctx.beginPath()
    ring.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    ctx.closePath()
    ctx.stroke()
  }

  // 轴线
  for (const p of radarPoints(cx, cy, radius, values.map(() => 1), 1)) {
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  // 数据多边形
  const poly = radarPoints(cx, cy, radius, values, 100)
  ctx.beginPath()
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath()
  ctx.fillStyle = 'rgba(232,192,116,0.28)'
  ctx.fill()
  ctx.strokeStyle = palette.gold
  ctx.lineWidth = 2
  ctx.stroke()

  // 顶点
  ctx.fillStyle = palette.goldBright
  for (const p of poly) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // 维度标签（放在 1.26 倍半径处，避免压住数据多边形）
  ctx.fillStyle = palette.textSub
  ctx.font = '20px "PingFang SC", "HarmonyOS Sans", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const labelPos = radarPoints(cx, cy, radius * 1.26, values.map(() => 1), 1)
  labels.forEach((text, i) => ctx.fillText(text, labelPos[i].x, labelPos[i].y))
}
