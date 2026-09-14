// src/core/storage.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveSession, loadSession, clearSession,
  bumpCount, getCount, resetCount,
  SESSION_KEY, COUNT_KEY
} from './storage.js'

function makeMemoryStore() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _dump: () => Object.fromEntries(map)
  }
}

let session
let local

beforeEach(() => {
  session = makeMemoryStore()
  local = makeMemoryStore()
})

describe('会话读写', () => {
  it('保存后能原样读回', () => {
    const data = {
      profile: { name: '张三', dept: 'tech', tenure: '1to3', zodiac: 'aries' },
      reading: { scores: { moYu: 72, shengZhi: 55, renMai: 81, caiYun: 63 } },
      unlocked: false,
      stage: 'result'
    }
    saveSession(data, session)
    expect(loadSession(session)).toEqual(data)
  })

  it('无数据时返回 null', () => {
    expect(loadSession(session)).toBeNull()
  })

  it('数据损坏时返回 null 而不抛异常', () => {
    session.setItem(SESSION_KEY, '{ 这不是合法 json')
    expect(loadSession(session)).toBeNull()
  })

  it('storage 不可用时静默降级，不抛异常', () => {
    const broken = {
      getItem() { throw new Error('QuotaExceededError') },
      setItem() { throw new Error('QuotaExceededError') },
      removeItem() { throw new Error('QuotaExceededError') }
    }
    expect(() => saveSession({ a: 1 }, broken)).not.toThrow()
    expect(loadSession(broken)).toBeNull()
    expect(() => clearSession(broken)).not.toThrow()
  })

  it('clearSession 后读不到数据', () => {
    saveSession({ a: 1 }, session)
    clearSession(session)
    expect(loadSession(session)).toBeNull()
  })
})

describe('计数', () => {
  it('初始为 0', () => {
    expect(getCount(local)).toBe(0)
  })

  it('每次 bump 递增 1', () => {
    bumpCount(local)
    bumpCount(local)
    expect(getCount(local)).toBe(3 - 1)
  })

  it('计数存的是数字不是字符串', () => {
    bumpCount(local)
    expect(typeof JSON.parse(local.getItem(COUNT_KEY))).toBe('number')
  })

  it('值损坏时归零而不是 NaN', () => {
    local.setItem(COUNT_KEY, 'abc')
    expect(getCount(local)).toBe(0)
  })

  it('resetCount 归零', () => {
    bumpCount(local)
    resetCount(local)
    expect(getCount(local)).toBe(0)
  })

  it('计数读写不抛异常即使 storage 不可用', () => {
    const broken = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') }, removeItem() {} }
    expect(() => bumpCount(broken)).not.toThrow()
    expect(getCount(broken)).toBe(0)
  })
})
