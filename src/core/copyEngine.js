// src/core/copyEngine.js
import { pickMany, pickOne } from './rng.js'

const VAR_RE = /\{(\w+)\}/g

/**
 * 替换文案中的 {key} 占位。未知 key 原样保留，便于运营发现拼写错误。
 * 注意：本函数只做字符串替换，不解析 HTML。渲染层走 Vue 的 {{ }} 自动转义。
 */
export function interpolate(text, vars = {}) {
  if (!text) return ''
  return String(text).replace(VAR_RE, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
  )
}

/** 从字符串池中不重复地取 n 条 */
export function pickText(pool, rng, n = 1) {
  if (!pool || pool.length === 0 || n <= 0) return []
  return pickMany(rng, pool, n)
}

/** 从对象池中取一条，返回浅拷贝，避免下游修改污染配置 */
export function pickEntry(pool, rng) {
  if (!pool || pool.length === 0) return null
  const picked = pickOne(rng, pool)
  return picked ? { ...picked } : null
}
