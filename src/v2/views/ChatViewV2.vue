<template>
  <div v-if="bootstrapping || errorMessage || !project || !report || !session">
    <V2AppShell>
      <div class="v2-page">
        <section class="v2-state-card v2-card">
          <p class="v2-section-kicker">Chat</p>
          <h2 class="v2-section-title">{{ errorMessage ? "聊天暂时不可用。" : "正在装配聊天会话。" }}</h2>
          <p v-if="errorMessage" class="v2-danger">{{ errorMessage }}</p>
        </section>
      </div>
    </V2AppShell>
  </div>

  <ToolChatSessionV2
    v-else-if="isToolProject"
    :project-name="project.subject_name"
    :is-sbti-tool="isSbtiTool"
    :assistant-display-name="assistantDisplayName"
    :assistant-avatar-label="assistantAvatarLabel"
    :assistant-avatar-style="assistantAvatarStyle"
    :assistant-subtitle="assistantSubtitle"
    :tool-summary="toolSummary"
    :user-subtitle="userSubtitle"
    :tool-tags="toolTags"
    :tool-principles="toolPrinciples"
    :tool-starter-actions="toolStarterActions"
    :messages="messages"
    :draft="draft"
    :sending="sending"
    :has-session="Boolean(session)"
    :mode-placeholder="modePlaceholder"
    :welcome-message="welcomeMessage"
    :report="report"
    @update:draft="draft = $event"
    @send="sendMessage"
    @send-starter="sendToolStarter"
    @open-report="router.push(`/projects/${project.project_id}/report`)"
    @back-projects="router.push('/projects')"
  />

  <V2AppShell v-else>
    <div class="v2-page">
      <section class="v2-hero">
        <div class="v2-panel-head">
          <div>
            <p class="v2-section-kicker">Chat</p>
            <h1 class="v2-page-title">{{ assistantDisplayName }}</h1>
            <p class="v2-page-subtitle">{{ assistantSubtitle }}</p>
          </div>
          <div class="v2-chip-row">
            <span class="v2-status-pill">{{ activeModeLabel }}</span>
            <span v-if="supportSkillPillLabel" class="v2-status-pill">{{ supportSkillPillLabel }}</span>
            <RouterLink :to="`/projects/${project.project_id}/report`" class="v2-btn v2-btn--ghost">查看报告</RouterLink>
          </div>
        </div>

        <div class="v2-chip-row">
          <button
            v-for="item in modeCards"
            :key="item.value"
            type="button"
            class="v2-btn"
            :class="activeMode === item.value ? 'v2-btn--primary' : 'v2-btn--ghost'"
            @click="switchMode(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </section>

      <section v-if="expertOptions.length" class="v2-card">
        <div class="v2-panel-head">
          <div>
            <p class="v2-section-kicker">Expert Match</p>
            <h2 class="v2-section-title">{{ expertPoolTitle }}</h2>
          </div>
          <span class="v2-status-pill">{{ expertPoolStatusLabel }}</span>
        </div>
        <div class="v2-card-grid">
          <article
            v-for="candidate in expertOptions"
            :key="candidate.expert_id"
            class="v2-option-card"
            :class="{ 'is-selected': selectedExpert?.expert_id === candidate.expert_id }"
          >
            <div class="v2-panel-head">
              <div>
                <p class="v2-section-title">{{ candidate.name }}</p>
                <p class="v2-muted">{{ candidate.role }}</p>
              </div>
              <span class="v2-status-pill">{{ Math.round(candidate.match_score * 100) }}%</span>
            </div>
            <div class="v2-chip-row">
              <span v-for="tag in candidate.tags.slice(0, 3)" :key="`${candidate.expert_id}-${tag}`" class="v2-chip">{{ tag }}</span>
            </div>
            <button
              v-if="selectedExpert?.expert_id !== candidate.expert_id"
              type="button"
              class="v2-btn v2-btn--ghost"
              :disabled="selectingExpert || sending"
              @click="selectExpert(candidate.expert_id)"
            >
              {{ hasPackProject ? "加载这个 skill" : "选 TA" }}
            </button>
          </article>
        </div>
      </section>

      <section class="v2-card v2-chat-shell">
        <div class="v2-chip-row">
          <button
            v-for="prompt in starterPrompts"
            :key="prompt"
            type="button"
            class="v2-btn v2-btn--ghost"
            @click="applySuggestedPrompt(prompt)"
          >
            {{ prompt }}
          </button>
        </div>

        <div ref="threadRef" class="v2-chat-thread">
          <section v-if="recommendedExpertSwitchCard" class="v2-chat-inline-switch-card">
            <div class="v2-chat-inline-switch-head">
              <div>
                <p class="v2-section-kicker">Skill Suggestion</p>
                <h2 class="v2-chat-inline-switch-title">{{ recommendedSwitchCardTitle }}</h2>
              </div>
              <span class="v2-status-pill">不自动切换</span>
            </div>
            <p class="v2-chat-inline-switch-copy">{{ recommendedExpertSwitchCard.reason }}</p>
            <div class="v2-chat-inline-switch-actions">
              <button
                type="button"
                class="v2-btn v2-btn--primary"
                :disabled="selectingExpert || sending"
                @click="selectExpert(recommendedExpertSwitchCard.expertId)"
              >
                {{ recommendedSwitchActionLabel }}
              </button>
              <button type="button" class="v2-btn v2-btn--ghost" @click="dismissRecommendedSwitchCard">
                先继续当前
              </button>
            </div>
          </section>

          <div v-if="!messages.length" class="v2-chat-row">
            <div class="v2-chat-avatar v2-chat-avatar--assistant" :style="assistantAvatarStyle" />
            <div class="v2-chat-bubble-stack">
              <p class="v2-chat-speaker">{{ assistantDisplayName }}</p>
              <div class="v2-chat-bubble v2-chat-bubble--assistant">
                <p>{{ welcomeMessage }}</p>
              </div>
            </div>
          </div>

          <div
            v-for="message in messages"
            :key="message.message_id"
          >
            <div
              v-if="isSystemNotice(message)"
              class="mx-auto flex max-w-[32rem] items-center justify-center px-4 py-2 text-center text-[12px] leading-5 text-[#9aa3af]"
            >
              <span>{{ message.content }}</span>
            </div>
            <div
              v-else
              class="v2-chat-row"
              :class="{ 'is-user': message.role === 'user' }"
            >
              <div
                class="v2-chat-avatar"
                :class="message.role === 'assistant' ? 'v2-chat-avatar--assistant' : 'v2-chat-avatar--user'"
                :style="message.role === 'assistant' ? assistantAvatarStyle : undefined"
              >
                {{ message.role === "assistant" ? "" : userAvatarLabel }}
              </div>
              <div class="v2-chat-bubble-stack">
                <p class="v2-chat-speaker">{{ message.role === 'assistant' ? assistantDisplayName : '你' }}</p>
                <div
                  class="v2-chat-bubble"
                  :class="message.role === 'assistant' ? 'v2-chat-bubble--assistant' : 'v2-chat-bubble--user'"
                >
                  <p>{{ message.content }}</p>
                  <div v-if="visibleCitations(message).length" class="v2-list v2-chat-citations">
                    <div
                      v-for="(citation, index) in visibleCitations(message)"
                      :key="citationKey(citation, index)"
                      class="v2-list-item"
                    >
                      <div>
                        <p>{{ citation.title }}</p>
                        <p v-if="citation.excerpt" class="v2-muted">{{ citation.excerpt }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="v2-chat-composer">
          <textarea
            ref="composerRef"
            v-model="draft"
            class="v2-textarea"
            rows="6"
            :placeholder="modePlaceholder"
            :disabled="!session || sending"
            @keydown="handleComposerKeydown"
          />
          <div class="v2-page-actions">
            <button class="v2-btn v2-btn--ghost" :disabled="!session" @click="prefillQuestion">快捷入口</button>
            <button class="v2-btn v2-btn--primary" :disabled="sending || !draft.trim() || !session" @click="sendMessage">
              {{ sending ? "生成中..." : "发送" }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </V2AppShell>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"

import ToolChatSessionV2 from "@/components/ToolChatSessionV2.vue"
import { api } from "@/lib/api"
import { ChatSocketClient } from "@/lib/chatSocket"
import { skillAvatarBackgroundStyle } from "@/lib/skillAvatar"
import type {
  ChatCitation,
  ChatExpertRecommendation,
  ChatMessage,
  ChatMode,
  ChatSessionBootstrapResponse,
  ChatSessionSummary,
  ChatStreamDonePayload,
  DistillReport,
  ExpertCandidate,
  ExpertCandidateListResponse,
  ExpertSelectionResponse,
  PackDetailResponse,
  ProjectSummary,
} from "@/types"
import V2AppShell from "@/v2/components/V2AppShell.vue"

const route = useRoute()
const router = useRouter()

const project = ref<ProjectSummary | null>(null)
const report = ref<DistillReport | null>(null)
const session = ref<ChatSessionSummary | null>(null)
const messages = ref<ChatMessage[]>([])
const expertMatches = ref<ChatExpertRecommendation | null>(null)
const primaryPackDetail = ref<PackDetailResponse | null>(null)
const activeMode = ref<ChatMode>((route.query.mode as ChatMode) || "advice")
const draft = ref("")
const sending = ref(false)
const selectingExpert = ref(false)
const bootstrapping = ref(true)
const errorMessage = ref("")
const dismissedRecommendedExpertId = ref("")
const composerRef = ref<HTMLTextAreaElement | null>(null)
const threadRef = ref<HTMLElement | null>(null)
let chatSocket: ChatSocketClient | null = null

function normalizeExpertRecommendation(
  source: ExpertCandidateListResponse | ChatExpertRecommendation | null | undefined,
  sessionId?: string
): ChatExpertRecommendation | null {
  if (!source) return null
  if ("recommended_switch" in source) {
    if (sessionId && source.session_id !== sessionId) {
      return { ...source, session_id: sessionId }
    }
    return source
  }
  return {
    project_id: source.project_id,
    session_id: sessionId || session.value?.session_id || "",
    selected_expert_id: source.selected_expert_id ?? null,
    recommended_expert_id: source.items[0]?.expert_id || null,
    recommended_switch: false,
    reason: null,
    items: source.items,
  }
}

const selectedExpert = computed<ExpertCandidate | null>(() => {
  const selectedId = expertMatches.value?.selected_expert_id
  if (!selectedId) return null
  return expertMatches.value?.items.find((item) => item.expert_id === selectedId) || null
})

const expertOptions = computed(() => expertMatches.value?.items || [])
const recommendedExpertSwitchCard = computed(() => {
  const recommendation = expertMatches.value
  if (!recommendation?.recommended_switch || !recommendation.recommended_expert_id) return null
  const candidate = recommendation.items.find((item) => item.expert_id === recommendation.recommended_expert_id)
  if (!candidate) return null
  if (dismissedRecommendedExpertId.value === candidate.expert_id) return null
  return {
    expertId: candidate.expert_id,
    name: candidate.name,
    reason: recommendation.reason?.trim() || candidate.reasons?.[0] || "这一轮问题更贴近另一位专家的能力范围。",
  }
})
const isToolProject = computed(() => project.value?.factory_category === "tool_agent")
const hasPackProject = computed(() => Boolean(project.value?.pack_slug && primaryPackDetail.value))
const supportSkill = computed(() => {
  if (!hasPackProject.value || !selectedExpert.value) return null
  if (selectedExpert.value.expert_id === project.value?.pack_slug) return null
  return selectedExpert.value
})
const packSkillText = computed(() => [
  primaryPackDetail.value?.pack.title,
  primaryPackDetail.value?.pack.subtitle,
  primaryPackDetail.value?.pack.domain,
  ...(primaryPackDetail.value?.pack.tags || []),
  ...(primaryPackDetail.value?.pack.skills || []),
].filter(Boolean).join(" ").toLowerCase())
const prefersDirectSkillMode = computed(() => {
  if (!hasPackProject.value) return false
  const pack = primaryPackDetail.value?.pack
  const category = String(pack?.factory_category || project.value?.factory_category || "").toLowerCase()
  const displayGroup = String(pack?.display_group || "").toLowerCase()
  const repoKind = String(pack?.repo_kind || "").toLowerCase()
  if (category === "tool_agent") return true
  if (repoKind === "single_skill" && (category === "professional_role" || displayGroup === "tool_entry" || displayGroup === "theme")) {
    return true
  }
  return /sbti|mbti|人格测试|人格测评|人格测验|赛博人格|personality test|quiz|量表|问卷|测试结果/.test(packSkillText.value)
})
const assistantDisplayName = computed(() => (
  primaryPackDetail.value?.pack.title ||
  selectedExpert.value?.name ||
  project.value?.subject_name ||
  "蒸馏人格"
))
const assistantAvatarLabel = computed(() => assistantDisplayName.value.slice(0, 1) || "蒸")
const userAvatarLabel = computed(() => (project.value?.subject_name || "我").slice(0, 1) || "我")
const assistantAvatarStyle = computed(() => {
  return skillAvatarBackgroundStyle(primaryPackDetail.value?.pack, project.value?.pack_slug || assistantDisplayName.value)
})
const userSubtitle = computed(() => `基于项目：${project.value?.subject_name || "当前用户"}`)
const assistantSubtitle = computed(() => {
  if (isToolProject.value) {
    return primaryPackDetail.value?.pack.subtitle || "当前 skill 已加载，直接进入测试或工具流程。"
  }
  if (hasPackProject.value) {
    const base = primaryPackDetail.value?.pack.subtitle || "当前 skill 已加载，直接进入对话。"
    if (supportSkill.value) {
      return `${base} 已加入支援 skill：${supportSkill.value.name}。`
    }
    return base
  }
  return selectedExpert.value
    ? `${selectedExpert.value.role} · 当前会按 ${selectedExpert.value.name} 的风格和判断方式回复`
    : `当前会按 ${project.value?.subject_name || "当前项目"} 的蒸馏人格给出建议`
})
const supportSkillPillLabel = computed(() => (
  supportSkill.value ? `已加入 ${supportSkill.value.name}` : ""
))
const recommendedSwitchCardTitle = computed(() => (
  recommendedExpertSwitchCard.value
    ? hasPackProject.value
      ? `检测到可加入的支援 skill：${recommendedExpertSwitchCard.value.name}`
      : `检测到更适合的专家：${recommendedExpertSwitchCard.value.name}`
    : ""
))
const recommendedSwitchActionLabel = computed(() => (hasPackProject.value ? "加入并继续" : "切换并继续"))
const expertPoolTitle = computed(() => (hasPackProject.value ? "候选支援 skill" : "当前专家池"))
const expertPoolStatusLabel = computed(() => {
  if (selectedExpert.value) return hasPackProject.value ? `已加入：${selectedExpert.value.name}` : `当前：${selectedExpert.value.name}`
  if (hasPackProject.value) return `候选 ${expertOptions.value.length}`
  return `Top ${expertOptions.value.length}`
})

const activeModeLabel = computed(() => {
  if (prefersDirectSkillMode.value) return "蒸馏对话"
  if (activeMode.value === "replica") return "复刻聊天"
  if (activeMode.value === "compare") return "双视角对比"
  return "专家咨询"
})

const modeCards = computed(() => {
  if (prefersDirectSkillMode.value) return []
  return [
    { value: "replica" as const, label: "复刻聊天" },
    { value: "advice" as const, label: "专家咨询" },
    { value: "compare" as const, label: "双视角对比" },
  ]
})

const modePlaceholder = computed(() => {
  if (isToolProject.value) {
    return isSbtiTool.value ? "输入“测自己”或“测 Agent”，我会直接进入测试流程..." : `直接告诉 ${assistantDisplayName.value} 你想开始什么工具流程...`
  }
  if (prefersDirectSkillMode.value) {
    return `直接告诉 ${assistantDisplayName.value} 你现在想蒸馏什么问题，我会按当前 skill 继续。`
  }
  if (activeMode.value === "replica") return `直接把场景丢给 ${assistantDisplayName.value}，看看 TA 会怎么回你...`
  if (activeMode.value === "compare") return `输入一个想让 ${assistantDisplayName.value} 做双视角判断的问题...`
  return `把你的问题交给 ${assistantDisplayName.value}，让 TA 直接给建议...`
})

const isSbtiTool = computed(() => {
  const text = [
    project.value?.subject_name,
    primaryPackDetail.value?.pack.title,
    primaryPackDetail.value?.pack.subtitle,
    ...(primaryPackDetail.value?.pack.tags || []),
    ...(primaryPackDetail.value?.pack.skills || []),
  ].filter(Boolean).join(" ").toLowerCase()
  return /sbti|mbti|人格测试|personality test|赛博人格/.test(text)
})

const toolStarterActions = computed(() => {
  if (isSbtiTool.value) {
    return [
      { label: "1 测自己", prompt: "开始 SBTI 测试，我要测自己。先让我选择模式或进入第一题。" },
      { label: "2 测 Agent", prompt: "开始 SBTI 测试，我要测我的 AI agent。先让我选择模式或进入第一题。" },
      { label: "生成结果页", prompt: "把我的测试结果生成网页，并给我一个适合分享的结果页结构。" },
    ]
  }
  return (primaryPackDetail.value?.starter_prompts || []).slice(0, 3).map((prompt) => ({ label: prompt, prompt }))
})

const starterPrompts = computed(() => {
  if (isToolProject.value) return toolStarterActions.value.map((item) => item.prompt)
  if (hasPackProject.value && primaryPackDetail.value?.starter_prompts?.length) {
    return primaryPackDetail.value.starter_prompts.slice(0, 3)
  }
  if (activeMode.value === "replica") {
    return [
      `如果我是你，你会怎么回我这句话？`,
      `按你的语气，帮我把这段回复改得更像真人一点。`,
      `如果继续聊下去，你会怎么开口？`,
    ]
  }
  if (activeMode.value === "compare") {
    return [
      `普通人会怎么做，你又会怎么做？`,
      `先给通用建议，再给你的蒸馏视角。`,
      `这件事该推进还是观望？请给双视角判断。`,
    ]
  }
  return [
    "我现在这一步最稳的做法是什么？",
    "如果你来判断，这件事先做什么？",
    "按你的视角，我该先补证据还是先行动？",
  ]
})

const welcomeMessage = computed(() => {
  if (isToolProject.value) {
    return isSbtiTool.value
      ? "SBTI skill 已加载。\n请选择测试模式，我会直接进入测试流程。"
      : `${assistantDisplayName.value} 已加载。\n选一个入口，我会直接进入当前工具流程。`
  }
  if (hasPackProject.value) {
    return `${assistantDisplayName.value} 已加载。\n直接把问题丢过来，我会按这个 skill 的视角继续。`
  }
  return `你现在正在和 ${assistantDisplayName.value} 的蒸馏人格聊天。\n直接把问题丢过来，我会按照当前模式继续。`
})

const toolSummary = computed(() => {
  return (
    primaryPackDetail.value?.preview_report.memory.summary ||
    report.value?.memory.summary ||
    "当前工具 skill 已加载，可以直接进入测试、解释结果或生成对应的展示页面。"
  )
})

const toolTags = computed(() => {
  const merged = [
    ...(primaryPackDetail.value?.pack.skills || []),
    ...(primaryPackDetail.value?.pack.suitable_for || []),
    ...(primaryPackDetail.value?.pack.tags || []),
  ]
  return [...new Set(merged)].filter(Boolean).slice(0, 8)
})

const toolPrinciples = computed(() => [
  ...(report.value?.cognition.decision_heuristics || []),
  ...(report.value?.honest_limits || []),
].slice(0, 4))

function normalizeChatMode(candidate: unknown, toolSession = false): ChatMode {
  if (toolSession) return "advice"
  return candidate === "replica" || candidate === "compare" || candidate === "advice" ? candidate : "advice"
}

function scrollThreadToBottom() {
  const node = threadRef.value
  if (!node) return
  node.scrollTop = node.scrollHeight
}

function normalizeComposerMessage(value: string) {
  const lines = value.replace(/\r\n/g, "\n").split("\n")
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  if (!lines.length) return ""
  const normalized = lines.map((line) => line.replace(/[ \t]+$/g, ""))
  normalized[0] = normalized[0].trimStart()
  normalized[normalized.length - 1] = normalized[normalized.length - 1].trimEnd()
  return normalized.join("\n")
}

function cleanCitationText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function hideCitation(citation: ChatCitation) {
  const haystack = `${citation.title || ""} ${citation.excerpt || ""}`.toLowerCase()
  return /(?:^|[\s(])(?:readme|skill)\.md\b/.test(haystack) || /\.mdx?\b/.test(haystack)
}

function visibleCitations(message: ChatMessage) {
  return message.citations
    .map((citation) => {
      if (hideCitation(citation)) return null
      const title = cleanCitationText(citation.title || "")
      const excerpt = cleanCitationText(citation.excerpt || "")
      if (!title && !excerpt) return null
      return {
        title: title || "资料来源",
        excerpt,
      }
    })
    .filter((citation): citation is ChatCitation => Boolean(citation))
}

function citationKey(citation: ChatCitation, index: number) {
  return `${citation.title}-${index}`
}

function isSystemNotice(message: ChatMessage) {
  return message.role === "system" || message.kind === "skill_switch"
}

function insertNoticeMessages(target: ChatMessage[], placeholder: ChatMessage, notices: ChatMessage[] | undefined) {
  if (!notices?.length) return
  const insertIndex = Math.max(0, target.indexOf(placeholder))
  target.splice(insertIndex, 0, ...notices)
}

function applySuggestedPrompt(prompt: string) {
  draft.value = prompt
  nextTick(() => composerRef.value?.focus())
}

function applyRouteDraft() {
  const nextDraft = typeof route.query.draft === "string" ? normalizeComposerMessage(route.query.draft) : ""
  if (!nextDraft) return
  draft.value = nextDraft
  nextTick(() => composerRef.value?.focus())
}

async function sendToolStarter(prompt: string) {
  if (!session.value || sending.value) return
  draft.value = prompt
  await nextTick()
  await sendMessage()
}

async function redirectLegacySkillChatToDistill(projectId: string) {
  const packSlug = primaryPackDetail.value?.pack.slug || project.value?.pack_slug || ""
  await router.replace({
    name: "new-project",
    query: {
      projectId,
      ...(packSlug ? { packSlug } : {}),
      step: "3",
      fromChat: "1",
    },
  })
}

async function ensureSession() {
  try {
    bootstrapping.value = true
    errorMessage.value = ""
    expertMatches.value = null
    primaryPackDetail.value = null

    const projectId = route.params.projectId as string
    const { data: bootstrap } = await api.post<ChatSessionBootstrapResponse>(`/projects/${projectId}/chat/bootstrap`, {
      mode: normalizeChatMode(route.query.mode),
    })
    const sessionDetail = bootstrap.session_detail
    project.value = sessionDetail.project
    report.value = sessionDetail.report
    messages.value = sessionDetail.messages
    session.value = sessionDetail.session
    resetChatSocket()
    primaryPackDetail.value = bootstrap.pack_detail || null
    const toolSession = sessionDetail.project.factory_category === "tool_agent"
    const lockedSkillSession = toolSession || prefersDirectSkillMode.value
    if (lockedSkillSession && route.query.legacyChat !== "1") {
      await redirectLegacySkillChatToDistill(projectId)
      return
    }
    activeMode.value = normalizeChatMode(sessionDetail.session.mode, lockedSkillSession)
    if (!toolSession) {
      expertMatches.value = normalizeExpertRecommendation(sessionDetail.expert_recommendation, sessionDetail.session.session_id)
      dismissedRecommendedExpertId.value = ""
    }
    await nextTick()
    applyRouteDraft()
    scrollThreadToBottom()
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || error.message || "对话室初始化失败"
  } finally {
    bootstrapping.value = false
  }
}

function resetChatSocket() {
  chatSocket?.close()
  chatSocket = null
}

function ensureChatSocket() {
  if (!session.value) throw new Error("聊天会话未初始化")
  const token = localStorage.getItem("distill-human-token") || ""
  if (!token) throw new Error("登录态已失效，请重新登录")
  if (!chatSocket) {
    chatSocket = new ChatSocketClient(session.value.session_id, token)
  }
  return chatSocket
}

async function switchMode(mode: ChatMode) {
  if (isToolProject.value || prefersDirectSkillMode.value) return
  activeMode.value = mode
  router.replace({ query: { mode } })
  await ensureSession()
}

async function selectExpert(nextExpertId: string) {
  if (!project.value || !expertMatches.value) return
  if (!nextExpertId || nextExpertId === expertMatches.value.selected_expert_id) return
  selectingExpert.value = true
  try {
    const { data } = await api.post<ExpertSelectionResponse>(`/projects/${project.value.project_id}/expert-selection`, {
      expert_id: nextExpertId,
    })
    expertMatches.value = {
      ...expertMatches.value,
      selected_expert_id: data.selected_expert_id,
      recommended_expert_id: data.selected_expert_id,
      recommended_switch: false,
      reason: null,
    }
    dismissedRecommendedExpertId.value = ""
  } finally {
    selectingExpert.value = false
  }
}

function dismissRecommendedSwitchCard() {
  dismissedRecommendedExpertId.value = recommendedExpertSwitchCard.value?.expertId || ""
}

function prefillQuestion() {
  applySuggestedPrompt(starterPrompts.value[0] || "")
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey) return
  event.preventDefault()
  void sendMessage()
}

async function sendMessage() {
  const userContent = normalizeComposerMessage(draft.value)
  if (sending.value || !session.value || !userContent) return
  sending.value = true
  draft.value = ""
  messages.value.push({
    message_id: `local-${Date.now()}`,
    session_id: session.value.session_id,
    role: "user",
    mode: activeMode.value,
    content: userContent,
    citations: [],
    created_at: new Date().toISOString(),
  })
  let streamedText = ""
  const placeholder: ChatMessage = {
    message_id: `stream-${Date.now()}`,
    session_id: session.value.session_id,
    role: "assistant",
    mode: activeMode.value,
    content: "",
    citations: [],
    created_at: new Date().toISOString(),
  }
  messages.value.push(placeholder)
  await nextTick()
  scrollThreadToBottom()
  try {
    const socket = ensureChatSocket()
    const result = await socket.sendMessage({
      content: userContent,
      mode: activeMode.value,
      onChunk: (chunk) => {
        streamedText += chunk
        placeholder.content = streamedText
        void nextTick().then(scrollThreadToBottom)
      },
    })
    const donePayload = result.donePayload as ChatStreamDonePayload | ChatMessage | null
    if (donePayload) {
      const finalPayload = donePayload as ChatStreamDonePayload
      const finalMessage = finalPayload.message || (donePayload as ChatMessage)
      insertNoticeMessages(messages.value, placeholder, finalPayload.notice_messages)
      placeholder.message_id = finalMessage.message_id
      placeholder.content = finalMessage.content
      placeholder.citations = finalMessage.citations || []
      placeholder.kind = finalMessage.kind
      placeholder.metadata = finalMessage.metadata
      if (finalPayload.expert_recommendation && !isToolProject.value) {
        expertMatches.value = normalizeExpertRecommendation(finalPayload.expert_recommendation, session.value.session_id)
        if (finalPayload.expert_recommendation.recommended_expert_id !== dismissedRecommendedExpertId.value) {
          dismissedRecommendedExpertId.value = ""
        }
      }
    } else if (!streamedText.trim()) {
      throw new Error("对话流没有返回正文")
    }
  } catch (error: any) {
    resetChatSocket()
    placeholder.content = `生成失败：${error?.message || "对话服务暂时不可用"}`
    draft.value = userContent
  } finally {
    sending.value = false
    await nextTick()
    scrollThreadToBottom()
  }
}

watch(
  () => messages.value.length,
  () => {
    void nextTick().then(scrollThreadToBottom)
  }
)

watch(
  () => route.query.draft,
  () => {
    applyRouteDraft()
  }
)

onMounted(() => {
  void ensureSession()
})

onBeforeUnmount(() => {
  resetChatSocket()
})
</script>
