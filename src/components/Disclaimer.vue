<script setup>
const TEXT = '本页面为纯娱乐互动，结果随机生成，不构成任何建议。所有信息仅在本地处理，不采集、不上传。'
</script>

<template>
  <p id="disclaimer" class="disclaimer">{{ TEXT }}</p>
</template>

<style scoped>
.disclaimer {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-dim);
  text-align: center;
}
</style>
