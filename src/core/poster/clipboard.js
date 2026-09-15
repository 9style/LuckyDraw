// src/core/poster/clipboard.js

/**
 * 复制文本，三段式降级。返回实际走通的那一档，供 UI 决定怎么提示。
 *
 * 为什么不能只写 navigator.clipboard.writeText：
 * 本项目部署在 http://121.40.123.10:888/ —— 纯 HTTP，不是 secure context，
 * 该 API 在那样的页面上**根本不存在**（不是「调用失败」，是 undefined）。
 * 只写第一段的话，降级路径自己就先崩了，而那正是它最该起作用的时刻。
 *
 * 依赖注入是为了让三个分支都能在 node（无 DOM）下测到。
 */
export async function copyText(text, deps = {}) {
  const { clipboard, legacyCopy } = deps

  // 第一档：Clipboard API（需 HTTPS 或 localhost）
  if (clipboard && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(text)
      return 'async'
    } catch {
      /* 权限被拒 / 页面未聚焦 —— 落到下一档，不往上抛 */
    }
  }

  // 第二档：document.execCommand('copy')，非 secure context 下仍可用
  if (typeof legacyCopy === 'function') {
    try {
      if (legacyCopy(text)) return 'execCommand'
    } catch {
      /* textarea 被拦截等 —— 落到最后一档 */
    }
  }

  // 第三档：交给 UI 把地址显示成可手选文本
  return 'manual'
}

/**
 * 第二档的浏览器实现：临时 textarea + execCommand。
 * 必须在调用时才碰 document —— 本模块会被 node 下的测试 import。
 */
export function legacyCopy(text) {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    // 不能 display:none（那样选不中），用 fixed + 透明移出视觉流
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return !!ok
  } catch {
    return false
  }
}
