// src/core/poster/poster.js
import { computeLayout } from './layout.js'
import { fitFontSize, wrapText } from './measure.js'
import { roundRect, drawStarfield, drawRadar } from './draw.js'
import { makeRng } from '../rng.js'

/** 星点种子写死：进出海报页时星空必须一模一样，否则观感如「图片在闪」。 */
export const STAR_SEED = 20260913

/** PNG dataURL 超过这个长度就改用 JPEG 0.92（深色渐变 + 星点 PNG 压不动）。 */
export const PNG_LIMIT = 1_200_000

export function shouldUseJpeg(dataUrl, limit = PNG_LIMIT) {
  return String(dataUrl).length > limit
}

const FONT_STACK = '"PingFang SC", "HarmonyOS Sans", "Microsoft YaHei", sans-serif'

/**
 * 组装海报上要画的全部文案。
 *
 * ⚠️ 一律从**冻结的 reading** 取，不重算任何东西 —— 海报上的分数与签文
 * 必须与用户屏幕上看到的一字不差。
 * 每个字段都兜底成空串：`String(undefined)` 会把字面量 "undefined" 画到海报上。
 */
export function buildVars(reading, cfg) {
  const { settings, scoring, copy } = cfg
  const r = reading ?? {}
  const vars = r.vars ?? {}
  const dims = scoring.dimensions
  const labels = scoring.dimensionLabels
  const scores = r.scores ?? {}

  return {
    title: settings.displayTitle ?? '',
    subtitle: copy.ui.poster?.subtitle ?? '打工人能量图鉴',
    name: vars.name ?? '',
    dept: vars.dept ?? '',
    identity: r.identity?.text ?? '',
    scoreRow: dims.map((d) => `${labels[d] ?? ''} ${scores[d] ?? 0}`).join('  ·  '),
    fortuneLevel: r.fortune?.level ?? '',
    fortuneVerse: r.fortune?.verse ?? '',
    fortuneYi: r.fortune?.yi ?? '',
    fortuneJi: r.fortune?.ji ?? '',
    scanHint: copy.ui.poster?.scanHint ?? '扫码算你的职场运势',
    disclaimer: copy.ui.poster?.disclaimer ?? ''
  }
}

/**
 * 绘制整张海报。
 *
 * 调用方提供一个已存在的 canvas 与一个**已加载完成**的二维码图片 ——
 * 图片没加载完就 drawImage 会画出一块空白（这正是设计文档列给 html2canvas 的坑，
 * 用 canvas 同样躲不掉）。
 *
 * 返回 { dataURL, format, layout }；format 为 'png' 或 'jpeg'。
 */
export function renderPoster({ reading, cfg, canvas, qrImage }) {
  const { canvas: geo, palette, boxes } = computeLayout(cfg.poster)
  canvas.width = geo.w
  canvas.height = geo.h
  const ctx = canvas.getContext('2d')
  const vars = buildVars(reading, cfg)
  const byKey = Object.fromEntries(boxes.map((b) => [b.key, b]))
  const cx = geo.w / 2
  // 维度 key、翻译名、分数按**同一顺序**排好后交给绘制函数 ——
  // 不让 drawRadar 去猜对象键序（那是隐式契约，改一处配置就会静默错位）
  const dimKeys = cfg.scoring.dimensions
  const dimLabels = dimKeys.map((d) => cfg.scoring.dimensionLabels[d] ?? d)
  const dimValues = dimKeys.map((d) => reading?.scores?.[d] ?? 0)

  // 背景：深色径向渐变 + 固定种子的星点
  const bg = ctx.createRadialGradient(cx, 0, 0, cx, geo.h * 0.45, geo.h * 0.75)
  bg.addColorStop(0, palette.bgSoft)
  bg.addColorStop(0.45, palette.bgMid)
  bg.addColorStop(1, palette.bgDeep)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, geo.w, geo.h)
  drawStarfield(ctx, geo.w, geo.h, makeRng(STAR_SEED))

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // 帮助函数：水平居中 + 垂直在盒子中线
  const drawCenter = (text, box, fontSize, color) => {
    ctx.fillStyle = palette[color] ?? color
    ctx.font = `${fontSize}px ${FONT_STACK}`
    ctx.fillText(text, cx, box.y + box.h / 2)
  }

  // 标题 / 副标题
  drawCenter(vars.title, byKey.title, byKey.title.font, byKey.title.color)
  drawCenter(vars.subtitle, byKey.subtitle, byKey.subtitle.font, byKey.subtitle.color)

  // 姓名：测量驱动降档（不用按字数分档 —— 对非英文/长英文名会误伤）
  const nameBox = byKey.name
  const nameFont = fitFontSize(vars.name, nameBox.maxWidth, {
    max: nameBox.font, min: nameBox.minFont
  }, (t, px) => measureWithCtx(ctx, t, px))
  drawCenter(vars.name, nameBox, nameFont, nameBox.color)

  // 身份标签：烫金描边圆角卡
  const idBox = byKey.identity
  roundRect(ctx, cx - idBox.maxWidth / 2, idBox.y, idBox.maxWidth, idBox.h, 16)
  ctx.fillStyle = palette.cardBg
  ctx.fill()
  ctx.strokeStyle = palette.cardLine
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = palette[idBox.color] ?? idBox.color
  ctx.font = `${idBox.font}px ${FONT_STACK}`
  ctx.fillText(vars.identity, cx, idBox.y + idBox.h / 2)

  // 雷达图。⚠️ 传的是 dimLabels（「摸鱼指数」）而不是 'moYu'
  const radarBox = byKey.radar
  drawRadar(ctx, cx, radarBox.y + radarBox.h / 2, radarBox.h / 2 - 30,
    dimValues, dimLabels, palette)

  // 四维数值行 / 签文 / 二维码 / 引导 / 免责
  drawCenter(vars.scoreRow, byKey.scoreRow, byKey.scoreRow.font, byKey.scoreRow.color)

  const fBox = byKey.fortune
  roundRect(ctx, cx - fBox.maxWidth / 2, fBox.y, fBox.maxWidth, fBox.h, 16)
  ctx.fillStyle = palette.cardBg
  ctx.fill()
  ctx.strokeStyle = palette.cardLine
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = palette.gold
  ctx.font = `${fBox.font}px ${FONT_STACK}`
  ctx.fillText(vars.fortuneLevel, cx, fBox.y + 42)
  drawWrapped(ctx, vars.fortuneVerse, cx, fBox.y + 96, fBox.maxWidth, 24, palette.textMain)
  drawWrapped(ctx, `宜 ${vars.fortuneYi}    忌 ${vars.fortuneJi}`, cx, fBox.y + fBox.h - 44,
    fBox.maxWidth, 18, palette.textSub)

  // 二维码：画得比白卡小，用卡片留白补足静默区（原图白边只有约 2 个模块，规范要 4）
  const qBox = byKey.qrcode
  const cardSize = qBox.h
  roundRect(ctx, cx - cardSize / 2, qBox.y, cardSize, cardSize, 12)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  if (qrImage) {
    const inner = cardSize * (116 / 140)
    ctx.drawImage(qrImage, cx - inner / 2, qBox.y + (cardSize - inner) / 2, inner, inner)
  }

  drawCenter(vars.scanHint, byKey.scanHint, byKey.scanHint.font, byKey.scanHint.color)
  drawWrapped(ctx, vars.disclaimer, cx, byKey.disclaimer.y + 12, byKey.disclaimer.maxWidth, 16,
    palette.textDim)

  // 导出：PNG 优先，超限改 JPEG（海报不透明，不丢透明通道）
  let dataURL = canvas.toDataURL('image/png')
  let format = 'png'
  if (shouldUseJpeg(dataURL)) {
    dataURL = canvas.toDataURL('image/jpeg', 0.92)
    format = 'jpeg'
  }
  return { dataURL, format, layout: { geo, boxes } }
}

/** 用真实 canvas 上下文测量 —— 真机字宽与估算器必然不同，这里必须用真值。 */
function measureWithCtx(ctx, text, fontPx) {
  const prev = ctx.font
  ctx.font = `${fontPx}px ${FONT_STACK}`
  const w = ctx.measureText(text).width
  ctx.font = prev
  return w
}

/** 居中折行绘制，返回实际占用的行数。 */
function drawWrapped(ctx, text, cx, top, maxWidth, fontPx, color) {
  if (!text) return 0
  const lines = wrapText(text, maxWidth, fontPx, (t, px) => measureWithCtx(ctx, t, px))
  ctx.fillStyle = color
  ctx.font = `${fontPx}px ${FONT_STACK}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((l, i) => ctx.fillText(l, cx, top + i * (fontPx * 1.5)))
  return lines.length
}
