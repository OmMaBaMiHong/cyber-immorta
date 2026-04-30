<template>
  <V2AppShell>
    <div class="v2-proto-page rebirth-page">
      <div class="v2-proto-container rebirth-shell">
        <section class="rebirth-header">
          <div>
            <h1 class="serif rebirth-title">27 型 SBTI 重生卡</h1>
          </div>
          <span class="rebirth-count">{{ filteredPersonalities.length }} 张</span>
        </section>

        <section class="rebirth-filter-bar" aria-label="人格筛选">
          <button
            v-for="filter in filters"
            :key="filter.key"
            type="button"
            class="rebirth-filter-pill"
            :class="{ active: activeFilter === filter.key }"
            @click="activeFilter = filter.key"
          >
            {{ filter.label }}
          </button>
        </section>

        <section class="rebirth-grid" aria-label="27 型卡片">
          <article
            v-for="item in filteredPersonalities"
            :key="item.code"
            class="rebirth-card"
          >
            <button type="button" class="rebirth-card-shell" :style="cardAccentStyle(item)" @click="openDetail(item)">
              <div class="rebirth-card-stage">
                <div class="rebirth-card-topline">
                  <span class="rebirth-card-code">{{ item.cardCode }}</span>
                  <span class="rebirth-card-label">{{ item.topTitle }}</span>
                </div>

                <div class="rebirth-card-portrait-wrap">
                  <span class="rebirth-card-watermark">{{ item.code }}</span>
                  <img
                    :src="resolvedPortrait(item)"
                    :alt="`${item.label} ${item.cardTitle}`"
                    class="rebirth-card-image"
                    @error="markPortraitBroken(item.code)"
                  />
                </div>

                <div class="rebirth-card-glass">
                  <p class="rebirth-card-title">{{ item.bottomTitle }}</p>
                  <p class="rebirth-card-copy">{{ item.bodyCopy }}</p>

                  <div class="rebirth-card-foot">
                    <span>{{ item.footerLeft }}</span>
                    <strong>{{ item.footerRight }}</strong>
                  </div>
                </div>
              </div>
            </button>
          </article>
        </section>
      </div>

      <div v-if="selectedPersonality" class="rebirth-modal" @click.self="closeDetail">
        <section class="rebirth-modal-panel" :style="cardAccentStyle(selectedPersonality)">
          <button type="button" class="rebirth-modal-close" @click="closeDetail">×</button>

          <div class="rebirth-modal-card">
            <div class="rebirth-modal-stage">
              <div class="rebirth-card-topline">
                <span class="rebirth-card-code">{{ selectedPersonality.cardCode }}</span>
                <span class="rebirth-card-label">{{ selectedPersonality.topTitle }}</span>
              </div>

              <div class="rebirth-modal-portrait-wrap">
                <span class="rebirth-card-watermark rebirth-card-watermark-modal">{{ selectedPersonality.code }}</span>
                <img
                  :src="resolvedPortrait(selectedPersonality)"
                  :alt="`${selectedPersonality.label} ${selectedPersonality.cardTitle}`"
                  class="rebirth-card-image"
                  @error="markPortraitBroken(selectedPersonality.code)"
                />
              </div>

              <div class="rebirth-modal-glass">
                <p class="rebirth-card-title">{{ selectedPersonality.bottomTitle }}</p>
                <p class="rebirth-modal-copy">{{ selectedPersonality.summary }}</p>
                <div class="rebirth-card-foot">
                  <span>{{ selectedPersonality.footerLeft }}</span>
                  <strong>{{ selectedPersonality.footerRight }}</strong>
                </div>
              </div>
            </div>

            <div class="rebirth-modal-content">
              <div class="rebirth-modal-meta">
                <span class="rebirth-modal-chip">{{ selectedPersonality.rarity.label }}</span>
                <span class="rebirth-modal-chip">{{ selectedPersonality.rarity.populationShare }}</span>
                <span class="rebirth-modal-chip">{{ selectedPersonality.mbtiMirrors.join(" / ") }}</span>
              </div>

              <p class="rebirth-modal-line">“{{ selectedPersonality.openingLine }}”</p>
              <p class="rebirth-modal-paragraph">{{ selectedPersonality.description }}</p>
              <p class="rebirth-modal-paragraph">{{ selectedPersonality.sbtiLens }}</p>

              <div v-if="selectedPersonality.soulQuestions.length" class="rebirth-question-list">
                <article
                  v-for="(question, index) in selectedPersonality.soulQuestions"
                  :key="`${selectedPersonality.code}-${index}`"
                  class="rebirth-question-card"
                >
                  <span>{{ index + 1 }}</span>
                  <p>{{ question }}</p>
                </article>
              </div>

              <div class="rebirth-modal-actions">
                <RouterLink
                  class="btn-primary rebirth-modal-primary"
                  :to="distillEntryLink(selectedPersonality)"
                  @click="closeDetail"
                >
                  去蒸馏一下
                </RouterLink>
                <button type="button" class="rebirth-modal-secondary" @click="closeDetail">关闭</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </V2AppShell>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue"

import V2AppShell from "@/v2/components/V2AppShell.vue"
import {
  sbtiCardAccentStyle,
  sbtiRebirthCards,
  type SbtiArchetype,
  type SbtiRebirthCard,
} from "@/v2/data/sbtiRebirthCatalog"

type FilterKey = "all" | SbtiArchetype

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "command", label: "统筹型" },
  { key: "care", label: "抚慰型" },
  { key: "detached", label: "观察型" },
  { key: "chaotic", label: "高动能" },
  { key: "fragile", label: "低电量" },
]

const activeFilter = ref<FilterKey>("all")
const selectedPersonality = ref<SbtiRebirthCard | null>(null)
const brokenPortraitCodes = ref<Record<string, true>>({})

const filteredPersonalities = computed(() => {
  if (activeFilter.value === "all") return sbtiRebirthCards
  return sbtiRebirthCards.filter((item) => item.visual.archetype === activeFilter.value)
})

function cardAccentStyle(item: SbtiRebirthCard) {
  return sbtiCardAccentStyle(item)
}

function resolvedPortrait(item: SbtiRebirthCard) {
  return brokenPortraitCodes.value[item.code] ? item.portraitFallbackUrl : item.portraitUrl
}

function markPortraitBroken(code: string) {
  brokenPortraitCodes.value = {
    ...brokenPortraitCodes.value,
    [code]: true,
  }
}

function distillEntryLink(item: SbtiRebirthCard) {
  return {
    name: "new-project",
    query: {
      targetKey: "self",
      subjectName: "我",
      projectName: `${item.label} ${item.cardTitle} 对照蒸馏`,
      source: "rebirth-template",
      template: item.code,
    },
  }
}

function openDetail(item: SbtiRebirthCard) {
  selectedPersonality.value = item
  document.body.style.overflow = "hidden"
}

function closeDetail() {
  selectedPersonality.value = null
  document.body.style.overflow = ""
}

onBeforeUnmount(() => {
  document.body.style.overflow = ""
})
</script>

<style scoped>
.rebirth-page {
  padding-bottom: 56px;
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.84), transparent 28%),
    #f4f1ec;
}

.rebirth-shell {
  display: grid;
  gap: 18px;
}

.rebirth-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  padding-top: 10px;
}

.rebirth-title {
  margin: 0;
  color: #17131c;
  font-size: clamp(28px, 3.2vw, 42px);
  line-height: 0.98;
}

.rebirth-count {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(22, 18, 28, 0.08);
  background: rgba(255, 255, 255, 0.72);
  color: rgba(23, 19, 28, 0.72);
  font-size: 12px;
  font-weight: 700;
}

.rebirth-filter-bar {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 2px 0 4px;
  scrollbar-width: none;
}

.rebirth-filter-bar::-webkit-scrollbar {
  display: none;
}

.rebirth-filter-pill {
  flex: 0 0 auto;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(24, 18, 31, 0.08);
  background: rgba(255, 255, 255, 0.82);
  color: rgba(24, 18, 31, 0.68);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.rebirth-filter-pill.active {
  background: #17131c;
  border-color: #17131c;
  color: #fff;
}

.rebirth-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 22px;
}

.rebirth-card {
  min-width: 0;
}

.rebirth-card-shell {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.rebirth-card-stage,
.rebirth-modal-stage {
  position: relative;
  overflow: hidden;
  border-radius: 32px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0.04) 28%, transparent 58%),
    radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.76), transparent 34%),
    radial-gradient(circle at 82% 86%, var(--rebirth-glow), transparent 44%),
    var(--rebirth-canvas);
  border: 1px solid rgba(255, 255, 255, 0.88);
  box-shadow:
    0 20px 50px rgba(31, 24, 39, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.54);
}

.rebirth-card-stage {
  min-height: 548px;
  transition: transform 0.24s ease, box-shadow 0.24s ease;
}

.rebirth-card-shell:hover .rebirth-card-stage {
  transform: translateY(-4px);
  box-shadow:
    0 28px 62px rgba(31, 24, 39, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.54);
}

.rebirth-card-topline {
  position: absolute;
  top: 22px;
  left: 24px;
  right: 24px;
  z-index: 3;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
}

.rebirth-card-code,
.rebirth-card-label {
  color: var(--rebirth-ink);
  font-size: 16px;
  font-weight: 900;
  letter-spacing: -0.03em;
}

.rebirth-card-code {
  font-size: 15px;
  opacity: 0.78;
}

.rebirth-card-portrait-wrap,
.rebirth-modal-portrait-wrap {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 80px;
}

.rebirth-card-portrait-wrap {
  min-height: 378px;
}

.rebirth-modal-portrait-wrap {
  min-height: 520px;
  padding-top: 86px;
}

.rebirth-card-watermark {
  position: absolute;
  top: 24px;
  left: 50%;
  z-index: 0;
  color: rgba(255, 255, 255, 0.34);
  font-size: clamp(58px, 9vw, 86px);
  font-weight: 900;
  letter-spacing: -0.08em;
  transform: translateX(-50%);
  white-space: nowrap;
  pointer-events: none;
}

.rebirth-card-watermark-modal {
  top: 34px;
  font-size: clamp(74px, 9vw, 112px);
}

.rebirth-card-image {
  display: block;
  width: 100%;
  max-width: 360px;
  object-fit: contain;
  transform:
    translateX(var(--portrait-shift-x))
    translateY(var(--portrait-shift-y))
    scaleX(var(--portrait-flip))
    scale(var(--portrait-scale));
  transform-origin: center bottom;
  filter: drop-shadow(0 26px 22px rgba(37, 28, 48, 0.14));
}

.rebirth-card-glass,
.rebirth-modal-glass {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 18px;
  z-index: 2;
  padding: 18px 20px 20px;
  border-radius: 30px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  background:
    radial-gradient(circle at 52% 0%, rgba(255, 255, 255, 0.24), transparent 34%),
    var(--rebirth-mist);
  backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
}

.rebirth-card-title {
  margin: 0;
  color: var(--rebirth-ink);
  font-size: 23px;
  font-weight: 900;
  letter-spacing: -0.03em;
}

.rebirth-card-copy,
.rebirth-modal-copy {
  margin: 9px 0 0;
  color: rgba(23, 19, 28, 0.84);
  font-size: 13px;
  line-height: 1.65;
}

.rebirth-card-foot {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
}

.rebirth-card-foot span {
  color: var(--rebirth-ink);
  font-size: 15px;
  font-weight: 700;
}

.rebirth-card-foot strong {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--rebirth-chip);
  color: var(--rebirth-chip-ink);
  font-size: 13px;
  font-weight: 800;
}

.rebirth-modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(16, 13, 20, 0.4);
  backdrop-filter: blur(18px);
}

.rebirth-modal-panel {
  position: relative;
  width: min(1180px, 100%);
  max-height: calc(100vh - 36px);
  overflow: auto;
  border-radius: 34px;
  background: #f8f5f0;
  box-shadow: 0 32px 90px rgba(18, 14, 24, 0.2);
}

.rebirth-modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 4;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 999px;
  background: rgba(24, 19, 31, 0.08);
  color: #1b1621;
  font-size: 24px;
  cursor: pointer;
}

.rebirth-modal-card {
  display: grid;
  grid-template-columns: minmax(340px, 0.84fr) minmax(0, 1fr);
  gap: 24px;
  padding: 24px;
}

.rebirth-modal-content {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 8px 6px 8px 0;
}

.rebirth-modal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.rebirth-modal-chip {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(24, 18, 31, 0.08);
  color: rgba(24, 18, 31, 0.7);
  font-size: 12px;
  font-weight: 700;
}

.rebirth-modal-line {
  margin: 0;
  color: #1a151f;
  font-size: 26px;
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: -0.03em;
}

.rebirth-modal-paragraph {
  margin: 0;
  color: rgba(23, 19, 28, 0.78);
  font-size: 15px;
  line-height: 1.85;
}

.rebirth-question-list {
  display: grid;
  gap: 10px;
}

.rebirth-question-card {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 12px;
  padding: 14px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(24, 18, 31, 0.06);
}

.rebirth-question-card span {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: rgba(23, 19, 28, 0.08);
  color: rgba(23, 19, 28, 0.76);
  font-size: 12px;
  font-weight: 800;
}

.rebirth-question-card p {
  margin: 0;
  color: rgba(23, 19, 28, 0.76);
  font-size: 14px;
  line-height: 1.7;
}

.rebirth-modal-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.rebirth-modal-primary {
  flex: 1 1 220px;
}

.rebirth-modal-secondary {
  flex: 0 0 auto;
  min-width: 112px;
  min-height: 48px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1px solid rgba(24, 18, 31, 0.08);
  background: rgba(255, 255, 255, 0.84);
  color: rgba(24, 18, 31, 0.74);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 1180px) {
  .rebirth-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .rebirth-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .rebirth-modal-card {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .rebirth-header {
    align-items: start;
    flex-direction: column;
  }

  .rebirth-grid {
    grid-template-columns: 1fr;
  }

  .rebirth-card-stage {
    min-height: 540px;
  }

  .rebirth-card-code,
  .rebirth-card-label {
    font-size: 16px;
  }

  .rebirth-card-watermark {
    font-size: 64px;
  }

  .rebirth-card-title {
    font-size: 20px;
  }

  .rebirth-modal {
    padding: 10px;
  }

  .rebirth-modal-card {
    padding: 16px;
    gap: 16px;
  }
}
</style>
