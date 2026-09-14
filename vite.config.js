import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    target: 'es2018',
    cssCodeSplit: false,
    chunkSizeWarningLimit: 800
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'scripts/**/*.test.js'],
    // 默认的 threads 池在 Windows 上会争用 vitest 自己的 %TEMP%\...\ssr 模块缓存，
    // 触发 "EBUSY: resource busy or locked"，导致只收集到部分测试文件并以 1 退出。
    // 实测：默认池 12 次跑出 2 次假失败；单进程 forks 池 10 次 0 失败。
    // 后续 12 个任务都用 `npx vitest run` 验收，假失败会让真失败被"再跑一次"掩盖。
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }
  }
})
