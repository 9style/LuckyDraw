// src/core/poster/clipboard.test.js
//
// 部署地址是纯 HTTP，navigator.clipboard 在那种页面里不存在。
// 三个分支必须各自可达 —— 且「上一档不可用」不能把整个函数带崩，
// 否则最需要降级的时候降级本身先炸了。
import { describe, it, expect, vi } from 'vitest'
import { copyText } from './clipboard.js'

const ok = () => Promise.resolve()
const boom = () => Promise.reject(new Error('denied'))

describe('copyText 三段式', () => {
  it('第一档可用时走 Clipboard API', async () => {
    const r = await copyText('x', { clipboard: { writeText: vi.fn(ok) }, legacyCopy: vi.fn(() => true) })
    expect(r).toBe('async')
  })

  it('HTTP 页面没有 clipboard 对象 → 落到 execCommand', async () => {
    const legacy = vi.fn(() => true)
    const r = await copyText('x', { clipboard: undefined, legacyCopy: legacy })
    expect(r).toBe('execCommand')
    expect(legacy).toHaveBeenCalledWith('x')
  })

  it('clipboard 存在但拒绝（权限/非聚焦）→ 落到 execCommand', async () => {
    const legacy = vi.fn(() => true)
    const r = await copyText('x', { clipboard: { writeText: vi.fn(boom) }, legacyCopy: legacy })
    expect(r).toBe('execCommand')
    expect(legacy).toHaveBeenCalled()
  })

  it('execCommand 也失败 → 返回 manual，交给 UI 显示可手选的地址', async () => {
    const r = await copyText('x', { clipboard: undefined, legacyCopy: () => false })
    expect(r).toBe('manual')
  })

  it('execCommand 抛异常也不外泄（返回 manual）', async () => {
    const r = await copyText('x', {
      clipboard: undefined,
      legacyCopy: () => { throw new Error('boom') }
    })
    expect(r).toBe('manual')
  })

  it('deps 全空也不抛异常', async () => {
    await expect(copyText('x', {})).resolves.toBe('manual')
  })
})
