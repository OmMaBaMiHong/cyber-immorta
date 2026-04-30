<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue"
import { useRouter } from "vue-router"

import { api } from "@/lib/api"
import { skillAvatarBackgroundStyle, skillAvatarLabel } from "@/lib/skillAvatar"
import { useAuthStore } from "@/stores/auth"
import type { DistillTargetConfig, PackSummary, ProjectSummary } from "@/types"

const router = useRouter()
const auth = useAuthStore()

const loading = ref(true)
const loadError = ref(false)
const targets = ref<DistillTargetConfig[]>([])
const enteringTargetKey = ref("")
const trackViewport = ref<HTMLElement | null>(null)
const skillSearchQuery = ref("")
const dreamInputFocused = ref(false)
const skillPacks = ref<PackSummary[]>([])
const skillPacksLoading = ref(false)
const skillPacksLoaded = ref(false)
const skillPacksError = ref(false)

const enabledTargets = computed(() => targets.value.filter((target) => target.enabled))
const hasTargets = computed(() => enabledTargets.value.length > 0)
const hasSkillSearchQuery = computed(() => normalizeIdentity(skillSearchQuery.value).length > 0)
const isDreamInputActive = computed(() => dreamInputFocused.value || hasSkillSearchQuery.value)
const skillPackBySlug = computed(() =>
  new Map(skillPacks.value.map((pack) => [normalizeIdentity(pack.slug), pack]))
)
const filteredSkillPacks = computed(() => {
  const query = normalizeIdentity(skillSearchQuery.value)
  if (!query) return []

  return skillPacks.value
    .map((pack) => ({
      pack,
      score: skillSearchScore(pack, query),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.pack.title.localeCompare(right.pack.title, "zh-Hans-CN"))
    .slice(0, 16)
    .map((item) => item.pack)
})
const hasVisibleSkillPacks = computed(() => filteredSkillPacks.value.length > 0)
const focusedTargetItems = computed(() => enabledTargets.value.slice(0, 12))
const focusedPackItems = computed(() => filteredSkillPacks.value.slice(0, 12))
const shouldShowFocusedPackState = computed(() => hasSkillSearchQuery.value)

function skillSearchScore(pack: PackSummary, query: string) {
  const title = normalizeIdentity(pack.title)
  const slug = normalizeIdentity(pack.slug)
  const avatar = normalizeIdentity(pack.avatar_label)
  const haystack = packHaystack(pack)
  if (title === query || slug === query || avatar === query) return 1000
  if (title.includes(query)) return 760 - title.indexOf(query)
  if (slug.includes(query)) return 680 - slug.indexOf(query)
  if (avatar.includes(query)) return 620
  if (haystack.includes(query)) return 360
  return 0
}

function packHaystack(pack: PackSummary) {
  return [
    pack.slug,
    pack.title,
    pack.subtitle,
    pack.domain,
    pack.display_group,
    pack.display_group_label,
    pack.factory_category,
    pack.factory_category_label,
    ...(pack.tags || []),
    ...(pack.skills || []),
    ...(pack.suitable_for || []),
    ...(pack.repo_entry_preview || []),
  ]
    .map((item) => normalizeIdentity(item))
    .filter(Boolean)
    .join(" ")
}

function packMatchedTarget(pack: PackSummary) {
  const slug = normalizeIdentity(pack.slug)
  const direct = enabledTargets.value.find((target) => {
    const searchableText = [
      target.default_pack_slug,
      ...(target.attached_pack_slugs || []),
    ]
      .map((item) => normalizeIdentity(item))
    return searchableText.includes(slug)
  })
  if (direct) return direct

  return (
    enabledTargets.value.find((target) => target.subject_type === "public_figure") ||
    enabledTargets.value.find((target) => normalizeIdentity(target.relation_label) === "all_humanity") ||
    enabledTargets.value[0] ||
    null
  )
}

function getPackAvatarStyle(pack: PackSummary) {
  return skillAvatarBackgroundStyle(pack, pack.slug)
}

function getPackAvatarLabel(pack: PackSummary) {
  return skillAvatarLabel(pack, pack.title)
}

function targetAvatarPack(target: DistillTargetConfig) {
  const slugs = [
    target.default_pack_slug,
    ...(target.attached_pack_slugs || []),
  ]
    .map((item) => normalizeIdentity(item))
    .filter(Boolean)
  for (const slug of slugs) {
    const pack = skillPackBySlug.value.get(slug)
    if (pack) return pack
  }
  return null
}

function getTargetAvatarStyle(target: DistillTargetConfig) {
  return skillAvatarBackgroundStyle(
    targetAvatarPack(target),
    target.default_pack_slug || target.attached_pack_slugs?.[0] || target.key,
  )
}

function dreamNodeStyle(index: number) {
  const layouts = [
    { x: 50, y: 20, size: 68, opacity: 1 },
    { x: 22, y: 38, size: 76, opacity: 0.9 },
    { x: 77, y: 36, size: 82, opacity: 0.96 },
    { x: 50, y: 48, size: 74, opacity: 1 },
    { x: 18, y: 66, size: 76, opacity: 0.9 },
    { x: 80, y: 68, size: 72, opacity: 0.86 },
    { x: 52, y: 76, size: 62, opacity: 0.44 },
    { x: 30, y: 82, size: 54, opacity: 0.3 },
    { x: 72, y: 82, size: 54, opacity: 0.26 },
  ]
  const item = layouts[index % layouts.length]
  const drift = Math.floor(index / layouts.length) * 5
  return {
    "--dream-x": `${Math.max(10, Math.min(90, item.x + drift))}%`,
    "--dream-y": `${Math.max(10, Math.min(90, item.y + drift))}%`,
    "--dream-size": `${item.size}px`,
    "--dream-opacity": String(item.opacity),
    "--dream-delay": `${index * 70}ms`,
  }
}

function compactDreamNodeStyle(index: number) {
  return {
    "--dream-delay": `${index * 36}ms`,
  }
}

function normalizeIdentity(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase()
}

function primaryPackSlug(project: ProjectSummary) {
  return String(
    project.intake_profile?.skill_router_config?.selected_pack_slugs?.[0] ||
    project.pack_slug ||
    "",
  ).trim().toLowerCase()
}

function compareProjectPriority(left: ProjectSummary, right: ProjectSummary) {
  const leftChat = left.can_chat_now ? 1 : 0
  const rightChat = right.can_chat_now ? 1 : 0
  if (leftChat !== rightChat) return rightChat - leftChat
  return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
}

function matchesTarget(project: ProjectSummary, target: DistillTargetConfig) {
  const targetPackSlugs = new Set([target.default_pack_slug, ...(target.attached_pack_slugs || [])].filter(Boolean).map((item) => item.toLowerCase()))
  const projectPack = primaryPackSlug(project)

  if (projectPack && targetPackSlugs.has(projectPack)) return true
  if (project.subject_type === target.subject_type && normalizeIdentity(project.relation_label) === normalizeIdentity(target.relation_label)) {
    return true
  }
  if (target.subject_type === "self" && project.subject_type === "self") return true
  if ((target.subject_type === "public_figure" || normalizeIdentity(target.relation_label) === "all_humanity") && project.subject_type === "public_figure") {
    return Boolean(projectPack && targetPackSlugs.has(projectPack))
  }
  return false
}

async function findExistingProject(target: DistillTargetConfig) {
  if (!auth.token) return null
  const { data } = await api.get<{ items: ProjectSummary[] }>("/projects")
  const candidates = (data.items || []).filter((project) => matchesTarget(project, target))
  if (!candidates.length) return null
  return [...candidates].sort((a, b) => compareProjectPriority(a, b))[0] || null
}

async function findExistingProjectForPack(packSlug: string) {
  if (!auth.token) return null
  const normalizedPack = normalizeIdentity(packSlug)
  if (!normalizedPack) return null
  const { data } = await api.get<{ items: ProjectSummary[] }>("/projects")
  const candidates = (data.items || []).filter((project) => primaryPackSlug(project) === normalizedPack)
  if (!candidates.length) return null
  return [...candidates].sort((a, b) => compareProjectPriority(a, b))[0] || null
}

async function loadTargets() {
  loading.value = true
  loadError.value = false
  try {
    const { data } = await api.get<{ items: DistillTargetConfig[] }>("/settings/distill-targets")
    targets.value = data.items || []
  } catch (error: any) {
    targets.value = []
    loadError.value = true
  } finally {
    loading.value = false
    await nextTick()
    requestAnimationFrame(() => {
      centerAvatarTrack()
    })
  }
}

async function loadSkillPacks() {
  if (skillPacksLoaded.value || skillPacksLoading.value) return
  skillPacksLoading.value = true
  skillPacksError.value = false
  try {
    const { data } = await api.get<{ items: PackSummary[] }>("/packs")
    skillPacks.value = data.items || []
    skillPacksLoaded.value = true
  } catch {
    skillPacks.value = []
    skillPacksError.value = true
  } finally {
    skillPacksLoading.value = false
  }
}

async function openDistillTarget(target: DistillTargetConfig) {
  enteringTargetKey.value = target.key
  try {
    const existingProject = await findExistingProject(target)
    const existingPack = existingProject ? primaryPackSlug(existingProject) : ""
    await router.push({
      name: "projects-cyber",
      query: {
        targetKey: target.key,
        ...(existingProject ? { projectId: existingProject.project_id } : {}),
        ...(existingProject?.intake_profile?.output_mode ? { output: existingProject.intake_profile.output_mode } : {}),
        ...(existingProject?.intake_profile?.civilization_level ? { civ: existingProject.intake_profile.civilization_level } : {}),
        ...(existingPack ? { pack: existingPack } : {}),
      },
    })
  } finally {
    enteringTargetKey.value = ""
  }
}

async function openSkillPack(pack: PackSummary) {
  const target = packMatchedTarget(pack)
  if (!target) return
  enteringTargetKey.value = target.key
  try {
    const existingProject = await findExistingProjectForPack(pack.slug)
    const existingPack = existingProject ? primaryPackSlug(existingProject) : normalizeIdentity(pack.slug)
    await router.push({
      name: "projects-cyber",
      query: {
        targetKey: target.key,
        pack: existingPack || pack.slug,
        skill: pack.slug,
        ...(existingProject ? { projectId: existingProject.project_id } : {}),
        ...(existingProject?.intake_profile?.output_mode ? { output: existingProject.intake_profile.output_mode } : {}),
        ...(existingProject?.intake_profile?.civilization_level ? { civ: existingProject.intake_profile.civilization_level } : {}),
      },
    })
  } finally {
    enteringTargetKey.value = ""
  }
}

function centerAvatarTrack() {
  const node = trackViewport.value
  if (!node) return
  const maxScroll = node.scrollWidth - node.clientWidth
  if (maxScroll > 0) {
    node.scrollLeft = maxScroll / 2
  }
}

function openInviteFriends() {
  router.push("/friends")
}

function clearDreamInput() {
  skillSearchQuery.value = ""
  dreamInputFocused.value = false
}

watch(skillSearchQuery, async () => {
  if (hasSkillSearchQuery.value) {
    void loadSkillPacks()
  }
  await nextTick()
  requestAnimationFrame(() => {
    centerAvatarTrack()
  })
})

onMounted(() => {
  void loadTargets()
  void loadSkillPacks()
})
</script>

<template>
  <div class="dream-page" :class="{ 'is-searching': isDreamInputActive }">
    <button
      v-if="isDreamInputActive"
      type="button"
      class="dream-close"
      aria-label="关闭搜索"
      @click="clearDreamInput"
    >
      <span class="material-symbols-rounded">close</span>
    </button>

    <header class="dream-header">
      <h1>赛博永生·人类蒸馏计划</h1>
      <p class="dream-subtitle">选择一个灵魂，开始蒸馏</p>
    </header>

    <main class="dream-stage">
      <div v-if="loading" class="dream-loading">
        <span class="dream-loading-dot" />
        <p>正在召唤蒸馏对象</p>
      </div>

      <template v-else-if="hasTargets">
        <div class="dream-bg-cloud" aria-hidden="true">
          <button
            v-for="(target, index) in enabledTargets.slice(0, 8)"
            :key="`ghost-${target.key}`"
            type="button"
            class="dream-ghost"
            :style="dreamNodeStyle(index)"
            tabindex="-1"
          >
            <span class="dream-avatar" :style="getTargetAvatarStyle(target)" />
          </button>
        </div>

        <div v-if="!isDreamInputActive" class="dream-freefield" aria-label="蒸馏对象梦境入口">
          <button type="button" class="dream-node invite-node" :style="dreamNodeStyle(1)" @click="openInviteFriends">
            <span class="material-symbols-rounded">person_add</span>
            <strong>邀请好友</strong>
          </button>

          <button
            v-for="(target, index) in enabledTargets.slice(0, 8)"
            :key="target.key"
            type="button"
            class="dream-node"
            :class="{ 'is-entering': enteringTargetKey === target.key }"
            :style="dreamNodeStyle(index === 0 ? 0 : index + 1)"
            :aria-label="`进入 ${target.label} 的蒸馏过程`"
            @click="openDistillTarget(target)"
          >
            <span class="dream-avatar" :style="getTargetAvatarStyle(target)" />
            <strong>{{ target.label }}</strong>
          </button>
        </div>

        <section v-else class="dream-search-panel">
          <div ref="trackViewport" class="dream-strip" aria-label="蒸馏搜索结果">
            <button type="button" class="dream-strip-card invite-node" @click="openInviteFriends">
              <span class="material-symbols-rounded">person_add</span>
              <strong>邀请好友</strong>
            </button>

            <template v-if="shouldShowFocusedPackState">
              <div v-if="skillPacksLoading" class="dream-strip-state">搜索中</div>
              <button
                v-for="(pack, index) in focusedPackItems"
                v-else-if="hasVisibleSkillPacks"
                :key="pack.slug"
                type="button"
                class="dream-strip-card"
                :style="compactDreamNodeStyle(index)"
                :aria-label="`进入 ${pack.title} skill`"
                @click="openSkillPack(pack)"
              >
                <span class="dream-avatar skill-pack-ring" :style="getPackAvatarStyle(pack)">
                  <span>{{ getPackAvatarLabel(pack) }}</span>
                </span>
                <strong>{{ pack.title }}</strong>
              </button>
              <div v-else class="dream-strip-state">
                <span>{{ skillPacksError ? "搜索失败" : "没有匹配" }}</span>
                <button type="button" @click="skillPacksError ? loadSkillPacks() : skillSearchQuery = ''">
                  {{ skillPacksError ? "重试" : "清空" }}
                </button>
              </div>
            </template>

            <button
              v-for="(target, index) in focusedTargetItems"
              v-else
              :key="target.key"
              type="button"
              class="dream-strip-card"
              :style="compactDreamNodeStyle(index)"
              :aria-label="`进入 ${target.label} 的蒸馏过程`"
              @click="openDistillTarget(target)"
            >
              <span class="dream-avatar" :style="getTargetAvatarStyle(target)" />
              <strong>{{ target.label }}</strong>
            </button>
          </div>
        </section>
      </template>

      <div v-else-if="loadError" class="dream-loading dream-loading--error">
        <p>蒸馏对象加载失败</p>
        <button type="button" @click="loadTargets">重新加载</button>
      </div>

      <div v-else class="dream-loading">
        <p>暂无可蒸馏的对象</p>
      </div>
    </main>

    <footer class="dream-composer" :class="{ 'is-active': isDreamInputActive }">
      <div class="dream-input-shell">
        <span class="material-symbols-rounded dream-input-icon" aria-hidden="true">search</span>
        <input
          v-model="skillSearchQuery"
          type="search"
          autocomplete="off"
          placeholder="搜索赛博世界 Skill"
          aria-label="搜索赛博世界 Skill"
          @focus="dreamInputFocused = true; loadSkillPacks()"
        />
      </div>
    </footer>
  </div>
</template>

<style scoped>
.dream-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  padding: max(16px, env(safe-area-inset-top, 0px)) 18px calc(var(--tab-bar-height) + var(--safe-bottom) + 24px);
  background:
    radial-gradient(circle at 50% 35%, rgba(47, 52, 68, 0.2), transparent 34%),
    linear-gradient(180deg, #0e0e13 0%, #09090d 55%, #07070a 100%);
  color: #eef3f6;
}

.dream-page::after {
  content: "";
  position: absolute;
  inset: auto 0 0;
  height: 26%;
  background: linear-gradient(180deg, transparent, rgba(7, 7, 10, 0.72) 64%, #07070a);
  pointer-events: none;
  z-index: 4;
}

.dream-header {
  position: relative;
  z-index: 12;
  display: grid;
  justify-items: center;
  gap: 4px;
  padding-top: 34px;
  transition: padding-top 0.28s ease;
}

.dream-page.is-searching .dream-header {
  padding-top: 24px;
}

.dream-header h1 {
  margin: 0;
  max-width: min(100%, 420px);
  color: #ecf4fb;
  font-size: clamp(1.2rem, 4.6vw, 1.72rem);
  font-weight: 780;
  line-height: 1.22;
  letter-spacing: 0;
  text-align: center;
}

.dream-subtitle {
  margin: 0;
  color: rgba(210, 215, 224, 0.62);
  font-size: 0.78rem;
  font-weight: 680;
  line-height: 1.4;
  text-align: center;
}

.dream-close {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 40px);
  left: 20px;
  z-index: 30;
  width: 44px;
  height: 44px;
  display: inline-grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: rgba(236, 242, 248, 0.9);
  cursor: pointer;
}

.dream-close .material-symbols-rounded {
  font-size: 36px;
  font-weight: 300;
}

.dream-stage {
  position: relative;
  z-index: 6;
  height: calc(100dvh - 206px - var(--tab-bar-height) - var(--safe-bottom));
  min-height: 430px;
}

.dream-freefield,
.dream-bg-cloud {
  position: absolute;
  inset: 0;
}

.dream-bg-cloud {
  z-index: 1;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.28s ease;
}

.dream-page.is-searching .dream-bg-cloud {
  opacity: 1;
}

.dream-ghost {
  position: absolute;
  left: var(--dream-x);
  top: var(--dream-y);
  width: var(--dream-size);
  height: var(--dream-size);
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  opacity: 0.58;
  transform: translate(-50%, -50%) scale(1.34);
  filter: blur(18px) saturate(0.78) brightness(0.78);
}

.dream-ghost .dream-avatar {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}

.dream-page.is-searching .dream-freefield {
  opacity: 0;
  transform: scale(1.03);
  filter: blur(18px);
  pointer-events: none;
}

.dream-node {
  position: absolute;
  left: var(--dream-x);
  top: var(--dream-y);
  z-index: 8;
  width: max(var(--dream-size), 68px);
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(205, 207, 217, 0.76);
  opacity: var(--dream-opacity);
  transform: translate(-50%, -50%);
  cursor: pointer;
  animation: dream-pop 0.42s ease both;
  animation-delay: var(--dream-delay);
  -webkit-tap-highlight-color: transparent;
}

.dream-node:active {
  transform: translate(-50%, calc(-50% - 5px)) scale(1.03);
}

.dream-node strong,
.dream-strip-card strong {
  max-width: 92px;
  overflow: hidden;
  color: rgba(204, 206, 217, 0.72);
  font-size: 0.78rem;
  font-weight: 720;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dream-avatar {
  position: relative;
  width: var(--dream-size, 64px);
  height: var(--dream-size, 64px);
  display: inline-grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: #191b23;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.28);
}

.dream-node.is-entering .dream-avatar,
.dream-strip-card:active .dream-avatar {
  box-shadow: 0 0 0 4px rgba(238, 242, 248, 0.16), 0 18px 44px rgba(0, 0, 0, 0.4);
}

.invite-node {
  color: rgba(237, 241, 248, 0.9);
}

.invite-node > .material-symbols-rounded,
.dream-strip-card.invite-node > .material-symbols-rounded {
  width: var(--dream-size, 64px);
  height: var(--dream-size, 64px);
  display: inline-grid;
  place-items: center;
  border: 1.5px dashed rgba(232, 235, 243, 0.58);
  border-radius: 50%;
  background: #20232c;
  color: rgba(247, 249, 253, 0.96);
  font-size: calc(var(--dream-size, 70px) * 0.44);
}

.dream-search-panel {
  position: absolute;
  left: -18px;
  right: -18px;
  bottom: 108px;
  z-index: 14;
}

.dream-strip {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  overflow-x: auto;
  overflow-y: visible;
  padding: 22px 48px 4px;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 84%, transparent 100%);
  mask-image: linear-gradient(90deg, #000 0%, #000 84%, transparent 100%);
}

.dream-strip::-webkit-scrollbar {
  display: none;
}

.dream-strip-card {
  min-width: 60px;
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(205, 207, 217, 0.76);
  cursor: pointer;
  animation: dream-strip-pop 0.3s ease both;
  animation-delay: var(--dream-delay);
  -webkit-tap-highlight-color: transparent;
}

.dream-strip-card .dream-avatar,
.dream-strip-card.invite-node > .material-symbols-rounded {
  --dream-size: 48px;
  width: 48px;
  height: 48px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.26);
}

.dream-strip-card strong {
  max-width: 70px;
  font-size: 0.72rem;
}

.skill-pack-ring {
  background-color: #141720;
  background-size: cover;
  background-position: center;
}

.skill-pack-ring > span {
  display: inline-grid;
  place-items: center;
  width: 29px;
  height: 29px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.42);
  color: #f6f0e6;
  font-family: var(--font-display);
  font-size: 0.94rem;
  font-weight: 850;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.72);
}

.dream-strip-state {
  min-width: 140px;
  min-height: 94px;
  display: grid;
  place-items: center;
  gap: 8px;
  color: rgba(205, 207, 217, 0.74);
  font-size: 0.92rem;
  font-weight: 750;
}

.dream-strip-state button {
  border: 0;
  background: transparent;
  color: rgba(239, 243, 250, 0.88);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.dream-composer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(var(--tab-bar-height) + var(--safe-bottom) + 12px);
  z-index: 18;
  display: grid;
  justify-items: center;
  gap: 16px;
  padding: 0 20px;
  transition: bottom 0.28s ease, gap 0.28s ease;
}

.dream-composer.is-active {
  bottom: calc(var(--tab-bar-height) + var(--safe-bottom) + 12px);
  gap: 12px;
}

.dream-input-shell {
  width: min(100%, 500px);
  min-height: 50px;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  column-gap: 10px;
  align-items: center;
  padding: 0 18px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background:
    linear-gradient(90deg, rgba(70, 78, 67, 0.3), rgba(43, 48, 58, 0.62), rgba(93, 50, 55, 0.24)),
    rgba(30, 31, 38, 0.78);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.05),
    0 14px 38px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.dream-composer.is-active .dream-input-shell {
  width: min(100%, 560px);
  min-height: 52px;
  border-color: rgba(111, 230, 223, 0.32);
  background:
    linear-gradient(90deg, rgba(50, 58, 59, 0.62), rgba(36, 39, 48, 0.82), rgba(57, 46, 54, 0.58)),
    rgba(21, 23, 30, 0.88);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    0 14px 42px rgba(0, 0, 0, 0.4);
}

.dream-input-icon {
  color: rgba(211, 221, 229, 0.66);
  font-size: 21px;
  font-weight: 300;
}

.dream-input-shell input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: rgba(230, 235, 243, 0.96);
  font: inherit;
  font-size: 0.98rem;
  font-weight: 680;
  line-height: 1.2;
  text-align: left;
  letter-spacing: 0;
  caret-color: #67e6e2;
}

.dream-input-shell input::placeholder {
  color: rgba(204, 209, 220, 0.78);
}

.dream-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 14px;
  color: rgba(210, 214, 224, 0.7);
  text-align: center;
}

.dream-loading-dot {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(225, 230, 238, 0.18);
  animation: dream-pulse 1.2s ease-in-out infinite;
}

.dream-loading p {
  margin: 0;
  font-weight: 760;
}

.dream-loading button {
  border: 0;
  background: transparent;
  color: #eef3f6;
  font: inherit;
  cursor: pointer;
}

@keyframes dream-pop {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 14px)) scale(0.9);
  }
  to {
    opacity: var(--dream-opacity, 1);
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes dream-strip-pop {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.94);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes dream-pulse {
  50% {
    opacity: 0.45;
    transform: scale(0.82);
  }
}

@media (min-width: 720px) {
  .dream-page {
    padding-inline: max(18px, calc((100vw - 720px) / 2));
  }

  .dream-stage {
    max-width: 720px;
    margin: 0 auto;
  }
}

@media (max-width: 480px) {
  .dream-page {
    padding-inline: 14px;
  }

  .dream-header {
    padding-top: 44px;
  }

  .dream-page.is-searching .dream-header {
    padding-top: 30px;
  }

  .dream-header h1 {
    max-width: 300px;
    font-size: 1.24rem;
  }

  .dream-stage {
    height: calc(100dvh - 202px - var(--tab-bar-height) - var(--safe-bottom));
    min-height: 430px;
  }

  .dream-node {
    width: max(var(--dream-size), 62px);
  }

  .dream-node strong {
    max-width: 76px;
    font-size: 0.72rem;
  }

  .dream-search-panel {
    bottom: 104px;
  }

  .dream-strip {
    gap: 12px;
    padding: 18px 42px 4px;
  }

  .dream-strip-card {
    min-width: 56px;
  }

  .dream-strip-card .dream-avatar,
  .dream-strip-card.invite-node > .material-symbols-rounded {
    --dream-size: 46px;
    width: 46px;
    height: 46px;
  }

  .dream-strip-card strong {
    max-width: 64px;
    font-size: 0.7rem;
  }

  .dream-composer {
    padding-inline: 16px;
  }

  .dream-input-shell {
    min-height: 48px;
    padding-inline: 16px;
  }

  .dream-composer.is-active .dream-input-shell {
    min-height: 50px;
  }

  .dream-input-shell input {
    font-size: 0.94rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dream-node,
  .dream-strip-card,
  .dream-loading-dot,
  .dream-freefield,
  .dream-bg-cloud,
  .dream-composer,
  .dream-header {
    animation: none !important;
    transition: none !important;
  }
}
</style>
