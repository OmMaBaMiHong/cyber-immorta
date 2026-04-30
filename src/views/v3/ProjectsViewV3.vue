<script setup lang="ts">
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import { api } from "@/lib/api"
import type { ProjectSummary } from "@/types"

const router = useRouter()

type ProjectListItem = ProjectSummary & {
  distill_mode?: string
  has_report?: boolean
}

const projects = ref<ProjectListItem[]>([])
const loading = ref(true)

const statusMap: Record<string, { label: string; color: string }> = {
  idle: { label: "待加料", color: "var(--fg-tertiary)" },
  materials_ready: { label: "就绪", color: "var(--accent-amber)" },
  distilling: { label: "蒸馏中", color: "var(--accent-blue)" },
  completed: { label: "已完成", color: "var(--accent-green)" },
  failed: { label: "失败", color: "var(--color-error)" },
}

const modeMap: Record<string, { label: string; icon: string }> = {
  gentle: { label: "小火蒸馏", icon: "local_fire_department" },
  fierce: { label: "猛火蒸馏", icon: "whatshot" },
}

function getStatusInfo(status: string) {
  return statusMap[status] || { label: status, color: "var(--fg-tertiary)" }
}

function getModeInfo(mode: string) {
  return modeMap[mode] || { label: mode, icon: "science" }
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(dateStr).toLocaleDateString("zh-CN")
}

function goToNewProject() {
  router.push("/projects/new")
}

function goToProject(project: ProjectSummary) {
  router.push({
    name: "projects-cyber",
    query: {
      projectId: project.project_id,
      ...(project.intake_profile?.output_mode ? { output: project.intake_profile.output_mode } : {}),
      ...(project.intake_profile?.civilization_level ? { civ: project.intake_profile.civilization_level } : {}),
    },
  })
}

function goToReport(project: ProjectSummary) {
  router.push(`/projects/${project.project_id}/report`)
}

async function loadProjects() {
  loading.value = true
  try {
    const { data } = await api.get<{ items: ProjectListItem[] }>("/projects")
    projects.value = data.items || []
  } catch {
    projects.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadProjects()
})
</script>

<template>
  <div class="v3-page">
    <!-- Header -->
    <header class="v3-page-header">
      <div class="v3-animate-in" style="animation-delay: 0ms">
        <p class="v3-micro" style="color: var(--accent-amber); margin-bottom: 8px">DISTILL LAB</p>
        <h1 class="v3-title-1">人类 3.0 工作台</h1>
        <p class="v3-caption" style="margin-top: 8px">管理你的蒸馏项目与智能分身</p>
      </div>
    </header>

    <div class="v3-page-content">
      <!-- Stats Bar -->
      <div
        v-if="!loading && projects.length"
        class="v3-stats-bar glass-2 v3-animate-in"
        style="animation-delay: 80ms"
      >
        <div class="v3-stats-item">
          <span class="v3-stats-value">{{ projects.length }}</span>
          <span class="v3-stats-label">项目</span>
        </div>
        <div class="v3-stats-divider" />
        <div class="v3-stats-item">
          <span class="v3-stats-value">{{ projects.filter(p => p.has_report).length }}</span>
          <span class="v3-stats-label">报告</span>
        </div>
        <div class="v3-stats-divider" />
        <div class="v3-stats-item">
          <span class="v3-stats-value">{{ projects.reduce((sum, p) => sum + p.material_count, 0) }}</span>
          <span class="v3-stats-label">素材</span>
        </div>
      </div>

      <!-- New Project Button -->
      <button
        class="v3-new-btn glass-2 v3-animate-in"
        style="animation-delay: 160ms"
        @click="goToNewProject"
      >
        <span class="material-symbols-rounded" style="font-size: 28px; color: var(--accent-amber)">add_circle</span>
        <div class="v3-new-btn-text">
          <span class="v3-title-3">开始新的蒸馏</span>
          <span class="v3-caption">选择灵魂 · 踏入赛博世界</span>
        </div>
        <span class="material-symbols-rounded" style="color: var(--fg-tertiary)">chevron_right</span>
      </button>

      <!-- Project List -->
      <div v-if="loading" class="v3-loading-state v3-animate-in" style="animation-delay: 240ms">
        <div class="v3-loading-spinner" />
        <p class="v3-caption">加载中...</p>
      </div>

      <div v-else-if="!projects.length" class="v3-empty-state v3-animate-in" style="animation-delay: 240ms">
        <div class="v3-empty-icon">
          <span class="material-symbols-rounded" style="font-size: 48px; color: var(--fg-tertiary)">science</span>
        </div>
        <p class="v3-title-3" style="color: var(--fg-secondary)">还没有蒸馏项目</p>
        <p class="v3-caption" style="margin-top: 4px">点击上方按钮，开始你的第一次赛博蒸馏</p>
      </div>

      <div v-else class="v3-project-list v3-stagger">
        <div
          v-for="project in projects"
          :key="project.project_id"
          class="v3-project-card glass-2 v3-animate-in"
          @click="goToProject(project)"
        >
          <!-- Top accent line -->
          <div
            class="v3-project-accent"
            :style="{
              background: project.distill_mode === 'fierce'
                ? 'linear-gradient(90deg, var(--accent-amber), var(--accent-orange))'
                : 'linear-gradient(90deg, var(--accent-blue), var(--accent-cyan))'
            }"
          />

          <div class="v3-project-body">
            <div class="v3-project-info">
              <div class="v3-project-avatar">
                <span class="material-symbols-rounded" style="font-size: 20px; color: var(--fg-secondary)">
                  {{ getModeInfo(project.distill_mode || "").icon }}
                </span>
              </div>
              <div class="v3-project-meta">
                <h3 class="v3-project-name">{{ project.name }}</h3>
                <div class="v3-project-tags">
                  <span class="v3-tag" :style="{ color: getStatusInfo(project.status).color }">
                    {{ getStatusInfo(project.status).label }}
                  </span>
                  <span class="v3-tag v3-tag-muted">
                    {{ getModeInfo(project.distill_mode || "").label }}
                  </span>
                </div>
              </div>
            </div>

            <div class="v3-project-footer">
              <span class="v3-caption">{{ timeAgo(project.updated_at) }}</span>
              <div class="v3-project-actions" @click.stop>
                <button
                  v-if="project.has_report"
                  class="v3-action-btn"
                  title="查看报告"
                  @click="goToReport(project)"
                >
                  <span class="material-symbols-rounded" style="font-size: 18px">description</span>
                </button>
                <button
                  v-if="project.has_report"
                  class="v3-action-btn"
                  title="分享"
                >
                  <span class="material-symbols-rounded" style="font-size: 18px">share</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Stats Bar */
.v3-stats-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 16px 20px;
  border-radius: var(--radius-lg);
  margin-bottom: 16px;
}

.v3-stats-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.v3-stats-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--fg-primary);
  font-family: var(--font-display);
}

.v3-stats-label {
  font-size: 11px;
  color: var(--fg-tertiary);
  font-weight: 500;
}

.v3-stats-divider {
  width: 0.5px;
  height: 28px;
  background: var(--border-glass-strong);
}

/* New Project Button */
.v3-new-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px 18px;
  border-radius: var(--radius-lg);
  margin-bottom: 24px;
  cursor: pointer;
  border: none;
  outline: none;
  text-align: left;
  transition: all var(--duration-fast) var(--ease-default);
  -webkit-tap-highlight-color: transparent;
}

.v3-new-btn:active {
  transform: scale(0.98);
}

.v3-new-btn-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Project List */
.v3-project-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Project Card */
.v3-project-card {
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
  -webkit-tap-highlight-color: transparent;
}

.v3-project-card:active {
  transform: scale(0.98);
}

.v3-project-accent {
  height: 3px;
  width: 100%;
}

.v3-project-body {
  padding: 14px 16px;
}

.v3-project-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.v3-project-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--bg-glass-3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.v3-project-meta {
  flex: 1;
  min-width: 0;
}

.v3-project-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.v3-project-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.v3-tag {
  font-size: 11px;
  font-weight: 500;
}

.v3-tag-muted {
  color: var(--fg-tertiary);
}

.v3-project-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 0.5px solid var(--border-glass);
}

.v3-project-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.v3-action-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: none;
  border: none;
  outline: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-secondary);
  transition: all var(--duration-fast) var(--ease-default);
  -webkit-tap-highlight-color: transparent;
}

.v3-action-btn:active {
  background: var(--bg-glass-3);
  transform: scale(0.9);
}

/* Empty State */
.v3-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.v3-empty-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--bg-glass-2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

/* Loading State */
.v3-loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
}

.v3-loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-glass);
  border-top-color: var(--accent-amber);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
