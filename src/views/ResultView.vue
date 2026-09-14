<script setup>
import { computed } from 'vue'
import { runtimeConfig } from '../core/config.js'
import { store, resetAll } from '../core/state.js'
import ScoreRadar from '../components/ScoreRadar.vue'
import ScoreBars from '../components/ScoreBars.vue'
import FortuneSlip from '../components/FortuneSlip.vue'
import LuckyEggs from '../components/LuckyEggs.vue'
import Disclaimer from '../components/Disclaimer.vue'

const r = computed(() => store.reading)
const dimLabels = runtimeConfig.scoring.dimensionLabels
const bandMeta = runtimeConfig.scoring.bands
const ui = runtimeConfig.copy.ui.result

function again() {
  resetAll()
}
</script>

<template>
  <section v-if="r" class="result">
    <header class="result__head">
      <p class="result__who">{{ r.vars.name }} · {{ r.vars.dept }}</p>
      <p class="result__meta">{{ r.vars.zodiac }} · {{ r.vars.tenure }}</p>
    </header>

    <div class="card card--identity">
      <p class="card__k">{{ ui.identityLabel }}</p>
      <p class="card__v gold-text">{{ r.identity.text }}</p>
    </div>

    <div class="card">
      <p class="card__k">{{ ui.scoresLabel }}</p>
      <ScoreRadar :scores="r.scores" :bands="r.bands" :labels="dimLabels" />
      <ScoreBars :scores="r.scores" :bands="r.bands" :labels="dimLabels" :band-meta="bandMeta" />
    </div>

    <div class="card">
      <p class="card__k">{{ ui.roastLabel }}</p>
      <ul class="roasts">
        <li v-for="(t, i) in r.roastTexts" :key="i" class="roasts__item">{{ t }}</li>
      </ul>
    </div>

    <div class="card">
      <p class="card__k">{{ ui.deptLabel }}</p>
      <p class="card__body">{{ r.deptJoke }}</p>
    </div>

    <div class="card">
      <p class="card__k">{{ ui.fortuneLabel }}</p>
      <FortuneSlip :fortune="r.fortune" :ui="ui" />
    </div>

    <div class="card">
      <p class="card__k">{{ ui.luckyLabel }}</p>
      <LuckyEggs :lucky="r.lucky" :ui="ui" />
    </div>

    <button class="btn-gold result__again" @click="again">{{ ui.again }}</button>

    <Disclaimer />
  </section>
</template>

<style scoped>
.result {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 26px 0 30px;
}
.result__head { text-align: center; }
.result__who { margin: 0 0 4px; font-size: 20px; color: var(--text-main); }
.result__meta { margin: 0; font-size: 12px; color: var(--text-dim); letter-spacing: 0.1em; }
.card {
  padding: 18px 16px;
  border: 1px solid var(--card-line);
  border-radius: var(--radius);
  background: var(--card-bg);
}
.card--identity { text-align: center; padding: 24px 16px; }
.card__k { margin: 0 0 14px; font-size: 12px; color: var(--text-dim); letter-spacing: 0.24em; text-align: center; }
.card__v { margin: 0; font-size: 26px; letter-spacing: 0.06em; }
.card__body { margin: 0; font-size: 15px; line-height: 1.9; color: var(--text-sub); text-align: center; }
.roasts { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 12px; }
.roasts__item { font-size: 15px; line-height: 1.9; color: var(--text-sub); }
.roasts__item::before { content: '· '; color: var(--gold); }
.result__again { margin-top: 8px; align-self: center; }
</style>
