<script setup>
import { computed } from 'vue'

const props = defineProps({
  scores: { type: Object, required: true },
  bands: { type: Object, required: true },
  labels: { type: Object, required: true },
  bandMeta: { type: Array, required: true },
  locked: { type: Boolean, default: false }
})

const rows = computed(() =>
  Object.keys(props.scores).map((dim) => {
    const bandKey = props.bands[dim]
    const meta = props.bandMeta.find((b) => b.key === bandKey) ?? {}
    return {
      dim,
      label: props.labels[dim],
      score: props.scores[dim],
      bandLabel: meta.label ?? '',
      emoji: meta.emoji ?? ''
    }
  })
)
</script>

<template>
  <ul class="bars">
    <li v-for="row in rows" :key="row.dim" class="bars__row">
      <span class="bars__name">{{ row.label }}</span>
      <span class="bars__track">
        <span class="bars__fill" :style="{ width: `${row.score}%` }" />
      </span>
      <span class="bars__val">
        <template v-if="locked">▓▓</template>
        <template v-else>{{ row.emoji }} {{ row.bandLabel }} {{ row.score }}</template>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.bars { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
.bars__row { display: grid; grid-template-columns: 62px 1fr 84px; align-items: center; gap: 10px; }
.bars__name { font-size: 13px; color: var(--text-sub); }
.bars__track { height: 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.bars__fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--gold-dim), var(--gold-bright)); }
.bars__val { font-size: 12px; color: var(--gold); text-align: right; }
</style>
