<template>
  <V2AppShell>
    <div class="v2-proto-page">
      <div class="v2-proto-container v2-projects-shell">
        <template v-if="projects.length">
          <section class="v2-human-workbench-hero">
            <div class="v2-human-workbench-hero-copy">
              <p class="v2-proto-kicker">HUMAN 3.0 WORKBENCH</p>
              <h1 class="serif v2-human-workbench-title">人类 3.0</h1>
              <p class="v2-human-workbench-subtitle">
                项目 + 数据 + 报告 + 分身状态，现在统一放回一个工作台里。你不用再猜自己是在资产层、报告层还是聊天层。
              </p>
            </div>
            <div class="v2-human-workbench-hero-actions">
              <RouterLink :to="selectedConversation?.reportHref || '/projects/new'" class="btn-primary">
                {{ selectedConversation ? "继续当前分身" : "开始蒸馏" }}
              </RouterLink>
              <RouterLink to="/projects/new" class="btn-ghost">新建蒸馏</RouterLink>
            </div>
          </section>

          <section class="v2-projects-toolbar">
            <button
              v-for="card in summaryCards"
              :key="card.key"
              type="button"
              class="v2-projects-summary-card"
              :class="{ 'is-active': activeSummaryFilter === card.key }"
              @click="handleSummaryCardClick(card.key)"
            >
              <div class="v2-projects-summary-icon">{{ card.icon }}</div>
              <div class="v2-projects-summary-copy">
                <p class="v2-projects-summary-label">{{ card.label }}</p>
                <p class="v2-projects-summary-value">{{ card.value }}</p>
              </div>
              <span class="v2-projects-summary-chip">{{ card.hint }}</span>
            </button>
          </section>

          <section class="v2-human-workbench-panels">
            <article class="v2-human-workbench-panel">
              <div class="v2-human-workbench-panel-head">
                <div>
                  <p class="v2-proto-kicker">Workspace</p>
                  <h2>项目资产</h2>
                </div>
                <span class="v2-human-workbench-panel-meta">{{ projects.length }} 个项目</span>
              </div>
              <div class="v2-human-workbench-list">
                <button
                  v-for="item in projectAssetItems"
                  :key="item.project_id"
                  type="button"
                  class="v2-human-workbench-list-item"
                  @click="selectHistoryProject(item.project_id)"
                >
                  <div>
                    <strong>{{ item.name }}</strong>
                    <p>{{ item.summary }}</p>
                  </div>
                  <span>{{ item.statusLabel }}</span>
                </button>
                <p v-if="!projectAssetItems.length" class="v2-human-workbench-empty">项目会在这里沉淀成你的长期资产。</p>
              </div>
            </article>

            <article class="v2-human-workbench-panel">
              <div class="v2-human-workbench-panel-head">
                <div>
                  <p class="v2-proto-kicker">Fuel</p>
                  <h2>数据燃料</h2>
                </div>
                <span class="v2-human-workbench-panel-meta">{{ totalMaterialCount }} 份素材</span>
              </div>
              <div class="v2-human-workbench-list">
                <button
                  v-for="item in dataFuelItems"
                  :key="item.project_id"
                  type="button"
                  class="v2-human-workbench-list-item"
                  @click="selectHistoryProject(item.project_id)"
                >
                  <div>
                    <strong>{{ item.name }}</strong>
                    <p>{{ item.summary }}</p>
                  </div>
                  <span>{{ item.value }}</span>
                </button>
                <p v-if="!dataFuelItems.length" class="v2-human-workbench-empty">先导入聊天记录、截图或文档，工作台才会有燃料。</p>
              </div>
            </article>

            <article class="v2-human-workbench-panel">
              <div class="v2-human-workbench-panel-head">
                <div>
                  <p class="v2-proto-kicker">Reports</p>
                  <h2>报告沉淀</h2>
                </div>
                <span class="v2-human-workbench-panel-meta">{{ readyProjects.length }} 份结果</span>
              </div>
              <div class="v2-human-workbench-list">
                <RouterLink
                  v-for="item in reportItems"
                  :key="item.project_id"
                  :to="item.href"
                  class="v2-human-workbench-list-item v2-human-workbench-list-item--link"
                >
                  <div>
                    <strong>{{ item.name }}</strong>
                    <p>{{ item.summary }}</p>
                  </div>
                  <span>{{ item.updatedLabel }}</span>
                </RouterLink>
                <p v-if="!reportItems.length" class="v2-human-workbench-empty">报告还没生成前，这里会先提醒你去补料或继续蒸馏。</p>
              </div>
            </article>

            <article class="v2-human-workbench-panel">
              <div class="v2-human-workbench-panel-head">
                <div>
                  <p class="v2-proto-kicker">Identity</p>
                  <h2>分身状态</h2>
                </div>
                <span class="v2-human-workbench-panel-meta">{{ liveAvatarProjects.length }} 条已上线</span>
              </div>
              <div class="v2-human-workbench-state">
                <div class="v2-human-workbench-state-card">
                  <strong>{{ selectedConversation?.title || "等待选择项目" }}</strong>
                  <p>{{ humanStateHeadline }}</p>
                </div>
                <div class="v2-human-workbench-state-grid">
                  <div
                    v-for="item in identityStateItems"
                    :key="item.label"
                    class="v2-human-workbench-state-item"
                  >
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section class="v2-projects-board">
            <aside class="v2-projects-sidebar">
              <div class="v2-projects-search">
                <input
                  v-model="searchQuery"
                  type="search"
                  class="v2-proto-input v2-projects-search-input"
                  placeholder="搜索项目 / 分身..."
                />
              </div>

              <div class="v2-projects-sidebar-head">
                <p class="v2-proto-kicker">PROJECT ASSETS</p>
              </div>

              <div class="v2-projects-conversation-list">
                <button
                  v-for="item in filteredConversationItems"
                  :key="item.key"
                  type="button"
                  class="v2-projects-conversation-item"
                  :class="{ 'is-active': item.key === selectedConversationKey }"
                  @click="selectConversation(item)"
                >
                  <div class="v2-projects-conversation-avatar" :class="{ 'is-group': item.avatars.length > 1 }">
                    <span
                      v-for="avatar in item.avatars"
                      :key="`${item.key}-${avatar.label}`"
                      class="v2-projects-avatar-chip"
                      :style="avatar.style"
                    >
                      {{ avatar.label }}
                    </span>
                  </div>

                  <div class="v2-projects-conversation-copy">
                    <div class="v2-projects-conversation-row">
                      <strong>{{ item.title }}</strong>
                      <div class="v2-projects-conversation-meta">
                        <span class="v2-projects-conversation-time">{{ item.updatedLabel }}</span>
                        <span v-if="item.counterLabel" class="v2-projects-conversation-badge">{{ item.counterLabel }}</span>
                      </div>
                    </div>
                    <p class="v2-projects-conversation-subtitle">{{ item.subtitle }}</p>
                    <div class="v2-projects-conversation-tags">
                      <span class="v2-projects-conversation-tag">{{ item.modeLabel }}</span>
                      <span class="v2-projects-conversation-tag v2-projects-conversation-tag--muted">{{ item.statusLabel }}</span>
                    </div>
                  </div>
                </button>
              </div>
            </aside>

            <section v-if="selectedConversation" class="v2-projects-detail">
              <header class="v2-projects-detail-head" :class="{ 'is-chat': detailMode === 'chat' }">
                <div class="v2-projects-detail-user">
                  <div class="v2-projects-detail-avatar" :class="{ 'is-group': selectedConversation.avatars.length > 1 }">
                    <span
                      v-for="avatar in selectedConversation.avatars"
                      :key="`detail-${selectedConversation.key}-${avatar.label}`"
                      class="v2-projects-avatar-chip"
                      :style="avatar.style"
                    >
                      {{ avatar.label }}
                    </span>
                  </div>

                  <div>
                    <h1 class="v2-projects-detail-title">{{ selectedConversation.title }}</h1>
                    <p class="v2-projects-detail-status">
                      <span class="v2-projects-presence-dot"></span>
                      {{ detailPresenceText }}
                    </p>
                    <div class="v2-projects-detail-facts" :class="{ 'is-chat': detailMode === 'chat' }">
                      <span
                        v-for="fact in selectedConversationFacts"
                        :key="`${fact.label}-${fact.value}`"
                        class="v2-projects-detail-fact"
                      >
                        <em>{{ fact.label }}</em>
                        <strong>{{ fact.value }}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div class="v2-projects-detail-actions">
                  <button type="button" class="v2-projects-icon-button" @click="openCurrentProjectProcess">
                    项
                  </button>
                  <button
                    type="button"
                    class="v2-projects-icon-button"
                    :disabled="!canEnterChat(selectedConversation.project)"
                    @click="detailMode = 'chat'"
                  >
                    聊
                  </button>
                  <RouterLink class="v2-projects-icon-button" :to="selectedConversation.reportHref">报</RouterLink>
                </div>
              </header>

              <div class="v2-projects-detail-modebar">
                <button
                  type="button"
                  class="v2-projects-mode-pill"
                  @click="openCurrentProjectProcess"
                >
                  项目总览
                </button>
                <button
                  type="button"
                  class="v2-projects-mode-pill"
                  :class="{ 'is-active': detailMode === 'chat' }"
                  :disabled="!canEnterChat(selectedConversation.project)"
                  @click="detailMode = 'chat'"
                >
                  最近聊天
                </button>
                <span class="v2-projects-mode-status">{{ selectedConversation.statusLabel }}</span>
              </div>

              <template v-if="detailMode === 'overview'">
                <div class="v2-projects-detail-scroll">
                  <div class="v2-projects-chat-timeline">Overview</div>

                  <div class="v2-projects-overview-panel">
                    <p class="v2-proto-kicker">{{ shouldShowOrganizeGuide ? "当前该做什么" : "项目判断" }}</p>
                    <p class="v2-projects-overview-copy">
                      {{ shouldShowOrganizeGuide ? organizeGuideCopy : selectedConversationNote }}
                    </p>
                    <div v-if="shouldShowOrganizeGuide" class="v2-projects-journey-list">
                      <div
                        v-for="step in projectJourneySteps"
                        :key="step.label"
                        class="v2-projects-journey-step"
                        :class="{ 'is-active': step.active, 'is-done': step.done }"
                      >
                        <span class="v2-projects-journey-dot"></span>
                        <div>
                          <strong>{{ step.label }}</strong>
                          <p>{{ step.copy }}</p>
                        </div>
                      </div>
                    </div>
                    <div class="v2-projects-overview-tags">
                      <span class="v2-projects-conversation-tag">{{ selectedConversation.modeLabel }}</span>
                      <span class="v2-projects-conversation-tag v2-projects-conversation-tag--muted">{{ selectedConversation.entryLabel }}</span>
                    </div>
                  </div>

                  <div class="v2-projects-overview-history">
                    <div class="v2-projects-overview-history-head">
                      <div>
                        <p class="v2-proto-kicker">历史项目 / 报告</p>
                        <h3 class="v2-projects-overview-history-title">不要重复看当前页，直接回看之前的项目沉淀</h3>
                      </div>
                    </div>
                    <div v-if="relatedHistoryItems.length" class="v2-projects-history-list">
                      <button
                        v-for="item in relatedHistoryItems"
                        :key="item.project_id"
                        type="button"
                        class="v2-projects-history-item"
                        @click="selectHistoryProject(item.project_id)"
                      >
                        <div>
                          <strong>{{ item.name }}</strong>
                          <p>{{ item.summary }}</p>
                        </div>
                        <div class="v2-projects-history-meta">
                          <span>{{ item.statusLabel }}</span>
                          <em>{{ item.updatedLabel }}</em>
                        </div>
                      </button>
                    </div>
                    <p v-else class="v2-projects-history-empty">
                      这个对象暂时还没有更多历史项目，先继续当前蒸馏。
                    </p>
                  </div>

                  <div class="v2-projects-overview-actions">
                    <RouterLink :to="selectedConversation.reportHref" class="btn-primary">查看项目</RouterLink>
                    <button
                      v-if="canEnterChat(selectedConversation.project)"
                      class="btn-ghost"
                      type="button"
                      @click="detailMode = 'chat'"
                    >
                      打开聊天
                    </button>
                    <button type="button" class="btn-ghost" @click="openMaterialWorkbench">继续加料</button>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="v2-projects-chat-shell" :class="{ 'is-chat': detailMode === 'chat' }">
                  <div class="v2-projects-chat-timeline">Today</div>

                  <section v-if="chatPreviewRecommendedCard" class="v2-projects-skill-switch-card">
                    <div>
                      <p class="v2-proto-kicker">Skill Suggestion</p>
                      <h3 class="v2-projects-skill-switch-title">
                        {{ selectedConversation.project.pack_slug ? `检测到可加入的支援 skill：${chatPreviewRecommendedCard.name}` : `检测到更适合的专家：${chatPreviewRecommendedCard.name}` }}
                      </h3>
                      <p class="v2-projects-skill-switch-copy">{{ chatPreviewRecommendedCard.reason }}</p>
                    </div>
                    <div class="v2-projects-skill-switch-actions">
                      <button
                        type="button"
                        class="btn-primary"
                        :disabled="switchingPreviewExpert || sending"
                        @click="selectPreviewExpert(chatPreviewRecommendedCard.expertId)"
                      >
                        {{ selectedConversation.project.pack_slug ? "加入并继续" : "切换并继续" }}
                      </button>
                      <button type="button" class="btn-ghost" @click="dismissPreviewRecommendedCard">
                        先继续当前
                      </button>
                    </div>
                  </section>

                  <div ref="threadRef" class="v2-projects-chat-thread">
                    <div v-if="chatPreviewLoading" class="v2-projects-chat-state">
                      正在装配最近聊天窗口...
                    </div>
                    <div v-else-if="chatPreviewError" class="v2-projects-chat-state v2-danger">
                      {{ chatPreviewError }}
                    </div>
                    <template v-else-if="chatPreviewMessages.length">
                      <div
                        v-for="message in chatPreviewMessages"
                        :key="message.message_id"
                      >
                        <div v-if="isSystemNotice(message)" class="v2-projects-chat-notice">
                          {{ message.content }}
                        </div>
                        <div
                          v-else
                          class="v2-projects-chat-row"
                          :class="{ 'is-user': message.role === 'user' }"
                        >
                          <div
                            class="v2-projects-chat-avatar"
                            :class="{ 'is-user': message.role === 'user' }"
                            :style="message.role === 'user' ? viewerAvatar.style : activeAssistantAvatar.style"
                          >
                            {{ message.role === "user" ? viewerAvatar.label : activeAssistantAvatar.label }}
                          </div>
                          <div
                            class="v2-projects-chat-bubble"
                            :class="{ 'is-pending': isPendingAssistantMessage(message) }"
                          >
                            <p>{{ message.content }}</p>
                            <span class="v2-projects-chat-time">{{ formatMessageTime(message.created_at) }}</span>
                          </div>
                        </div>
                      </div>
                    </template>
                    <div v-else class="v2-projects-chat-state">
                      这个项目还没有聊天记录，现在就在这里开启第一轮蒸馏。
                    </div>
                  </div>
                </div>
              </template>

              <footer class="v2-projects-composer">
                <input
                  :key="imageInputKey"
                  ref="imagePickerRef"
                  type="file"
                  accept="image/*"
                  class="v2-projects-file-input"
                  @change="handleImageFileChange"
                />
                <input
                  :key="fileInputKey"
                  ref="filePickerRef"
                  type="file"
                  class="v2-projects-file-input"
                  @change="handleMaterialFileChange"
                />
                <div class="v2-projects-composer-field">
                  <button
                    type="button"
                    class="v2-projects-composer-tool"
                    :disabled="uploadingMaterial || sending"
                    title="上传图片"
                    @click="triggerImagePicker"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5.5 6.5h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
                      <path d="M8 14.5l2.3-2.6a1 1 0 0 1 1.5 0l1.6 1.8 1.5-1.6a1 1 0 0 1 1.5 0l2.1 2.4" />
                      <circle cx="9" cy="10" r="1.1" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="v2-projects-composer-tool"
                    :disabled="uploadingMaterial || sending"
                    title="上传文件"
                    @click="triggerFilePicker"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4.5 7.5a2 2 0 0 1 2-2h3.1a2 2 0 0 1 1.4.57l1.03 1.03A2 2 0 0 0 13.44 7.7H17.5a2 2 0 0 1 2 2v6.8a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V7.5Z" />
                    </svg>
                  </button>
                  <textarea
                    v-model="composerDraft"
                    class="v2-projects-composer-input"
                    rows="1"
                    :disabled="sending"
                    :placeholder="detailMode === 'chat' ? '继续聊，回车发送，Shift+Enter 换行' : '输入内容后会直接在当前窗口开启蒸馏对话'"
                    @keydown="handleComposerKeydown"
                    @paste="handleComposerPaste"
                  />
                  <button
                    type="button"
                    class="v2-projects-composer-send"
                    :disabled="sending || uploadingMaterial"
                    @click="continueChat"
                  >
                    {{ sending ? "…" : "→" }}
                  </button>
                </div>
              </footer>
              <div v-if="composerNotice" class="v2-projects-composer-note">
                {{ composerNotice }}
              </div>
            </section>

            <section v-else class="v2-projects-detail v2-projects-detail--empty">
              <div class="v2-projects-detail-empty-card">
                <p class="v2-proto-kicker">No Match</p>
                <h2 class="serif v2-projects-detail-empty-title">没有匹配到会话。</h2>
                <p class="v2-projects-detail-empty-copy">换个关键词，或者切回“全部”，左侧消息列表会重新展开。</p>
                <button type="button" class="btn-ghost" @click="searchQuery = ''; activeSummaryFilter = 'all'">
                  清空筛选
                </button>
              </div>
            </section>
          </section>
        </template>

        <section v-else class="v2-projects-empty">
          <p class="v2-proto-kicker">Empty</p>
          <h2 class="serif v2-projects-empty-title">先创建第一个项目。</h2>
          <p class="v2-projects-empty-copy">
            私有蒸馏适合导入聊天记录和截图，人物包适合直接体验预制视角。现在所有结果都会回到这个“新人类 3.0”项目中枢。
          </p>
          <div class="v2-proto-button-row v2-proto-button-row--center">
            <RouterLink to="/projects/new" class="btn-primary">打开蒸馏器</RouterLink>
            <RouterLink to="/plaza" class="btn-ghost">去蒸馏工厂</RouterLink>
          </div>
        </section>
      </div>
    </div>
  </V2AppShell>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"

import { api } from "@/lib/api"
import { ChatSocketClient } from "@/lib/chatSocket"
import type {
  ChatExpertRecommendation,
  ChatMessage,
  ChatSessionBootstrapResponse,
  ChatSessionSummary,
  ChatStreamDonePayload,
  ExpertCandidateListResponse,
  ExpertSelectionResponse,
  JobStatus,
  MaterialSummary,
  ProjectSummary,
  SubjectType,
} from "@/types"
import { formatDateTime } from "@/v2/app"
import V2AppShell from "@/v2/components/V2AppShell.vue"

type SummaryFilter = "all" | "ready" | "active" | "tool"
type DetailMode = "overview" | "chat"

interface RailAvatar {
  label: string
  style: Record<string, string>
}

interface ConversationItem {
  key: string
  title: string
  subtitle: string
  preview: string
  updatedLabel: string
  counterLabel: string
  statusLabel: string
  modeLabel: string
  entryLabel: string
  href: string
  chatHref: string
  materialHref: string
  reportHref: string
  avatars: RailAvatar[]
  project: ProjectSummary
}

type EvidenceType = "chat_export" | "screenshot" | "text_note" | "public_reference"

const route = useRoute()
const router = useRouter()
const projects = ref<ProjectSummary[]>([])
const activeSummaryFilter = ref<SummaryFilter>("all")
const searchQuery = ref("")
const selectedConversationKey = ref("")
const detailMode = ref<DetailMode>("chat")
const chatPreviewLoading = ref(false)
const chatPreviewError = ref("")
const chatPreviewMessages = ref<ChatMessage[]>([])
const chatPreviewRecommendation = ref<ChatExpertRecommendation | null>(null)
const activeChatSession = ref<ChatSessionSummary | null>(null)
const composerDraft = ref("")
const composerNotice = ref("")
const uploadingMaterial = ref(false)
const sending = ref(false)
const switchingPreviewExpert = ref(false)
const imagePickerRef = ref<HTMLInputElement | null>(null)
const filePickerRef = ref<HTMLInputElement | null>(null)
const threadRef = ref<HTMLElement | null>(null)
const imageInputKey = ref(0)
const fileInputKey = ref(0)
const dismissedPreviewRecommendedExpertId = ref("")
let chatSocket: ChatSocketClient | null = null
let chatBootstrapPromise: Promise<ChatSessionSummary | null> | null = null
let chatBootstrapProjectId = ""
const viewerAvatar = makeAvatar("我", "viewer-self", 232)

const sortedProjects = computed(() =>
  [...projects.value].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
)

const activeProjects = computed(() =>
  sortedProjects.value.filter((project) =>
    project.status === "draft" ||
    project.status === "ready_for_distill" ||
    project.status === "distilling" ||
    Boolean(project.latest_job_status && isActiveJob(project.latest_job_status))
  )
)

const readyProjects = computed(() =>
  sortedProjects.value.filter((project) => project.status === "report_ready" || project.status === "chat_ready")
)

const toolProjects = computed(() =>
  sortedProjects.value.filter((project) => project.factory_category === "tool_agent")
)

const totalMaterialCount = computed(() =>
  sortedProjects.value.reduce((sum, project) => sum + project.material_count, 0)
)

const liveAvatarProjects = computed(() =>
  sortedProjects.value.filter((project) => canEnterChat(project))
)

const summaryCards = computed(() => [
  { key: "all" as SummaryFilter, label: "项目资产", value: projects.value.length, hint: "全部项目", icon: "项" },
  { key: "active" as SummaryFilter, label: "数据燃料", value: totalMaterialCount.value, hint: `${activeProjects.value.length} 条待推进`, icon: "料" },
  { key: "ready" as SummaryFilter, label: "报告沉淀", value: readyProjects.value.length, hint: "可复看", icon: "报" },
  { key: "tool" as SummaryFilter, label: "分身状态", value: liveAvatarProjects.value.length, hint: "可继续", icon: "身" },
])

const conversationItems = computed<ConversationItem[]>(() =>
  sortedProjects.value
    .filter((project) => canEnterChat(project) || project.status === "report_ready" || Boolean(project.pack_slug))
    .map((project) => {
      const poolMode = isProjectConversationPool(project)
      return {
        key: project.project_id,
        title: project.name,
        subtitle: poolMode
          ? "精准蒸馏会话准备完毕"
          : `${project.subject_name} · ${project.factory_category === "tool_agent" ? "单 skill 会话已就绪" : "聊天已就绪"}`,
        preview: project.analysis_goal || "直接进入最近聊天窗口。",
        updatedLabel: formatConversationTime(project.updated_at),
        counterLabel: project.material_count > 0 ? String(Math.min(project.material_count, 9)) : "",
        statusLabel: projectStatusText(project),
        modeLabel: poolMode ? "多 skill 入口" : "单 skill 入口",
        entryLabel: project.factory_category === "tool_agent" ? "测试 / 报告" : poolMode ? "项目总览 / 会话池" : "报告 / 聊天",
        href: conversationEntryPath(project),
        chatHref: chatEntryPath(project),
        materialHref: `/projects/new?projectId=${project.project_id}`,
        reportHref: projectEntryPath(project),
        avatars: buildConversationAvatars(project),
        project,
      }
    })
)

const filteredConversationItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return conversationItems.value.filter((item) => {
    if (activeSummaryFilter.value === "ready" && !readyProjects.value.some((project) => project.project_id === item.project.project_id)) return false
    if (activeSummaryFilter.value === "active" && !activeProjects.value.some((project) => project.project_id === item.project.project_id) && item.project.material_count === 0) return false
    if (activeSummaryFilter.value === "tool" && !canEnterChat(item.project)) return false
    if (!query) return true
    return [
      item.title,
      item.subtitle,
      item.project.subject_name,
      item.project.analysis_goal || "",
    ].join(" ").toLowerCase().includes(query)
  })
})

const selectedConversation = computed(() =>
  filteredConversationItems.value.find((item) => item.key === selectedConversationKey.value) ||
  filteredConversationItems.value[0] ||
  null
)

const detailPresenceText = computed(() => {
  if (!selectedConversation.value) return "未选择项目"
  if (detailMode.value !== "chat") return "项目状态正常"
  const project = selectedConversation.value.project
  if (!canEnterChat(project)) return "当前项目更适合先继续整理"
  if (chatPreviewLoading.value) return "正在恢复最近会话"
  if (chatPreviewError.value) return "聊天窗口恢复失败"
  if (activeChatSession.value) {
    return chatPreviewMessages.value.length ? "最近会话已连接" : "会话已连接，等待第一条消息"
  }
  return "聊天入口待启动"
})

const selectedConversationFacts = computed(() => {
  if (!selectedConversation.value) return []
  const project = selectedConversation.value.project
  const facts = [
    {
      label: "对象",
      value: `${project.subject_name} · ${subjectTypeText(project.subject_type)}`,
    },
    project.relation_label
      ? {
          label: "关系",
          value: project.relation_label,
        }
      : null,
    {
      label: "素材",
      value: `${project.material_count} 份`,
    },
    {
      label: "状态",
      value: selectedConversation.value.statusLabel,
    },
    {
      label: "更新",
      value: formatDateTime(project.updated_at),
    },
  ].filter(Boolean)
  const normalizedFacts = facts as Array<{ label: string; value: string }>
  return detailMode.value === "chat" ? normalizedFacts.slice(0, 3) : normalizedFacts
})

const selectedConversationNote = computed(() => {
  if (!selectedConversation.value) return ""
  return selectedConversation.value.project.analysis_goal?.trim() || "项目总览只保留真实字段，避免再显示空洞文案。需要继续蒸馏时，优先直接进入聊天或继续加料。"
})

const shouldShowOrganizeGuide = computed(() => {
  const project = selectedConversation.value?.project
  if (!project) return false
  if (project.status === "draft" || project.status === "ready_for_distill" || project.status === "distilling") return true
  if ((project.pack_slug || project.factory_category === "tool_agent") && project.status !== "report_ready" && project.status !== "chat_ready") {
    return true
  }
  return false
})

const organizeGuideCopy = computed(() => {
  const project = selectedConversation.value?.project
  if (!project) return ""
  if (project.status === "draft") return "这条会话还在建档阶段，先把材料和目标整理完整，再进入稳定聊天。"
  if (project.status === "ready_for_distill") return "材料已经差不多了，现在更适合进入蒸馏流程，而不是直接把聊天当主界面。"
  if (project.status === "distilling") return "当前正在解析和蒸馏，聊天窗口更像旁路入口，主承接应该是整理进度和结果等待。"
  if (project.pack_slug || project.factory_category === "tool_agent") {
    return "当前 skill 还没沉淀成完整报告，先把它当整理过程来承接，等结果稳定后再把聊天放到主位。"
  }
  return selectedConversationNote.value
})

const projectJourneySteps = computed(() => {
  const project = selectedConversation.value?.project
  if (!project) return []
  const status = project.status
  const activeIndex = status === "draft"
    ? 0
    : status === "ready_for_distill"
      ? 1
      : status === "distilling"
        ? 2
        : 3
  return [
    { label: "建档", copy: "确认对象、目标和入口。", active: activeIndex === 0, done: activeIndex > 0 },
    { label: "整理素材", copy: "上传聊天记录、截图、文字补充。", active: activeIndex === 1, done: activeIndex > 1 },
    { label: "蒸馏处理", copy: "解析、向量化、生成中间结果。", active: activeIndex === 2, done: activeIndex > 2 },
    { label: "报告 / 稳定会话", copy: "结果成型后，再把聊天作为主承接。", active: activeIndex === 3, done: activeIndex > 3 },
  ]
})

const relatedHistoryItems = computed(() => {
  const current = selectedConversation.value?.project
  if (!current) return []
  const sameSubject = sortedProjects.value.filter((project) =>
    project.project_id !== current.project_id &&
    project.subject_name === current.subject_name
  )
  const fallback = sortedProjects.value.filter((project) => project.project_id !== current.project_id)
  const source = sameSubject.length ? sameSubject : fallback
  return source.slice(0, 6).map((project) => ({
    project_id: project.project_id,
    name: project.name,
    summary: project.analysis_goal?.trim() || `${project.subject_name} · ${projectStatusText(project)}`,
    statusLabel: projectStatusText(project),
    updatedLabel: formatConversationTime(project.updated_at),
  }))
})

const projectAssetItems = computed(() =>
  sortedProjects.value.slice(0, 4).map((project) => ({
    project_id: project.project_id,
    name: project.name,
    summary: project.analysis_goal?.trim() || `${project.subject_name} · ${subjectTypeText(project.subject_type)}`,
    statusLabel: projectStatusText(project),
  }))
)

const dataFuelItems = computed(() => {
  const ranked = [...sortedProjects.value].sort((a, b) => {
    if (b.material_count !== a.material_count) return b.material_count - a.material_count
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
  return ranked.slice(0, 4).map((project) => ({
    project_id: project.project_id,
    name: project.name,
    summary: project.material_count
      ? `${project.subject_name} 已入库 ${project.material_count} 份素材`
      : "还没有素材，适合先补聊天记录、截图或文档。",
    value: project.material_count ? `${project.material_count} 份` : "待补料",
  }))
})

const reportItems = computed(() =>
  readyProjects.value.slice(0, 4).map((project) => ({
    project_id: project.project_id,
    name: project.name,
    summary: project.analysis_goal?.trim() || `${project.subject_name} 的最新报告与稳定承接入口`,
    updatedLabel: formatConversationTime(project.updated_at),
    href: projectEntryPath(project),
  }))
)

const humanStateHeadline = computed(() => {
  const project = selectedConversation.value?.project
  if (!project) return "先选一个项目，工作台会把它的分身状态、报告和会话一起承接。"
  if (canEnterChat(project)) return "当前分身可继续对话，下一轮问题会直接接在最近会话后面。"
  if (project.status === "report_ready") return "报告已经成型，距离稳定分身只差最后一轮聊天接管。"
  if (project.material_count > 0) return "材料已经进场，但分身还在校准，适合继续补料或发起蒸馏。"
  return "项目已建档，但还缺代表性的材料，分身暂时还没有稳定站起来。"
})

const identityStateItems = computed(() => {
  const project = selectedConversation.value?.project
  if (!project) {
    return [
      { label: "当前焦点", value: "未选择" },
      { label: "聊天承接", value: "未启动" },
      { label: "数据基底", value: "0 份" },
      { label: "最近更新", value: "等待中" },
    ]
  }
  return [
    { label: "当前焦点", value: project.name },
    { label: "聊天承接", value: canEnterChat(project) ? "已上线" : "待校准" },
    { label: "数据基底", value: `${project.material_count} 份` },
    { label: "最近更新", value: formatConversationTime(project.updated_at) },
  ]
})

function isActiveJob(status?: JobStatus) {
  return !!status && ["queued", "parsing", "extracting", "distilling", "report_ready"].includes(status)
}

function subjectTypeText(type: SubjectType) {
  const labels: Record<SubjectType, string> = {
    self: "自己",
    private_person: "他人",
    public_figure: "人物包",
  }
  return labels[type]
}

function projectStatusText(project: ProjectSummary) {
  if (project.latest_job_status === "failed") {
    return "蒸馏失败"
  }
  if (project.latest_job_status && isActiveJob(project.latest_job_status)) {
    return `蒸馏中 · ${project.latest_job_status}`
  }
  const labels: Record<string, string> = {
    draft: "待建档",
    ready_for_distill: "待蒸馏",
    distilling: "蒸馏中",
    report_ready: "报告已生成",
    chat_ready: "聊天已就绪",
  }
  return labels[project.status] || project.status
}

function projectEntryPath(project: ProjectSummary) {
  if (project.latest_job_id && project.latest_job_status && isActiveJob(project.latest_job_status)) {
    return `/projects/${project.project_id}/jobs/${project.latest_job_id}`
  }
  if (project.status === "draft" || project.status === "ready_for_distill") {
    return `/projects/new?projectId=${project.project_id}`
  }
  return `/projects/${project.project_id}/report`
}

function projectSecondaryPath(project: ProjectSummary) {
  if (project.factory_category === "tool_agent") {
    return project.status === "chat_ready" ? `/projects/${project.project_id}/report` : `/chat/${project.project_id}`
  }
  return `/chat/${project.project_id}?mode=advice`
}

function chatEntryPath(project: ProjectSummary) {
  if (project.factory_category === "tool_agent") return `/chat/${project.project_id}`
  return `/chat/${project.project_id}?mode=advice`
}

function canEnterChat(project: ProjectSummary) {
  return project.can_chat_now
}

function isProjectConversationPool(project: ProjectSummary) {
  return !project.pack_slug && project.factory_category !== "tool_agent" && project.subject_type !== "public_figure"
}

function conversationEntryPath(project: ProjectSummary) {
  if (project.factory_category === "tool_agent" || project.pack_slug) {
    return projectSecondaryPath(project)
  }
  return `/projects/new?projectId=${project.project_id}`
}

function buildConversationAvatars(project: ProjectSummary): RailAvatar[] {
  if (isProjectConversationPool(project)) {
    return [
      makeAvatar("性", `${project.project_id}-personality`, 16),
      makeAvatar("情", `${project.project_id}-emotion`, 188),
      makeAvatar((project.subject_name || "蒸").slice(0, 1), `${project.project_id}-subject`, 284),
    ]
  }
  const label = project.factory_category === "tool_agent"
    ? "技"
    : (project.subject_name || project.name || "蒸").slice(0, 1)
  return [makeAvatar(label, project.project_id, 44)]
}

function makeAvatar(label: string, seed: string, hueOffset = 0): RailAvatar {
  let hash = 0
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) >>> 0
  const hueA = (hash + hueOffset) % 360
  const hueB = (hueA + 38) % 360
  return {
    label,
    style: {
      background: `linear-gradient(135deg, hsl(${hueA} 72% 48%), hsl(${hueB} 82% 58%))`,
    },
  }
}

function formatConversationTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "刚刚"
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

function formatMessageTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

function scrollThreadToBottom() {
  const node = threadRef.value
  if (!node) return
  node.scrollTop = node.scrollHeight
}

function scheduleScrollThreadToBottom() {
  void nextTick().then(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollThreadToBottom()
      })
    })
  })
}

function resetChatSocket() {
  chatSocket?.close()
  chatSocket = null
}

function ensureChatSocket() {
  if (!activeChatSession.value) throw new Error("聊天会话未初始化")
  const token = localStorage.getItem("distill-human-token") || ""
  if (!token) throw new Error("登录态已失效，请重新登录")
  if (!chatSocket) {
    chatSocket = new ChatSocketClient(activeChatSession.value.session_id, token)
  }
  return chatSocket
}

function isSystemNotice(message: ChatMessage) {
  return message.role === "system" || message.kind === "skill_switch"
}

function isPendingAssistantMessage(message: ChatMessage) {
  return message.role === "assistant" && !message.message_id.startsWith("msg_") && !message.citations.length
}

function insertNoticeMessages(target: ChatMessage[], placeholder: ChatMessage, notices?: ChatMessage[]) {
  if (!notices?.length) return
  const insertIndex = Math.max(0, target.indexOf(placeholder))
  target.splice(insertIndex, 0, ...notices)
}

const activeAssistantAvatar = computed(() => {
  const current = selectedConversation.value
  if (current?.avatars?.[0]) {
    return current.avatars[0]
  }
  return makeAvatar((current?.project.subject_name || "蒸").slice(0, 1), current?.project.project_id || "assistant", 48)
})

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
    session_id: sessionId || activeChatSession.value?.session_id || "",
    selected_expert_id: source.selected_expert_id ?? null,
    recommended_expert_id: source.items[0]?.expert_id || null,
    recommended_switch: false,
    reason: null,
    items: source.items,
  }
}

const chatPreviewRecommendedCard = computed(() => {
  const recommendation = chatPreviewRecommendation.value
  if (!recommendation?.recommended_switch || !recommendation.recommended_expert_id) return null
  const candidate = recommendation.items.find((item) => item.expert_id === recommendation.recommended_expert_id)
  if (!candidate) return null
  if (dismissedPreviewRecommendedExpertId.value === candidate.expert_id) return null
  return {
    expertId: candidate.expert_id,
    name: candidate.name,
    reason: recommendation.reason?.trim() || candidate.reasons?.[0] || "这一轮问题更贴近另一条 skill 的能力范围。",
  }
})

function selectConversation(item: ConversationItem) {
  selectedConversationKey.value = item.key
  detailMode.value = shouldPreferOverview(item.project) ? "overview" : "chat"
  composerNotice.value = ""
  dismissedPreviewRecommendedExpertId.value = ""
}

function handleSummaryCardClick(key: SummaryFilter) {
  activeSummaryFilter.value = key
}

function openCurrentProjectProcess() {
  if (!selectedConversation.value) return
  void router.push(selectedConversation.value.reportHref)
}

function selectHistoryProject(projectId: string) {
  const target = conversationItems.value.find((item) => item.project.project_id === projectId)
  if (!target) return
  selectConversation(target)
}

async function loadProjects() {
  const { data } = await api.get<{ items: ProjectSummary[] }>("/projects")
  projects.value = data.items
  if (!selectedConversationKey.value && data.items.length) {
    selectedConversationKey.value = data.items[0].project_id
  }
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

function inferEvidenceTypeFromFile(file: File): EvidenceType {
  const fileName = file.name.toLowerCase()
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(fileName)) return "screenshot"
  if (/\.(txt|csv|json|md)$/i.test(fileName)) return "chat_export"
  return "public_reference"
}

function openMaterialWorkbench() {
  if (!selectedConversation.value) return
  router.push(selectedConversation.value.materialHref)
}

function dismissPreviewRecommendedCard() {
  dismissedPreviewRecommendedExpertId.value = chatPreviewRecommendedCard.value?.expertId || ""
}

async function selectPreviewExpert(expertId: string) {
  const current = selectedConversation.value
  if (!current || !expertId) return
  switchingPreviewExpert.value = true
  try {
    const { data } = await api.post<ExpertSelectionResponse>(`/projects/${current.project.project_id}/expert-selection`, {
      expert_id: expertId,
    })
    const currentRecommendation = chatPreviewRecommendation.value
    if (currentRecommendation) {
      chatPreviewRecommendation.value = {
        ...currentRecommendation,
        selected_expert_id: data.selected_expert_id,
        recommended_expert_id: data.selected_expert_id,
        recommended_switch: false,
        reason: null,
      }
    }
    dismissedPreviewRecommendedExpertId.value = ""
    composerNotice.value = current.project.pack_slug
      ? "支援 skill 已加入，下一轮会按新的 skill 组合继续。"
      : `已切换到 ${data.selected_expert.name}，下一轮开始生效。`
  } catch (error: any) {
    composerNotice.value = error.response?.data?.detail || error.message || "skill 切换失败"
  } finally {
    switchingPreviewExpert.value = false
  }
}

function triggerFilePicker() {
  filePickerRef.value?.click()
}

function triggerImagePicker() {
  imagePickerRef.value?.click()
}

async function uploadMaterialFile(file: File) {
  if (!selectedConversation.value) return
  try {
    uploadingMaterial.value = true
    composerNotice.value = ""
    const formData = new FormData()
    formData.append("evidence_type", inferEvidenceTypeFromFile(file))
    formData.append("label", file.name || "续传素材")
    formData.append("text_content", "")
    formData.append("consent_confirmed", "true")
    formData.append("file", file)
    await api.post<{ material: MaterialSummary }>(`/projects/${selectedConversation.value.project.project_id}/materials/upload`, formData)
    composerNotice.value = `已补充素材：${file.name || "未命名文件"}`
    await loadProjects()
  } catch (error: any) {
    composerNotice.value = error.response?.data?.detail || error.message || "文件上传失败"
  } finally {
    uploadingMaterial.value = false
    imageInputKey.value += 1
    fileInputKey.value += 1
  }
}

async function handleMaterialFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  await uploadMaterialFile(file)
}

async function handleImageFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  await uploadMaterialFile(file)
}

async function handleComposerPaste(event: ClipboardEvent) {
  const fileItem = Array.from(event.clipboardData?.items || []).find((item) => item.kind === "file")
  const file = fileItem?.getAsFile()
  if (!file) return
  event.preventDefault()
  await uploadMaterialFile(file)
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey) return
  event.preventDefault()
  void continueChat()
}

async function continueChat() {
  if (!selectedConversation.value) return
  const normalizedDraft = normalizeComposerMessage(composerDraft.value)
  const project = selectedConversation.value.project
  if (canEnterChat(project)) {
    if (detailMode.value !== "chat") {
      detailMode.value = "chat"
    }
    if (!normalizedDraft) {
      composerNotice.value = ""
      return
    }
    await sendMessageInPlace(normalizedDraft)
    return
  }
  composerNotice.value = "这个项目暂时还不能聊天，先点“继续加料”补素材。"
}

async function loadChatPreview(projectId: string) {
  if (chatBootstrapPromise && chatBootstrapProjectId === projectId) {
    return await chatBootstrapPromise
  }

  chatBootstrapProjectId = projectId
  chatPreviewLoading.value = true
  chatPreviewError.value = ""
  activeChatSession.value = null
  chatPreviewMessages.value = []
  chatPreviewRecommendation.value = null
  resetChatSocket()
  const task = (async () => {
    try {
      const { data } = await api.post<ChatSessionBootstrapResponse>(`/projects/${projectId}/chat/bootstrap`, {
        mode: "advice",
      })
      if (selectedConversation.value?.project.project_id !== projectId) {
        return null
      }
      activeChatSession.value = data.session_detail.session
      chatPreviewMessages.value = data.session_detail.messages
      chatPreviewRecommendation.value = normalizeExpertRecommendation(
        data.session_detail.expert_recommendation,
        data.session_detail.session.session_id,
      )
      dismissedPreviewRecommendedExpertId.value = ""
      scheduleScrollThreadToBottom()
      return activeChatSession.value
    } catch (error: any) {
      if (selectedConversation.value?.project.project_id === projectId) {
        chatPreviewMessages.value = []
        activeChatSession.value = null
        chatPreviewRecommendation.value = null
        chatPreviewError.value = error.response?.data?.detail || error.message || "最近聊天窗口加载失败"
      }
      return null
    } finally {
      if (selectedConversation.value?.project.project_id === projectId) {
        chatPreviewLoading.value = false
      }
      if (chatBootstrapProjectId === projectId) {
        chatBootstrapPromise = null
      }
    }
  }
  )()
  chatBootstrapPromise = task
  return await task
}

async function ensureChatSessionForProject(projectId: string) {
  if (activeChatSession.value?.project_id === projectId) {
    return activeChatSession.value
  }
  await loadChatPreview(projectId)
  if (!activeChatSession.value) throw new Error(chatPreviewError.value || "聊天窗口初始化失败")
  return activeChatSession.value
}

async function sendMessageInPlace(userContent: string) {
  if (!selectedConversation.value || sending.value) return
  const projectId = selectedConversation.value.project.project_id
  const session = await ensureChatSessionForProject(projectId)
  sending.value = true
  composerNotice.value = ""
  composerDraft.value = ""
  chatPreviewMessages.value.push({
    message_id: `local-${Date.now()}`,
    session_id: session.session_id,
    role: "user",
    mode: "advice",
    content: userContent,
    citations: [],
    created_at: new Date().toISOString(),
  })
  let streamedText = ""
  const placeholder: ChatMessage = {
    message_id: `stream-${Date.now()}`,
    session_id: session.session_id,
    role: "assistant",
    mode: "advice",
    content: "",
    citations: [],
    created_at: new Date().toISOString(),
  }
  chatPreviewMessages.value.push(placeholder)
  await nextTick()
  scheduleScrollThreadToBottom()
  try {
    const socket = ensureChatSocket()
    const result = await socket.sendMessage({
      content: userContent,
      mode: "advice",
      timeoutMs: 90000,
      onChunk: (chunk) => {
        streamedText += chunk
        placeholder.content = streamedText
        scheduleScrollThreadToBottom()
      },
      onStatus: ({ text }) => {
        const nextText = text.trim()
        if (!nextText || streamedText) return
        placeholder.content = nextText
        scheduleScrollThreadToBottom()
      },
    })
    const donePayload = result.donePayload as ChatStreamDonePayload | ChatMessage | null
    if (donePayload) {
      const finalPayload = donePayload as ChatStreamDonePayload
      const finalMessage = finalPayload.message || (donePayload as ChatMessage)
      insertNoticeMessages(chatPreviewMessages.value, placeholder, finalPayload.notice_messages)
      placeholder.message_id = finalMessage.message_id
      placeholder.content = finalMessage.content
      placeholder.kind = finalMessage.kind
      placeholder.metadata = finalMessage.metadata
      placeholder.citations = finalMessage.citations || []
      if (finalPayload.expert_recommendation) {
        chatPreviewRecommendation.value = normalizeExpertRecommendation(
          finalPayload.expert_recommendation,
          session.session_id,
        )
        if (finalPayload.expert_recommendation.recommended_expert_id !== dismissedPreviewRecommendedExpertId.value) {
          dismissedPreviewRecommendedExpertId.value = ""
        }
      }
      composerNotice.value = ""
    } else if (!streamedText.trim()) {
      throw new Error("对话流没有返回正文")
    }
  } catch (error: any) {
    resetChatSocket()
    placeholder.content = `生成失败：${error?.message || "对话服务暂时不可用"}`
    composerDraft.value = userContent
    composerNotice.value = "发送失败，内容已回填到输入框。"
  } finally {
    sending.value = false
    scheduleScrollThreadToBottom()
  }
}

function shouldPreferOverview(project: ProjectSummary) {
  if (!canEnterChat(project)) return true
  if (project.status === "draft" || project.status === "ready_for_distill" || project.status === "distilling") return true
  if ((project.pack_slug || project.factory_category === "tool_agent") && project.status !== "report_ready" && project.status !== "chat_ready") {
    return true
  }
  return false
}

watch(
  () => filteredConversationItems.value.map((item) => item.key).join("|"),
  () => {
    if (!filteredConversationItems.value.some((item) => item.key === selectedConversationKey.value)) {
      selectedConversationKey.value = filteredConversationItems.value[0]?.key || ""
    }
    if (selectedConversation.value) {
      detailMode.value = shouldPreferOverview(selectedConversation.value.project) ? "overview" : "chat"
    }
  },
  { immediate: true },
)

watch(
  () => [detailMode.value, selectedConversation.value?.project.project_id].join("|"),
  (signature) => {
    if (!signature) return
    if (detailMode.value !== "chat" || !selectedConversation.value) return
    if (!canEnterChat(selectedConversation.value.project)) return
    void loadChatPreview(selectedConversation.value.project.project_id)
  },
)

watch(
  () => chatPreviewMessages.value.length,
  () => {
    scheduleScrollThreadToBottom()
  },
)

onMounted(() => {
  if (route.query.focus === "reports") activeSummaryFilter.value = "ready"
  else if (route.query.focus === "data") activeSummaryFilter.value = "active"
  else if (route.query.focus === "state") activeSummaryFilter.value = "tool"
  void loadProjects()
})

onBeforeUnmount(() => {
  resetChatSocket()
})
</script>

<style scoped>
.v2-projects-shell {
  padding-top: 12px;
  display: grid;
  gap: 18px;
}

.v2-human-workbench-hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  padding: 28px 30px 24px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 30px;
  background:
    radial-gradient(circle at top left, rgba(218, 165, 78, 0.14), transparent 34%),
    radial-gradient(circle at 82% 12%, rgba(87, 109, 206, 0.14), transparent 28%),
    linear-gradient(180deg, rgba(19, 19, 28, 0.94), rgba(14, 14, 20, 0.92));
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.24);
}

.v2-human-workbench-hero-copy {
  max-width: 760px;
  display: grid;
  gap: 12px;
}

.v2-human-workbench-title {
  margin: 0;
  font-size: clamp(42px, 6vw, 72px);
  line-height: 0.94;
  letter-spacing: -0.05em;
}

.v2-human-workbench-subtitle {
  margin: 0;
  max-width: 62ch;
  color: rgba(237, 232, 223, 0.76);
  font-size: 16px;
  line-height: 1.8;
}

.v2-human-workbench-hero-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.v2-projects-toolbar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  align-items: center;
}

.v2-projects-summary-card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  padding: 18px 20px;
  min-height: 126px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(14, 14, 22, 0.78));
  box-shadow: 0 22px 54px rgba(0, 0, 0, 0.2);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.25s ease, transform 0.25s ease, background 0.25s ease;
}

.v2-projects-summary-card.is-active,
.v2-projects-summary-card:hover {
  border-color: rgba(212, 148, 58, 0.24);
  background: rgba(212, 148, 58, 0.08);
  transform: translateY(-1px);
}

.v2-projects-summary-icon {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: rgba(255, 244, 224, 0.94);
  background: rgba(255, 255, 255, 0.04);
}

.v2-projects-summary-copy {
  display: grid;
  gap: 8px;
}

.v2-projects-summary-label {
  font-size: 13px;
  color: var(--v2-muted);
}

.v2-projects-summary-value {
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
}

.v2-projects-summary-chip {
  align-self: start;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--v2-muted);
  font-size: 12px;
}

.v2-human-workbench-panels {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
}

.v2-human-workbench-panel {
  min-width: 0;
  display: grid;
  gap: 16px;
  padding: 22px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(22, 22, 30, 0.92), rgba(17, 17, 24, 0.9));
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.2);
}

.v2-human-workbench-panel-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.v2-human-workbench-panel-head h2 {
  margin: 6px 0 0;
  font-size: 24px;
  letter-spacing: -0.03em;
}

.v2-human-workbench-panel-meta {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--v2-muted);
  font-size: 12px;
  white-space: nowrap;
}

.v2-human-workbench-list,
.v2-human-workbench-state {
  display: grid;
  gap: 10px;
}

.v2-human-workbench-empty {
  margin: 0;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--v2-muted);
  font-size: 13px;
  line-height: 1.7;
}

.v2-human-workbench-list-item {
  min-width: 0;
  width: 100%;
  border: 0;
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.v2-human-workbench-list-item--link {
  text-decoration: none;
}

.v2-human-workbench-list-item:hover {
  background: rgba(255, 255, 255, 0.07);
  transform: translateY(-1px);
}

.v2-human-workbench-list-item strong,
.v2-human-workbench-state-card strong {
  display: block;
  font-size: 15px;
}

.v2-human-workbench-list-item p,
.v2-human-workbench-state-card p {
  margin: 6px 0 0;
  color: var(--v2-muted);
  font-size: 13px;
  line-height: 1.6;
}

.v2-human-workbench-list-item span {
  color: rgba(255, 219, 166, 0.82);
  font-size: 12px;
  white-space: nowrap;
}

.v2-human-workbench-state-card {
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.05);
}

.v2-human-workbench-state-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.v2-human-workbench-state-item {
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  display: grid;
  gap: 6px;
}

.v2-human-workbench-state-item span {
  color: var(--v2-muted);
  font-size: 12px;
}

.v2-human-workbench-state-item strong {
  font-size: 14px;
}

.v2-projects-board {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 0;
  height: calc(100vh - 196px);
  min-height: 760px;
  align-items: stretch;
}

.v2-projects-sidebar,
.v2-projects-detail {
  min-width: 0;
  min-height: 0;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.v2-projects-sidebar {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-right: 0;
  border-radius: 30px 0 0 30px;
  background: linear-gradient(180deg, rgba(42, 42, 48, 0.92), rgba(32, 32, 38, 0.92));
  padding: 0;
  overflow: hidden;
}

.v2-projects-search,
.v2-projects-sidebar-head {
  padding: 18px 22px 0;
}

.v2-projects-search-input {
  background: rgba(255, 255, 255, 0.04);
}

.v2-projects-sidebar-head {
  display: flex;
  align-items: center;
  padding-bottom: 14px;
}

.v2-projects-conversation-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.v2-projects-conversation-item {
  width: 100%;
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 22px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: background 0.25s ease;
}

.v2-projects-conversation-item:hover,
.v2-projects-conversation-item.is-active {
  background: rgba(255, 255, 255, 0.03);
}

.v2-projects-conversation-item.is-active {
  box-shadow: inset 2px 0 0 var(--v2-accent);
}

.v2-projects-conversation-avatar {
  position: relative;
  width: 52px;
  min-width: 52px;
  height: 52px;
}

.v2-projects-conversation-avatar.is-group,
.v2-projects-detail-avatar.is-group {
  width: 72px;
}

.v2-projects-avatar-chip {
  position: absolute;
  inset: 0 auto auto 0;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  border: 2px solid rgba(13, 14, 19, 0.75);
}

.v2-projects-conversation-avatar.is-group .v2-projects-avatar-chip:nth-child(2),
.v2-projects-detail-avatar.is-group .v2-projects-avatar-chip:nth-child(2) {
  left: 16px;
  top: 10px;
}

.v2-projects-conversation-avatar.is-group .v2-projects-avatar-chip:nth-child(3),
.v2-projects-detail-avatar.is-group .v2-projects-avatar-chip:nth-child(3) {
  left: 28px;
  top: 2px;
}

.v2-projects-conversation-copy {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.v2-projects-conversation-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.v2-projects-conversation-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.v2-projects-conversation-row strong {
  display: block;
  min-width: 0;
  font-size: 20px;
  line-height: 1.3;
}

.v2-projects-conversation-time,
.v2-projects-conversation-subtitle {
  font-size: 12px;
  color: var(--v2-muted);
}

.v2-projects-conversation-subtitle {
  font-size: 16px;
  line-height: 1.6;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.v2-projects-conversation-badge {
  min-width: 28px;
  height: 28px;
  padding: 0 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(244, 177, 72, 0.96);
  color: #111;
  font-size: 12px;
  font-weight: 700;
}

.v2-projects-conversation-tags,
.v2-projects-overview-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.v2-projects-conversation-tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 13px;
  color: rgba(255, 244, 224, 0.94);
  background: rgba(212, 148, 58, 0.12);
  border: 1px solid rgba(212, 148, 58, 0.1);
}

.v2-projects-conversation-tag--muted {
  color: var(--v2-muted);
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.06);
}

.v2-projects-detail {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 0 30px 30px 0;
  background: linear-gradient(180deg, rgba(21, 21, 29, 0.94), rgba(12, 12, 18, 0.94));
  padding: 0;
  overflow: hidden;
}

.v2-projects-detail--empty {
  justify-content: center;
  align-items: center;
}

.v2-projects-detail-empty-card {
  width: min(420px, calc(100% - 48px));
  display: grid;
  gap: 12px;
  padding: 32px;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
}

.v2-projects-detail-empty-title {
  font-size: 32px;
}

.v2-projects-detail-empty-copy {
  color: var(--v2-muted);
  font-size: 15px;
  line-height: 1.7;
}

.v2-projects-detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.v2-projects-detail-head.is-chat {
  padding: 18px 24px 14px;
}

.v2-projects-detail-user {
  display: flex;
  align-items: center;
  gap: 18px;
}

.v2-projects-detail-avatar {
  position: relative;
  width: 56px;
  min-width: 56px;
  height: 56px;
}

.v2-projects-detail-title {
  font-size: 24px;
  font-weight: 700;
}

.v2-projects-detail-status {
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--v2-muted);
  font-size: 14px;
}

.v2-projects-detail-facts {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.v2-projects-detail-facts.is-chat {
  margin-top: 10px;
  gap: 8px;
}

.v2-projects-detail-fact {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 12px;
}

.v2-projects-detail-facts.is-chat .v2-projects-detail-fact {
  padding: 6px 10px;
  font-size: 11px;
}

.v2-projects-detail-fact em {
  font-style: normal;
  color: var(--v2-muted);
}

.v2-projects-detail-fact strong {
  font-weight: 600;
}

.v2-projects-detail-actions {
  display: flex;
  gap: 12px;
}

.v2-projects-presence-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
}

.v2-projects-icon-button {
  width: 42px;
  height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.04);
  color: var(--v2-fg);
  text-decoration: none;
  cursor: pointer;
}

.v2-projects-icon-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.v2-projects-detail-modebar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 24px 0;
}

.v2-projects-mode-pill {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: var(--v2-muted);
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
}

.v2-projects-mode-pill.is-active {
  background: rgba(212, 148, 58, 0.14);
  border-color: rgba(212, 148, 58, 0.22);
  color: var(--v2-fg);
}

.v2-projects-mode-status {
  margin-left: auto;
  color: var(--v2-muted);
  font-size: 13px;
}

.v2-projects-detail-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.v2-projects-overview-panel {
  display: grid;
  gap: 16px;
  margin: 28px 32px 0;
  padding: 24px 26px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(212, 148, 58, 0.08), rgba(255, 255, 255, 0.02));
}

.v2-projects-overview-copy {
  color: rgba(237, 232, 223, 0.84);
  font-size: 16px;
  line-height: 1.9;
}

.v2-projects-journey-list {
  display: grid;
  gap: 12px;
}

.v2-projects-journey-step {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: start;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.v2-projects-journey-step.is-active {
  background: rgba(212, 148, 58, 0.1);
  border-color: rgba(212, 148, 58, 0.18);
}

.v2-projects-journey-step.is-done .v2-projects-journey-dot {
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.14);
}

.v2-projects-journey-step strong {
  display: block;
  font-size: 14px;
}

.v2-projects-journey-step p {
  margin-top: 4px;
  color: var(--v2-muted);
  font-size: 13px;
  line-height: 1.6;
}

.v2-projects-journey-dot {
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.24);
}

.v2-projects-overview-history {
  display: grid;
  gap: 16px;
  margin: 22px 32px 0;
  padding: 24px 26px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.025);
}

.v2-projects-overview-history-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.v2-projects-overview-history-title {
  font-size: 20px;
  line-height: 1.45;
}

.v2-projects-history-list {
  display: grid;
  gap: 10px;
}

.v2-projects-history-item {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  text-align: left;
  padding: 16px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.v2-projects-history-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(212, 148, 58, 0.18);
  transform: translateY(-1px);
}

.v2-projects-history-item strong {
  display: block;
  font-size: 16px;
}

.v2-projects-history-item p {
  margin-top: 4px;
  color: var(--v2-muted);
  font-size: 13px;
  line-height: 1.6;
}

.v2-projects-history-meta {
  display: grid;
  gap: 6px;
  justify-items: end;
  flex-shrink: 0;
}

.v2-projects-history-meta span,
.v2-projects-history-meta em {
  font-style: normal;
  color: var(--v2-muted);
  font-size: 12px;
}

.v2-projects-history-empty {
  color: var(--v2-muted);
  font-size: 14px;
  line-height: 1.7;
}

.v2-projects-overview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 14px;
  padding: 24px 32px 32px;
}

.v2-projects-chat-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.v2-projects-chat-shell.is-chat {
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.v2-projects-skill-switch-card {
  position: relative;
  z-index: 2;
  margin: 12px 24px 0;
  padding: 16px 18px;
  border-radius: 22px;
  border: 1px solid rgba(212, 148, 58, 0.18);
  background: linear-gradient(180deg, rgba(212, 148, 58, 0.1), rgba(255, 255, 255, 0.03));
  display: grid;
  gap: 14px;
}

.v2-projects-skill-switch-title {
  font-size: 18px;
  line-height: 1.45;
}

.v2-projects-skill-switch-copy {
  margin-top: 6px;
  color: rgba(237, 232, 223, 0.76);
  font-size: 14px;
  line-height: 1.7;
}

.v2-projects-skill-switch-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.v2-projects-chat-timeline {
  justify-self: center;
  margin-top: 14px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--v2-muted);
  font-size: 12px;
}

.v2-projects-chat-thread,
.v2-projects-chat-state {
  padding: 16px 24px 0;
}

.v2-projects-chat-thread {
  display: grid;
  gap: 18px;
  align-content: start;
  overflow-y: auto;
}

.v2-projects-chat-notice {
  margin: 0 auto;
  max-width: 32rem;
  padding: 4px 14px;
  text-align: center;
  color: #9aa3af;
  font-size: 12px;
  line-height: 1.6;
}

.v2-projects-chat-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.v2-projects-chat-row.is-user {
  justify-content: flex-end;
}

.v2-projects-chat-avatar {
  width: 34px;
  min-width: 34px;
  height: 34px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}

.v2-projects-chat-row.is-user .v2-projects-chat-avatar {
  order: 2;
}

.v2-projects-chat-bubble {
  max-width: min(620px, 72%);
  display: grid;
  gap: 10px;
  padding: 16px 20px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.1);
}

.v2-projects-chat-row.is-user .v2-projects-chat-bubble {
  order: 1;
}

.v2-projects-chat-row.is-user .v2-projects-chat-bubble {
  background: linear-gradient(180deg, rgba(229, 166, 69, 0.95), rgba(209, 144, 43, 0.96));
  color: #0e0d0a;
}

.v2-projects-chat-bubble.is-pending {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(237, 232, 223, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.v2-projects-chat-bubble p {
  font-size: 17px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.v2-projects-chat-time {
  justify-self: end;
  font-size: 12px;
  color: rgba(237, 232, 223, 0.58);
}

.v2-projects-chat-row.is-user .v2-projects-chat-time {
  color: rgba(18, 15, 10, 0.72);
}

.v2-projects-chat-state {
  align-self: start;
  color: var(--v2-muted);
  font-size: 16px;
  line-height: 1.7;
}

.v2-projects-empty {
  text-align: center;
  display: grid;
  gap: 14px;
  padding: 56px 24px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(14, 14, 22, 0.76));
}

.v2-projects-empty-title {
  font-size: 34px;
}

.v2-projects-empty-copy {
  max-width: 620px;
  color: var(--v2-muted);
  font-size: 15px;
  line-height: 1.8;
}

.v2-projects-composer {
  display: block;
  padding: 18px 20px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(18, 20, 27, 0.9);
}

.v2-projects-file-input {
  display: none;
}

.v2-projects-composer-field {
  min-width: 0;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: end;
  gap: 10px;
  padding: 8px 10px 8px 12px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.04);
}

.v2-projects-composer-tool,
.v2-projects-composer-send {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--v2-muted);
  text-decoration: none;
  font-size: 15px;
  transition: color 0.2s ease, background 0.2s ease, transform 0.2s ease;
  cursor: pointer;
}

.v2-projects-composer-tool:hover,
.v2-projects-composer-send:hover {
  color: var(--v2-fg);
  background: rgba(255, 255, 255, 0.06);
  transform: translateY(-1px);
}

.v2-projects-composer-tool:disabled,
.v2-projects-composer-send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.v2-projects-composer-tool svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.v2-projects-composer-input {
  min-height: 34px;
  max-height: 132px;
  padding: 7px 0 5px;
  border-radius: 0;
  border: 0;
  color: var(--v2-fg);
  background: transparent;
  resize: none;
  font: inherit;
  outline: none;
  line-height: 1.6;
}

.v2-projects-composer-input::placeholder {
  color: rgba(237, 232, 223, 0.4);
}

.v2-projects-composer-send {
  background: linear-gradient(180deg, #f2bf68, #d99035);
  color: #100d08;
  font-weight: 700;
  box-shadow: 0 10px 24px rgba(217, 144, 53, 0.24);
}

.v2-projects-composer-note {
  padding: 10px 12px 0;
  color: var(--v2-muted);
  font-size: 13px;
}

@media (max-width: 1400px) {
  .v2-human-workbench-panels,
  .v2-projects-toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1180px) {
  .v2-human-workbench-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .v2-projects-board {
    grid-template-columns: 1fr;
    height: auto;
  }

  .v2-projects-sidebar {
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 30px 30px 0 0;
  }

  .v2-projects-conversation-list {
    max-height: 360px;
  }

  .v2-projects-detail {
    border-left: 1px solid rgba(255, 255, 255, 0.06);
    border-top: 0;
    border-radius: 0 0 30px 30px;
  }

  .v2-projects-composer {
    padding: 16px 18px 18px;
  }
}

@media (max-width: 760px) {
  .v2-human-workbench-panels,
  .v2-projects-toolbar {
    grid-template-columns: 1fr;
  }

  .v2-human-workbench-panel-head,
  .v2-projects-summary-card,
  .v2-projects-conversation-item,
  .v2-projects-detail-head,
  .v2-projects-detail-user,
  .v2-projects-overview-actions,
  .v2-projects-chat-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .v2-projects-detail-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .v2-projects-detail-modebar {
    flex-wrap: wrap;
  }

  .v2-projects-mode-status {
    width: 100%;
    margin-left: 0;
  }

  .v2-human-workbench-state-grid {
    grid-template-columns: 1fr;
  }

  .v2-projects-overview-title {
    font-size: 40px;
  }

  .v2-projects-chat-bubble {
    max-width: 100%;
  }

  .v2-projects-history-item {
    align-items: flex-start;
    flex-direction: column;
  }

  .v2-projects-history-meta {
    justify-items: start;
  }

  .v2-projects-composer {
    padding: 16px;
  }

  .v2-projects-composer-field {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .v2-projects-composer-tool:nth-child(2) {
    display: none;
  }
}
</style>
