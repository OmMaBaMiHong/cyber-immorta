<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue"
import { useRouter } from "vue-router"
import axios from "axios"

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8091"
const router = useRouter()

interface PackSummary {
  slug: string
  title: string
  subtitle: string
  domain: string
  avatar_label: string
  hero_background: string
  tags: string[]
  skills: string[]
  suitable_for: string[]
  source_count: number
  source_types: string[]
  factory_category: string
  factory_category_label: string
  display_group: string
  display_group_label: string
}

interface PackSourceLink {
  title: string
  url: string
  source_type: string
}

interface PackDetail {
  pack: PackSummary
  starter_prompts: string[]
  sources: PackSourceLink[]
  related_system_packs: PackSummary[]
  related_tool_packs: PackSummary[]
}

const props = defineProps<{
  slug: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const visible = ref(false)
const detail = ref<PackDetail | null>(null)
const loading = ref(false)
const sheetEl = ref<HTMLElement | null>(null)

watch(() => props.slug, async (newSlug) => {
  if (newSlug) {
    visible.value = true
    document.body.style.overflow = "hidden"
    await loadDetail(newSlug)
  } else {
    closeSheet()
  }
})

async function loadDetail(slug: string) {
  loading.value = true
  detail.value = null
  try {
    const token = localStorage.getItem("distill-human-token")
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    const { data } = await axios.get<PackDetail>(`${API_BASE}/packs/${slug}`, { headers, timeout: 10000 })
    detail.value = data
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
}

function closeSheet() {
  visible.value = false
  document.body.style.overflow = ""
  setTimeout(() => emit("close"), 300)
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) closeSheet()
}

function onTouchMove(e: TouchEvent) {
  if (!sheetEl.value) return
  const rect = sheetEl.value.getBoundingClientRect()
  if (rect.top > 60) {
    closeSheet()
  }
}

function usePack() {
  if (detail.value) {
    closeSheet()
    router.push({
      name: "projects-cyber",
      query: {
        pack: detail.value.pack.slug,
        from: "plaza",
      },
    })
  }
}

const portraitPool = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&h=400&fit=crop",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&h=400&fit=crop",
]

function getHeroImage(pack: PackSummary): string {
  if (pack.hero_background && pack.hero_background.startsWith("http")) {
    return pack.hero_background
  }
  const index = pack.slug.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % portraitPool.length
  return portraitPool[index]
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") closeSheet()
}

onMounted(() => document.addEventListener("keydown", onKeydown))
onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown)
  document.body.style.overflow = ""
})
</script>

<template>
  <transition name="sheet-fade">
    <div v-if="visible" class="sheet-backdrop" @click="onBackdropClick" @touchmove="onTouchMove">
      <transition name="sheet-slide">
        <div v-if="visible" ref="sheetEl" class="sheet-container">
          <!-- Drag handle -->
          <div class="sheet-handle" />

          <!-- Hero image -->
          <div v-if="detail?.pack" class="sheet-hero">
            <img :src="getHeroImage(detail.pack)" :alt="detail.pack.title" />
            <div class="sheet-hero-overlay" />
            <button class="sheet-close" @click="closeSheet">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <!-- Loading -->
          <div v-if="loading" class="sheet-loading">
            <div class="sheet-loading-spinner" />
            <p style="color: rgba(255,255,255,0.6); font-size: 0.8rem; margin-top: 12px">加载中...</p>
          </div>

          <!-- Content -->
          <div v-else-if="detail" class="sheet-content">
            <!-- Title area -->
            <div class="sheet-title-area">
              <span class="sheet-category">{{ detail.pack.display_group_label || detail.pack.factory_category_label }}</span>
              <h2 class="sheet-title">{{ detail.pack.title }}</h2>
              <p class="sheet-subtitle">{{ detail.pack.subtitle }}</p>
            </div>

            <!-- Skills -->
            <div v-if="detail.pack.skills.length" class="sheet-section">
              <h4 class="sheet-section-title">核心技能</h4>
              <div class="sheet-skills">
                <span v-for="skill in detail.pack.skills" :key="skill" class="sheet-skill-tag">{{ skill }}</span>
              </div>
            </div>

            <!-- Suitable for -->
            <div v-if="detail.pack.suitable_for?.length" class="sheet-section">
              <h4 class="sheet-section-title">使用场景</h4>
              <div class="sheet-scenarios">
                <div v-for="s in detail.pack.suitable_for" :key="s" class="sheet-scenario-item">
                  <span class="material-symbols-rounded" style="font-size: 16px; color: var(--neon-cyan)">check_circle</span>
                  <span>{{ s }}</span>
                </div>
              </div>
            </div>

            <!-- Starter prompts -->
            <div v-if="detail.starter_prompts?.length" class="sheet-section">
              <h4 class="sheet-section-title">快速开始</h4>
              <div class="sheet-prompts">
                <button
                  v-for="(prompt, i) in detail.starter_prompts"
                  :key="i"
                  class="sheet-prompt-btn"
                  @click="usePack"
                >
                  <span class="material-symbols-rounded" style="font-size: 16px; color: var(--neon-cyan)">bolt</span>
                  {{ prompt }}
                </button>
              </div>
            </div>

            <!-- Sources -->
            <div v-if="detail.sources?.length" class="sheet-section">
              <h4 class="sheet-section-title">素材来源 ({{ detail.pack.source_count }})</h4>
              <div class="sheet-sources">
                <a
                  v-for="source in detail.sources.slice(0, 5)"
                  :key="source.url"
                  :href="source.url"
                  target="_blank"
                  rel="noopener"
                  class="sheet-source-item"
                  @click.stop
                >
                  <span class="material-symbols-rounded" style="font-size: 16px">link</span>
                  <span class="sheet-source-title">{{ source.title }}</span>
                  <span class="material-symbols-rounded" style="font-size: 14px; color: rgba(255,255,255,0.4)">open_in_new</span>
                </a>
              </div>
            </div>

            <!-- Tags -->
            <div v-if="detail.pack.tags.length" class="sheet-tags">
              <span v-for="tag in detail.pack.tags" :key="tag" class="sheet-tag">#{{ tag }}</span>
            </div>

            <div class="sheet-footer">
              <button class="cyber-btn cyber-btn-primary sheet-cta" @click="usePack">
                使用此技能包
                <span class="material-symbols-rounded" style="font-size: 18px; margin-left: 6px">arrow_forward</span>
              </button>
            </div>
          </div>

          <!-- Error -->
          <div v-else class="sheet-loading">
            <span class="material-symbols-rounded" style="font-size: 32px; color: var(--neon-red); opacity: 0.6">error</span>
            <p style="color: rgba(255,255,255,0.6); font-size: 0.8rem; margin-top: 10px">加载失败</p>
          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<style scoped>
/* Backdrop */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet-fade-enter-active { transition: opacity 0.3s ease; }
.sheet-fade-leave-active { transition: opacity 0.2s ease; }
.sheet-fade-enter-from,
.sheet-fade-leave-to { opacity: 0; }

/* Container — 纯黑玻璃态 */
.sheet-container {
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  background: #000000;
  border-radius: 20px 20px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.15) transparent;
}

.sheet-container::-webkit-scrollbar { width: 4px; }
.sheet-container::-webkit-scrollbar-thumb { background: rgba(0,245,212,0.2); border-radius: 2px; }

.sheet-slide-enter-active { transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1); }
.sheet-slide-leave-active { transition: transform 0.25s ease; }
.sheet-slide-enter-from,
.sheet-slide-leave-to { transform: translateY(100%); }

/* Handle */
.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.2);
  margin: 10px auto 0;
  flex-shrink: 0;
}

/* Hero */
.sheet-hero {
  position: relative;
  width: 100%;
  height: 200px;
  overflow: hidden;
}

.sheet-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sheet-hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 30%, #000000 100%);
}

.sheet-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.sheet-close .material-symbols-rounded { font-size: 18px; }

/* Loading */
.sheet-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.sheet-loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--neon-cyan);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Content */
.sheet-content {
  padding: 0 20px 0;
}

/* Title area */
.sheet-title-area {
  margin-bottom: 20px;
}

.sheet-category {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background: rgba(0, 245, 212, 0.1);
  border: 1px solid rgba(0, 245, 212, 0.2);
  color: var(--neon-cyan);
  font-size: 0.65rem;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.sheet-title {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 6px;
  letter-spacing: 0.02em;
}

.sheet-subtitle {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  margin: 0;
}

/* Section */
.sheet-section {
  margin-bottom: 20px;
}

.sheet-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 2px;
  text-transform: uppercase;
  margin: 0 0 10px;
}

/* Skills */
.sheet-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sheet-skill-tag {
  padding: 5px 14px;
  border-radius: var(--radius-full);
  background: rgba(0, 245, 212, 0.08);
  border: 1px solid rgba(0, 245, 212, 0.15);
  color: var(--neon-cyan);
  font-size: 0.75rem;
  letter-spacing: 0.5px;
}

/* Scenarios */
.sheet-scenarios {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sheet-scenario-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: #ffffff;
  line-height: 1.4;
}

/* Starter prompts */
.sheet-prompts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sheet-prompt-btn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
  font-size: 0.8rem;
  line-height: 1.5;
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
  -webkit-tap-highlight-color: transparent;
}

.sheet-prompt-btn:active {
  background: rgba(0, 245, 212, 0.06);
  border-color: rgba(0, 245, 212, 0.15);
}

/* Sources */
.sheet-sources {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sheet-source-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  text-decoration: none;
  color: #ffffff;
  font-size: 0.75rem;
  transition: all var(--duration-fast) var(--ease-default);
}

.sheet-source-item:active {
  background: rgba(255, 255, 255, 0.14);
}

.sheet-source-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Tags */
.sheet-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.sheet-tag {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.5);
}

/* CTA */
.sheet-footer {
  position: sticky;
  bottom: 0;
  margin: 0 -20px;
  padding:
    14px
    20px
    calc(var(--tab-bar-height) + var(--safe-bottom) + 18px);
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.82) 24%, #000 54%);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.sheet-cta {
  width: 100%;
  padding: 14px 24px;
  font-size: 0.95rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
