// src/core/poster/poster.test.js
//
// renderPoster 本身要真 canvas，跑不了 node；但它的两个**判断**是纯的，必须测：
// 导出格式的取舍直接决定微信里会不会被压糊。
import { describe, it, expect } from 'vitest'
import { shouldUseJpeg, buildVars } from './poster.js'
import { runtimeConfig } from '../config.js'

const reading = {
  vars: { name: '张三', dept: '技术 / 研发', zodiac: '双子座', tenure: '入职 1-3 年' },
  identity: { text: '年假余额守财奴', dept: null },
  scores: { moYu: 73, shengZhi: 78, renMai: 45, caiYun: 94 },
  bands: { moYu: 'ji', shengZhi: 'ji', renMai: 'ping', caiYun: 'daji' },
  fortune: { level: '小吉', verse: '轻舟已过小重山，前路平平未有澜。', yi: '收尾', ji: '加戏', explain: 'x' }
}

describe('shouldUseJpeg', () => {
  it('PNG 体积在限额内时保留 PNG', () => {
    expect(shouldUseJpeg('data:image/png;base64,' + 'A'.repeat(100))).toBe(false)
  })

  it('超过限额时改用 JPEG（深色渐变 + 星点在 PNG 下压缩率很差）', () => {
    expect(shouldUseJpeg('data:image/png;base64,' + 'A'.repeat(1_300_000))).toBe(true)
  })

  it('恰好等于限额时仍用 PNG（边界取闭区间）', () => {
    const head = 'data:image/png;base64,'
    expect(shouldUseJpeg(head + 'A'.repeat(1_200_000 - head.length))).toBe(false)
  })
})

describe('buildVars', () => {
  const v = buildVars(reading, runtimeConfig)

  it('取用户看到的展示名，而不是归一后的 key', () => {
    expect(v.name).toBe('张三')
    expect(v.title).toBe(runtimeConfig.settings.displayTitle)
  })

  it('身份标签与签文取自冻结的 reading，不重算', () => {
    expect(v.identity).toBe('年假余额守财奴')
    expect(v.fortuneLevel).toBe('小吉')
    expect(v.fortuneVerse).toBe('轻舟已过小重山，前路平平未有澜。')
  })

  it('四维数值行含全部四个维度与分数', () => {
    for (const d of runtimeConfig.scoring.dimensions) {
      expect(v.scoreRow).toContain(String(reading.scores[d]))
    }
  })

  it('缺失字段时兜底成空串，不产出字面量 undefined', () => {
    const bare = buildVars({ vars: {}, identity: {}, scores: {}, fortune: {} }, runtimeConfig)
    for (const [k, val] of Object.entries(bare)) {
      expect(String(val), `${k} 渲染出了 undefined`).not.toContain('undefined')
    }
  })
})
