<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { runtimeConfig } from '../core/config.js'
import { store } from '../core/state.js'
import { renderPoster } from '../core/poster/poster.js'
import { copyText, legacyCopy } from '../core/poster/clipboard.js'
import qrUrl from '../assets/qrcode.png'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close'])

const ui = runtimeConfig.copy.ui.result
const phase = ref('pending')   // pending | ready | failed | manual
const dataURL = ref('')

// 微信内置浏览器无法用 JS 写相册，只能引导长按；其余环境给下载按钮。
const isWeChat = /MicroMessenger/i.test(navigator.userAgent)

// ⚠️ 模板里**访问不到**全局 location —— Vue 模板只放行 Math/Date/JSON 等少数全局，
// 写 `location.href` 会静默取到 undefined。必须先在脚本里取出来。
const currentUrl = location.href

/**
 * 加载二维码图片。
 * 必须先 await 解码完成 —— 没加载完就 drawImage 会画出一块空白，
 * 而海报上那块空白是白色的，看起来像"二维码区留白"，不会报任何错。
 */
function loadQr() {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)   // 图挂了也不能让整张海报失败
    img.src = qrUrl
  })
}

async function generate() {
  phase.value = 'pending'
  dataURL.value = ''
  try {
    const canvas = document.createElement('canvas')
    const qrImage = await loadQr()
    const result = renderPoster({
      reading: store.reading,
      cfg: runtimeConfig,
      canvas,
      qrImage
    })
    dataURL.value = result.dataURL
    phase.value = 'ready'
  } catch {
    // 兜底态是一个完整可读的结果页，不是错误提示 —— 结果页从未被替换掉，
    // 关掉浮层即可继续用。
    phase.value = 'failed'
  }
}

/** 桌面浏览器：直接触发下载。<a download> 在微信内无效，所以那条路走长按。 */
function download() {
  const a = document.createElement('a')
  a.href = dataURL.value
  a.download = `职场运势-${store.reading?.vars?.name ?? ''}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

async function copyLink() {
  const how = await copyText(location.href, {
    clipboard: navigator.clipboard,
    legacyCopy
  })
  // 三段都没走通（HTTP 页面 + execCommand 被拦）→ 显示可选文本让用户手抄
  if (how === 'manual') phase.value = 'manual'
}

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      // 结果页很长，不锁背景会滚穿
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', onKey)
      await generate()
    } else {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal" @click.self="$emit('close')">
      <button class="modal__close" aria-label="关闭" @click="$emit('close')">×</button>

      <p v-if="phase === 'pending'" class="modal__tip">{{ ui.posterPending }}</p>

      <img v-else-if="phase === 'ready'" class="modal__img" :src="dataURL" alt="职场运势海报" />

      <div v-else-if="phase === 'failed'" class="modal__fail">
        <p>{{ ui.posterFailed }}</p>
        <button class="modal__btn" @click="copyLink">{{ ui.copyLink }}</button>
      </div>

      <div v-else class="modal__fail">
        <p>请长按选中下面的地址手动复制：</p>
        <input class="modal__url" :value="currentUrl" readonly @focus="$event.target.select()" />
      </div>

      <div class="modal__actions">
        <p v-if="phase === 'ready' && isWeChat" class="modal__hint">{{ ui.posterHint }}</p>
        <button v-else-if="phase === 'ready'" class="modal__btn" @click="download">
          {{ ui.posterDownload }}
        </button>
        <button v-else-if="phase === 'failed'" class="modal__btn" @click="$emit('close')">返回结果</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  background: rgba(10, 5, 22, 0.92);
  animation: fade-in 0.24s ease;
}
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .modal { animation: none; }
}
.modal__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  font-size: 24px;
  line-height: 1;
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
}
.modal__img {
  max-width: 100%;
  max-height: 72vh;
  width: auto;
  height: auto;
  border-radius: var(--radius);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
}
.modal__tip { color: var(--text-sub); letter-spacing: 0.1em; }
.modal__hint { margin: 0; color: var(--gold); font-size: 14px; letter-spacing: 0.08em; }
.modal__fail { text-align: center; color: var(--text-sub); }
.modal__btn {
  min-height: var(--tap);
  padding: 0 24px;
  background: linear-gradient(135deg, var(--gold-bright), var(--gold), var(--gold-dim));
  color: #2a1a05;
  font-weight: 700;
}
.modal__url {
  width: 100%;
  max-width: 320px;
  min-height: var(--tap);
  padding: 0 12px;
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid var(--card-line);
  border-radius: 12px;
  font-size: 13px;
}
.modal__actions { display: flex; flex-direction: column; align-items: center; gap: 10px; }
</style>
