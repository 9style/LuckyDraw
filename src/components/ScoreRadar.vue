<script setup>
import { computed } from 'vue'

const props = defineProps({
  scores: { type: Object, required: true },
  bands: { type: Object, required: true },
  labels: { type: Object, required: true },
  focused: { type: Boolean, default: false }
})

const SIZE = 240
const CENTER = SIZE / 2
const RADIUS = 82

const dims = computed(() => Object.keys(props.scores))

function pointOn(index, total, ratio) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  return {
    x: CENTER + Math.cos(angle) * RADIUS * ratio,
    y: CENTER + Math.sin(angle) * RADIUS * ratio
  }
}

function polygon(ratio) {
  return dims.value
    .map((_, i) => {
      const p = pointOn(i, dims.value.length, ratio)
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    })
    .join(' ')
}

const gridRings = [0.25, 0.5, 0.75, 1]
const dataPolygon = computed(() =>
  dims.value
    .map((dim, i) => {
      const ratio = Math.max(0.04, (props.scores[dim] ?? 0) / 100)
      const p = pointOn(i, dims.value.length, ratio)
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    })
    .join(' ')
)

const axisPoints = computed(() =>
  dims.value.map((_, i) => pointOn(i, dims.value.length, 1))
)
const vertexPoints = computed(() =>
  dims.value.map((dim, i) => {
    const ratio = Math.max(0.04, (props.scores[dim] ?? 0) / 100)
    return pointOn(i, dims.value.length, ratio)
  })
)
const labelPoints = computed(() =>
  dims.value.map((_, i) => pointOn(i, dims.value.length, 1.26))
)
</script>

<template>
  <svg
    class="radar"
    :class="{ 'radar--blurred': focused }"
    :viewBox="`0 0 ${SIZE} ${SIZE}`"
    role="img"
    :aria-label="dims.map((d) => `${labels[d]} ${scores[d]} 分`).join('，')"
  >
    <polygon
      v-for="ring in gridRings"
      :key="ring"
      :points="polygon(ring)"
      fill="none"
      stroke="rgba(232,192,116,0.18)"
      stroke-width="1"
    />
    <line
      v-for="(p, i) in axisPoints"
      :key="`axis-${i}`"
      :x1="CENTER"
      :y1="CENTER"
      :x2="p.x"
      :y2="p.y"
      stroke="rgba(232,192,116,0.18)"
      stroke-width="1"
    />
    <polygon :points="dataPolygon" fill="rgba(232,192,116,0.28)" stroke="var(--gold)" stroke-width="2" />
    <circle
      v-for="(p, i) in vertexPoints"
      :key="`v-${i}`"
      :cx="p.x"
      :cy="p.y"
      r="3.5"
      fill="var(--gold-bright)"
    />
    <text
      v-for="(p, i) in labelPoints"
      :key="`l-${i}`"
      :x="p.x"
      :y="p.y"
      text-anchor="middle"
      dominant-baseline="middle"
      class="radar__label"
    >
      {{ labels[dims[i]] }}
    </text>
  </svg>
</template>

<style scoped>
.radar { width: 100%; max-width: 260px; height: auto; display: block; margin: 0 auto; }
.radar--blurred { filter: blur(5px); }
.radar__label { fill: var(--text-sub); font-size: 11px; }
</style>
