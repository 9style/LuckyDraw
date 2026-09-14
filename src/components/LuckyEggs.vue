<script setup>
defineProps({
  lucky: { type: Object, required: true },
  ui: { type: Object, required: true }
})
</script>

<template>
  <ul class="eggs">
    <li class="eggs__item">
      <span class="eggs__k">{{ ui.luckyColor }}</span>
      <span class="eggs__v">{{ lucky.color }}</span>
    </li>
    <li class="eggs__item">
      <span class="eggs__k">{{ ui.luckyNumber }}</span>
      <span class="eggs__v">{{ lucky.number }}</span>
    </li>
    <li class="eggs__item">
      <span class="eggs__k">{{ ui.luckyDirection }}</span>
      <span class="eggs__v">{{ lucky.direction }}</span>
    </li>
    <li class="eggs__item">
      <span class="eggs__k">{{ ui.luckyZodiac }}</span>
      <span class="eggs__v">{{ lucky.zodiac }}</span>
    </li>
  </ul>
</template>

<style scoped>
.eggs {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.eggs__item {
  padding: 12px;
  border: 1px solid var(--card-line);
  border-radius: 12px;
  background: var(--card-bg);
  text-align: center;
}
.eggs__k { display: block; font-size: 11px; color: var(--text-dim); margin-bottom: 6px; }
.eggs__v { display: block; font-size: 15px; color: var(--gold); }
</style>
