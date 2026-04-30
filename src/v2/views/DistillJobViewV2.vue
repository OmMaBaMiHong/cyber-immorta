<template>
  <V2AppShell>
    <div class="v2-page">
      <section v-if="project && job" class="v2-hero">
        <div class="v2-hero-grid">
          <div>
            <p class="v2-section-kicker">Async Job</p>
            <h1 class="v2-page-title">{{ project.name }}</h1>
            <p class="v2-page-subtitle">{{ statusMeta.copy }}</p>
            <div class="v2-chip-row">
              <span class="v2-status-pill">{{ statusMeta.label }}</span>
              <span class="v2-chip">素材 {{ project.material_count }}</span>
              <span class="v2-chip">对象 {{ project.subject_name }}</span>
            </div>
            <div v-if="job.error_message" class="v2-danger">{{ job.error_message }}</div>
            <div class="v2-page-actions">
              <button v-if="job.status === 'failed'" class="v2-btn v2-btn--primary" :disabled="retrying" @click="handleRetry">
                {{ retrying ? "重试中..." : "重试蒸馏" }}
              </button>
              <RouterLink v-if="job.status === 'report_ready' || job.status === 'chat_ready'" :to="`/projects/${project.project_id}/report`" class="v2-btn v2-btn--primary">
                查看报告
              </RouterLink>
              <RouterLink v-if="job.status === 'chat_ready'" :to="`/chat/${project.project_id}`" class="v2-btn v2-btn--ghost">
                进入聊天
              </RouterLink>
            </div>
          </div>

          <div class="v2-panel">
            <div class="v2-panel-head">
              <div>
                <p class="v2-section-kicker">Progress</p>
                <h2 class="v2-section-title">{{ progressPercent }}%</h2>
              </div>
              <span class="v2-status-pill">{{ statusMeta.label }}</span>
            </div>
            <div class="v2-progress-bar">
              <div class="v2-progress-fill" :style="{ width: `${progressPercent}%` }" />
            </div>
            <div class="v2-list">
              <div v-for="step in displaySteps" :key="step.key" class="v2-list-item">
                <div>
                  <p>{{ step.title }}</p>
                  <p class="v2-muted">{{ step.copy }}</p>
                </div>
                <span class="v2-status-pill">{{ step.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="project && job" class="v2-grid v2-grid--2">
        <article class="v2-card">
          <div class="v2-panel-head">
            <div>
              <p class="v2-section-kicker">Materials</p>
              <h2 class="v2-section-title">当前素材</h2>
            </div>
          </div>
          <div class="v2-list">
            <div v-for="material in materials" :key="material.material_id" class="v2-list-item">
              <div>
                <p>{{ material.label }}</p>
                <p class="v2-muted">{{ material.content_excerpt || "等待解析文本摘要" }}</p>
              </div>
              <span class="v2-chip">{{ material.evidence_type }}</span>
            </div>
            <div v-if="!materials.length" class="v2-list-item">
              <p class="v2-muted">当前还没有可展示的素材摘要。</p>
            </div>
          </div>
        </article>

        <article class="v2-card">
          <div class="v2-panel-head">
            <div>
              <p class="v2-section-kicker">Timeline</p>
              <h2 class="v2-section-title">真实状态回放</h2>
            </div>
          </div>
          <div class="v2-list">
            <div v-for="(item, index) in timelineRows" :key="`${item}-${index}`" class="v2-list-item">
              <div>
                <p>{{ statusText(item) }}</p>
                <p class="v2-muted">{{ timelineCopy(item) }}</p>
              </div>
              <span class="v2-chip">Step {{ index + 1 }}</span>
            </div>
          </div>
        </article>
      </section>

      <section v-else class="v2-state-card v2-card">
        <p class="v2-section-kicker">Loading</p>
        <h2 class="v2-section-title">正在读取蒸馏任务。</h2>
      </section>
    </div>
  </V2AppShell>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"

import { api } from "@/lib/api"
import type { DistillJob, JobStatus, MaterialSummary, ProjectDetailResponse } from "@/types"
import V2AppShell from "@/v2/components/V2AppShell.vue"

const route = useRoute()
const router = useRouter()

const project = ref<ProjectDetailResponse["project"] | null>(null)
const materials = ref<MaterialSummary[]>([])
const job = ref<DistillJob | null>(null)
const retrying = ref(false)

const activeStatuses = new Set<JobStatus>(["queued", "parsing", "extracting", "distilling", "report_ready"])
const progressMap: Record<JobStatus, number> = {
  queued: 8,
  parsing: 24,
  extracting: 46,
  distilling: 74,
  report_ready: 90,
  chat_ready: 100,
  failed: 100,
}

let pollTimer: number | undefined
let redirectTimer: number | undefined

const progressPercent = computed(() => (job.value ? progressMap[job.value.status] : 0))

const statusMeta = computed(() => {
  switch (job.value?.status) {
    case "queued":
      return { label: "任务排队中", copy: "任务已经创建完成，后端正在准备读取项目素材。" }
    case "parsing":
      return { label: "正在解析素材", copy: "聊天记录、截图和文档正在转成统一的证据片段。" }
    case "extracting":
      return { label: "正在提取证据", copy: "系统正在过滤噪音，整理可用于蒸馏的关键事实和表达模式。" }
    case "distilling":
      return { label: "正在蒸馏画像", copy: "真实推理链路正在生成 memory、persona、cognition 三层结构。" }
    case "report_ready":
      return { label: "报告已生成", copy: "报告已可查看，对话能力会在后台继续装配。" }
    case "chat_ready":
      return { label: "对话已就绪", copy: "报告和对话能力都已经生成完成，页面会自动进入报告页。" }
    case "failed":
      return { label: "任务失败", copy: "这次蒸馏没有成功完成，错误原因已经保留，可以直接重试。" }
    default:
      return { label: "读取中", copy: "正在同步当前任务状态。" }
  }
})

const displaySteps = computed(() => {
  const timeline = new Set(job.value?.timeline || [])
  const current = job.value?.status
  return [
    { key: "parsing", title: "解析原始素材", copy: "统一聊天、截图、文档格式。", ...resolveStepState("parsing", timeline, current) },
    { key: "extracting", title: "提取证据片段", copy: "抽取关键事件、语气、重复模式。", ...resolveStepState("extracting", timeline, current) },
    { key: "distilling", title: "蒸馏画像报告", copy: "输出 memory、persona、cognition 三层结果。", ...resolveStepState("distilling", timeline, current) },
    { key: "chat_ready", title: "装配对话能力", copy: "编译对话技能和引用能力。", ...resolveStepState("chat_ready", timeline, current) },
  ]
})

const timelineRows = computed(() => job.value?.timeline || [])

function resolveStepState(step: JobStatus, timeline: Set<JobStatus>, current?: JobStatus) {
  if (current === "failed" && !timeline.has(step)) return { label: "未执行" }
  if (current === step) return { label: "进行中" }
  if (timeline.has(step) || (step === "chat_ready" && current === "chat_ready")) return { label: "已完成" }
  return { label: "待开始" }
}

function statusText(status: JobStatus) {
  return {
    queued: "任务已创建",
    parsing: "解析素材",
    extracting: "提取证据",
    distilling: "生成报告",
    report_ready: "报告完成",
    chat_ready: "聊天完成",
    failed: "任务失败",
  }[status]
}

function timelineCopy(status: JobStatus) {
  return {
    queued: "任务进入后端队列，等待工作进程接手。",
    parsing: "开始读取并解析文本、截图、附件等素材。",
    extracting: "对素材做结构化处理，沉淀出证据片段。",
    distilling: "把证据蒸成可读报告和人格结构。",
    report_ready: "报告已完成，可直接打开阅读。",
    chat_ready: "聊天能力也准备好了，可以开始对话。",
    failed: "这轮任务出错，错误信息已被保留。",
  }[status]
}

function clearTimers() {
  if (pollTimer) window.clearTimeout(pollTimer)
  if (redirectTimer) window.clearTimeout(redirectTimer)
}

async function loadProject() {
  const projectId = route.params.projectId as string
  const { data } = await api.get<ProjectDetailResponse>(`/projects/${projectId}`)
  project.value = data.project
  materials.value = data.materials
}

async function loadJob() {
  const jobId = route.params.jobId as string
  const { data } = await api.get<DistillJob>(`/jobs/${jobId}`)
  job.value = data
  if (data.status === "report_ready" || data.status === "chat_ready") {
    redirectTimer = window.setTimeout(() => {
      void router.replace(`/projects/${data.project_id}/report`)
    }, 1200)
  }
  if (activeStatuses.has(data.status)) {
    pollTimer = window.setTimeout(() => void refresh(), 1600)
  }
}

async function refresh() {
  clearTimers()
  await Promise.all([loadProject(), loadJob()])
}

async function handleRetry() {
  if (!job.value) return
  retrying.value = true
  try {
    const { data } = await api.post<DistillJob>(`/jobs/${job.value.job_id}/retry`, {})
    router.replace(`/projects/${data.project_id}/jobs/${data.job_id}`)
  } finally {
    retrying.value = false
  }
}

onMounted(() => {
  void refresh()
})

onBeforeUnmount(() => {
  clearTimers()
})
</script>
