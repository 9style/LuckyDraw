// src/core/poster/layout.js

/** 海报必需的元素，顺序即绘制顺序。 */
export const REQUIRED_KEYS = [
  'title', 'subtitle', 'name', 'identity',
  'radar', 'scoreRow', 'fortune', 'qrcode', 'scanHint', 'disclaimer'
]

/**
 * 把 poster.json 的**元素流**求值为带绝对 y 的盒子列表。
 *
 * 为什么不用绝对 y：设计文档 §10.2 用的是绝对坐标，结果排到 1328、底部只剩 6px，
 * 违反它自己写的「底部保留 ≥16px」。元素流让「排到哪了」变成可计算的量，
 * 那条约束才能被 layout.test.js 断言住。
 *
 * 间距来自每个元素的 `gap`，**不做自动压缩** —— 自动压缩会把「间距调坏了」这件事
 * 藏起来（版面看起来正常，只是比设计稿挤）。宁可让测试红。
 */
export function computeLayout(poster) {
  const { canvas, elements, palette } = poster
  let y = canvas.marginTop
  const boxes = []
  for (const el of elements) {
    boxes.push({ ...el, y })
    y += el.h + (el.gap || 0)
  }
  return { canvas, palette, boxes }
}
