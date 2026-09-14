<script setup>
defineProps({
  fortune: { type: Object, required: true },
  ui: { type: Object, required: true }
})
</script>

<template>
  <div class="slip">
    <p class="slip__level gold-text">{{ fortune.level }}</p>
    <p class="slip__verse">{{ fortune.verse }}</p>
    <div class="slip__rows">
      <p><span class="slip__tag slip__tag--yi">{{ ui.yiLabel }}</span>{{ fortune.yi }}</p>
      <p><span class="slip__tag slip__tag--ji">{{ ui.jiLabel }}</span>{{ fortune.ji }}</p>
    </div>
    <p class="slip__explain">{{ fortune.explain }}</p>
  </div>
</template>

<style scoped>
.slip {
  padding: 20px 18px;
  border: 1px solid var(--card-line);
  border-radius: var(--radius);
  background: var(--card-bg);
  text-align: center;
}
.slip__level { margin: 0 0 12px; font-size: 22px; letter-spacing: 0.3em; }
.slip__verse { margin: 0 0 16px; font-size: 16px; line-height: 1.9; color: var(--text-main); letter-spacing: 0.06em; }
.slip__rows { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.slip__rows p { margin: 0; font-size: 14px; color: var(--text-sub); }
.slip__tag {
  display: inline-block;
  width: 22px;
  height: 22px;
  line-height: 22px;
  margin-right: 8px;
  border-radius: 6px;
  font-size: 12px;
  text-align: center;
}
.slip__tag--yi { background: rgba(122, 200, 140, 0.22); color: #9fe0b0; }
.slip__tag--ji { background: rgba(220, 130, 130, 0.2); color: #f0a5a5; }
.slip__explain { margin: 0; padding-top: 12px; border-top: 1px dashed var(--card-line); font-size: 13px; color: var(--text-dim); line-height: 1.7; }
</style>
