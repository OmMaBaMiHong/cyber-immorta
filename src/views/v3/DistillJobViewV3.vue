<template>
  <div class="job-v3-page">
    <section v-if="project && job" class="job-v3-shell">
      <header class="job-v3-header">
        <button type="button" class="job-v3-back" @click="goBack">
          <span class="material-symbols-rounded">arrow_back</span>
        </button>
        <div>
          <p>ASYNC DISTILL</p>
          <h1>{{ project.name }}</h1>
        </div>
      </header>

      <section class="job-v3-hero" :class="`is-${job.status}`">
        <div class="job-v3-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p class="job-v3-kicker">{{ statusMeta.label }}</p>
        <h2>{{ statusMeta.title }}</h2>
        <p>{{ statusMeta.copy }}</p>
        <div class="job-v3-chip-row">
          <span>{{ progressPercent }}%</span>
          <span>素材 {{ project.material_count }}</span>
          <span>{{ project.subject_name }}</span>
        </div>
      </section>

      <section class="job-v3-card-stage" aria-label="三张命运卡生成进度">
        <article v-for="card in destinyCards" :key="card.key" class="job-v3-destiny-card" :class="{ 'is-ready': card.ready }">
          <div class="job-v3-card-glow" />
          <span class="job-v3-card-index">{{ card.index }}</span>
          <strong>{{ card.title }}</strong>
          <p>{{ card.copy }}</p>
        </article>
      </section>

      <section v-if="job.error_message" class="job-v3-error">
        <span class="material-symbols-rounded">error</span>
        <p>{{ job.error_message }}</p>
      </section>

      <div class="job-v3-actions">
        <button v-if="job.status === 'failed'" type="button" class="job-v3-primary" :disabled="retrying" @click="handleRetry">
          {{ retrying ? "重试中..." : "重试生成报告" }}
        </button>
        <button v-if="job.status === 'report_ready' || job.status === 'chat_ready'" type="button" class="job-v3-primary" @click="openReport">
          查看三张命运卡
        </button>
        <button type="button" class="job-v3-secondary" @click="goBackToCyber">
          返回蒸馏
        </button>
      </div>

      <section class="job-v3-progress">
        <div class="job-v3-progress-head">
          <span>PROGRESS</span>
          <strong>{{ progressPercent }}%</strong>
        </div>
        <div class="job-v3-progress-track">
          <div class="job-v3-progress-fill" :style="{ width: `${progressPercent}%` }" />
        </div>
        <div class="job-v3-step-list">
          <div v-for="step in displaySteps" :key="step.key" class="job-v3-step" :class="`is-${step.state}`">
            <span class="job-v3-step-dot" />
            <div>
              <strong>{{ step.title }}</strong>
              <p>{{ step.copy }}</p>
            </div>
          </div>
        </div>
      </section>
    </section>

    <section v-else class="job-v3-loading">
      <span class="material-symbols-rounded">hourglass_top</span>
      <p>正在读取蒸馏任务</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"

import { api } from "@/lib/api"
import type { DistillJob, JobStatus, ProjectDetailResponse } from "@/types"

const route = useRoute()
const router = useRouter()

const project = ref<ProjectDetailResponse["project"] | null>(null)
const job = ref<DistillJob | null>(null)
const retrying = ref(false)

const activeStatuses = new Set<JobStatus>(["queued", "parsing", "extracting", "distilling", "report_ready"])
const progressMap: Record<JobStatus, number> = {
  queued: 8,
  parsing: 24,
  extracting: 46,
  distilling: 74,
  report_ready: 92,
  chat_ready: 100,
  failed: 100,
}

let pollTimer: number | undefined
let redirectTimer: number | undefined

const progressPercent = computed(() => (job.value ? progressMap[job.value.status] : 0))

const storyboard = computed<NonNullable<DistillJob["storyboard"]>>(() => job.value?.storyboard || {})

const statusMeta = computed(() => {
  const meta = storyboard.value.status_meta || {}
  return {
    label: meta.label || job.value?.status || "同步",
    title: meta.title || "Hermes 分镜同步中",
    copy: meta.copy || "正在读取蒸馏机返回的导演分镜。",
  }
})

const destinyCards = computed(() => {
  const cards = storyboard.value.destiny_cards || []
  if (!cards.length) {
    return [
      { key: "storyboard", index: "01", title: "导演分镜", copy: "等待 Hermes 输出", ready: false },
    ]
  }
  return cards.map((card, index) => ({
    key: card.key || `card-${index}`,
    index: card.index || `${index + 1}`.padStart(2, "0"),
    title: card.title || "命运卡",
    copy: card.copy || "正在装配",
    ready: progressPercent.value >= (card.ready_threshold || 100),
  }))
})

const displaySteps = computed(() => {
  const timeline = new Set(job.value?.timeline || [])
  const current = job.value?.status
  const steps = storyboard.value.steps || []
  if (!steps.length) return []
  return steps.map((step) => ({
    key: step.key,
    title: step.title || step.key,
    copy: step.copy || "",
    state: resolveStepState(step.key, timeline, current),
  }))
})

function resolveStepState(step: JobStatus, timeline: Set<JobStatus>, current?: JobStatus) {
  if (current === "failed" && !timeline.has(step)) return "pending"
  if (current === step) return "active"
  if (timeline.has(step) || (step === "chat_ready" && current === "chat_ready")) return "done"
  return "pending"
}

function clearTimers() {
  if (pollTimer) window.clearTimeout(pollTimer)
  if (redirectTimer) window.clearTimeout(redirectTimer)
}

async function loadProject() {
  const projectId = route.params.projectId as string
  const { data } = await api.get<ProjectDetailResponse>(`/projects/${projectId}`)
  project.value = data.project
}

async function loadJob() {
  const jobId = route.params.jobId as string
  const { data } = await api.get<DistillJob>(`/jobs/${jobId}`)
  job.value = data
  if (data.status === "report_ready" || data.status === "chat_ready") {
    redirectTimer = window.setTimeout(() => {
      void router.replace(`/projects/${data.project_id}/report`)
    }, 900)
  }
  if (activeStatuses.has(data.status)) {
    pollTimer = window.setTimeout(() => void refresh(), 1500)
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
    await router.replace(`/projects/${data.project_id}/jobs/${data.job_id}`)
    await refresh()
  } finally {
    retrying.value = false
  }
}

function openReport() {
  if (!project.value) return
  void router.push(`/projects/${project.value.project_id}/report`)
}

function goBackToCyber() {
  if (!project.value) return
  void router.push({ name: "projects-cyber", query: { projectId: project.value.project_id } })
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  goBackToCyber()
}

onMounted(() => {
  void refresh()
})

onBeforeUnmount(() => {
  clearTimers()
})
</script>

<style scoped>
.job-v3-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: calc(env(safe-area-inset-top, 0px) + 18px) 16px calc(var(--tab-bar-height) + var(--safe-bottom) + 24px);
  background:
    radial-gradient(circle at 20% 10%, rgba(39, 226, 193, 0.16), transparent 32%),
    radial-gradient(circle at 90% 20%, rgba(224, 160, 62, 0.14), transparent 30%),
    var(--bg-primary);
  color: var(--text-primary);
}

.job-v3-shell {
  width: min(520px, 100%);
  margin: 0 auto;
}

.job-v3-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  padding-right: 92px;
}

.job-v3-back {
  width: 40px;
  height: 40px;
  border: 1px solid var(--separator-soft);
  border-radius: 50%;
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.job-v3-back .material-symbols-rounded {
  font-size: 21px;
}

.job-v3-header p,
.job-v3-kicker,
.job-v3-progress-head span,
.job-v3-card-index {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 0.72rem;
  letter-spacing: 0.16em;
}

.job-v3-header h1 {
  margin: 4px 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 9vw, 3rem);
  line-height: 0.98;
}

.job-v3-hero,
.job-v3-progress,
.job-v3-error {
  border: 1px solid color-mix(in srgb, var(--neon-cyan) 28%, transparent);
  border-radius: 24px;
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.22);
}

.job-v3-hero {
  position: relative;
  overflow: hidden;
  min-height: 260px;
  padding: 26px 22px;
}

.job-v3-hero h2 {
  position: relative;
  margin: 54px 0 10px;
  max-width: 12ch;
  font-family: var(--font-display);
  font-size: clamp(2.4rem, 15vw, 4.4rem);
  line-height: 0.92;
}

.job-v3-hero p:not(.job-v3-kicker) {
  position: relative;
  max-width: 28ch;
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.65;
}

.job-v3-orbit {
  position: absolute;
  inset: 14px;
  pointer-events: none;
}

.job-v3-orbit span {
  position: absolute;
  inset: 22%;
  border: 1px solid color-mix(in srgb, var(--neon-cyan) 45%, transparent);
  border-radius: 50%;
  animation: jobOrbit 3.8s ease-out infinite;
}

.job-v3-orbit span:nth-child(2) {
  animation-delay: 0.7s;
  border-color: color-mix(in srgb, var(--neon-gold) 42%, transparent);
}

.job-v3-orbit span:nth-child(3) {
  animation-delay: 1.4s;
}

.job-v3-chip-row {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;
}

.job-v3-chip-row span,
.job-v3-secondary,
.job-v3-primary {
  border-radius: 999px;
  font-weight: 700;
}

.job-v3-chip-row span {
  padding: 8px 12px;
  background: color-mix(in srgb, var(--bg-primary) 72%, transparent);
  color: var(--text-primary);
  font-size: 0.78rem;
}

.job-v3-card-stage {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0;
}

.job-v3-destiny-card {
  position: relative;
  overflow: hidden;
  min-height: 158px;
  padding: 14px 12px;
  border: 1px solid var(--separator-soft);
  border-radius: 20px;
  background: color-mix(in srgb, var(--bg-elevated) 84%, transparent);
  opacity: 0.64;
}

.job-v3-destiny-card.is-ready {
  opacity: 1;
  border-color: color-mix(in srgb, var(--neon-cyan) 46%, transparent);
}

.job-v3-card-glow {
  position: absolute;
  inset: auto -20px -34px;
  height: 70px;
  background: radial-gradient(circle, rgba(39, 226, 193, 0.26), transparent 68%);
}

.job-v3-destiny-card strong {
  position: relative;
  display: block;
  margin-top: 34px;
  font-family: var(--font-display);
  font-size: 1.2rem;
  line-height: 1.05;
}

.job-v3-destiny-card p {
  position: relative;
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 0.76rem;
  line-height: 1.45;
}

.job-v3-error {
  display: flex;
  gap: 10px;
  margin: 14px 0;
  padding: 14px;
  border-color: color-mix(in srgb, #ff5b6e 46%, transparent);
  color: #ffb7c0;
}

.job-v3-error .material-symbols-rounded {
  flex: 0 0 auto;
  font-size: 20px;
}

.job-v3-error p {
  max-height: 148px;
  margin: 0;
  overflow: auto;
  font-size: 0.86rem;
  line-height: 1.55;
}

.job-v3-actions {
  display: flex;
  gap: 10px;
  margin: 16px 0;
}

.job-v3-primary,
.job-v3-secondary {
  min-height: 48px;
  border: 0;
  padding: 0 18px;
  font-size: 0.92rem;
}

.job-v3-primary {
  flex: 1;
  background: linear-gradient(135deg, var(--neon-gold), #f4bd5a);
  color: #19120a;
}

.job-v3-primary:disabled {
  opacity: 0.62;
}

.job-v3-secondary {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--separator-soft);
}

.job-v3-progress {
  padding: 18px;
}

.job-v3-progress-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 10px;
}

.job-v3-progress-head strong {
  font-family: var(--font-display);
  font-size: 2rem;
}

.job-v3-progress-track {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-primary) 10%, transparent);
}

.job-v3-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--neon-gold), var(--neon-cyan));
  transition: width 280ms ease;
}

.job-v3-step-list {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.job-v3-step {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.job-v3-step-dot {
  width: 10px;
  height: 10px;
  margin-top: 4px;
  border-radius: 50%;
  background: var(--separator-soft);
}

.job-v3-step.is-done .job-v3-step-dot,
.job-v3-step.is-active .job-v3-step-dot {
  background: var(--neon-cyan);
  box-shadow: 0 0 16px color-mix(in srgb, var(--neon-cyan) 60%, transparent);
}

.job-v3-step strong {
  display: block;
  color: var(--text-primary);
  font-size: 0.92rem;
}

.job-v3-step p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.job-v3-loading {
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  place-items: center;
  gap: 10px;
  color: var(--text-secondary);
}

@keyframes jobOrbit {
  0% {
    opacity: 0.78;
    transform: scale(0.4) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: scale(1.9) rotate(28deg);
  }
}

@media (min-width: 760px) {
  .job-v3-page {
    padding-inline: 24px;
  }
}
</style>
