// src/core/state.test.js
//
// `restore()` 是全项目**唯一消费不可信持久化输入**的地方 —— 而它此前零测试覆盖。
// 本文件的存在理由：一个形状错误的会话（例如有 `scores`、无 `vars` 的 reading）
// 会被真值判断放行，随后 ResultView 渲染 `r.vars.name` 抛异常 → 整页空白，
// 没有跳过、没有错误提示、没有恢复路径。
//
// 为什么必须自建 storage 假实现：`storage.js` 的默认参数取 `globalThis.sessionStorage`，
// 而本套件跑在 vitest 的 `environment: 'node'` 下，没有真 storage（Chrome 之外的
// Node 没有 Web Storage）。测试期间替换全局，结束后**原样还原**，避免污染其他文件
// （vitest 配置为 singleFork，所有测试文件共享同一进程）。
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { store, restore, resetAll, setStage, setProfile, setReading, STAGES } from './state.js'
import { SESSION_KEY } from './storage.js'
import { runtimeConfig } from './config.js'
import { buildReading } from './fortune.js'
import { makeRng } from './rng.js'

/** 最小内存版 Web Storage：只需 storage.js 用到的三个方法 */
class MemoryStorage {
  constructor() {
    this.map = new Map()
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null
  }
  setItem(key, value) {
    this.map.set(key, String(value))
  }
  removeItem(key) {
    this.map.delete(key)
  }
  get length() {
    return this.map.size
  }
}

let realDescriptor

beforeAll(() => {
  realDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
})

beforeEach(() => {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true
  })
  resetAll()
})

afterEach(() => {
  if (realDescriptor) Object.defineProperty(globalThis, 'sessionStorage', realDescriptor)
  else delete globalThis.sessionStorage
})

afterAll(() => {
  // 双保险：即使某个用例抛错提前结束，全局也不会留着一个假 storage
  if (realDescriptor) Object.defineProperty(globalThis, 'sessionStorage', realDescriptor)
  else delete globalThis.sessionStorage
})

const profile = { name: '张三', dept: 'tech', tenure: '1to3', zodiac: 'gemini' }
/** 真实 reading（走 buildReading 生成），用作「合法会话」的基准 */
const reading = buildReading(profile, runtimeConfig, makeRng(20260913))

function writeSession(obj) {
  globalThis.sessionStorage.setItem(SESSION_KEY, JSON.stringify(obj))
}

function readSession() {
  const raw = globalThis.sessionStorage.getItem(SESSION_KEY)
  return raw === null ? null : JSON.parse(raw)
}

describe('restore：合法会话', () => {
  it('完整会话正常恢复，落到结果页', () => {
    writeSession({ stage: 'result', profile, reading, unlocked: false })
    expect(restore()).toBe(true)
    expect(store.stage).toBe('result')
    expect(store.profile).toEqual(profile)
    expect(store.reading).toEqual(reading)
    expect(store.unlocked).toBe(false)
  })

  it('真实 buildReading 产出的 reading 必须被接受（校验面不能严到误伤真实数据）', () => {
    // 这条是给「校验写得过严」立的反面保护：只要 buildReading 的产出被拒，
    // 就等于所有正常用户的会话恢复全线失效，而其余用例仍会全绿。
    writeSession({ stage: 'result', profile, reading: buildReading(profile, runtimeConfig, makeRng(7)), unlocked: true })
    expect(restore()).toBe(true)
    expect(store.unlocked).toBe(true)
  })

  it('stage 为 form 时回到填表页', () => {
    writeSession({ stage: 'form', profile, reading, unlocked: false })
    expect(restore()).toBe(true)
    expect(store.stage).toBe('form')
  })

  it('stage 为 divining 时归一化为 result，且**归一化结果会落盘**', () => {
    // 内存里 stage 是 'result' 而存储里仍是 'divining' 的话，二者要等到下一次
    // 写入才对齐 —— 期间若再次刷新，恢复出来的 stage 仍会走一遍同样的归一化。
    writeSession({ stage: 'divining', profile, reading, unlocked: false })
    expect(restore()).toBe(true)
    expect(store.stage).toBe('result')
    expect(readSession().stage).toBe('result')
  })

  it('unlocked 被强制转为布尔值', () => {
    writeSession({ stage: 'result', profile, reading, unlocked: 'yes' })
    restore()
    expect(store.unlocked).toBe(true)
  })
})

describe('restore：残缺 / 不可信会话必须被拒绝并清除', () => {
  it('缺 vars 的 reading（有 scores）被拒绝，且会话被清除', () => {
    // 这是本次修复的核心回归：`{ scores }` 形状非空，真值判断放行，
    // 随后 ResultView 的 `r.vars.name` 抛异常 → 白屏。
    const broken = { scores: reading.scores, bands: reading.bands }
    writeSession({ stage: 'result', profile, reading: broken, unlocked: false })

    expect(restore()).toBe(false)
    expect(globalThis.sessionStorage.getItem(SESSION_KEY)).toBeNull()
    // 不做部分恢复：reading 不得进入内存
    expect(store.reading).toBeNull()
    expect(store.stage).toBe('intro')
  })

  it('reading.vars 存在但缺字段（name 非字符串）同样被拒绝', () => {
    const broken = { ...reading, vars: { dept: '技术 / 研发', zodiac: '双子座', tenure: '入职 1-3 年' } }
    writeSession({ stage: 'result', profile, reading: broken, unlocked: false })
    expect(restore()).toBe(false)
    expect(store.reading).toBeNull()
  })

  it('reading.vars 为 null 被拒绝', () => {
    writeSession({ stage: 'result', profile, reading: { ...reading, vars: null }, unlocked: false })
    expect(restore()).toBe(false)
    expect(store.reading).toBeNull()
  })

  it('reading 缺 scores / bands / identity / fortune / lucky 任一项都被拒绝', () => {
    for (const key of ['scores', 'bands', 'identity', 'fortune', 'lucky']) {
      const broken = { ...reading }
      delete broken[key]
      writeSession({ stage: 'result', profile, reading: broken, unlocked: false })
      expect(restore(), `缺 ${key} 时应拒绝`).toBe(false)
      expect(store.reading).toBeNull()
    }
  })

  it('缺 reading 被拒绝', () => {
    writeSession({ stage: 'result', profile, unlocked: false })
    expect(restore()).toBe(false)
    expect(globalThis.sessionStorage.getItem(SESSION_KEY)).toBeNull()
    expect(store.profile).toBeNull()
  })

  it('缺 profile 被拒绝', () => {
    writeSession({ stage: 'result', reading, unlocked: false })
    expect(restore()).toBe(false)
    expect(store.reading).toBeNull()
  })

  it('profile 字段类型不对（非字符串）被拒绝', () => {
    writeSession({ stage: 'result', profile: { ...profile, dept: 42 }, reading, unlocked: false })
    expect(restore()).toBe(false)
    expect(store.profile).toBeNull()
  })

  it('没有会话时返回 false，且不写回任何东西', () => {
    expect(restore()).toBe(false)
    expect(globalThis.sessionStorage.getItem(SESSION_KEY)).toBeNull()
    expect(store.stage).toBe('intro')
  })

  it('sessionStorage 里是无法解析的垃圾时返回 false 并清除', () => {
    globalThis.sessionStorage.setItem(SESSION_KEY, '{ 这不是 json')
    expect(restore()).toBe(false)
    expect(globalThis.sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('会话是数组 / 字符串 / null 等非对象时返回 false', () => {
    for (const junk of [[1, 2, 3], '"just a string"', 'null', '42']) {
      globalThis.sessionStorage.setItem(SESSION_KEY, junk)
      expect(restore(), `junk=${junk}`).toBe(false)
      expect(globalThis.sessionStorage.getItem(SESSION_KEY)).toBeNull()
    }
  })

  it('拒绝后不留下半恢复状态：store 各字段保持开场页取值', () => {
    setStage('form')
    const before = { ...store }
    writeSession({ stage: 'result', profile, reading: { scores: {} }, unlocked: true })
    expect(restore()).toBe(false)
    expect({ ...store }).toEqual(before)
  })
})

describe('state 写入路径（与 restore 共享同一份存储）', () => {
  it('setStage / setProfile / setReading 都会被 restore 读回', () => {
    setProfile(profile)
    setReading(reading)
    setStage('result')
    resetAllState()
    expect(restore()).toBe(true)
    expect(store.profile).toEqual(profile)
    expect(store.reading).toEqual(reading)
    expect(store.stage).toBe('result')
  })

  it('resetAll 清空内存与存储', () => {
    setProfile(profile)
    setReading(reading)
    setStage('result')
    resetAll()
    expect(store.stage).toBe(STAGES[0])
    expect(store.profile).toBeNull()
    expect(store.reading).toBeNull()
    expect(globalThis.sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })
})

/** 只清内存、保留存储 —— 用于模拟「重新加载页面」 */
function resetAllState() {
  store.stage = 'intro'
  store.profile = null
  store.reading = null
  store.unlocked = false
}
