<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { api } from "@/lib/api"
import {
  projectPrimaryPackSlug,
  skillAvatarBackgroundStyle,
  type SkillAvatarPack,
} from "@/lib/skillAvatar"
import type { ChatSessionBootstrapResponse, ProjectSummary } from "@/types"

const router = useRouter()
const route = useRoute()

const projects = ref<ProjectSummary[]>([])
const packAvatarMap = ref<Record<string, SkillAvatarPack>>({})
const loading = ref(true)
const loadError = ref("")
const sandboxDraft = ref<{ leftProjectId: string; rightProjectId: string; mode: string; createdAt: string } | null>(null)
const sandboxBootstrapping = ref(false)
const sandboxError = ref("")

function primaryPackSlug(project: ProjectSummary) {
  return projectPrimaryPackSlug(project).toLowerCase()
}

function compareProjectPriority(left: ProjectSummary, right: ProjectSummary) {
  const leftChat = left.can_chat_now ? 1 : 0
  const rightChat = right.can_chat_now ? 1 : 0
  if (leftChat !== rightChat) return rightChat - leftChat
  return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
}

const uniqueProjects = computed(() => {
  return [...projects.value].sort((a, b) => compareProjectPriority(a, b))
})

const chatProjects = computed(() =>
  uniqueProjects.value.filter((p) => p.can_chat_now)
)

const activeProjects = computed(() =>
  uniqueProjects.value
    .filter((p) => !p.can_chat_now && (p.status === "distilling" || p.status === "ready_for_distill" || p.status === "draft"))
)
const sandboxLeftProject = computed(() => projects.value.find((project) => project.project_id === sandboxDraft.value?.leftProjectId) || null)
const sandboxRightProject = computed(() => projects.value.find((project) => project.project_id === sandboxDraft.value?.rightProjectId) || null)
const sandboxModeLabel = computed(() => {
  if (!sandboxDraft.value) return ""
  if (sandboxDraft.value.mode === "observe") return "我旁观"
  if (sandboxDraft.value.mode === "left") return `以 ${sandboxLeftProject.value?.subject_name || "当前卡"} 视角`
  return `以 ${sandboxRightProject.value?.subject_name || "对方卡"} 视角`
})
const showSandboxDraft = computed(() => Boolean(route.query.sandbox && sandboxDraft.value && sandboxLeftProject.value && sandboxRightProject.value))

async function loadProjects() {
  loading.value = true
  loadError.value = ""
  try {
    const { data } = await api.get<{ items: ProjectSummary[] }>("/projects")
    projects.value = data.items || []
  } catch (e: any) {
    loadError.value = e.response?.data?.detail || "加载失败"
  } finally {
    loading.value = false
  }
}

function loadSandboxDraft() {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem("distill-human:v3:relationship-sandbox-draft")
    sandboxDraft.value = raw ? JSON.parse(raw) : null
  } catch {
    sandboxDraft.value = null
  }
}

function clearSandboxDraft() {
  sandboxDraft.value = null
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("distill-human:v3:relationship-sandbox-draft")
  }
}

async function enterSandboxChat() {
  const draft = sandboxDraft.value
  if (!draft || !sandboxLeftProject.value || !sandboxRightProject.value) return
  sandboxBootstrapping.value = true
  sandboxError.value = ""
  try {
    const { data } = await api.post<ChatSessionBootstrapResponse>("/relationship-sandbox/bootstrap", {
      left_project_id: draft.leftProjectId,
      right_project_id: draft.rightProjectId,
      mode: draft.mode,
      title: `关系沙盘 · ${sandboxLeftProject.value.subject_name} × ${sandboxRightProject.value.subject_name}`,
    })
    await router.push({
      name: "projects-cyber",
      query: {
        projectId: data.session_detail.project.project_id,
        sessionId: data.session_detail.session.session_id,
        civ: data.session_detail.session.civilization_level,
        sandbox: "1",
      },
    })
  } catch (error: any) {
    sandboxError.value = error?.response?.data?.detail || error?.message || "关系沙盘创建失败"
  } finally {
    sandboxBootstrapping.value = false
  }
}

function goToChat(project: ProjectSummary) {
  const pack = primaryPackSlug(project)
  router.push({
    name: "projects-cyber",
    query: {
      projectId: project.project_id,
      ...(pack ? { pack } : {}),
      ...(project.intake_profile?.output_mode ? { output: project.intake_profile.output_mode } : {}),
      ...(project.intake_profile?.civilization_level ? { civ: project.intake_profile.civilization_level } : {}),
    },
  })
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    draft: "草稿",
    ready_for_distill: "待蒸馏",
    distilling: "蒸馏中",
    report_ready: "报告就绪",
    chat_ready: "可对话",
  }
  return map[status] || status
}

function getStatusColor(status: string) {
  if (status === "chat_ready" || status === "report_ready") return "var(--neon-cyan)"
  if (status === "distilling") return "var(--neon-gold)"
  return "var(--text-secondary)"
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "刚刚"
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}小时前`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD}天前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

async function loadPackAvatars() {
  try {
    const { data } = await api.get<{ items: SkillAvatarPack[] }>("/packs")
    packAvatarMap.value = Object.fromEntries((data.items || []).map((pack) => [pack.slug.toLowerCase(), pack]))
  } catch {
    packAvatarMap.value = {}
  }
}

function projectAvatarPack(project: ProjectSummary) {
  const slug = primaryPackSlug(project)
  return slug ? packAvatarMap.value[slug] : null
}

function projectAvatarStyle(project: ProjectSummary) {
  return skillAvatarBackgroundStyle(projectAvatarPack(project), primaryPackSlug(project) || project.subject_name)
}

onMounted(() => {
  loadSandboxDraft()
  void Promise.all([loadPackAvatars(), loadProjects()])
})
</script>

<template>
  <div class="msg-page">
    <!-- Header -->
    <header class="msg-header">
      <div class="msg-header-inner cyber-animate-in">
        <p class="msg-kicker">MESSAGES</p>
        <h1 class="msg-title">消息</h1>
        <p class="msg-subtitle">与你的智能分身对话</p>
      </div>
    </header>

    <div class="msg-content">
      <section v-if="showSandboxDraft" class="sandbox-draft-banner cyber-animate-in">
        <div class="sandbox-draft-icon">
          <span class="material-symbols-rounded">hub</span>
        </div>
        <div class="sandbox-draft-copy">
          <strong>{{ sandboxLeftProject?.subject_name }} × {{ sandboxRightProject?.subject_name }}</strong>
          <p>{{ sandboxError || `关系沙盘已准备 · 加载内置 skill：关系沙盘编排器 · ${sandboxModeLabel}` }}</p>
        </div>
        <button type="button" class="sandbox-draft-enter" :disabled="sandboxBootstrapping" @click="enterSandboxChat">
          {{ sandboxBootstrapping ? '创建中' : '进入' }}
        </button>
        <button type="button" class="sandbox-draft-close" @click="clearSandboxDraft">
          <span class="material-symbols-rounded">close</span>
        </button>
      </section>

      <!-- Loading -->
      <div v-if="loading" class="msg-state">
        <div class="msg-loading-spinner" />
        <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 12px">加载中...</p>
      </div>

      <!-- Error -->
      <div v-else-if="loadError" class="msg-state">
        <span class="material-symbols-rounded" style="font-size: 36px; color: var(--neon-red); opacity: 0.6">cloud_off</span>
        <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 10px">{{ loadError }}</p>
        <button class="cyber-btn cyber-btn-ghost" style="margin-top: 12px; padding: 6px 16px; font-size: 0.7rem" @click="loadProjects">重新加载</button>
      </div>

      <!-- Empty -->
      <div v-else-if="!chatProjects.length && !activeProjects.length" class="msg-state">
        <span class="material-symbols-rounded" style="font-size: 48px; color: var(--neon-gold); opacity: 0.4">forum</span>
        <p class="cyber-title cyber-title-sm" style="color: var(--text-secondary); margin-top: 12px">暂无对话</p>
        <p class="cyber-caption" style="margin-top: 4px">完成蒸馏后，这里会出现可对话的智能分身</p>
        <button class="cyber-btn cyber-btn-ghost" style="margin-top: 16px; padding: 8px 20px; font-size: 0.75rem" @click="router.push('/projects')">
          <span class="material-symbols-rounded" style="font-size: 16px; margin-right: 4px">science</span>
          开始蒸馏
        </button>
      </div>

      <template v-else>
        <!-- Active / In-progress projects -->
        <section v-if="activeProjects.length" class="msg-section">
          <p class="msg-section-title">进行中</p>
          <div class="msg-list">
            <div
              v-for="project in activeProjects"
              :key="project.project_id"
              class="msg-item msg-item--disabled"
            >
              <div class="msg-avatar" :style="projectAvatarStyle(project)" />
              <div class="msg-body">
                <div class="msg-body-top">
                  <span class="msg-name">{{ project.subject_name }}</span>
                  <span class="msg-status" :style="{ color: getStatusColor(project.status) }">
                    {{ getStatusLabel(project.status) }}
                  </span>
                </div>
                <p class="msg-desc">
                  {{ project.analysis_goal || project.relation_label || "蒸馏准备中..." }}
                </p>
                <p class="msg-time">{{ formatTime(project.updated_at) }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Chat-ready projects -->
        <section v-if="chatProjects.length" class="msg-section">
          <p class="msg-section-title">可对话</p>
          <div class="msg-list">
            <div
              v-for="(project, index) in chatProjects"
              :key="project.project_id"
              class="msg-item cyber-animate-in"
              :style="{ animationDelay: `${index * 60}ms` }"
              @click="goToChat(project)"
            >
              <div class="msg-avatar" :style="projectAvatarStyle(project)" />
              <div class="msg-body">
                <div class="msg-body-top">
                  <span class="msg-name">{{ project.subject_name }}</span>
                  <span class="msg-time-inline">{{ formatTime(project.updated_at) }}</span>
                </div>
                <p class="msg-desc">
                  {{ project.analysis_goal || project.relation_label || "点击进入对话" }}
                </p>
                <div class="msg-tags">
                  <span v-if="project.factory_category_label" class="msg-tag">{{ project.factory_category_label }}</span>
                  <span v-if="project.pack_slug" class="msg-tag msg-tag--skill">Skill</span>
                  <span class="msg-tag msg-tag--chat">可对话</span>
                </div>
              </div>
              <span class="material-symbols-rounded msg-arrow">chevron_right</span>
            </div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.msg-page {
  padding: 0 12px;
  padding-bottom: calc(var(--tab-bar-height) + var(--safe-bottom) + 24px);
}

/* Header */
.msg-header {
  text-align: center;
  padding: 50px 0 20px;
}

.msg-header-inner {
  display: inline-block;
}

.msg-kicker {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  margin: 0 0 6px;
}

.msg-title {
  font-family: var(--font-display);
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.msg-subtitle {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 6px 0 0;
  letter-spacing: 0;
}

/* Content */
.msg-content {
  max-width: 600px;
  margin: 0 auto;
}

.sandbox-draft-banner {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto 34px;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 22%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent-primary) 10%, var(--bg-elevated));
}

.sandbox-draft-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: inline-grid;
  place-items: center;
  background: color-mix(in srgb, var(--accent-primary) 14%, transparent);
  color: var(--accent-primary);
}

.sandbox-draft-copy {
  min-width: 0;
}

.sandbox-draft-copy strong {
  display: block;
  color: var(--text-primary);
  font-size: 0.86rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sandbox-draft-copy p {
  margin: 3px 0 0;
  color: var(--text-secondary);
  font-size: 0.7rem;
}

.sandbox-draft-close {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  background: var(--fill-secondary);
  color: var(--text-secondary);
}

.sandbox-draft-enter {
  height: 34px;
  padding: 0 13px;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 24%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 800;
}

.sandbox-draft-enter:disabled {
  opacity: 0.55;
}

.sandbox-draft-close .material-symbols-rounded {
  font-size: 18px;
}

/* State */
.msg-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.msg-loading-spinner {
  width: 28px;
  height: 28px;
  border: 2px solid color-mix(in srgb, var(--accent-primary) 18%, transparent);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: msg-spin 0.8s linear infinite;
}

@keyframes msg-spin {
  to { transform: rotate(360deg); }
}

/* Section */
.msg-section {
  margin-bottom: 20px;
}

.msg-section-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.06em;
  margin: 0 0 10px 4px;
  text-transform: uppercase;
}

/* List */
.msg-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Item */
.msg-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.2s var(--ease-default);
  -webkit-tap-highlight-color: transparent;
}

.msg-item:not(.msg-item--disabled):active {
  transform: scale(0.98);
  background: rgba(255, 255, 255, 0.06);
}

.msg-item:not(.msg-item--disabled):hover {
  border-color: rgba(245, 166, 35, 0.2);
  background: rgba(255, 255, 255, 0.05);
}

.msg-item--disabled {
  opacity: 0.5;
  cursor: default;
}

/* Avatar */
.msg-avatar {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--separator-soft);
}

/* Body */
.msg-body {
  flex: 1;
  min-width: 0;
}

.msg-body-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.msg-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.msg-status {
  font-size: 0.65rem;
  font-weight: 600;
  flex-shrink: 0;
  letter-spacing: 0.5px;
}

.msg-time-inline {
  font-size: 0.65rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.msg-desc {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin: 3px 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.msg-time {
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.25);
  margin: 2px 0 0;
}

/* Tags */
.msg-tags {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.msg-tag {
  display: inline-block;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  font-size: 0.58rem;
  letter-spacing: 0.5px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}

.msg-tag--skill {
  background: rgba(0, 245, 212, 0.08);
  border-color: rgba(0, 245, 212, 0.15);
  color: var(--neon-cyan);
}

.msg-tag--chat {
  background: rgba(245, 166, 35, 0.08);
  border-color: rgba(245, 166, 35, 0.15);
  color: var(--neon-gold);
}

/* Arrow */
.msg-arrow {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}
</style>
