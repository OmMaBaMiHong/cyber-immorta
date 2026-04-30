<template>
  <section class="tool-v2-shell">
    <div class="tool-v2-atmosphere"></div>
    <canvas ref="canvasRef" class="tool-v2-canvas"></canvas>

    <header class="tool-v2-nav">
      <button type="button" class="tool-v2-brand" @click="$emit('back-projects')">
        <span class="tool-v2-brand-mark">DH</span>
        <span class="tool-v2-brand-text">DISTILL.HUMAN</span>
      </button>

      <div class="tool-v2-nav-actions">
        <span class="tool-v2-pill tool-v2-pill--status">{{ statusLabel }}</span>
        <button type="button" class="tool-v2-pill" @click="$emit('open-report')">查看报告</button>
      </div>
    </header>

    <div class="tool-v2-layout">
      <section class="tool-v2-hero">
        <div class="tool-v2-kicker-row">
          <span class="tool-v2-kicker">
            <span class="tool-v2-kicker-dot"></span>
            {{ isSbtiTool ? "SBTI 赛博人格测试" : "工具型蒸馏会话" }}
          </span>
          <span class="tool-v2-kicker-note">{{ kickerNote }}</span>
        </div>

        <div class="tool-v2-hero-main">
          <div>
            <h1 class="tool-v2-title serif">{{ assistantDisplayName }}</h1>
            <p class="tool-v2-subtitle">{{ assistantSubtitle }}</p>
          </div>
          <div class="tool-v2-avatar" :style="assistantAvatarStyle" />
        </div>

        <p class="tool-v2-summary">{{ toolSummary }}</p>

        <div class="tool-v2-meta-row">
          <span v-for="tag in previewTags" :key="tag" class="tool-v2-chip">{{ tag }}</span>
        </div>
      </section>

      <section class="tool-v2-stage">
        <div class="tool-v2-step-indicator">
          <template v-for="(step, index) in stageSteps" :key="step.id">
            <div class="tool-v2-step-dot" :class="step.state">{{ index + 1 }}</div>
            <div v-if="index < stageSteps.length - 1" class="tool-v2-step-line" :class="lineState(index)"></div>
          </template>
        </div>

        <div class="tool-v2-step-captions">
          <div v-for="step in stageSteps" :key="`${step.id}-caption`" class="tool-v2-step-caption">
            <p class="tool-v2-step-title">{{ step.title }}</p>
            <p class="tool-v2-step-copy">{{ step.copy }}</p>
          </div>
        </div>

        <section v-if="currentStep === 1" class="tool-v2-panel tool-v2-view">
          <div class="tool-v2-panel-head">
            <div>
              <p class="tool-v2-section-label">Step 1</p>
              <h2 class="tool-v2-panel-title">定方向</h2>
            </div>
            <span class="tool-v2-mini-pill">{{ projectName }}</span>
          </div>

          <p class="tool-v2-panel-copy">先选当前会话要进入的模式。这里不走专家池，不走复刻人，直接进入 skill 对应流程。</p>

          <div class="tool-v2-option-grid">
            <button
              v-for="option in starterOptions"
              :key="option.prompt"
              type="button"
              class="tool-v2-option"
              :class="{ 'is-selected': option.prompt === selectedPrompt }"
              @click="selectOption(option.prompt)"
            >
              <span class="tool-v2-option-index">{{ option.short }}</span>
              <span class="tool-v2-option-body">
                <span class="tool-v2-option-title">{{ option.title }}</span>
                <span class="tool-v2-option-copy">{{ option.copy }}</span>
              </span>
            </button>
          </div>

          <div class="tool-v2-focus-box">
            <p class="tool-v2-section-label">会话重点</p>
            <div class="tool-v2-focus-row">
              <button
                v-for="focus in focusChips"
                :key="focus.value"
                type="button"
                class="tool-v2-focus-chip"
                :class="{ 'is-selected': focus.value === selectedFocus }"
                @click="selectedFocus = focus.value"
              >
                {{ focus.label }}
              </button>
            </div>
          </div>

          <div class="tool-v2-assistant-box">
            <div class="tool-v2-assistant-icon">AI</div>
            <div>
              <p class="tool-v2-assistant-title">蒸馏助手</p>
              <p class="tool-v2-assistant-copy">{{ assistantHelperCopy }}</p>
            </div>
          </div>

          <div class="tool-v2-actions">
            <button type="button" class="tool-v2-btn tool-v2-btn--primary" @click="goToStep(2)">
              进入下一步
            </button>
          </div>
        </section>

        <section v-else-if="currentStep === 2" class="tool-v2-panel tool-v2-view">
          <div class="tool-v2-panel-head">
            <div>
              <p class="tool-v2-section-label">Step 2</p>
              <h2 class="tool-v2-panel-title">开始测试</h2>
            </div>
            <span class="tool-v2-mini-pill">{{ focusLabel }}</span>
          </div>

          <div class="tool-v2-entry-grid">
            <button
              v-for="option in starterOptions"
              :key="`${option.prompt}-entry`"
              type="button"
              class="tool-v2-entry-card"
              :class="{ 'is-selected': option.prompt === selectedPrompt }"
              :disabled="sending"
              @click="triggerStarter(option.prompt)"
            >
              <span class="tool-v2-entry-label">{{ option.title }}</span>
              <span class="tool-v2-entry-copy">{{ option.copy }}</span>
            </button>
          </div>

          <div class="tool-v2-composer-box">
            <label class="tool-v2-section-label" for="tool-v2-input">输入内容</label>
            <textarea
              id="tool-v2-input"
              ref="composerRef"
              class="tool-v2-textarea"
              :value="draft"
              :placeholder="modePlaceholder"
              :disabled="!hasSession || sending"
              @input="handleInput"
              @keydown="handleKeydown"
            />
            <div class="tool-v2-composer-foot">
              <p class="tool-v2-composer-hint">{{ sending ? progressLabel : "Enter 发送，Shift + Enter 换行。" }}</p>
              <div class="tool-v2-actions">
                <button type="button" class="tool-v2-btn tool-v2-btn--ghost" @click="goToStep(1)">返回</button>
                <button type="button" class="tool-v2-btn tool-v2-btn--ghost" @click="prefillSelectedPrompt">填入当前入口</button>
                <button type="button" class="tool-v2-btn tool-v2-btn--primary" :disabled="!draft.trim() || sending || !hasSession" @click="sendNow">
                  {{ sending ? "发送中..." : "开始测试" }}
                </button>
              </div>
            </div>
          </div>

          <div class="tool-v2-thread-card">
            <div class="tool-v2-thread-head">
              <p class="tool-v2-section-label">实时对话</p>
              <span class="tool-v2-mini-pill">消息 {{ messages.length }}</span>
            </div>

            <div ref="threadRef" class="tool-v2-thread">
              <div v-if="!messages.length" class="tool-v2-thread-empty">
                <div class="tool-v2-thread-empty-mark" :style="assistantAvatarStyle" />
                <p class="tool-v2-thread-empty-title">{{ welcomeMessage }}</p>
                <p class="tool-v2-thread-empty-copy">你可以直接发起测试，也可以补一句你想先看的重点。</p>
              </div>

              <div
                v-for="message in messages"
                :key="message.message_id"
                class="tool-v2-thread-row"
                :class="{ 'is-user': message.role === 'user' }"
              >
                <div
                  class="tool-v2-thread-avatar"
                  :class="message.role === 'assistant' ? 'is-assistant' : 'is-user'"
                  :style="message.role === 'assistant' ? assistantAvatarStyle : undefined"
                >
                  {{ message.role === "assistant" ? "" : userAvatarLabel }}
                </div>
                <div class="tool-v2-thread-bubble-stack">
                  <p class="tool-v2-bubble-name">{{ message.role === "assistant" ? assistantDisplayName : "你" }}</p>
                  <div class="tool-v2-bubble" :class="message.role === 'assistant' ? 'is-assistant' : 'is-user'">
                    <p class="tool-v2-bubble-text">{{ message.content }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-else class="tool-v2-panel tool-v2-view">
            <div v-if="sending" class="tool-v2-progress-state">
            <div class="tool-v2-progress-orb" :style="assistantAvatarStyle" />
            <h2 class="tool-v2-panel-title">正在蒸馏中...</h2>
            <p class="tool-v2-panel-copy">{{ progressLabel }}</p>
            <div class="tool-v2-progress-bar">
              <div class="tool-v2-progress-fill" :style="{ width: `${progressPercent}%` }"></div>
            </div>
          </div>

          <template v-else>
            <div class="tool-v2-panel-head">
              <div>
                <p class="tool-v2-section-label">Step 3</p>
                <h2 class="tool-v2-panel-title">结果与报告</h2>
              </div>
              <span class="tool-v2-mini-pill">{{ finalStateLabel }}</span>
            </div>

            <div class="tool-v2-report-grid">
              <div v-for="metric in reportMetrics" :key="metric.label" class="tool-v2-metric-card">
                <p class="tool-v2-metric-value" :class="metric.tone">{{ metric.value }}</p>
                <p class="tool-v2-metric-label">{{ metric.label }}</p>
              </div>
            </div>

            <div class="tool-v2-dual-grid">
              <article class="tool-v2-report-card tool-v2-report-card--hero">
                <div class="tool-v2-report-header">
                  <div>
                    <p class="tool-v2-section-label">MBTI / SBTI 卡片</p>
                    <h3 class="tool-v2-report-title">{{ reportTitle }}</h3>
                  </div>
                  <span class="tool-v2-mini-pill">{{ reportCode }}</span>
                </div>

                <div class="tool-v2-letter-row">
                  <span v-for="letter in reportLetters" :key="letter.key" class="tool-v2-letter" :class="letter.active ? 'is-active' : 'is-muted'">
                    {{ letter.value }}
                  </span>
                </div>

                <p class="tool-v2-report-copy">{{ reportMotto }}</p>

                <div class="tool-v2-tag-row">
                  <span v-for="tag in reportKeywords" :key="tag" class="tool-v2-chip">{{ tag }}</span>
                </div>
              </article>

              <article class="tool-v2-report-card">
                <div class="tool-v2-report-header">
                  <div>
                    <p class="tool-v2-section-label">方案建议</p>
                    <h3 class="tool-v2-report-title">继续往下聊什么</h3>
                  </div>
                </div>

                <div class="tool-v2-advice-list">
                  <div v-for="card in adviceCards" :key="card.title" class="tool-v2-advice-card">
                    <p class="tool-v2-advice-title">{{ card.title }}</p>
                    <p class="tool-v2-advice-copy">{{ card.copy }}</p>
                  </div>
                </div>
              </article>
            </div>

            <article class="tool-v2-report-card">
              <div class="tool-v2-report-header">
                <div>
                  <p class="tool-v2-section-label">复刻对话</p>
                  <h3 class="tool-v2-report-title">当前会话摘录</h3>
                </div>
              </div>

              <div class="tool-v2-preview-thread">
                <div
                  v-for="item in conversationPreview"
                  :key="item.key"
                  class="tool-v2-preview-row"
                  :class="{ 'is-user': item.role === 'user' }"
                >
                  <div class="tool-v2-preview-bubble" :class="item.role">
                    {{ item.content }}
                  </div>
                </div>
              </div>
            </article>

            <div class="tool-v2-actions">
              <button type="button" class="tool-v2-btn tool-v2-btn--ghost" @click="goToStep(2)">继续追问</button>
              <button type="button" class="tool-v2-btn tool-v2-btn--ghost" @click="$emit('open-report')">查看完整报告</button>
              <button type="button" class="tool-v2-btn tool-v2-btn--primary" @click="restartFlow">重新开始</button>
            </div>
          </template>
        </section>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"

import type { ChatMessage, DistillReport } from "@/types"

interface ToolStarterAction {
  label: string
  prompt: string
}

const props = defineProps<{
  projectName: string
  isSbtiTool: boolean
  assistantDisplayName: string
  assistantAvatarLabel: string
  assistantAvatarStyle?: Record<string, string> | undefined
  assistantSubtitle: string
  toolSummary: string
  userSubtitle: string
  toolTags: string[]
  toolPrinciples: string[]
  toolStarterActions: ToolStarterAction[]
  messages: ChatMessage[]
  draft: string
  sending: boolean
  hasSession: boolean
  modePlaceholder: string
  welcomeMessage: string
  report: DistillReport
}>()

const emit = defineEmits<{
  (event: "update:draft", value: string): void
  (event: "send"): void
  (event: "send-starter", prompt: string): void
  (event: "open-report"): void
  (event: "back-projects"): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const composerRef = ref<HTMLTextAreaElement | null>(null)
const threadRef = ref<HTMLElement | null>(null)
const currentStep = ref(1)
const selectedPrompt = ref("")
const selectedFocus = ref("portrait")
const progressPercent = ref(12)
const progressIndex = ref(0)
const animationFrameId = ref<number | null>(null)
let progressTimer: ReturnType<typeof setInterval> | null = null

const starterOptions = computed(() =>
  props.toolStarterActions.map((item, index) => ({
    prompt: item.prompt,
    title: item.label.replace(/^\d+\s*/, "").trim() || item.label,
    short: String(index + 1).padStart(2, "0"),
    copy: item.prompt,
  }))
)

const previewTags = computed(() => props.toolTags.slice(0, 6))

const stageSteps = computed(() => {
  const userStarted = props.messages.some((message) => message.role === "user")
  const assistantResponded = props.messages.some((message) => message.role === "assistant")
  const activeStep = assistantResponded ? 3 : userStarted ? 2 : currentStep.value
  return [
    {
      id: "direction",
      title: "定方向",
      copy: "先选当前工具要怎么启动。",
      state: activeStep > 1 ? "done" : "active",
    },
    {
      id: "testing",
      title: "开始测试",
      copy: "直接进入输入与对话流程。",
      state: activeStep > 2 ? "done" : activeStep === 2 ? "active" : "idle",
    },
    {
      id: "report",
      title: "结果与报告",
      copy: "拿到结果后继续解释和追问。",
      state: activeStep === 3 ? "active" : "idle",
    },
  ]
})

const progressStages = [
  "读取当前 skill 上下文...",
  "对齐测试模式...",
  "生成结果骨架...",
  "整理报告卡片...",
]

const progressLabel = computed(() => progressStages[progressIndex.value] || progressStages[0])
const kickerNote = computed(() => (props.sending ? progressLabel.value : "按照当前 skill 直接进入状态，不额外绕路"))
const statusLabel = computed(() => (props.isSbtiTool ? "SBTI 工具型会话" : "工具型 skill 已加载"))

const focusChips = computed(() => {
  if (props.isSbtiTool) {
    return [
      { value: "portrait", label: "人格结果" },
      { value: "dialog", label: "实时测试" },
      { value: "share", label: "分享页" },
    ]
  }
  return [
    { value: "portrait", label: "主流程" },
    { value: "dialog", label: "实时对话" },
    { value: "share", label: "结果说明" },
  ]
})

const focusLabel = computed(() => focusChips.value.find((item) => item.value === selectedFocus.value)?.label || "实时测试")

const assistantHelperCopy = computed(() => {
  const current = starterOptions.value.find((item) => item.prompt === selectedPrompt.value)
  if (current) {
    return `推荐先从「${current.title}」开始。先推进一轮，拿到可看的结果和对话，再决定是不是继续追加问题。`
  }
  return "先定一个入口，再进实时会话。这个页面不做表面包装，直接推到能跑的测试状态。"
})

const reportMetrics = computed(() => [
  {
    label: props.isSbtiTool ? "测试类型" : "会话类型",
    value: props.isSbtiTool ? "SBTI" : "TOOL",
    tone: "is-amber",
  },
  {
    label: "核心风格",
    value: props.report.persona.tone || "已加载",
    tone: "is-cyan",
  },
  {
    label: "技能标签",
    value: String(props.toolTags.length),
    tone: "",
  },
  {
    label: "画像置信度",
    value: `${Math.round((props.report.confidence.overall_score || 0) * 100)}%`,
    tone: "is-green",
  },
])

const reportTitle = computed(() => (props.isSbtiTool ? "SBTI 测试卡" : props.assistantDisplayName))
const reportCode = computed(() => (props.isSbtiTool ? "SBTI" : "TOOL"))
const reportLetters = computed(() =>
  Array.from(reportCode.value.padEnd(4, "·").slice(0, 4)).map((value, index) => ({
    key: `${value}-${index}`,
    value,
    active: value !== "·",
  }))
)
const reportKeywords = computed(() => props.toolTags.slice(0, 4))
const reportMotto = computed(() => props.report.cognition.worldview || props.toolSummary)

const adviceCards = computed(() => {
  const suggestions = props.report.cognition.suggested_use_cases.slice(0, 2)
  const heuristics = props.toolPrinciples.slice(0, 2)
  const cards = [
    ...suggestions.map((item) => ({
      title: item,
      copy: "拿这个主题继续追问，能更快进入有用结果。",
    })),
    ...heuristics.map((item) => ({
      title: item,
      copy: "这是当前会话会坚持的判断原则。",
    })),
  ]
  return cards.slice(0, 4)
})

const conversationPreview = computed(() => {
  if (!props.messages.length) {
    return [
      { key: "welcome", role: "assistant", content: props.welcomeMessage },
    ]
  }
  return props.messages.slice(-4).map((message) => ({
    key: message.message_id,
    role: message.role,
    content: message.content,
  }))
})

const finalStateLabel = computed(() => (props.messages.some((message) => message.role === "assistant") ? "蒸馏完成" : "等待结果"))
const userAvatarLabel = computed(() => props.projectName.slice(0, 1) || "我")

watch(
  starterOptions,
  (options) => {
    if (!options.length) {
      selectedPrompt.value = ""
      return
    }
    const stillExists = options.some((option) => option.prompt === selectedPrompt.value)
    if (!stillExists) {
      selectedPrompt.value = options[0]?.prompt || ""
    }
  },
  { immediate: true }
)

watch(
  () => props.messages,
  (messages) => {
    if (messages.some((message) => message.role === "assistant")) currentStep.value = 3
    else if (messages.some((message) => message.role === "user")) currentStep.value = Math.max(currentStep.value, 2)
    void nextTick(scrollThreadToBottom)
  },
  { deep: true, immediate: true }
)

watch(
  () => props.sending,
  (sending) => {
    stopProgressAnimation()
    if (sending) {
      currentStep.value = 3
      progressPercent.value = Math.max(progressPercent.value, 16)
      progressTimer = setInterval(() => {
        progressIndex.value = (progressIndex.value + 1) % progressStages.length
        progressPercent.value = Math.min(progressPercent.value + 18, 92)
      }, 800)
      return
    }

    progressIndex.value = 0
    progressPercent.value = props.messages.some((message) => message.role === "assistant") ? 100 : 12
  },
  { immediate: true }
)

function lineState(index: number) {
  const current = stageSteps.value[index]
  const next = stageSteps.value[index + 1]
  if (!current || !next) return ""
  if (current.state === "done" && (next.state === "done" || next.state === "active")) return "done"
  if (current.state === "active") return "active"
  return ""
}

function goToStep(step: number) {
  currentStep.value = step
  if (step === 2 && !props.draft.trim() && selectedPrompt.value) {
    emit("update:draft", selectedPrompt.value)
  }
}

function selectOption(prompt: string) {
  selectedPrompt.value = prompt
  emit("update:draft", prompt)
}

function triggerStarter(prompt: string) {
  selectedPrompt.value = prompt
  currentStep.value = 3
  emit("send-starter", prompt)
}

function prefillSelectedPrompt() {
  if (!selectedPrompt.value) return
  emit("update:draft", selectedPrompt.value)
  void nextTick(() => composerRef.value?.focus())
}

function handleInput(event: Event) {
  emit("update:draft", (event.target as HTMLTextAreaElement).value)
}

function sendNow() {
  if (!props.draft.trim() && selectedPrompt.value) {
    currentStep.value = 3
    emit("send-starter", selectedPrompt.value)
    return
  }
  currentStep.value = 3
  emit("send")
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey) return
  event.preventDefault()
  sendNow()
}

function restartFlow() {
  currentStep.value = 1
  progressPercent.value = 12
  progressIndex.value = 0
  emit("update:draft", "")
}

function scrollThreadToBottom() {
  if (!threadRef.value) return
  threadRef.value.scrollTop = threadRef.value.scrollHeight
}

function stopProgressAnimation() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}

function renderCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const context = canvas.getContext("2d")
  if (!context) return

  const parent = canvas.parentElement
  const width = parent?.clientWidth || window.innerWidth
  const height = parent?.clientHeight || window.innerHeight
  const ratio = window.devicePixelRatio || 1

  canvas.width = Math.floor(width * ratio)
  canvas.height = Math.floor(height * ratio)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  context.setTransform(ratio, 0, 0, ratio, 0, 0)

  const particles = Array.from({ length: 32 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 2.2 + 0.4,
    speedX: (Math.random() - 0.5) * 0.22,
    speedY: -(Math.random() * 0.6 + 0.08),
    amber: Math.random() > 0.35,
  }))

  const draw = () => {
    context.clearRect(0, 0, width, height)
    for (const particle of particles) {
      particle.x += particle.speedX
      particle.y += particle.speedY
      if (particle.y < -10) particle.y = height + 12
      if (particle.x < -10) particle.x = width + 10
      if (particle.x > width + 10) particle.x = -10

      context.beginPath()
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
      context.fillStyle = particle.amber ? "rgba(212,148,58,0.24)" : "rgba(34,211,238,0.18)"
      context.fill()
    }
    animationFrameId.value = window.requestAnimationFrame(draw)
  }

  draw()
}

watch(canvasRef, () => {
  if (!canvasRef.value) return
  if (animationFrameId.value) window.cancelAnimationFrame(animationFrameId.value)
  renderCanvas()
})

onBeforeUnmount(() => {
  stopProgressAnimation()
  if (animationFrameId.value) window.cancelAnimationFrame(animationFrameId.value)
})
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&family=Space+Grotesk:wght@400;500;700&display=swap");

.tool-v2-shell {
  position: relative;
  overflow: hidden;
  min-height: calc(100vh - 72px);
  padding: 24px;
  border-radius: 28px;
  border: 1px solid rgba(212, 148, 58, 0.12);
  background: #08080e;
  color: #ede8df;
}

.tool-v2-shell,
.tool-v2-shell * {
  font-family: "Space Grotesk", "Noto Serif SC", sans-serif;
}

.tool-v2-shell .serif {
  font-family: "Noto Serif SC", serif;
}

.tool-v2-atmosphere,
.tool-v2-canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.tool-v2-atmosphere {
  background:
    radial-gradient(ellipse 60% 40% at 20% 10%, rgba(212, 148, 58, 0.1) 0%, transparent 60%),
    radial-gradient(ellipse 50% 50% at 80% 80%, rgba(34, 211, 238, 0.06) 0%, transparent 60%),
    radial-gradient(ellipse 80% 60% at 50% 50%, rgba(212, 148, 58, 0.04) 0%, transparent 70%);
}

.tool-v2-nav,
.tool-v2-layout {
  position: relative;
  z-index: 1;
}

.tool-v2-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 60px;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(212, 148, 58, 0.12);
}

.tool-v2-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  border: 0;
  background: transparent;
  color: #ede8df;
  cursor: pointer;
}

.tool-v2-brand-mark {
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: linear-gradient(135deg, #d4943a, #c77d20);
  color: #08080e;
  font-weight: 900;
}

.tool-v2-brand-text {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.tool-v2-nav-actions,
.tool-v2-meta-row,
.tool-v2-focus-row,
.tool-v2-actions,
.tool-v2-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tool-v2-pill,
.tool-v2-chip,
.tool-v2-mini-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(212, 148, 58, 0.18);
  background: rgba(255, 255, 255, 0.03);
  color: #ede8df;
  font-size: 0.78rem;
  font-weight: 600;
}

.tool-v2-pill--status,
.tool-v2-mini-pill {
  border-color: rgba(34, 211, 238, 0.18);
  color: #67e8f9;
  background: rgba(34, 211, 238, 0.08);
}

.tool-v2-layout {
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(280px, 0.7fr) minmax(0, 1.3fr);
  padding-top: 22px;
}

.tool-v2-hero,
.tool-v2-panel {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid rgba(212, 148, 58, 0.12);
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.24);
}

.tool-v2-hero {
  padding: 28px;
}

.tool-v2-stage {
  display: grid;
  gap: 18px;
}

.tool-v2-panel {
  padding: 22px;
}

.tool-v2-kicker-row,
.tool-v2-hero-main,
.tool-v2-panel-head,
.tool-v2-thread-head,
.tool-v2-report-header,
.tool-v2-composer-foot {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.tool-v2-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(212, 148, 58, 0.22);
  background: rgba(212, 148, 58, 0.08);
  color: #d4943a;
  font-size: 0.78rem;
  font-weight: 700;
}

.tool-v2-kicker-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #d4943a;
  box-shadow: 0 0 16px rgba(212, 148, 58, 0.4);
}

.tool-v2-kicker-note,
.tool-v2-subtitle,
.tool-v2-summary,
.tool-v2-panel-copy,
.tool-v2-assistant-copy,
.tool-v2-option-copy,
.tool-v2-entry-copy,
.tool-v2-composer-hint,
.tool-v2-thread-empty-copy,
.tool-v2-report-copy,
.tool-v2-advice-copy,
.tool-v2-step-copy,
.tool-v2-bubble-text {
  color: #8a8578;
}

.tool-v2-title {
  margin: 18px 0 0;
  font-size: clamp(2rem, 4vw, 3.4rem);
  font-weight: 900;
  line-height: 1.05;
}

.tool-v2-subtitle {
  margin: 10px 0 0;
  line-height: 1.7;
}

.tool-v2-avatar {
  display: inline-grid;
  place-items: center;
  width: 72px;
  height: 72px;
  flex: 0 0 72px;
  border-radius: 18px;
  color: #08080e;
  font-size: 1.4rem;
  font-weight: 900;
  box-shadow: 0 16px 30px rgba(212, 148, 58, 0.16);
}

.tool-v2-summary {
  margin: 18px 0 0;
  line-height: 1.85;
}

.tool-v2-step-indicator {
  display: flex;
  align-items: center;
}

.tool-v2-step-dot {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border-radius: 999px;
  border: 2px solid rgba(212, 148, 58, 0.16);
  color: #8a8578;
  font-size: 0.84rem;
  font-weight: 700;
  transition: all 0.3s ease;
}

.tool-v2-step-dot.active {
  border-color: #d4943a;
  background: #d4943a;
  color: #08080e;
  box-shadow: 0 0 20px rgba(212, 148, 58, 0.28);
}

.tool-v2-step-dot.done {
  border-color: #22c55e;
  background: #22c55e;
  color: #08080e;
}

.tool-v2-step-line {
  height: 2px;
  flex: 1;
  min-width: 36px;
  background: rgba(255, 255, 255, 0.08);
}

.tool-v2-step-line.done {
  background: #22c55e;
}

.tool-v2-step-line.active {
  background: linear-gradient(90deg, #22c55e, #d4943a);
}

.tool-v2-step-captions {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.tool-v2-step-title,
.tool-v2-option-title,
.tool-v2-entry-label,
.tool-v2-panel-title,
.tool-v2-thread-empty-title,
.tool-v2-report-title,
.tool-v2-advice-title,
.tool-v2-bubble-name {
  margin: 0;
  color: #ede8df;
  font-weight: 700;
}

.tool-v2-step-copy {
  font-size: 0.78rem;
  line-height: 1.55;
}

.tool-v2-section-label {
  margin: 0 0 8px;
  color: #8a8578;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.tool-v2-panel-title {
  font-size: 1.8rem;
}

.tool-v2-option-grid,
.tool-v2-entry-grid,
.tool-v2-report-grid,
.tool-v2-dual-grid {
  display: grid;
  gap: 14px;
}

.tool-v2-option-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 18px;
}

.tool-v2-option,
.tool-v2-entry-card,
.tool-v2-focus-chip,
.tool-v2-btn {
  transition: all 0.3s ease;
}

.tool-v2-option {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid rgba(212, 148, 58, 0.14);
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.tool-v2-option:hover,
.tool-v2-option.is-selected,
.tool-v2-entry-card:hover,
.tool-v2-entry-card.is-selected {
  border-color: rgba(212, 148, 58, 0.3);
  background: rgba(212, 148, 58, 0.08);
  transform: translateY(-2px);
}

.tool-v2-option-index {
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(212, 148, 58, 0.18), rgba(34, 211, 238, 0.08));
  color: #d4943a;
  font-weight: 700;
}

.tool-v2-option-body {
  display: grid;
  gap: 6px;
}

.tool-v2-focus-box,
.tool-v2-assistant-box,
.tool-v2-thread-card,
.tool-v2-composer-box,
.tool-v2-report-card {
  margin-top: 18px;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid rgba(212, 148, 58, 0.12);
  background: rgba(255, 255, 255, 0.02);
}

.tool-v2-focus-chip {
  min-height: 36px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: #ede8df;
  cursor: pointer;
}

.tool-v2-focus-chip.is-selected {
  border-color: rgba(212, 148, 58, 0.32);
  background: rgba(212, 148, 58, 0.12);
  color: #d4943a;
}

.tool-v2-assistant-box {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  border-color: rgba(34, 211, 238, 0.16);
  background: rgba(34, 211, 238, 0.05);
}

.tool-v2-assistant-icon,
.tool-v2-progress-orb,
.tool-v2-thread-empty-mark {
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 12px;
  background: rgba(34, 211, 238, 0.14);
  color: #67e8f9;
  font-size: 0.84rem;
  font-weight: 800;
}

.tool-v2-assistant-title {
  margin: 0 0 6px;
  color: #67e8f9;
  font-weight: 700;
}

.tool-v2-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 18px;
  border-radius: 12px;
  border: 1px solid rgba(212, 148, 58, 0.18);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
}

.tool-v2-btn--primary {
  background: #d4943a;
  color: #08080e;
}

.tool-v2-btn--primary:hover:not(:disabled) {
  background: #e8a838;
  box-shadow: 0 8px 30px rgba(212, 148, 58, 0.25);
}

.tool-v2-btn--ghost {
  background: transparent;
  color: #ede8df;
}

.tool-v2-btn--ghost:hover:not(:disabled) {
  border-color: rgba(212, 148, 58, 0.3);
  color: #d4943a;
  background: rgba(212, 148, 58, 0.05);
}

.tool-v2-btn:disabled,
.tool-v2-entry-card:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tool-v2-entry-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.tool-v2-entry-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid rgba(212, 148, 58, 0.14);
  background: rgba(212, 148, 58, 0.03);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.tool-v2-textarea {
  width: 100%;
  min-height: 150px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid rgba(212, 148, 58, 0.18);
  background: rgba(255, 255, 255, 0.03);
  color: #ede8df;
  font: inherit;
  line-height: 1.8;
  resize: vertical;
}

.tool-v2-textarea:focus {
  outline: none;
  border-color: rgba(212, 148, 58, 0.4);
  box-shadow: 0 0 0 4px rgba(212, 148, 58, 0.08);
}

.tool-v2-thread {
  display: grid;
  gap: 12px;
  max-height: 360px;
  overflow-y: auto;
}

.tool-v2-thread-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.tool-v2-thread-row.is-user {
  justify-content: flex-end;
}

.tool-v2-thread-row.is-user .tool-v2-thread-avatar {
  order: 2;
}

.tool-v2-thread-row.is-user .tool-v2-thread-bubble-stack {
  align-items: flex-end;
}

.tool-v2-thread-avatar {
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 14px;
  font-size: 0.92rem;
  font-weight: 800;
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.24);
}

.tool-v2-thread-avatar.is-assistant {
  color: #08080e;
}

.tool-v2-thread-avatar.is-user {
  background: linear-gradient(135deg, #1d4ed8, #163b7a);
  color: #eff6ff;
}

.tool-v2-thread-bubble-stack {
  display: grid;
  gap: 6px;
  min-width: 0;
  max-width: min(82%, calc(100% - 54px));
}

.tool-v2-bubble {
  padding: 12px 16px;
  border-radius: 18px;
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.18);
}

.tool-v2-bubble.is-assistant {
  background: linear-gradient(180deg, rgba(249, 244, 235, 0.98), rgba(236, 226, 211, 0.95));
  border: 1px solid rgba(214, 194, 163, 0.42);
  color: #18120d;
}

.tool-v2-bubble.is-user {
  background: linear-gradient(135deg, #1d4ed8, #163b7a);
  border: 1px solid rgba(120, 169, 255, 0.38);
  color: #eff6ff;
}

.tool-v2-bubble-name {
  margin-bottom: 6px;
  font-size: 0.76rem;
  color: rgba(237, 232, 223, 0.72);
}

.tool-v2-bubble-text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.75;
  color: inherit;
}

.tool-v2-thread-empty {
  display: grid;
  gap: 12px;
  place-items: center;
  min-height: 180px;
  text-align: center;
}

.tool-v2-progress-state {
  display: grid;
  gap: 16px;
  justify-items: center;
  padding: 36px 0;
  text-align: center;
}

.tool-v2-progress-orb {
  width: 72px;
  height: 72px;
  flex-basis: 72px;
  border-radius: 999px;
  background: rgba(212, 148, 58, 0.12);
  color: #d4943a;
  box-shadow: 0 0 0 0 rgba(212, 148, 58, 0.22);
  animation: tool-v2-pulse 2.5s infinite;
}

.tool-v2-progress-bar {
  width: min(100%, 420px);
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.tool-v2-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #d4943a, #22d3ee);
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.tool-v2-report-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 18px;
}

.tool-v2-metric-card {
  padding: 18px;
  border-radius: 16px;
  border: 1px solid rgba(212, 148, 58, 0.12);
  background: rgba(255, 255, 255, 0.03);
  text-align: center;
}

.tool-v2-metric-value {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  color: #ede8df;
}

.tool-v2-metric-value.is-amber {
  color: #d4943a;
}

.tool-v2-metric-value.is-cyan {
  color: #67e8f9;
}

.tool-v2-metric-value.is-green {
  color: #22c55e;
}

.tool-v2-metric-label {
  margin: 6px 0 0;
  color: #8a8578;
  font-size: 0.76rem;
}

.tool-v2-dual-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 18px;
}

.tool-v2-report-card--hero {
  background: linear-gradient(135deg, rgba(212, 148, 58, 0.08), rgba(34, 211, 238, 0.05));
}

.tool-v2-letter-row {
  display: flex;
  gap: 10px;
  margin: 18px 0;
}

.tool-v2-letter {
  display: inline-grid;
  place-items: center;
  width: 54px;
  height: 62px;
  border-radius: 12px;
  font-size: 1.5rem;
  font-weight: 900;
}

.tool-v2-letter.is-active {
  color: #d4943a;
  border: 1px solid rgba(212, 148, 58, 0.3);
  background: rgba(212, 148, 58, 0.1);
}

.tool-v2-letter.is-muted {
  color: #8a8578;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
}

.tool-v2-advice-list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.tool-v2-advice-card {
  padding: 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(212, 148, 58, 0.06), rgba(34, 211, 238, 0.03));
  border: 1px solid rgba(212, 148, 58, 0.12);
}

.tool-v2-preview-thread {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.tool-v2-preview-row {
  display: flex;
}

.tool-v2-preview-row.is-user {
  justify-content: flex-end;
}

.tool-v2-preview-bubble {
  max-width: 82%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 0.88rem;
  line-height: 1.7;
}

.tool-v2-preview-bubble.user {
  background: rgba(212, 148, 58, 0.12);
  border: 1px solid rgba(212, 148, 58, 0.2);
}

.tool-v2-preview-bubble.assistant {
  background: rgba(34, 211, 238, 0.08);
  border: 1px solid rgba(34, 211, 238, 0.15);
}

@keyframes tool-v2-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(212, 148, 58, 0.24);
  }
  50% {
    box-shadow: 0 0 20px 6px rgba(212, 148, 58, 0.08);
  }
}

@media (max-width: 1100px) {
  .tool-v2-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .tool-v2-shell {
    padding: 18px;
    border-radius: 24px;
  }

  .tool-v2-nav,
  .tool-v2-hero-main,
  .tool-v2-panel-head,
  .tool-v2-composer-foot {
    flex-direction: column;
    align-items: stretch;
  }

  .tool-v2-option-grid,
  .tool-v2-entry-grid,
  .tool-v2-report-grid,
  .tool-v2-dual-grid,
  .tool-v2-step-captions {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .tool-v2-panel,
  .tool-v2-hero {
    padding: 18px;
  }

  .tool-v2-title {
    font-size: 2.2rem;
  }

  .tool-v2-avatar {
    width: 60px;
    height: 60px;
    flex-basis: 60px;
  }

  .tool-v2-thread-avatar {
    width: 38px;
    height: 38px;
    flex-basis: 38px;
    border-radius: 12px;
  }

  .tool-v2-thread-bubble-stack {
    max-width: calc(100% - 50px);
  }

  .tool-v2-letter {
    width: 46px;
    height: 54px;
    font-size: 1.25rem;
  }
}
</style>
