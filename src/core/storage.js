// src/core/storage.js

export const SESSION_KEY = 'ld_session'
export const COUNT_KEY = 'ld_count'

function defaultSession() {
  try {
    return globalThis.sessionStorage
  } catch {
    return null
  }
}

function defaultLocal() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

/** 读写一律吞异常：隐私模式、配额超限、storage 被禁用都不能打断主流程 */
export function saveSession(data, store = defaultSession()) {
  if (!store) return
  try {
    store.setItem(SESSION_KEY, JSON.stringify(data))
  } catch {
    /* 静默降级：会话恢复是增强功能，失败不影响主流程 */
  }
}

export function loadSession(store = defaultSession()) {
  if (!store) return null
  try {
    const raw = store.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function clearSession(store = defaultSession()) {
  if (!store) return
  try {
    store.removeItem(SESSION_KEY)
  } catch {
    /* 同上 */
  }
}

export function getCount(store = defaultLocal()) {
  if (!store) return 0
  try {
    const n = Number(JSON.parse(store.getItem(COUNT_KEY)))
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

export function bumpCount(store = defaultLocal()) {
  const next = getCount(store) + 1
  if (!store) return next
  try {
    store.setItem(COUNT_KEY, JSON.stringify(next))
  } catch {
    /* 计数失败无所谓 */
  }
  return next
}

export function resetCount(store = defaultLocal()) {
  if (!store) return
  try {
    store.setItem(COUNT_KEY, JSON.stringify(0))
  } catch {
    /* 同上 */
  }
}
