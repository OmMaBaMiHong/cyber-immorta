<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"

import { api, assetUrl } from "@/lib/api"
import { ChatSocketClient } from "@/lib/chatSocket"
import { findSelfProject, isPlaceholderSelfName, selfIdentityNameFromProject } from "@/lib/onboarding"
import { skillAvatarBackgroundStyle, skillAvatarLabel } from "@/lib/skillAvatar"
import { useAuthStore } from "@/stores/auth"
import type {
  ChatCivilizationLevel,
  ChatMessage,
  ChatSessionBootstrapResponse,
  ChatSessionDetailResponse,
  ChatSessionSummary,
  DistillJob,
  DistillTargetConfig,
  DistillIntensity,
  PackCloneResponse,
  PackDetailResponse,
  PackSummary,
  ProductGuidanceResponse,
  ProjectDetailResponse,
  ProjectSummary,
} from "@/types"

type OutputMode = "rebirth" | "clone" | "possess"
type CivilizationLevel = ChatCivilizationLevel
type CivilizationEgg = "low" | "mid" | "high"
type DistillStage =
  | "idle"
  | "skill_vortex"
  | "system_awaken_dialog"
  | "skill_tree_grow"
  | "tree_collapse"
  | "civilization_eggs"
  | "egg_hatch_dialog"
  | "warp_transition"
  | "chat_bootstrapping"
  | "chat_ready"
type EvidenceType = "chat_export" | "screenshot" | "text_note" | "public_reference"

interface SkillCard {
  id: string
  packSlug: string
  title: string
  roleLabel: string
  subtitle: string
  avatarLabel: string
  heroBackground: string
  tags: string[]
  starterPrompts: string[]
}

interface DistillFlowContext {
  selectedSkillId: string
  selectedOutputMode: OutputMode | ""
  selectedCivilization: CivilizationEgg | ""
  selectedEggId: CivilizationEgg | ""
  dialogScriptCursor: number
  skipRequested: boolean
  canSkip: boolean
  bootstrapRequested: boolean
  bootstrapResolved: boolean
}

type ModalStep = "" | "enter" | "output" | "civilization" | "upload" | "identity"
type PendingIdentityAction = "" | "civilization-low" | "civilization-mid" | "egg-confirm" | "upload-next" | "warp"

const MEMORY_DRAFT_KEY = "distill-human:v3:cyber-memory-draft"
const DEFAULT_PERSONALITY_PACK_SLUG = ""
const DEFAULT_SKILL_PACK_SLUG = "github-agenmod-immortal-skill"
const PERSONALITY_SKILL_PATTERN = /sbti|mbti|人格测试|赛博人格|personality test|性格测试|性格分析/i
const EMOTION_SKILL_PATTERN = /emotion|emotional|relationship|attachment|love|恋爱|亲密|前任|暧昧|关系|情绪|情感|边界/i

const avatarStyles = ["notionists", "adventurer", "bottts", "fun-emoji", "lorelei", "micah"]

const outputOptions: Array<{ value: OutputMode; label: string; blurb: string; icon: string }> = [
  { value: "rebirth", label: "重生", blurb: "保留核心意识，重置旧的噪声轨迹。", icon: "autorenew" },
  { value: "clone", label: "复制", blurb: "复制一份分身，在数字世界独立演化。", icon: "content_copy" },
  { value: "possess", label: "夺舍", blurb: "接管新的躯壳，沿用部分能力回路。", icon: "bolt" },
]

const civilizationOptions: Array<{
  value: CivilizationLevel
  label: string
  blurb: string
  accent: string
  action: string
}> = [
  { value: "low", label: "低等文明", blurb: "直接进入神明对话，小火蒸馏 15 问起步。", accent: "cyan", action: "进入神明对话" },
  { value: "mid", label: "中等文明", blurb: "上传记忆碎片，经轮回之门洗礼后入场。", accent: "gold", action: "穿过轮回之门" },
  { value: "high", label: "高等文明", blurb: "进入多 skill 专家团，与专家团群聊对话。", accent: "purple", action: "进入专家团" },
]

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const loading = ref(true)
const loadError = ref("")
const targets = ref<DistillTargetConfig[]>([])
const skillCards = ref<SkillCard[]>([])
const skillLoading = ref(false)
const skillError = ref("")

// Skill search
const skillSearchText = ref("")
const skillSearchFocused = ref(false)
const allPacksCache = ref<PackSummary[]>([])
const skillSearchLoading = ref(false)

const filteredSearchPacks = computed(() => {
  const q = skillSearchText.value.trim().toLowerCase()
  if (!q) return []
  return allPacksCache.value.filter((p) => {
    return (
      p.title.toLowerCase().includes(q) ||
      p.subtitle.toLowerCase().includes(q) ||
      p.avatar_label.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.skills.some((s) => s.toLowerCase().includes(q))
    )
  }).slice(0, 10)
})

const showSearchDropdown = computed(() => skillSearchText.value.trim().length > 0)

async function loadAllPacks() {
  if (allPacksCache.value.length) return
  skillSearchLoading.value = true
  try {
    const { data } = await api.get<{ items: PackSummary[] }>("/packs")
    allPacksCache.value = data.items || []
  } catch {
    // silent
  } finally {
    skillSearchLoading.value = false
  }
}

async function onSearchFocus() {
  skillSearchFocused.value = true
  await loadAllPacks()
}

function onSearchBlur() {
  setTimeout(() => { skillSearchFocused.value = false }, 200)
}

async function selectSearchPack(slug: string) {
  skillSearchText.value = ""
  skillSearchFocused.value = false
  // Update route query to trigger reload with new pack
  const query: Record<string, string> = { ...route.query } as Record<string, string>
  query.pack = slug
  delete query.skill
  await router.replace({ query })
  // Reload skill cards with new primary pack
  await loadSkillCards()
}

const activeTargetKey = ref("")
const selectedSkillId = ref("")
const selectedOutput = ref<OutputMode | "">("")
const selectedCivilization = ref<CivilizationLevel | "">("")
const flowStage = ref<DistillStage>("idle")
const flowContext = reactive<DistillFlowContext>({
  selectedSkillId: "",
  selectedOutputMode: "",
  selectedCivilization: "",
  selectedEggId: "",
  dialogScriptCursor: 0,
  skipRequested: false,
  canSkip: false,
  bootstrapRequested: false,
  bootstrapResolved: false,
})
const currentModal = ref<ModalStep>("")
const activeOutputHelp = ref<OutputMode | "">("")
const selfIdentityName = ref("")
const selfIdentityError = ref("")
const pendingIdentityAction = ref<PendingIdentityAction>("")
const staleLaunchProjectId = ref("")
const hasShownEntryModal = ref(false)
const expandedSkillId = ref("")
const activeChatMenu = ref<"" | "output" | "civilization">("")
const nerveAnimDone = ref(false)
const stageCopy = ref("")
const introScanLines = ref<string[]>([])
const systemDialogLines = ref<string[]>([])
const eggDialogLines = ref<string[]>([])
const scriptTypingText = ref("")
const scriptTyping = ref(false)
const idleIntroReady = ref(false)
let scriptTimer: ReturnType<typeof setTimeout> | null = null
let scriptInterval: ReturnType<typeof setInterval> | null = null
let scriptRunId = 0

// ===== Cinematic Output Mode =====
const cinematicPhase = ref<"entrance" | "welcome" | "choice" | "confirm" | "">("")
const cinematicText = ref("")
const cinematicTyping = ref(false)
const cinematicConfirmed = ref(false)
let cinematicTimer: ReturnType<typeof setTimeout> | null = null
let typeTimer: ReturnType<typeof setInterval> | null = null

function cleanDisplayText(value: string | null | undefined) {
  return (value || "")
    .replace(/赛博永生/g, "数字永生")
    .replace(/赛博人格/g, "人格")
    .replace(/赛博世界/g, "数字世界")
    .replace(/赛博/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

const isChatStage = computed(() => flowStage.value === "chat_ready")
const isIdleStage = computed(() => flowStage.value === "idle")
const shouldShowSkillCards = computed(() => flowStage.value !== "idle" || idleIntroReady.value)
const selectedEggMeta = computed(() => civilizationOptions.find((item) => item.value === flowContext.selectedEggId) || null)
const systemDialogReady = computed(() => !scriptTyping.value && systemDialogLines.value.length >= 3)
const eggDialogReady = computed(() => !scriptTyping.value && eggDialogLines.value.length > 0)

function clearScriptPlayback(cancel = true) {
  if (cancel) scriptRunId += 1
  if (scriptTimer) { clearTimeout(scriptTimer); scriptTimer = null }
  if (scriptInterval) { clearInterval(scriptInterval); scriptInterval = null }
  scriptTyping.value = false
  scriptTypingText.value = ""
}

function syncFlowSelections() {
  flowContext.selectedSkillId = selectedSkillId.value
  flowContext.selectedOutputMode = selectedOutput.value
  flowContext.selectedCivilization = (selectedCivilization.value || "") as CivilizationEgg | ""
}

function goToStage(stage: DistillStage) {
  flowStage.value = stage
  flowContext.canSkip = ["skill_vortex", "skill_tree_grow", "tree_collapse"].includes(stage)
  if (stage !== "idle") introScanLines.value = []
  if (stage !== "system_awaken_dialog") systemDialogLines.value = []
  if (stage !== "egg_hatch_dialog") eggDialogLines.value = []
  if (stage !== "warp_transition") {
    flowContext.bootstrapRequested = false
    flowContext.bootstrapResolved = false
  }
}

async function typeFlowLine(target: typeof systemDialogLines, line: string, speed = 34) {
  clearScriptPlayback(false)
  const runId = scriptRunId
  scriptTypingText.value = ""
  scriptTyping.value = true
  await new Promise<void>((resolve) => {
    let index = 0
    scriptInterval = setInterval(() => {
      if (runId !== scriptRunId) {
        if (scriptInterval) {
          clearInterval(scriptInterval)
          scriptInterval = null
        }
        resolve()
        return
      }
      if (index < line.length) {
        scriptTypingText.value += line[index]
        index += 1
        return
      }
      if (scriptInterval) {
        clearInterval(scriptInterval)
        scriptInterval = null
      }
      target.value = [...target.value, line]
      scriptTypingText.value = ""
      scriptTyping.value = false
      resolve()
    }, speed)
  })
}

async function playSystemDialog() {
  clearScriptPlayback()
  flowContext.dialogScriptCursor = 0
  systemDialogLines.value = []
  const runId = scriptRunId
  const lines = [
    `已锁定主 skill「${cleanDisplayText(selectedSkill.value?.title) || "未知 skill"}」`,
    "系统核心已激活，蒸馏链路正在预热。",
    "是否开始加载蒸馏链路？",
  ]
  for (const line of lines) {
    if (runId !== scriptRunId) return
    flowContext.dialogScriptCursor += 1
    await typeFlowLine(systemDialogLines, line)
    if (runId !== scriptRunId) return
    await new Promise<void>((resolve) => {
      scriptTimer = setTimeout(() => resolve(), 160)
    })
  }
}

async function playIdleScanIntro() {
  if (flowStage.value !== "idle") return
  clearScriptPlayback()
  flowContext.dialogScriptCursor = 0
  introScanLines.value = []
  idleIntroReady.value = false
  const runId = scriptRunId
  const guided = await loadProductGuidance("cyber_onboarding", {
    segment: "idle_scan",
    target_key: activeTargetKey.value,
    selected_skill: selectedSkill.value?.title || "",
  })
  const lines = normalizeGuidanceLines(guided, [
    "检测到宿主情绪剧烈波动，急于探索真理。",
    "系统激活中，正在扫描...",
    "系统匹配中...",
  ])
  for (const line of lines) {
    if (runId !== scriptRunId || flowStage.value !== "idle") return
    flowContext.dialogScriptCursor += 1
    await typeFlowLine(introScanLines, line, 100)
    if (runId !== scriptRunId || flowStage.value !== "idle") return
    await new Promise<void>((resolve) => {
      scriptTimer = setTimeout(() => resolve(), 320)
    })
  }
  if (runId === scriptRunId && flowStage.value === "idle") {
    await new Promise<void>((resolve) => {
      scriptTimer = setTimeout(() => resolve(), 520)
    })
    if (runId === scriptRunId && flowStage.value === "idle") {
      idleIntroReady.value = true
    }
  }
}

async function playEggDialog(civilization: CivilizationEgg) {
  clearScriptPlayback()
  flowContext.dialogScriptCursor = 0
  eggDialogLines.value = []
  const runId = scriptRunId
  const fallbackMap: Record<CivilizationEgg, string[]> = {
    low: [
      "低等文明舱门已开启。",
      "宿主将直接进入神明对话，以 15 问完成首轮蒸馏。",
      "请选择降临方式，然后投胎进入该文明。",
    ],
    mid: [
      "中等文明舱门已开启。",
      "宿主需携带记忆碎片，经过轮回洗礼后进入对话空间。",
      "请选择降临方式，然后确认投胎。",
    ],
    high: [
      "高等文明专家团尚未完全接入。",
      "当前版本仅保留入口展示，暂不开放真实对话链路。",
    ],
  }
  const guided = await loadProductGuidance("cyber_onboarding", {
    segment: "civilization_egg_dialog",
    civilization,
    output_mode: selectedOutput.value || "",
    selected_skill: selectedSkill.value?.title || "",
    onboarding: isSelfDistillFlow.value,
  })
  for (const line of normalizeGuidanceLines(guided, fallbackMap[civilization])) {
    if (runId !== scriptRunId) return
    flowContext.dialogScriptCursor += 1
    await typeFlowLine(eggDialogLines, line)
    if (runId !== scriptRunId) return
    await new Promise<void>((resolve) => {
      scriptTimer = setTimeout(() => resolve(), 140)
    })
  }
}

async function loadProductGuidance(surface: "cyber_onboarding" | "memory_intake", context: Record<string, any>) {
  if (!auth.token) return {}
  try {
    const { data } = await api.post<ProductGuidanceResponse>("/guidance", { surface, context })
    return data.payload || {}
  } catch {
    return {}
  }
}

function normalizeGuidanceLines(payload: Record<string, any>, fallback: string[]) {
  const lines = Array.isArray(payload.lines)
    ? payload.lines.map((item) => String(item || "").trim()).filter(Boolean)
    : []
  return lines.length ? lines : fallback
}

async function refreshMemoryIntakeGuide() {
  memoryIntakeGuide.value = await loadProductGuidance("memory_intake", {
    subject_name: activeTarget.value?.label || chatProject.value?.subject_name || "",
    subject_type: activeTarget.value?.subject_type || chatProject.value?.subject_type || "",
    output_mode: selectedOutput.value || "",
    text_length: memoryText.value.trim().length,
    attachment_count: memoryFiles.value.length,
    onboarding: isSelfDistillFlow.value,
  })
}

const cinematicSkillName = computed(() => cleanDisplayText(selectedSkill.value?.title) || "未知灵魂")

const cinematicOptions = computed(() => [
  {
    value: "rebirth" as OutputMode,
    label: "重生",
    icon: "autorenew",
    color: "cyan",
    desc: `重生为${cinematicSkillName.value}，保留核心意识，从零开始新的数字人生`,
  },
  {
    value: "clone" as OutputMode,
    label: "复制",
    icon: "content_copy",
    color: "purple",
    desc: `复制${cinematicSkillName.value}的才华，以你自己的身份在数字世界独立演化`,
  },
  {
    value: "possess" as OutputMode,
    label: "夺舍",
    icon: "bolt",
    color: "gold",
    desc: `夺舍 300 年前的${cinematicSkillName.value}，以双视角方式开启数字人生`,
  },
])

function typeText(text: string, callback?: () => void) {
  cinematicText.value = ""
  cinematicTyping.value = true
  let i = 0
  typeTimer = setInterval(() => {
    if (i < text.length) {
      cinematicText.value += text[i]
      i++
    } else {
      clearInterval(typeTimer!)
      typeTimer = null
      cinematicTyping.value = false
      callback?.()
    }
  }, 35)
}

function startCinematicOutput() {
  cinematicPhase.value = "entrance"
  cinematicText.value = ""
  cinematicConfirmed.value = false
  // Phase 1: entrance animation (CSS handles it, 2s)
  cinematicTimer = setTimeout(() => {
    // Phase 2: welcome text
    cinematicPhase.value = "welcome"
    typeText(`已进入对话空间`, () => {
      cinematicTimer = setTimeout(() => {
        // Phase 3: choice
        cinematicPhase.value = "choice"
        typeText(`检测到宿主选择了「${cinematicSkillName.value}」的灵魂模板，请问宿主想要：`)
      }, 600)
    })
  }, 2200)
}

function cinematicChoose(mode: OutputMode) {
  if (cinematicTyping.value || cinematicConfirmed.value) return
  cinematicConfirmed.value = true
  cinematicPhase.value = "confirm"
  chooseOutput(mode)
  const label = mode === "rebirth" ? "重生" : mode === "clone" ? "复制" : "夺舍"
  typeText(`已选择「${label}」模式，正在初始化…`, () => {
    cinematicTimer = setTimeout(() => {
      goToCivilizationModal()
    }, 800)
  })
}

function cleanupCinematic() {
  if (cinematicTimer) { clearTimeout(cinematicTimer); cinematicTimer = null }
  if (typeTimer) { clearInterval(typeTimer); typeTimer = null }
  cinematicPhase.value = ""
  cinematicText.value = ""
  cinematicTyping.value = false
  cinematicConfirmed.value = false
}
const vesselShowCards = ref(false)

// ===== Seed Growth Animation (Social Planet) =====
const seedPhase = ref<"idle" | "vortex" | "absorb" | "seed" | "sprout" | "tree" | "bloom" | "done">("idle")
// Flag: navigated from plaza "使用此技能包" button — checked once on mount
const navigatedFromPlaza = routeQueryString("from") === "plaza"
const seedAnimTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const seedParticles = ref<Array<{ id: number; x: number; y: number; size: number; delay: number; dur: number }>>([])

function generateSeedParticles(count: number) {
  seedParticles.value = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 280,
    y: (Math.random() - 0.5) * 280,
    size: 3 + Math.random() * 5,
    delay: Math.random() * 1.5,
    dur: 1 + Math.random() * 1.5,
  }))
}

function startSeedGrowth(skillId: string) {
  // Set selected first
  selectedSkillId.value = skillId
  selectedOutput.value = ""
  selectedCivilization.value = ""
  activeOutputHelp.value = ""
  chatReady.value = false
  chatError.value = ""
  syncFlowQuery()
  generateSeedParticles(36)

  // Phase 1: Vortex appears (2.5s) — spinning portal opens
  seedPhase.value = "vortex"

  seedAnimTimer.value = setTimeout(() => {
    // Phase 2: Absorb (2s) — avatar gets sucked into vortex
    seedPhase.value = "absorb"
    seedAnimTimer.value = setTimeout(() => {
      // Phase 3: Seed (2.5s) — glowing seed appears in center
      seedPhase.value = "seed"
      seedAnimTimer.value = setTimeout(() => {
        // Phase 4: Sprout (2s) — seed cracks open, sprout emerges
        seedPhase.value = "sprout"
        seedAnimTimer.value = setTimeout(() => {
          // Phase 5: Tree (3.5s) — branches grow with skill connections
          seedPhase.value = "tree"
          seedAnimTimer.value = setTimeout(() => {
            // Phase 6: Bloom (3s) — skill fruits pop in
            seedPhase.value = "bloom"
            seedAnimTimer.value = setTimeout(() => {
              // Done — skill tree stays visible, user clicks "下一步"
              seedPhase.value = "done"
            }, 3000)
          }, 3500)
        }, 2000)
      }, 2500)
    }, 2000)
  }, 2500)
}

function resetFlowBranch() {
  cleanupSeedAnim()
  clearScriptPlayback()
  stageCopy.value = ""
  idleIntroReady.value = false
  introScanLines.value = []
  flowContext.skipRequested = false
  flowContext.dialogScriptCursor = 0
  flowContext.selectedEggId = ""
  selectedOutput.value = ""
  selectedCivilization.value = ""
  flowContext.selectedOutputMode = ""
  flowContext.selectedCivilization = ""
  currentModal.value = ""
  activeOutputHelp.value = ""
  chatReady.value = false
  chatError.value = ""
}

function handleSkillActivation(skillId: string) {
  resetFlowBranch()
  selectedSkillId.value = skillId
  flowContext.selectedSkillId = skillId
  syncFlowSelections()
  syncFlowQuery({
    output: undefined,
    civ: undefined,
    autostart: undefined,
  })
  goToStage("skill_vortex")
  generateSeedParticles(36)
  seedPhase.value = "vortex"
  seedAnimTimer.value = setTimeout(() => {
    seedPhase.value = "absorb"
    seedAnimTimer.value = setTimeout(async () => {
      cleanupSeedAnim()
      goToStage("system_awaken_dialog")
      await playSystemDialog()
    }, 1200)
  }, 1000)
}

async function beginSkillTreeSequence() {
  clearScriptPlayback()
  eggDialogLines.value = []
  systemDialogLines.value = []
  stageCopy.value = "记忆种子孕育中..."
  goToStage("skill_tree_grow")
  generateSeedParticles(28)
  seedPhase.value = "seed"
  seedAnimTimer.value = setTimeout(() => {
    stageCopy.value = "技能之芽正在萌发..."
    seedPhase.value = "sprout"
    seedAnimTimer.value = setTimeout(() => {
      stageCopy.value = "主干已建立，主 skill 正在锚定..."
      seedPhase.value = "tree"
      seedAnimTimer.value = setTimeout(() => {
        stageCopy.value = "附属 skill 果实已接入，科技树达到峰值。"
        seedPhase.value = "bloom"
        seedAnimTimer.value = setTimeout(() => {
          goToStage("tree_collapse")
          stageCopy.value = "树叶正在枯萎，枝干开始坍塌..."
          seedAnimTimer.value = setTimeout(() => {
            cleanupSeedAnim()
            goToStage("civilization_eggs")
          }, 1100)
        }, 1800)
      }, 2200)
    }, 1500)
  }, 1200)
}

function chooseEgg(civilization: CivilizationEgg) {
  if (civilization === "high") return
  flowContext.selectedEggId = civilization
  selectedCivilization.value = civilization
  flowContext.selectedCivilization = civilization
  syncFlowSelections()
  syncFlowQuery()
  goToStage("egg_hatch_dialog")
  void playEggDialog(civilization)
}

function cleanupSeedAnim() {
  if (seedAnimTimer.value) { clearTimeout(seedAnimTimer.value); seedAnimTimer.value = null }
  seedPhase.value = "idle"
  seedParticles.value = []
}

const transitionActive = ref(false)
const transitionTitle = ref("正在加载")
const transitionCopy = ref("神经网络正在分叉，请稍候。")
const transitionOpenedAt = ref(0)

const chatProject = ref<ProjectSummary | null>(null)
const resumeProject = ref<ProjectSummary | null>(null)
const knownSelfProject = ref<ProjectSummary | null>(null)
const chatSession = ref<ChatSessionSummary | null>(null)
const chatMessages = ref<ChatMessage[]>([])
const chatDraft = ref("")
const chatSending = ref(false)
const chatBootstrapping = ref(false)
const chatStatusText = ref("")
const chatError = ref("")
const chatReady = ref(false)
const reportGenerating = ref(false)
const reportRedirecting = ref(false)
const reportAvailable = ref(false)
const reportViewCardDismissed = ref(false)
const restoredDraftHint = ref("")

const memoryText = ref("")
const memoryFiles = ref<File[]>([])
const memoryIntakeGuide = ref<Record<string, any>>({})
const uploadInput = ref<HTMLInputElement | null>(null)
const messagesPanel = ref<HTMLElement | null>(null)
const chatStageRef = ref<HTMLElement | null>(null)

let chatSocket: ChatSocketClient | null = null
let autoLaunchConsumed = false

const enabledTargets = computed(() => targets.value.filter((item) => item.enabled))
const activeTarget = computed(() => enabledTargets.value.find((item) => item.key === activeTargetKey.value) || null)
const activeTargetIndex = computed(() => enabledTargets.value.findIndex((item) => item.key === activeTargetKey.value))
const selectedSkill = computed(() => skillCards.value.find((item) => item.id === selectedSkillId.value) || null)
const idlePrimarySkill = computed(() => selectedSkill.value || skillCards.value[0] || null)
const loadingPrimarySkillPreview = computed<SkillCard | null>(() => {
  const packSlug =
    routeQueryString("pack") ||
    routeQueryString("skill") ||
    activeTarget.value?.default_pack_slug ||
    activeTarget.value?.attached_pack_slugs?.[0] ||
    ""
  if (!packSlug) return null
  const title = cleanDisplayText(activeTarget.value?.label) || "主 skill"
  return {
    id: packSlug,
    packSlug,
    title,
    roleLabel: "主人物 skill",
    subtitle: "正在载入当前 skill 头像",
    avatarLabel: title.slice(0, 1) || "主",
    heroBackground: "",
    tags: [],
    starterPrompts: [],
  }
})
const idlePrimarySkillDisplay = computed(() => idlePrimarySkill.value || loadingPrimarySkillPreview.value)
const topbarDisplayTitle = computed(() => {
  if (flowStage.value === "chat_ready") return activeTarget.value?.label || ""
  return cleanDisplayText(idlePrimarySkillDisplay.value?.title) || activeTarget.value?.label || ""
})
const idlePrimarySkillIndex = computed(() => {
  if (!idlePrimarySkill.value) return 0
  const index = skillCards.value.findIndex((item) => item.id === idlePrimarySkill.value?.id)
  return index >= 0 ? index : 0
})
const idleAuxSkills = computed(() => {
  const primaryId = idlePrimarySkill.value?.id
  return skillCards.value
    .map((skill, originalIndex) => ({ skill, originalIndex }))
    .filter((item) => item.skill.id !== primaryId)
    .slice(0, 2)
})
const previewSkill = computed(() => skillCards.value.find((item) => item.id === expandedSkillId.value) || selectedSkill.value || null)
const previewSkillIndex = computed(() => previewSkill.value ? skillCards.value.findIndex((item) => item.id === previewSkill.value!.id) : -1)
const selectedOutputMeta = computed(() => outputOptions.find((item) => item.value === selectedOutput.value) || null)
const selectedCivilizationMeta = computed(() => civilizationOptions.find((item) => item.value === selectedCivilization.value) || null)
const outputModeSystemSkillLabel = computed(() => {
  const mode = selectedOutput.value || chatProject.value?.intake_profile?.output_mode || resumeProject.value?.intake_profile?.output_mode || ""
  if (mode === "rebirth") return "重生者执行规则"
  if (mode === "clone") return "复制人执行规则"
  if (mode === "possess") return "夺舍魔执行规则"
  return ""
})
const isRelationshipSandboxSession = computed(() => {
  return String(chatSession.value?.sandbox_context?.kind || "") === "relationship_sandbox"
})
const isSelfDistillFlow = computed(() => activeTarget.value?.subject_type === "self" || activeTargetKey.value === "self" || routeQueryString("targetKey") === "self")
const existingSelfIdentityName = computed(() => (
  selfIdentityNameFromProject(chatProject.value) ||
  selfIdentityNameFromProject(resumeProject.value) ||
  selfIdentityNameFromProject(knownSelfProject.value)
))
const resolvedSelfIdentityName = computed(() => selfIdentityName.value.trim() || existingSelfIdentityName.value)
const starterPrompts = computed(() => {
  return selectedSkill.value?.starterPrompts?.slice(0, 3) || activeTarget.value?.starter_prompts?.slice(0, 3) || []
})
const lowCivProgress = computed(() => getLowCivilizationProgress(chatMessages.value))
const gentleProgress = computed(() => {
  return `${lowCivProgress.value.answerCount}/${lowCivProgress.value.targetCount}`
})
const lastAssistantMessage = computed(() => [...chatMessages.value].reverse().find((item) => item.role === "assistant") || null)
const showReportViewCard = computed(() => {
  return chatReady.value && Boolean(currentProjectId()) && reportAvailable.value && !reportViewCardDismissed.value
})
const lowCivReportPending = computed(() => {
  if (selectedCivilization.value !== "low") return false
  return Boolean(lastAssistantMessage.value?.metadata?.low_civ_report_pending_confirmation)
})
const chatSendLabel = computed(() => {
  if (chatSending.value) {
    return "发送中..."
  }
  return "发送"
})
const chatPlaceholder = computed(() => {
  if (selectedCivilization.value === "low") {
    return lowCivReportPending.value ? "可继续补充，或点击上方生成报告卡片。" : "输入答案，或继续作答。"
  }
  return "向神明提问，或补充记忆。"
})
const canAdvanceOutput = computed(() => Boolean(selectedOutput.value))
const canAdvanceCivilization = computed(() => Boolean(selectedCivilization.value))

type CivilizationLaunchOptions = {
  sendPrimer?: boolean
}

type SkillCardKind = "primary" | "personality" | "emotion"

function cleanQuery(payload: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => Boolean(value)))
}

function routeQueryString(key: string) {
  const value = route.query[key]
  return typeof value === "string" ? value : ""
}

function currentProjectId() {
  const routeProjectId = routeQueryString("projectId")
  if (!chatProject.value?.project_id && !resumeProject.value?.project_id && staleLaunchProjectId.value === routeProjectId) {
    return ""
  }
  return chatProject.value?.project_id || resumeProject.value?.project_id || routeQueryString("projectId") || ""
}

function buildFlowQuery(extra?: Record<string, string | undefined>) {
  return cleanQuery({
    projectId: currentProjectId() || undefined,
    targetKey: activeTargetKey.value || undefined,
    skill: selectedSkillId.value || undefined,
    pack: selectedSkill.value?.packSlug || undefined,
    output: selectedOutput.value || undefined,
    civ: selectedCivilization.value || undefined,
    onboarding: routeQueryString("onboarding") || undefined,
    ...extra,
  })
}

function syncFlowQuery(extra?: Record<string, string | undefined>) {
  void router.replace({
    name: "projects-cyber",
    query: buildFlowQuery(extra),
  })
}

function requiresSelfIdentityFor(civilization: CivilizationLevel | CivilizationEgg | "") {
  if (!isSelfDistillFlow.value) return false
  if (civilization !== "low" && civilization !== "mid") return false
  return isPlaceholderSelfName(resolvedSelfIdentityName.value)
}

function openSelfIdentityModal(action: PendingIdentityAction) {
  pendingIdentityAction.value = action
  selfIdentityError.value = ""
  if (!selfIdentityName.value.trim() && existingSelfIdentityName.value) {
    selfIdentityName.value = existingSelfIdentityName.value
  }
  currentModal.value = "identity"
}

function ensureSelfIdentityBefore(civilization: CivilizationLevel | CivilizationEgg | "", action: PendingIdentityAction) {
  if (!auth.token) return true
  if (!requiresSelfIdentityFor(civilization)) return true
  openSelfIdentityModal(action)
  return false
}

function selfIdentityProjectName() {
  const name = resolvedSelfIdentityName.value.trim()
  if (!name) {
    throw new Error("请先填写自己的新身份名称。")
  }
  return name
}

function buildSelfProjectPayload(civilization: "low" | "mid") {
  const identityName = selfIdentityProjectName()
  const outputMode = selectedOutput.value || "rebirth"
  return {
    name: `主人物卡 · ${identityName}`,
    subject_name: identityName,
    subject_type: "self",
    relation_label: "self",
    analysis_goal: "生成我的主人物卡",
    intake_profile: {
      conversation_scope: "direct_1v1",
      relationship_stage: "self_distillation",
      distill_goal: "build_self_card",
      key_concern: "portrait_report",
      civilization_level: civilization,
      output_mode: outputMode,
      participant_summary: `用户正在以新身份「${identityName}」进行自我蒸馏。`,
      skill_router_config: {
        configured_names: activeTarget.value?.configured_names || [],
        selected_pack_slugs: selectedSkill.value?.packSlug ? [selectedSkill.value.packSlug] : [],
      },
    },
  }
}

async function createSelfProject(civilization: "low" | "mid") {
  const { data } = await api.post<ProjectSummary>("/projects", buildSelfProjectPayload(civilization))
  return data
}

function getAvatarUrl(target: DistillTargetConfig, index: number) {
  const icon = target.icon?.trim() || ""
  const looksLikeImagePath =
    icon.startsWith("http://") ||
    icon.startsWith("https://") ||
    icon.startsWith("/") ||
    icon.startsWith("data:image/") ||
    /\.(png|jpe?g|gif|svg|webp|avif)$/i.test(icon)

  if (looksLikeImagePath) {
    return assetUrl(icon)
  }
  const style = avatarStyles[index % avatarStyles.length]
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(target.key)}&backgroundColor=0a0a0f`
}

function getFallbackSvg(name: string) {
  const char = encodeURIComponent(name[0] || "?")
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect fill="%230a0a0f" width="80" height="80" rx="40"/><text x="40" y="48" text-anchor="middle" fill="%2300f5d4" font-size="28" font-family="serif">${char}</text></svg>`
}

function resetChatSocket() {
  chatSocket?.close()
  chatSocket = null
}

function ensureChatSocket() {
  const token = localStorage.getItem("distill-human-token") || ""
  if (!chatSession.value?.session_id) throw new Error("聊天会话尚未建立")
  if (!token) throw new Error("登录态已失效，请重新登录")
  if (!chatSocket) {
    chatSocket = new ChatSocketClient(chatSession.value.session_id, token)
  }
  return chatSocket
}

function scrollMessagesToBottom() {
  const node = messagesPanel.value
  if (!node) return
  node.scrollTop = node.scrollHeight
}

async function focusLatestChatPosition() {
  await nextTick()
  scrollMessagesToBottom()
  requestAnimationFrame(() => {
    scrollMessagesToBottom()
    chatStageRef.value?.scrollIntoView({ behavior: "auto", block: "end" })
  })
}

function normalizeComposerMessage(value: string) {
  const lines = value.replace(/\r\n/g, "\n").split("\n")
  if (!lines.length) return ""
  const normalized = lines.map((line) => line.replace(/[ \t]+$/g, ""))
  normalized[0] = normalized[0].trimStart()
  normalized[normalized.length - 1] = normalized[normalized.length - 1].trimEnd()
  return normalized.join("\n").trim()
}

function getLowCivilizationProgress(messages: ChatMessage[]) {
  const progressMessage = [...messages].reverse().find((item) => {
    const metadata = item.metadata || {}
    return (
      Number.isFinite(Number(metadata.low_civ_answer_count)) ||
      Number.isFinite(Number(metadata.low_civ_question_count))
    )
  })
  const metadata = progressMessage?.metadata || {}
  const targetCount = Math.max(1, Number(metadata.low_civ_target_count) || 15)
  const questionCount = Math.max(0, Math.min(Number(metadata.low_civ_question_count) || 0, targetCount))
  const answerCount = Math.max(0, Math.min(Number(metadata.low_civ_answer_count) || 0, targetCount))
  return {
    questionCount,
    answerCount,
    targetCount,
    completed: Boolean(metadata.low_civ_questionnaire_completed) || answerCount >= targetCount,
  }
}

function messageActionCard(message: ChatMessage) {
  const raw = message.metadata?.action_card
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const card = raw as Record<string, unknown>
  const type = String(card.type || "").trim()
  if (type !== "generate_low_civ_report") return null
  return {
    type,
    title: String(card.title || "生成报告").trim(),
    description: String(card.description || "点击后进入正式生成流程。").trim(),
    buttonLabel: String(card.button_label || "生成报告").trim(),
  }
}

function inferEvidenceTypeFromFile(file: File): EvidenceType {
  const fileName = file.name.toLowerCase()
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(fileName)) return "screenshot"
  if (/\.(txt|csv|json|md)$/i.test(fileName)) return "chat_export"
  return "public_reference"
}

function isOutputMode(value: unknown): value is OutputMode {
  return value === "rebirth" || value === "clone" || value === "possess"
}

function isCivilizationLevel(value: unknown): value is CivilizationLevel {
  return value === "low" || value === "mid" || value === "high"
}

function normalizeIdentity(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase()
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
    ...pack.tags,
    ...pack.skills,
    ...pack.suitable_for,
    ...pack.repo_entry_preview,
  ].join(" ").toLowerCase()
}

function packHeadline(pack: PackSummary) {
  return [
    pack.slug,
    pack.title,
    pack.subtitle,
    pack.domain,
  ].join(" ").toLowerCase()
}

function countKeywordHits(haystack: string, keywords: string[]) {
  let hits = 0
  for (const keyword of keywords) {
    if (keyword && haystack.includes(String(keyword).toLowerCase())) hits += 1
  }
  return hits
}

function targetContextTerms(target: DistillTargetConfig) {
  return Array.from(new Set([
    ...(target.pack_keywords || []),
    ...(target.configured_names || []),
    target.label,
    target.subject_default,
  ].filter(Boolean)))
}

function packHeroBackgroundStyle(heroBackground: string, fallbackIndex = 0) {
  return skillAvatarBackgroundStyle(
    { slug: `skill-${fallbackIndex}`, hero_background: heroBackground },
    `skill-${fallbackIndex}`,
  )
}

function skillCardAvatarPack(skill: SkillCard, fallbackIndex = 0) {
  const fallbackSlug = `skill-${fallbackIndex}`
  return {
    slug: skill.packSlug || fallbackSlug,
    title: skill.title,
    avatar_label: skill.avatarLabel,
    hero_background: skill.heroBackground,
  }
}

function skillCardAvatarStyle(skill: SkillCard, fallbackIndex = 0) {
  const pack = skillCardAvatarPack(skill, fallbackIndex)
  return skillAvatarBackgroundStyle(pack, pack.slug || `skill-${fallbackIndex}`)
}

function skillCardAvatarText(skill: SkillCard, fallbackIndex = 0) {
  return skillAvatarLabel(skillCardAvatarPack(skill, fallbackIndex), skill.title)
}

function pickPersonalityPackSlug(allPacks: PackSummary[], blocked = new Set<string>()) {
  if (!blocked.has(DEFAULT_PERSONALITY_PACK_SLUG) && allPacks.some((pack) => pack.slug === DEFAULT_PERSONALITY_PACK_SLUG)) {
    return DEFAULT_PERSONALITY_PACK_SLUG
  }
  const ranked = allPacks
    .filter((pack) => PERSONALITY_SKILL_PATTERN.test(packHaystack(pack)))
    .map((pack) => {
      const headline = packHeadline(pack)
      let score = 0
      if (pack.slug === DEFAULT_PERSONALITY_PACK_SLUG) score += 1000
      if (PERSONALITY_SKILL_PATTERN.test(headline)) score += 320
      if (PERSONALITY_SKILL_PATTERN.test(packHaystack(pack))) score += 180
      if (pack.factory_category === "tool_agent") score += 100
      if (pack.display_group === "tool_entry") score += 80
      return { pack, score }
    })
    .sort((left, right) => right.score - left.score || left.pack.title.localeCompare(right.pack.title))
  return ranked.find((item) => !blocked.has(item.pack.slug))?.pack.slug || ""
}

function pickEmotionPackSlug(allPacks: PackSummary[], target: DistillTargetConfig, blocked = new Set<string>()) {
  if (!blocked.has(DEFAULT_SKILL_PACK_SLUG) && allPacks.some((pack) => pack.slug === DEFAULT_SKILL_PACK_SLUG)) {
    return DEFAULT_SKILL_PACK_SLUG
  }
  const terms = targetContextTerms(target)
  const ranked = allPacks
    .map((pack) => {
      const headline = packHeadline(pack)
      const haystack = packHaystack(pack)
      let score = 0
      if (EMOTION_SKILL_PATTERN.test(headline)) score += 320
      if (EMOTION_SKILL_PATTERN.test(haystack)) score += 180
      if (PERSONALITY_SKILL_PATTERN.test(headline)) score += 40
      if (pack.factory_category === "tool_agent") score += 120
      if (pack.display_group === "tool_entry") score += 90
      if (pack.factory_category === "human_expert") score -= 40
      if (pack.factory_category === "professional_role" && normalizeIdentity(target.relation_label) !== "boss_manager") score -= 120
      if (pack.slug === target.default_pack_slug && normalizeIdentity(target.relation_label) === "ex_partner") score += 140
      if (pack.slug === DEFAULT_PERSONALITY_PACK_SLUG) score -= 60
      score += countKeywordHits(haystack, terms) * 24
      if (/供应商|采购|客户|crm|sales|business|售前|律所|计费|reddit|公众号|政府|pipeline/.test(haystack)) score -= 220
      return { pack, score }
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.pack.title.localeCompare(right.pack.title))
  return ranked.find((item) => !blocked.has(item.pack.slug))?.pack.slug || ""
}

function buildSystemSkillCard(
  kind: SkillCardKind,
  detail: PackDetailResponse | null,
  packSlug: string,
): SkillCard {
  if (kind === "primary") {
    return {
      id: packSlug,
      packSlug,
      title: detail?.pack.title || "主蒸馏对象",
      roleLabel: "主人物 skill",
      subtitle: detail?.pack.subtitle || "当前头像对应的主 skill 线",
      avatarLabel: detail?.pack.avatar_label || "主",
      heroBackground: detail?.pack.hero_background || "",
      tags: [...(detail?.pack.skills || []), ...(detail?.pack.tags || [])].slice(0, 3),
      starterPrompts: detail?.starter_prompts || [],
    }
  }

  if (kind === "personality") {
    return {
      id: `personality:${packSlug || "default"}`,
      packSlug,
      title: detail?.pack.title || "性格测试",
      roleLabel: "系统 skill",
      subtitle: "进入 SBTI / MBTI 人格蒸馏线",
      avatarLabel: detail?.pack.avatar_label || "性",
      heroBackground: detail?.pack.hero_background || "",
      tags: ["人格画像", "系统校准", detail?.pack.title || "SBTI"],
      starterPrompts: detail?.starter_prompts || [],
    }
  }

  return {
    id: `emotion:${packSlug || "default"}`,
    packSlug,
    title: detail?.pack.title || "情感分析",
    roleLabel: "技能 skill",
    subtitle: "进入关系模式与技能侧分析线",
    avatarLabel: detail?.pack.avatar_label || "情",
    heroBackground: detail?.pack.hero_background || "",
    tags: ["技能分叉", "关系模式", detail?.pack.title || "情感线"],
    starterPrompts: detail?.starter_prompts || [],
  }
}

function primaryPackSlugFromProject(project: ProjectSummary | null) {
  if (!project) return ""
  const selectedPack = project.intake_profile?.skill_router_config?.selected_pack_slugs?.[0]
  return String(selectedPack || project.pack_slug || "").trim()
}

function inferOutputFromProject(project: ProjectSummary | null): OutputMode | "" {
  const value = project?.intake_profile?.output_mode
  return isOutputMode(value) ? value : ""
}

function inferCivilizationFromProject(project: ProjectSummary | null): CivilizationLevel | "" {
  const value = project?.intake_profile?.civilization_level
  return isCivilizationLevel(value) ? value : ""
}

function resumeCivilizationFromProject(project: ProjectSummary | null): CivilizationLevel {
  return inferCivilizationFromProject(project) || "mid"
}

function inferTargetKeyFromProject(project: ProjectSummary, availableTargets: DistillTargetConfig[], preferredKey = "") {
  const projectPackSlug = primaryPackSlugFromProject(project)
  const packMatches = projectPackSlug
    ? availableTargets.filter((item) => (
        item.default_pack_slug === projectPackSlug ||
        (item.attached_pack_slugs || []).includes(projectPackSlug)
      ))
    : []
  if (preferredKey && packMatches.some((item) => item.key === preferredKey)) {
    return preferredKey
  }
  if (packMatches.length === 1) {
    return packMatches[0]?.key || preferredKey
  }
  const exact = availableTargets.find((item) => (
    item.subject_type === project.subject_type &&
    normalizeIdentity(item.relation_label) === normalizeIdentity(project.relation_label)
  ))
  if (exact) return exact.key
  if (project.subject_type === "self") {
    return availableTargets.find((item) => item.subject_type === "self")?.key || preferredKey
  }
  if (project.subject_type === "public_figure" || normalizeIdentity(project.relation_label) === "all_humanity") {
    return availableTargets.find((item) => item.subject_type === "public_figure")?.key || preferredKey
  }
  return packMatches[0]?.key || preferredKey || availableTargets[0]?.key || ""
}

function inferTargetKeyFromRequestedPack(availableTargets: DistillTargetConfig[], requestedPackSlug: string, preferredKey = "") {
  const normalizedRequestedPackSlug = normalizeIdentity(requestedPackSlug)
  if (!normalizedRequestedPackSlug) return preferredKey || availableTargets[0]?.key || ""
  const packMatches = availableTargets.filter((item) => (
    normalizeIdentity(item.default_pack_slug) === normalizedRequestedPackSlug ||
    (item.attached_pack_slugs || []).some((slug) => normalizeIdentity(slug) === normalizedRequestedPackSlug)
  ))
  if (preferredKey && packMatches.some((item) => item.key === preferredKey)) {
    return preferredKey
  }
  if (packMatches.length === 1) {
    return packMatches[0]?.key || preferredKey
  }
  const publicFallback = availableTargets.find((item) => (
    item.subject_type === "public_figure" ||
    normalizeIdentity(item.relation_label) === "all_humanity"
  ))
  const nonSelfFallback = availableTargets.find((item) => item.subject_type !== "self")
  return (
    packMatches[0]?.key ||
    preferredKey ||
    publicFallback?.key ||
    nonSelfFallback?.key ||
    availableTargets[0]?.key ||
    ""
  )
}

function findReusableProjectForTarget(target: DistillTargetConfig, projects: ProjectSummary[]) {
  const sorted = [...projects].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  const exact = sorted.find((project) => (
    project.subject_type === target.subject_type &&
    normalizeIdentity(project.relation_label) === normalizeIdentity(target.relation_label) &&
    (
      target.subject_type === "self" ||
      !target.subject_default ||
      normalizeIdentity(project.subject_name) === normalizeIdentity(target.subject_default)
    )
  ))
  if (exact) return exact
  if (target.subject_type === "self") {
    return sorted.find((project) => project.subject_type === "self") || null
  }
  if (target.subject_type === "public_figure" || normalizeIdentity(target.relation_label) === "all_humanity") {
    return sorted.find((project) => project.subject_type === "public_figure") || null
  }
  const targetPackSlugs = new Set([target.default_pack_slug, ...(target.attached_pack_slugs || [])].filter(Boolean))
  if (!targetPackSlugs.size) return null
  return (
    sorted.find((project) => targetPackSlugs.has(primaryPackSlugFromProject(project))) ||
    sorted.find((project) => targetPackSlugs.has(String(project.pack_slug || "").trim())) ||
    null
  )
}

function canResumeIntoChat(project: ProjectSummary | null) {
  if (!project) return false
  return Boolean(project.can_chat_now || project.pack_slug || project.material_count > 0)
}

async function loadResumeProject(projectId: string) {
  const { data } = await api.get<ProjectDetailResponse>(`/projects/${projectId}`)
  return data.project
}

async function refreshReportAvailability(projectId: string) {
  reportAvailable.value = false
  reportViewCardDismissed.value = false
  if (!projectId) return
  try {
    await api.get(`/projects/${projectId}/report`)
    reportAvailable.value = true
  } catch (error: any) {
    if (error?.response?.status !== 404) {
      console.warn("Failed to refresh report availability", error)
    }
  }
}

async function resolveResumeProject(availableTargets: DistillTargetConfig[]) {
  if (!auth.token) return null
  const explicitProjectId = routeQueryString("projectId")
  if (explicitProjectId) {
    const explicitProject = await loadResumeProject(explicitProjectId)
    const requestedPackSlug = normalizeIdentity(routeQueryString("pack") || routeQueryString("skill"))
    const requestedOutput = routeQueryString("output")
    const requestedCivilization = routeQueryString("civ")
    const isFreshLaunchIntent = Boolean(!routeQueryString("sessionId") && requestedPackSlug && requestedOutput && requestedCivilization)
    const projectPackSlug = normalizeIdentity(primaryPackSlugFromProject(explicitProject))
    if (
      isFreshLaunchIntent &&
      requestedPackSlug &&
      projectPackSlug &&
      requestedPackSlug !== projectPackSlug
    ) {
      staleLaunchProjectId.value = explicitProjectId
      return null
    }
    staleLaunchProjectId.value = ""
    return explicitProject
  }
  const requestedTargetKey = routeQueryString("targetKey")
  const target = availableTargets.find((item) => item.key === requestedTargetKey)
  if (!target) return null
  const { data } = await api.get<{ items: ProjectSummary[] }>("/projects")
  const requestedPackSlug = normalizeIdentity(routeQueryString("pack") || routeQueryString("skill"))
  if (requestedPackSlug) {
    const requestedOutput = routeQueryString("output")
    const requestedCivilization = routeQueryString("civ")
    const isFreshLaunchIntent = Boolean(!routeQueryString("sessionId") && requestedOutput && requestedCivilization)
    const exactPackProject = (data.items || [])
      .filter((project) => (
        project.subject_type === target.subject_type &&
        normalizeIdentity(primaryPackSlugFromProject(project)) === requestedPackSlug
      ))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
    if (exactPackProject) return exactPackProject
    if (target.subject_type === "self" && isFreshLaunchIntent) {
      return null
    }
    return exactPackProject || null
  }
  return findReusableProjectForTarget(target, data.items || [])
}

function persistMemoryDraft() {
  if (typeof window === "undefined") return
  const payload = {
    targetKey: activeTargetKey.value,
      skill: selectedSkillId.value,
      pack: selectedSkill.value?.packSlug || "",
    output: selectedOutput.value,
    civ: selectedCivilization.value,
    text: memoryText.value.trim(),
    hadFiles: memoryFiles.value.length > 0,
  }
  window.sessionStorage.setItem(MEMORY_DRAFT_KEY, JSON.stringify(payload))
}

function restoreMemoryDraft() {
  if (typeof window === "undefined") return
  const raw = window.sessionStorage.getItem(MEMORY_DRAFT_KEY)
  if (!raw) return
  try {
    const payload = JSON.parse(raw) as {
      targetKey?: string
      text?: string
      hadFiles?: boolean
    }
    if (payload.targetKey && payload.targetKey !== activeTargetKey.value) return
    if (payload.text) {
      memoryText.value = payload.text
    }
    if (payload.hadFiles) {
      restoredDraftHint.value = "已恢复文字记忆，附件需要重新选择。"
    }
  } catch {
    // ignore invalid draft
  }
}

function clearMemoryDraft() {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(MEMORY_DRAFT_KEY)
  restoredDraftHint.value = ""
}

async function redirectToAuth(autoStart = false) {
  if (selectedCivilization.value === "mid") {
    persistMemoryDraft()
  }
  const redirect = router.resolve({
    name: "projects-cyber",
    query: buildFlowQuery(autoStart ? { autostart: "1" } : {}),
  }).fullPath
  await router.push({ name: "auth", query: { redirect } })
}

async function loadTargets() {
  loading.value = true
  loadError.value = ""
  resumeProject.value = null
  // Pre-detect autolaunch to suppress loading flash
  if (
    auth.token &&
    (
      typeof route.query.projectId === "string" ||
      (
        typeof route.query.skill === "string" &&
        typeof route.query.output === "string" &&
        typeof route.query.civ === "string"
      )
    )
  ) {
    chatBootstrapping.value = true
  }
  try {
    const { data } = await api.get<{ items: DistillTargetConfig[] }>("/settings/distill-targets")
    targets.value = data.items || []
    const requestedTargetKey = typeof route.query.targetKey === "string" ? route.query.targetKey : ""
    const requestedPackSlug = normalizeIdentity(routeQueryString("pack") || routeQueryString("skill"))
    resumeProject.value = await resolveResumeProject(enabledTargets.value)
    const inferredTargetKey = resumeProject.value
      ? inferTargetKeyFromProject(resumeProject.value, enabledTargets.value, requestedTargetKey)
      : inferTargetKeyFromRequestedPack(enabledTargets.value, requestedPackSlug, requestedTargetKey)
    activeTargetKey.value = enabledTargets.value.find((item) => item.key === inferredTargetKey)?.key || enabledTargets.value[0]?.key || ""
    if (!activeTargetKey.value) {
      loadError.value = "暂无可蒸馏对象"
      skillCards.value = []
      return
    }
    if (auth.token && (activeTarget.value?.subject_type === "self" || resumeProject.value?.subject_type === "self")) {
      knownSelfProject.value = await findSelfProject()
    } else {
      knownSelfProject.value = null
    }
    await loadSkillCards()
    restoreMemoryDraft()
    maybeConsumeAutoLaunch()
  } catch (error: any) {
    targets.value = []
    skillCards.value = []
    loadError.value = error?.response?.data?.detail || error?.message || "蒸馏对象加载失败"
  } finally {
    loading.value = false
    if (!chatReady.value) {
      chatBootstrapping.value = false
    }
  }
}

async function maybeResumeProjectFlow() {
  const project = resumeProject.value
  if (!project) return
  const requestedSessionId = routeQueryString("sessionId")
  if (requestedSessionId) {
    chatBootstrapping.value = true
    try {
      const { data } = await api.get<ChatSessionDetailResponse>(`/chat/sessions/${requestedSessionId}`)
      chatProject.value = data.project
      resumeProject.value = data.project
      chatSession.value = data.session
      chatMessages.value = data.messages || []
      selectedCivilization.value = data.session.civilization_level || selectedCivilization.value || resumeCivilizationFromProject(data.project)
      await refreshReportAvailability(data.project.project_id)
      chatReady.value = true
      resetChatSocket()
      syncFlowQuery({
        projectId: data.project.project_id,
        sessionId: data.session.session_id,
        autostart: undefined,
      })
      goToStage("chat_ready")
      await focusLatestChatPosition()
      return
    } finally {
      chatBootstrapping.value = false
    }
  }

  const preferredPackSlug = primaryPackSlugFromProject(project)
  const requestedSkill = routeQueryString("skill")
  const requestedPack = routeQueryString("pack")
  const matchedSkill = skillCards.value.find((item) => item.id === preferredPackSlug || item.packSlug === preferredPackSlug) || null

  if (!requestedSkill && !requestedPack) {
    selectedSkillId.value = matchedSkill?.id || skillCards.value[0]?.id || selectedSkillId.value
  }
  if (!routeQueryString("output")) {
    selectedOutput.value = inferOutputFromProject(project) || selectedOutput.value
  }
  selectedCivilization.value = isCivilizationLevel(routeQueryString("civ"))
    ? (routeQueryString("civ") as CivilizationLevel)
    : (selectedCivilization.value || resumeCivilizationFromProject(project))

  syncFlowQuery({
    projectId: project.project_id,
    autostart: undefined,
  })

  if (!canResumeIntoChat(project)) return

  chatBootstrapping.value = true
  try {
    await openChatForProject(project.project_id, selectedCivilization.value || resumeCivilizationFromProject(project), false, false)
  } finally {
    chatBootstrapping.value = false
  }
}

function restoreSceneStageFromSelections() {
  syncFlowSelections()
  if (chatReady.value || chatSession.value) {
    goToStage("chat_ready")
    return
  }
  if (currentModal.value === "upload") {
    goToStage("egg_hatch_dialog")
    return
  }
  if (selectedCivilization.value) {
    flowContext.selectedEggId = selectedCivilization.value as CivilizationEgg
    goToStage("civilization_eggs")
    return
  }
  goToStage("idle")
}

async function loadSkillCards() {
  if (!activeTarget.value) return
  skillLoading.value = true
  skillError.value = ""
  try {
    const { data: packsData } = await api.get<{ items: PackSummary[] }>("/packs")
    const allPacks = packsData.items || []
    // Cache for skill search
    if (!allPacksCache.value.length) allPacksCache.value = allPacks
    const mainPackSlug =
      primaryPackSlugFromProject(resumeProject.value) ||
      routeQueryString("pack") ||
      routeQueryString("skill") ||
      activeTarget.value.default_pack_slug ||
      activeTarget.value.attached_pack_slugs?.[0] ||
      ""
    const hasDefaultPersonalityPack = allPacks.some((pack) => pack.slug === DEFAULT_PERSONALITY_PACK_SLUG)
    const blocked = new Set<string>([mainPackSlug].filter(Boolean))
    const personalityPackSlug =
      pickPersonalityPackSlug(allPacks, blocked) ||
      (hasDefaultPersonalityPack ? DEFAULT_PERSONALITY_PACK_SLUG : "") ||
      mainPackSlug
    blocked.add(personalityPackSlug)
    const emotionPackSlug =
      pickEmotionPackSlug(allPacks, activeTarget.value, blocked) ||
      personalityPackSlug ||
      mainPackSlug

    const plannedCards = [
      { kind: "primary", packSlug: mainPackSlug },
      { kind: "personality", packSlug: personalityPackSlug },
      { kind: "emotion", packSlug: emotionPackSlug },
    ] satisfies Array<{ kind: SkillCardKind; packSlug: string }>
    const normalizedPlan = plannedCards.filter((item) => Boolean(item.packSlug))

    const uniqueSlugs = Array.from(new Set(normalizedPlan.map((item) => item.packSlug)))
    const detailEntries = await Promise.all(uniqueSlugs.map(async (slug) => {
      const { data } = await api.get<PackDetailResponse>(`/packs/${slug}`)
      return [slug, data] as const
    }))
    const detailMap = Object.fromEntries(detailEntries) as Record<string, PackDetailResponse>
    const normalizedCards = normalizedPlan.map((item) => buildSystemSkillCard(
      item.kind,
      detailMap[item.packSlug] || null,
      item.packSlug,
    ))
    skillCards.value = normalizedCards

    const requestedSkill = typeof route.query.skill === "string" ? route.query.skill : ""
    const requestedPack = typeof route.query.pack === "string" ? route.query.pack : ""
    const preferredPackSlug = primaryPackSlugFromProject(resumeProject.value)
    const preferProjectResume = Boolean(routeQueryString("projectId") && resumeProject.value)
    selectedSkillId.value =
      (preferProjectResume
        ? normalizedCards.find((item) => item.id === preferredPackSlug || item.packSlug === preferredPackSlug)?.id
        : "") ||
      normalizedCards.find((item) => item.id === requestedSkill)?.id ||
      normalizedCards.find((item) => item.packSlug === requestedPack)?.id ||
      normalizedCards.find((item) => item.id === preferredPackSlug || item.packSlug === preferredPackSlug)?.id ||
      normalizedCards[0]?.id ||
      ""
    const requestedOutput = typeof route.query.output === "string" ? route.query.output : ""
    const requestedCivilization = typeof route.query.civ === "string" ? route.query.civ : ""
    selectedOutput.value = preferProjectResume
      ? (inferOutputFromProject(resumeProject.value) || (isOutputMode(requestedOutput) ? requestedOutput : ""))
      : (isOutputMode(requestedOutput) ? requestedOutput : inferOutputFromProject(resumeProject.value))
    selectedCivilization.value = preferProjectResume
      ? (inferCivilizationFromProject(resumeProject.value) || (isCivilizationLevel(requestedCivilization) ? requestedCivilization : ""))
      : (isCivilizationLevel(requestedCivilization) ? requestedCivilization : inferCivilizationFromProject(resumeProject.value))
    syncFlowQuery(route.query.autostart === "1" ? { autostart: "1" } : {})
    maybeOpenEntryModal()
    await maybeResumeProjectFlow()
    restoreSceneStageFromSelections()
    if (flowStage.value === "idle") {
      void playIdleScanIntro()
    } else {
      idleIntroReady.value = true
    }

  } catch (error: any) {
    skillCards.value = []
    skillError.value = error?.response?.data?.detail || error?.message || "技能分叉加载失败"
  } finally {
    skillLoading.value = false
  }
}

function selectSkill(id: string) {
  expandedSkillId.value = ""
  handleSkillActivation(id)
}

function previewSkillDetail(id: string) {
  expandedSkillId.value = id
}

function closeSkillPreview() {
  expandedSkillId.value = ""
}

function chooseOutput(mode: OutputMode) {
  selectedOutput.value = mode
  const lockedEggCivilization = flowContext.selectedEggId || ""
  selectedCivilization.value = lockedEggCivilization || ""
  activeOutputHelp.value = ""
  chatReady.value = false
  chatError.value = ""
  flowContext.selectedOutputMode = mode
  flowContext.selectedCivilization = lockedEggCivilization || ""
  syncFlowQuery()
}

function chooseCivilization(level: CivilizationLevel) {
  selectedCivilization.value = level
  chatReady.value = false
  chatError.value = ""
  flowContext.selectedCivilization = level
  syncFlowQuery()
}

function openFilePicker() {
  activeChatMenu.value = ""
  uploadInput.value?.click()
}

function toggleChatMenu(menu: "" | "output" | "civilization") {
  activeChatMenu.value = activeChatMenu.value === menu ? "" : menu
}

function closeChatMenu() {
  activeChatMenu.value = ""
}

async function syncActiveProjectStrategy(next: { output?: OutputMode; civilization?: CivilizationLevel }) {
  const projectId = chatProject.value?.project_id || resumeProject.value?.project_id || routeQueryString("projectId")
  if (!projectId) return
  const currentProject = chatProject.value || resumeProject.value
  const payload = {
    name: currentProject?.name || `${activeTarget.value?.label || "蒸馏对象"} · ${cleanDisplayText(selectedSkill.value?.title) || "对话"}`,
    subject_name: currentProject?.subject_name || activeTarget.value?.subject_default || activeTarget.value?.label || "蒸馏对象",
    relation_label: currentProject?.relation_label || activeTarget.value?.relation_label || undefined,
    analysis_goal: currentProject?.analysis_goal || activeTarget.value?.goal_default || "数字分身",
    intake_profile: {
      conversation_scope: "direct_1v1",
      relationship_stage: currentProject?.intake_profile?.relationship_stage || "current_observation",
      distill_goal: currentProject?.intake_profile?.distill_goal || "understand_persona",
      key_concern: currentProject?.intake_profile?.key_concern || "portrait_report",
      civilization_level: next.civilization || selectedCivilization.value || currentProject?.intake_profile?.civilization_level || "mid",
      output_mode: next.output || selectedOutput.value || currentProject?.intake_profile?.output_mode || "rebirth",
      skill_router_config: {
        configured_names: activeTarget.value?.configured_names || currentProject?.intake_profile?.skill_router_config?.configured_names || [],
        selected_pack_slugs: selectedSkill.value?.packSlug ? [selectedSkill.value.packSlug] : (currentProject?.intake_profile?.skill_router_config?.selected_pack_slugs || []),
      },
    },
  }
  const { data } = await api.put<ProjectSummary>(`/projects/${projectId}`, payload)
  chatProject.value = data
  resumeProject.value = data
}

async function updateChatOutput(mode: OutputMode) {
  selectedOutput.value = mode
  closeChatMenu()
  syncFlowQuery()
  try {
    await syncActiveProjectStrategy({ output: mode })
  } catch (error: any) {
    chatError.value = error?.response?.data?.detail || error?.message || "降临方式同步失败"
  }
}

async function updateChatCivilization(level: CivilizationLevel) {
  if (level === "high") {
    chatError.value = "高等文明专家团正在建设中。"
    return
  }
  selectedCivilization.value = level
  chatError.value = ""
  closeChatMenu()
  syncFlowQuery()
  try {
    await syncActiveProjectStrategy({ civilization: level })
  } catch (error: any) {
    chatError.value = error?.response?.data?.detail || error?.message || "投胎文明同步失败"
  }
}

function closeModal() {
  cleanupCinematic()
  clearScriptPlayback()
  currentModal.value = ""
  activeOutputHelp.value = ""
}

function maybeOpenEntryModal() {
  if (skillError.value || !skillCards.value.length || hasShownEntryModal.value) return
  hasShownEntryModal.value = true
}

function openOutputModal() {
  if (!selectedSkill.value && skillCards.value.length) {
    selectedSkillId.value = skillCards.value[0]?.id || ""
  }
  cleanupCinematic()
  currentModal.value = "output"
  startCinematicOutput()
}

function goToCivilizationModal() {
  if (!selectedOutput.value) return
  cleanupCinematic()
  currentModal.value = "civilization"
}

async function beginWarpTransition() {
  if (!selectedCivilization.value || !selectedOutput.value) return
  if (selectedCivilization.value === "high") {
    chatError.value = "高等文明专家团正在建设中。"
    return
  }
  if (!ensureSelfIdentityBefore(selectedCivilization.value, "warp")) return
  currentModal.value = ""
  closeSkillPreview()
  flowContext.bootstrapRequested = true
  flowContext.bootstrapResolved = false
  goToStage("warp_transition")
  try {
    await continueByCivilization({ sendPrimer: true })
  } finally {
    flowContext.bootstrapResolved = true
    if (!chatReady.value && flowStage.value === "warp_transition") {
      goToStage("egg_hatch_dialog")
    }
  }
}

async function confirmEggCivilizationChoice() {
  if (!flowContext.selectedEggId) return
  if (!selectedOutput.value) {
    chatError.value = "请先选择降临方式。"
    return
  }
  selectedCivilization.value = flowContext.selectedEggId
  flowContext.selectedCivilization = flowContext.selectedEggId
  if (!ensureSelfIdentityBefore(flowContext.selectedEggId, "egg-confirm")) return
  if (flowContext.selectedEggId === "mid" && !memoryText.value.trim() && !memoryFiles.value.length) {
    currentModal.value = "upload"
    return
  }
  await beginWarpTransition()
}

async function continueAfterIdentitySubmit() {
  const action = pendingIdentityAction.value
  pendingIdentityAction.value = ""
  if (action === "civilization-low") {
    closeModal()
    await continueByCivilization()
    return
  }
  if (action === "civilization-mid") {
    currentModal.value = "upload"
    return
  }
  if (action === "egg-confirm") {
    if (selectedCivilization.value === "mid" && !memoryText.value.trim() && !memoryFiles.value.length) {
      currentModal.value = "upload"
      return
    }
    await beginWarpTransition()
    return
  }
  if (action === "upload-next" || action === "warp") {
    closeModal()
    await beginWarpTransition()
  }
}

async function handleSelfIdentitySubmit() {
  const name = selfIdentityName.value.trim()
  if (!name) {
    selfIdentityError.value = "请填写自己的新身份名称。"
    return
  }
  selfIdentityName.value = name
  selfIdentityError.value = ""
  await continueAfterIdentitySubmit()
}

async function handleCivilizationNext() {
  if (!selectedCivilization.value) return
  if (selectedCivilization.value === "low") {
    if (!ensureSelfIdentityBefore("low", "civilization-low")) return
    closeModal()
    await continueByCivilization()
    return
  }
  if (selectedCivilization.value === "mid") {
    if (!ensureSelfIdentityBefore("mid", "civilization-mid")) return
    currentModal.value = "upload"
    return
  }
  chatError.value = "高等文明专家团正在建设中。"
}

async function handleUploadNext() {
  if (!memoryText.value.trim() && !memoryFiles.value.length) {
    chatError.value = memoryIntakeGuide.value.validation || "请先上传文字或附件记忆。"
    return
  }
  if (!ensureSelfIdentityBefore(selectedCivilization.value || "mid", "upload-next")) return
  closeModal()
  await beginWarpTransition()
}

function toggleOutputHelp(mode: OutputMode) {
  activeOutputHelp.value = activeOutputHelp.value === mode ? "" : mode
}

function appendFiles(files: FileList | File[]) {
  const nextFiles = Array.from(files).slice(0, 6)
  const existing = new Set(memoryFiles.value.map((item) => `${item.name}-${item.size}`))
  memoryFiles.value = [...memoryFiles.value, ...nextFiles.filter((item) => !existing.has(`${item.name}-${item.size}`))]
}

function handleFileChange(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files?.length) return
  appendFiles(files)
  ;(event.target as HTMLInputElement).value = ""
}

function removeMemoryFile(index: number) {
  memoryFiles.value.splice(index, 1)
}

function openTransition(title: string, copy: string) {
  transitionTitle.value = title
  transitionCopy.value = copy
  transitionActive.value = true
  transitionOpenedAt.value = Date.now()
}

async function closeTransition(showVesselCards = false) {
  const elapsed = Date.now() - transitionOpenedAt.value
  const minVisibleMs = 1400
  if (transitionActive.value && elapsed < minVisibleMs) {
    await new Promise((resolve) => setTimeout(resolve, minVisibleMs - elapsed))
  }
  transitionActive.value = false
  vesselShowCards.value = showVesselCards
}

async function bootstrapChat(projectId: string, title: string, civilizationLevel: CivilizationLevel, forceNew = false) {
  const { data } = await api.post<ChatSessionBootstrapResponse>(`/projects/${projectId}/chat/bootstrap`, {
    mode: "advice",
    title,
    force_new: forceNew,
    civilization_level: civilizationLevel,
  })
  chatProject.value = data.session_detail.project
  resumeProject.value = data.session_detail.project
  chatSession.value = data.session_detail.session
  chatMessages.value = data.session_detail.messages || []
  await refreshReportAvailability(data.session_detail.project.project_id)
  chatReady.value = true
  resetChatSocket()
  await focusLatestChatPosition()
}

async function openChatForProject(projectId: string, civilizationLevel: CivilizationLevel, sendPrimer = true, forceNew = false) {
  if (!selectedSkill.value || !activeTarget.value) return
  await bootstrapChat(
    projectId,
    `${activeTarget.value.label} · ${selectedSkill.value.title}`,
    civilizationLevel,
    forceNew,
  )
  vesselShowCards.value = false
  syncFlowQuery({
    projectId,
    autostart: undefined,
  })
  if (!sendPrimer || chatMessages.value.length) return
  void sendChatMessage(
    civilizationLevel === "low" ? "启动低等文明蒸馏。" : civilizationLevel === "mid" ? "启动中等文明蒸馏。" : "启动高等文明蒸馏。",
    {
      hiddenUser: true,
      intensity: civilizationLevel === "low" ? "gentle" : "intense",
      civilizationLevel,
    },
  )
}

async function uploadMemoryText(projectId: string, text: string) {
  const normalized = normalizeComposerMessage(text)
  if (!normalized) return
  const formData = new FormData()
  formData.append("evidence_type", "text_note")
  formData.append("label", "记忆文本")
  formData.append("text_content", normalized)
  formData.append("consent_confirmed", "true")
  await api.post(`/projects/${projectId}/materials/upload`, formData)
}

async function uploadMemoryFiles(projectId: string) {
  for (const file of memoryFiles.value.slice(0, 6)) {
    const formData = new FormData()
    formData.append("evidence_type", inferEvidenceTypeFromFile(file))
    formData.append("label", file.name || "记忆碎片")
    formData.append("text_content", "")
    formData.append("consent_confirmed", "true")
    formData.append("file", file)
    await api.post(`/projects/${projectId}/materials/upload`, formData)
  }
}

async function sendChatMessage(
  content: string,
  options?: { hiddenUser?: boolean; intensity?: DistillIntensity; civilizationLevel?: CivilizationLevel },
) {
  const userContent = normalizeComposerMessage(content)
  if (!userContent || !chatSession.value) return
  chatError.value = ""
  chatStatusText.value = "神明正在回应..."
  if (!options?.hiddenUser) {
    reportViewCardDismissed.value = true
  }
  if (!options?.hiddenUser) {
    chatMessages.value.push({
      message_id: `local-user-${Date.now()}`,
      session_id: chatSession.value.session_id,
      role: "user",
      mode: "advice",
      content: userContent,
      citations: [],
      created_at: new Date().toISOString(),
    })
  }
  const placeholder: ChatMessage = {
    message_id: `local-assistant-${Date.now()}`,
    session_id: chatSession.value.session_id,
    role: "assistant",
    mode: "advice",
    content: "",
    citations: [],
    created_at: new Date().toISOString(),
  }
  chatMessages.value.push(placeholder)
  await nextTick()
  scrollMessagesToBottom()

  let streamedText = ""
  try {
    const socket = ensureChatSocket()
    const result = await socket.sendMessage({
      content: userContent,
      mode: "advice",
      distillIntensity: options?.intensity,
      civilizationLevel: options?.civilizationLevel || (selectedCivilization.value || "mid"),
      onStatus: (status) => {
        chatStatusText.value = status.text || "正在加载"
      },
      onChunk: (chunk) => {
        streamedText += chunk
        placeholder.content = streamedText
        void nextTick().then(scrollMessagesToBottom)
      },
    })
    const payload = result.donePayload as { message?: ChatMessage } | ChatMessage | null
    const finalMessage = (payload as any)?.message || payload
    if (finalMessage) {
      placeholder.message_id = finalMessage.message_id
      placeholder.content = finalMessage.content
      placeholder.citations = finalMessage.citations || []
      placeholder.metadata = finalMessage.metadata
      placeholder.kind = finalMessage.kind
    } else if (!streamedText.trim()) {
      throw new Error("没有收到神明回应")
    }
  } catch (error: any) {
    resetChatSocket()
    placeholder.content = `生成失败：${error?.message || "对话服务暂时不可用"}`
    if (!options?.hiddenUser) {
      chatDraft.value = userContent
    }
    chatError.value = error?.message || "对话服务暂时不可用"
  } finally {
    chatStatusText.value = ""
    await nextTick()
    scrollMessagesToBottom()
  }
}

async function launchLowCivilization(options?: CivilizationLaunchOptions) {
  if (!selectedSkill.value || !activeTarget.value || !selectedOutputMeta.value) return
  if (!auth.token) {
    await redirectToAuth(true)
    return
  }
  if (!ensureSelfIdentityBefore("low", "warp")) return
  chatBootstrapping.value = true
  openTransition("正在加载", "小火蒸馏引擎正在点火，准备开始 15 问。")
  try {
    if (isSelfDistillFlow.value) {
      const project = await createSelfProject("low")
      await uploadMemoryText(project.project_id, `新身份名称：${selfIdentityProjectName()}\n蒸馏目标：生成我的主人物卡。`)
      chatProject.value = project
      resumeProject.value = project
      await openChatForProject(project.project_id, "low", options?.sendPrimer ?? true, false)
    } else {
      const { data } = await api.post<PackCloneResponse>(`/packs/${selectedSkill.value.packSlug}/clone`, {
        intake_profile: {
          civilization_level: "low",
          output_mode: selectedOutput.value,
          skill_router_config: {
            configured_names: activeTarget.value.configured_names || [],
            selected_pack_slugs: [selectedSkill.value.packSlug],
          },
        },
      })
      chatProject.value = data.project
      resumeProject.value = data.project
      await openChatForProject(data.project.project_id, "low", options?.sendPrimer ?? true, false)
    }
    await closeTransition(false)
  } catch (error: any) {
    await closeTransition(false)
    chatError.value = error?.response?.data?.detail || error?.message || "低等文明接入失败"
  } finally {
    chatBootstrapping.value = false
    syncFlowQuery({ autostart: undefined })
  }
}

async function launchMidCivilization(options?: CivilizationLaunchOptions) {
  if (!selectedSkill.value || !activeTarget.value || !selectedOutputMeta.value) return
  if (!memoryText.value.trim() && !memoryFiles.value.length) {
    chatError.value = memoryIntakeGuide.value.validation || "请先上传文字或附件记忆。"
    return
  }
  if (!auth.token) {
    await redirectToAuth(memoryFiles.value.length === 0)
    return
  }
  if (!ensureSelfIdentityBefore("mid", "warp")) return
  chatBootstrapping.value = true
  openTransition("对话已开启", memoryIntakeGuide.value.transition || "记忆碎片正在整理，数字分身正在生成。")
  try {
    let project: ProjectSummary
    if (isSelfDistillFlow.value) {
      project = await createSelfProject("mid")
    } else {
      const distillSubjectName =
        activeTarget.value.subject_type === "public_figure" || normalizeIdentity(activeTarget.value.relation_label) === "all_humanity"
          ? (selectedSkill.value.title || activeTarget.value.subject_default || activeTarget.value.label)
          : (activeTarget.value.subject_default || activeTarget.value.label)
      const payload = {
        name: `${distillSubjectName} · ${selectedSkill.value.title}`,
        subject_name: distillSubjectName,
        subject_type: activeTarget.value.subject_type,
        relation_label: activeTarget.value.relation_label,
        analysis_goal: activeTarget.value.subject_type === "public_figure"
          ? `围绕 ${selectedSkill.value.title} 生成数字分身`
          : (activeTarget.value.goal_default || "数字分身"),
        intake_profile: {
          conversation_scope: "direct_1v1",
          relationship_stage: "current_observation",
          distill_goal: "understand_persona",
          key_concern: "portrait_report",
          civilization_level: "mid",
          output_mode: selectedOutput.value,
          skill_router_config: {
            configured_names: activeTarget.value.configured_names || [],
            selected_pack_slugs: [selectedSkill.value.packSlug],
          },
        },
      }
      const { data } = await api.post<ProjectSummary>("/projects", payload)
      project = data
    }
    await uploadMemoryText(project.project_id, memoryText.value)
    await uploadMemoryFiles(project.project_id)
    chatProject.value = project
    resumeProject.value = project
    clearMemoryDraft()
    await openChatForProject(project.project_id, "mid", options?.sendPrimer ?? true, false)
    await closeTransition(false)
  } catch (error: any) {
    await closeTransition(false)
    chatError.value = error?.response?.data?.detail || error?.message || "中等文明接入失败"
  } finally {
    chatBootstrapping.value = false
    syncFlowQuery({ autostart: undefined })
  }
}

async function launchHighCivilization(options?: CivilizationLaunchOptions) {
  if (!selectedSkill.value || !activeTarget.value || !selectedOutputMeta.value) return
  if (!auth.token) {
    await redirectToAuth(true)
    return
  }
  chatBootstrapping.value = true
  openTransition("正在加载", "高等文明专家团正在接入。")
  try {
    const { data } = await api.post<PackCloneResponse>(`/packs/${selectedSkill.value.packSlug}/clone`, {
      intake_profile: {
        civilization_level: "high",
        output_mode: selectedOutput.value,
        skill_router_config: {
          configured_names: activeTarget.value.configured_names || [],
          selected_pack_slugs: [selectedSkill.value.packSlug],
        },
      },
    })
    chatProject.value = data.project
    resumeProject.value = data.project
    await openChatForProject(data.project.project_id, "high", options?.sendPrimer ?? true, false)
    await closeTransition(false)
  } catch (error: any) {
    await closeTransition(false)
    chatError.value = error?.response?.data?.detail || error?.message || "高等文明接入失败"
  } finally {
    chatBootstrapping.value = false
    syncFlowQuery({ autostart: undefined })
  }
}

async function continueByCivilization(options?: CivilizationLaunchOptions) {
  if (selectedCivilization.value === "low") {
    await launchLowCivilization(options)
    return
  }
  if (selectedCivilization.value === "mid") {
    await launchMidCivilization(options)
    return
  }
  if (selectedCivilization.value === "high") {
    await launchHighCivilization(options)
  }
}

function maybeConsumeAutoLaunch() {
  if (autoLaunchConsumed) return
  if (!auth.token) return
  if (chatReady.value || chatSession.value) return
  if (!selectedSkill.value || !selectedOutput.value || !selectedCivilization.value) return
  const shouldAutoLaunch =
    route.query.autostart === "1" ||
    (selectedCivilization.value !== "mid" &&
      typeof route.query.skill === "string" &&
      typeof route.query.output === "string" &&
      typeof route.query.civ === "string")
  if (!shouldAutoLaunch) return
  autoLaunchConsumed = true
  hasShownEntryModal.value = true

  if (!ensureSelfIdentityBefore(selectedCivilization.value, "warp")) {
    chatBootstrapping.value = false
    return
  }

  if (selectedCivilization.value === "mid" && !memoryText.value.trim() && !memoryFiles.value.length) {
    currentModal.value = "upload"
    return
  }

  currentModal.value = ""
  void beginWarpTransition()
}

function useStarterPrompt(prompt: string) {
  chatDraft.value = prompt
}

function constellationNodePos(index: number): Record<string, string> {
  const positions = [
    { top: "4%", left: "12%" },
    { top: "2%", left: "72%" },
    { top: "72%", left: "4%" },
  ]
  const pos = positions[index % positions.length]
  return {
    top: pos.top,
    left: pos.left,
    animationDelay: `${0.3 + index * 0.2}s`,
  }
}

/** Idle opening positions — one center main skill, two side skills */
function idleAuxSkillPos(index: number): Record<string, string> {
  const positions = [
    { top: "18%", left: "16%", enterX: "250px", enterY: "0px" },
    { top: "18%", left: "64%", enterX: "-250px", enterY: "0px" },
  ]
  const pos = positions[index % positions.length]
  return {
    top: pos.top,
    left: pos.left,
    animationDelay: `${0.36 + index * 0.12}s`,
    "--skill-label-delay": `${1.18 + index * 0.16}s`,
    "--skill-pulse-delay": `${2.04 + index * 0.16}s`,
    "--idle-enter-x": pos.enterX,
    "--idle-enter-y": pos.enterY,
    "--idle-line-delay": `${0.78 + index * 0.16}s`,
  }
}

/** Non-idle skill avatar positions retained for later overlay states */
function skillAvatarPos(index: number): Record<string, string> {
  const positions = [
    { top: "44%", left: "12%" },
    { top: "31%", left: "71%" },
    { top: "57%", left: "69%" },
  ]
  const pos = positions[index % positions.length]
  return {
    top: pos.top,
    left: pos.left,
    animationDelay: `${0.25 + index * 0.16}s`,
    "--skill-label-delay": `${0.52 + index * 0.16}s`,
    "--skill-pulse-delay": `${1.1 + index * 0.14}s`,
  }
}

/** Other enabled targets excluding the active one — shown as dimmed background avatars */
const backgroundTargets = computed(() =>
  enabledTargets.value.filter((t) => t.key !== activeTargetKey.value)
)

/** Scatter background avatars naturally around the canvas */
function backgroundAvatarPos(index: number): Record<string, string> {
  // Organic positions that avoid the center and skill avatar zones
  const positions = [
    { top: "6%",  left: "35%" },
    { top: "22%", left: "78%" },
    { top: "48%", left: "72%" },
    { top: "70%", left: "55%" },
    { top: "38%", left: "4%" },
    { top: "80%", left: "30%" },
    { top: "28%", left: "42%" },
    { top: "55%", left: "8%" },
    { top: "15%", left: "88%" },
    { top: "75%", left: "75%" },
  ]
  const pos = positions[index % positions.length]
  return {
    top: pos.top,
    left: pos.left,
    animationDelay: `${0.6 + index * 0.12}s`,
  }
}

async function enterChatFromVessel() {
  if (!chatProject.value || !selectedSkill.value) return
  try {
    await openChatForProject(chatProject.value.project_id, selectedCivilization.value || "low", true)
  } catch (error: any) {
    chatError.value = error?.message || "进入对话失败"
  }
}

async function startReportGenerationFlow() {
  const projectId = currentProjectId()
  if (!projectId) {
    throw new Error("当前项目不存在，无法生成报告")
  }
  if (reportRedirecting.value) return
  reportRedirecting.value = true
  chatStatusText.value = "正在生成三张命运卡..."
  chatError.value = ""
  try {
    const { data } = await api.post<DistillJob>(`/projects/${projectId}/distill`, {})
    await router.push({
      name: "job-progress",
      params: {
        projectId: data.project_id,
        jobId: data.job_id,
      },
    })
  } finally {
    chatStatusText.value = ""
    reportRedirecting.value = false
  }
}

async function openReportView() {
  const projectId = currentProjectId()
  if (!projectId) {
    chatError.value = "当前项目不存在，无法打开报告"
    return
  }
  chatError.value = ""
  const project = chatProject.value || resumeProject.value
  try {
    await api.get(`/projects/${projectId}/report`)
    reportAvailable.value = true
    await router.push(`/projects/${projectId}/report`)
    return
  } catch (error: any) {
    const status = error?.response?.status
    if (status && status !== 404) {
      chatError.value = error?.response?.data?.detail || error?.message || "打开报告失败"
      return
    }
  }
  if (project?.latest_job_id && project.latest_job_status && project.latest_job_status !== "failed") {
    try {
      await router.push({
        name: "job-progress",
        params: {
          projectId,
          jobId: project.latest_job_id,
        },
      })
      return
    } catch (error: any) {
      chatError.value = error?.response?.data?.detail || error?.message || "打开报告失败"
      return
    }
  }
  reportAvailable.value = false
  chatError.value = "正式报告尚未生成，请完成后端下发的生成确认卡片。"
}

async function triggerReportGeneration() {
  if (chatSending.value || reportGenerating.value || reportRedirecting.value) return
  chatSending.value = true
  reportGenerating.value = true
  chatError.value = ""
  closeChatMenu()
  try {
    await startReportGenerationFlow()
  } catch (error: any) {
    chatError.value = error?.response?.data?.detail || error?.message || "生成报告失败"
  } finally {
    chatSending.value = false
    reportGenerating.value = false
  }
}

async function submitChat() {
  if (chatSending.value) return
  const draft = normalizeComposerMessage(chatDraft.value)
  const attachmentCount = memoryFiles.value.length
  if (!draft && !attachmentCount) return
  chatSending.value = true
  chatError.value = ""
  reportViewCardDismissed.value = true
  closeChatMenu()
  chatDraft.value = ""
  try {
    if (!chatSession.value) {
      await continueByCivilization({ sendPrimer: false })
      if (!chatSession.value) {
        chatDraft.value = draft
        return
      }
    }
    if (attachmentCount > 0 && chatProject.value) {
      await uploadMemoryFiles(chatProject.value.project_id)
    }
    const composedDraft = attachmentCount > 0
      ? `${draft || "我刚上传了新的记忆附件，请结合这些材料继续。"}\n\n（我刚补充了 ${attachmentCount} 个附件记忆，请结合最新材料继续。）`
      : draft
    await sendChatMessage(composedDraft, {
      intensity: selectedCivilization.value === "low" ? "gentle" : "intense",
      civilizationLevel: selectedCivilization.value || "mid",
    })
    memoryFiles.value = []
  } catch (error: any) {
    chatDraft.value = draft
    chatError.value = error?.response?.data?.detail || error?.message || "对话服务暂时不可用"
  } finally {
    chatSending.value = false
  }
}

function handleChatKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey) return
  event.preventDefault()
  void submitChat()
}

async function goBackHome() {
  await router.push({ name: "projects" })
}

watch(
  () => route.query.projectId,
  async (value, previous) => {
    if (value === previous) return
    const existingProjectId = chatProject.value?.project_id || resumeProject.value?.project_id || ""
    if (String(value || "") && String(value || "") === existingProjectId) return
    autoLaunchConsumed = false
    chatReady.value = false
    chatMessages.value = []
    chatDraft.value = ""
    chatError.value = ""
    chatSession.value = null
    chatProject.value = null
    resumeProject.value = null
    flowContext.selectedEggId = ""
    goToStage("idle")
    resetChatSocket()
    await loadTargets()
  },
)

watch(
  () => route.query.targetKey,
  async (value, previous) => {
    if (routeQueryString("projectId")) return
    if (!value || value === previous || value === activeTargetKey.value) return
    autoLaunchConsumed = false
    activeTargetKey.value = String(value)
    selectedSkillId.value = ""
    selectedOutput.value = ""
    selectedCivilization.value = ""
    currentModal.value = ""
    activeOutputHelp.value = ""
    hasShownEntryModal.value = false
    chatReady.value = false
    chatMessages.value = []
    chatDraft.value = ""
    chatError.value = ""
    chatSession.value = null
    chatProject.value = null
    resumeProject.value = null
    flowContext.selectedEggId = ""
    goToStage("idle")
    resetChatSocket()
    await loadSkillCards()
    restoreMemoryDraft()
    maybeConsumeAutoLaunch()
  },
)

watch(
  () => chatMessages.value.length,
  async () => {
    await focusLatestChatPosition()
  },
)

watch(
  () => chatReady.value,
  async (value) => {
    if (!value) return
    goToStage("chat_ready")
    await focusLatestChatPosition()
  },
)

watch(
  () => currentModal.value,
  (value) => {
    if (value === "upload") void refreshMemoryIntakeGuide()
  },
)

onMounted(() => {
  void loadTargets()
})

onBeforeUnmount(() => {
  resetChatSocket()
  cleanupSeedAnim()
  clearScriptPlayback()
})
</script>

<template>
  <div class="cyber-flow-page" :class="{ 'is-chat-ready': flowStage === 'chat_ready' }">
    <div class="cyber-flow-shell" :class="{ 'cyber-flow-shell--idle': isIdleStage }">
      <header class="flow-topbar">
        <button type="button" class="topbar-link" @click="goBackHome">
          <span class="material-symbols-rounded">arrow_back</span>
          返回选择
        </button>
        <h2 class="topbar-title" v-if="topbarDisplayTitle && flowStage !== 'chat_ready'">{{ topbarDisplayTitle }}</h2>
      </header>

      <div
        v-if="!isIdleStage"
        id="titleArea"
        class="title-area cyber-animate-in-down"
        :class="{
          'title-area--constellation': activeTarget && flowStage !== 'chat_ready',
          'title-area--scan': isIdleStage,
        }"
      >
        <h1>{{ isIdleStage ? "系统扫描中" : "上传记忆" }}</h1>
        <p v-if="isIdleStage">系统已接管当前宿主，正在匹配可用蒸馏支线。</p>
      </div>

      <section v-if="loading && !chatBootstrapping" class="flow-loading cyber-card">
        <p>正在加载</p>
      </section>

      <section v-else-if="loadError" class="flow-error cyber-card">
        <p>{{ loadError }}</p>
        <button type="button" class="cyber-btn cyber-btn-primary" @click="loadTargets">重新加载</button>
      </section>

      <template v-else-if="activeTarget && flowStage !== 'chat_ready'">
        <section
          v-if="flowStage === 'idle' || flowStage === 'skill_vortex' || flowStage === 'skill_tree_grow' || flowStage === 'tree_collapse'"
          class="social-stage cyber-animate-in"
          :class="{ 'social-stage--idle': isIdleStage }"
        >
          <div class="social-field">
            <div
              v-for="(target, idx) in backgroundTargets.slice(0, 5)"
              :key="`social-bg-${target.key}`"
              class="social-ghost-avatar"
              :style="backgroundAvatarPos(idx)"
            >
              <img
                :src="getAvatarUrl(target, idx)"
                :alt="target.label"
                @error="($event.target as HTMLImageElement).src = getFallbackSvg(target.label)"
              />
            </div>

            <div class="social-target">
              <div v-if="isIdleStage && (shouldShowSkillCards || skillLoading)" class="idle-skill-emission" aria-hidden="true">
                <span class="idle-vortex-ripple idle-vortex-ripple--1" />
                <span class="idle-vortex-ripple idle-vortex-ripple--2" />
                <span class="idle-vortex-ripple idle-vortex-ripple--3" />
                <span class="idle-vortex-spiral idle-vortex-spiral--1" />
                <span class="idle-vortex-spiral idle-vortex-spiral--2" />
                <span class="idle-vortex-spark idle-vortex-spark--1" />
                <span class="idle-vortex-spark idle-vortex-spark--2" />
                <span class="idle-vortex-spark idle-vortex-spark--3" />
              </div>
              <button
                v-if="isIdleStage && (shouldShowSkillCards || skillLoading) && idlePrimarySkillDisplay"
                type="button"
                class="social-target-main"
                :class="{ 'is-loading-preview': !shouldShowSkillCards || !idlePrimarySkill }"
                :disabled="!shouldShowSkillCards || !idlePrimarySkill"
                @click="idlePrimarySkill && handleSkillActivation(idlePrimarySkill.id)"
              >
                <span class="social-target-main-avatar" :style="skillCardAvatarStyle(idlePrimarySkillDisplay, idlePrimarySkillIndex)" />
                <span v-if="idlePrimarySkill && selectedSkillId === idlePrimarySkill.id" class="social-skill-tap-guide" aria-hidden="true">
                  <span class="material-symbols-rounded">touch_app</span>
                </span>
                <strong>{{ idlePrimarySkillDisplay.roleLabel }}</strong>
                <span>{{ cleanDisplayText(idlePrimarySkillDisplay.title) }}</span>
              </button>
              <div v-else-if="!isIdleStage" class="social-target-ring">
                <img
                  :src="getAvatarUrl(activeTarget, activeTargetIndex >= 0 ? activeTargetIndex : 0)"
                  :alt="activeTarget.label"
                  @error="($event.target as HTMLImageElement).src = getFallbackSvg(activeTarget.label)"
                />
              </div>
            </div>

            <div v-if="skillLoading" class="social-loading">系统匹配中...</div>
            <div v-else-if="skillError" class="social-loading social-loading--error">{{ skillError }}</div>
            <div v-else-if="isIdleStage || introScanLines.length || scriptTypingText" class="social-stage-intro">
              <div v-for="(line, index) in introScanLines" :key="`idle-intro-${index}`" class="social-stage-intro-line">
                {{ line }}
              </div>
              <div v-if="scriptTypingText" class="social-stage-intro-line social-stage-intro-line--typing">
                {{ scriptTypingText }}<span class="cinematic-cursor">|</span>
              </div>
              <Transition name="idle-hint">
                <p v-if="shouldShowSkillCards" class="social-stage-intro-hint">请点击头像进行加载。</p>
              </Transition>
            </div>
            <template v-if="!skillLoading && !skillError && shouldShowSkillCards && isIdleStage">
              <button
                v-for="(item, index) in idleAuxSkills"
                :key="item.skill.id"
                type="button"
                class="social-skill"
                :class="{
                  'social-skill--avatar': true,
                  'social-skill--aux': true,
                  'social-skill--aux-left': index === 0,
                  'social-skill--aux-right': index === 1,
                  'is-selected': selectedSkillId === item.skill.id
                }"
                :style="idleAuxSkillPos(index)"
                @click="handleSkillActivation(item.skill.id)"
              >
                <span class="social-skill-avatar" :style="skillCardAvatarStyle(item.skill, item.originalIndex)" />
                <strong>{{ item.skill.roleLabel }}</strong>
                <span>{{ cleanDisplayText(item.skill.title) }}</span>
              </button>
            </template>
            <template v-else-if="!skillLoading && !skillError && shouldShowSkillCards">
              <button
                v-for="(skill, index) in skillCards"
                :key="skill.id"
                type="button"
                class="social-skill"
                :class="{
                  'social-skill--avatar': isIdleStage,
                  'is-recommended': isIdleStage && selectedSkillId === skill.id,
                  'is-selected': selectedSkillId === skill.id,
                  'is-absorbing': seedPhase === 'absorb' && selectedSkillId === skill.id,
                  'is-absorbed': (seedPhase === 'seed' || seedPhase === 'sprout') && selectedSkillId === skill.id,
                  'is-dimmed': (flowStage !== 'idle' || (seedPhase !== 'idle' && seedPhase !== 'done')) && selectedSkillId !== skill.id
                }"
                :style="skillAvatarPos(index)"
                :disabled="flowStage !== 'idle'"
                @click="flowStage === 'idle' && handleSkillActivation(skill.id)"
              >
                <span class="social-skill-avatar" :style="packHeroBackgroundStyle(skill.heroBackground, index)" />
                <span v-if="isIdleStage && selectedSkillId === skill.id" class="social-skill-tap-guide" aria-hidden="true">
                  <span class="material-symbols-rounded">touch_app</span>
                </span>
                <strong>{{ skill.roleLabel }}</strong>
                <span>{{ cleanDisplayText(skill.title) }}</span>
              </button>
            </template>

            <span class="social-orb social-orb--a" />
            <span class="social-orb social-orb--b" />
            <span class="social-orb social-orb--c" />

            <Transition name="seed-overlay">
              <div v-if="seedPhase !== 'idle'" class="seed-growth-overlay" :class="{ 'is-collapse': flowStage === 'tree_collapse' }">
                <div class="seed-particles">
                  <span
                    v-for="p in seedParticles"
                    :key="p.id"
                    class="seed-particle"
                    :style="{
                      '--px': `${p.x}px`,
                      '--py': `${p.y}px`,
                      '--ps': `${p.size}px`,
                      '--pd': `${p.delay}s`,
                      '--pdu': `${p.dur}s`,
                    }"
                  />
                </div>

                <div
                  class="seed-vortex"
                  :class="{
                    'is-appearing': seedPhase === 'vortex',
                    'is-absorbing': seedPhase === 'absorb',
                    'is-collapsing': seedPhase === 'seed',
                  }"
                >
                  <div class="seed-vortex-ring seed-vortex-ring--1" />
                  <div class="seed-vortex-ring seed-vortex-ring--2" />
                  <div class="seed-vortex-ring seed-vortex-ring--3" />
                  <div class="seed-vortex-ring seed-vortex-ring--4" />
                  <div class="seed-vortex-core">
                    <span
                      v-if="selectedSkill"
                      class="seed-vortex-avatar"
                      :style="packHeroBackgroundStyle(selectedSkill.heroBackground, skillCards.findIndex((item) => item.id === selectedSkill?.id))"
                    />
                  </div>
                </div>

                <div
                  class="seed-pod"
                  :class="{
                    'is-forming': seedPhase === 'seed',
                    'is-sprouting': seedPhase === 'sprout',
                    'is-fading': seedPhase === 'tree',
                  }"
                >
                  <div class="seed-pod-glow" />
                  <span class="material-symbols-rounded seed-pod-icon">eco</span>
                  <div class="seed-pod-crack" />
                </div>

                <Transition name="seed-tree-enter">
                  <svg
                    v-if="seedPhase === 'tree' || seedPhase === 'bloom' || seedPhase === 'done'"
                    class="seed-tree-svg"
                    viewBox="0 0 320 280"
                    fill="none"
                    :class="{ 'is-collapsing': flowStage === 'tree_collapse' }"
                  >
                    <path class="seed-branch seed-branch--trunk" d="M160 250 Q160 200 160 140" />
                    <path class="seed-branch seed-branch--l1" d="M160 190 Q130 160 80 130" />
                    <path class="seed-branch seed-branch--r1" d="M160 170 Q190 140 240 120" />
                    <path class="seed-branch seed-branch--t1" d="M160 140 Q160 100 160 60" />
                    <path class="seed-branch seed-branch--l2" d="M80 130 Q60 115 40 100" />
                    <path class="seed-branch seed-branch--r2" d="M240 120 Q260 105 280 90" />
                    <path class="seed-branch seed-branch--tl" d="M160 100 Q135 80 110 65" />
                    <path class="seed-branch seed-branch--tr" d="M160 100 Q185 80 210 65" />
                    <path class="seed-glow-line seed-glow-line--l" d="M80 130 Q60 115 40 100" />
                    <path class="seed-glow-line seed-glow-line--r" d="M240 120 Q260 105 280 90" />
                    <path class="seed-glow-line seed-glow-line--t" d="M160 60 Q160 40 160 30" />

                    <g
                      v-for="(skill, idx) in skillCards.slice(0, 6)"
                      :key="`fruit-${skill.id}`"
                      class="seed-fruit-group"
                      :style="{ animationDelay: `${1.2 + idx * 0.3}s` }"
                    >
                      <circle
                        class="seed-fruit-ring"
                        :cx="[40, 280, 160, 110, 210, 160][idx] || 160"
                        :cy="[100, 90, 30, 65, 65, 60][idx] || 60"
                        r="26"
                      />
                      <circle
                        class="seed-fruit-core"
                        :cx="[40, 280, 160, 110, 210, 160][idx] || 160"
                        :cy="[100, 90, 30, 65, 65, 60][idx] || 60"
                        r="20"
                        :fill="['rgba(0,245,212,0.12)', 'rgba(245,166,35,0.12)', 'rgba(126,105,255,0.12)', 'rgba(0,245,212,0.08)', 'rgba(245,166,35,0.08)', 'rgba(126,105,255,0.08)'][idx]"
                      />
                    </g>
                  </svg>
                </Transition>

                <Transition name="seed-hint">
                  <div v-if="flowStage === 'skill_vortex' && seedPhase === 'vortex'" class="seed-phase-hint">
                    <span class="material-symbols-rounded" style="font-size: 14px">cyclone</span>
                    轮回通道开启中...
                  </div>
                </Transition>
                <Transition name="seed-hint">
                  <div v-if="flowStage === 'skill_vortex' && seedPhase === 'absorb'" class="seed-phase-hint">
                    <span class="material-symbols-rounded" style="font-size: 14px">psychology</span>
                    灵魂正在注入...
                  </div>
                </Transition>
                <Transition name="seed-hint">
                  <div v-if="flowStage === 'skill_tree_grow' && seedPhase === 'seed'" class="seed-phase-hint">
                    <span class="material-symbols-rounded" style="font-size: 14px">spa</span>
                    {{ stageCopy || "记忆种子孕育中..." }}
                  </div>
                </Transition>
                <Transition name="seed-hint">
                  <div v-if="flowStage === 'skill_tree_grow' && seedPhase === 'sprout'" class="seed-phase-hint">
                    <span class="material-symbols-rounded" style="font-size: 14px">forest</span>
                    {{ stageCopy || "技能之芽正在萌发..." }}
                  </div>
                </Transition>
                <Transition name="seed-hint">
                  <div v-if="flowStage === 'skill_tree_grow' && seedPhase === 'tree'" class="seed-phase-hint">
                    <span class="material-symbols-rounded" style="font-size: 14px">account_tree</span>
                    {{ stageCopy || "技能树正在生长..." }}
                  </div>
                </Transition>
                <Transition name="seed-hint">
                  <div v-if="flowStage === 'skill_tree_grow' && (seedPhase === 'bloom' || seedPhase === 'done')" class="seed-phase-hint seed-phase-hint--done">
                    <span class="material-symbols-rounded" style="font-size: 14px; color: var(--neon-cyan)">auto_awesome</span>
                    {{ stageCopy || "技能树构建完成" }}
                  </div>
                </Transition>
                <Transition name="seed-hint">
                  <div v-if="flowStage === 'tree_collapse'" class="seed-phase-hint seed-phase-hint--done">
                    <span class="material-symbols-rounded" style="font-size: 14px; color: #f5a623">deblur</span>
                    {{ stageCopy || "科技树正在坍塌..." }}
                  </div>
                </Transition>
              </div>
            </Transition>
          </div>

          <div class="social-stage-actions">
            <button
              v-if="flowStage === 'skill_vortex' || flowStage === 'skill_tree_grow' || flowStage === 'tree_collapse'"
              type="button"
              class="cyber-btn cyber-btn-ghost social-stage-next"
              @click="flowStage === 'skill_vortex' ? (cleanupSeedAnim(), goToStage('system_awaken_dialog'), playSystemDialog()) : flowStage === 'tree_collapse' ? (cleanupSeedAnim(), goToStage('civilization_eggs')) : (cleanupSeedAnim(), goToStage('civilization_eggs'))"
            >
              跳过动画
            </button>
          </div>
        </section>

        <section v-else-if="flowStage === 'system_awaken_dialog'" class="distill-system-stage">
          <div class="distill-system-content">
            <div class="distill-scene-kicker">SYSTEM</div>
            <div class="distill-system-console">
              <div v-for="(line, index) in systemDialogLines" :key="`system-line-${index}`" class="distill-system-line">
                {{ line }}
              </div>
              <div v-if="scriptTypingText" class="distill-system-line distill-system-line--typing">
                {{ scriptTypingText }}<span class="cinematic-cursor">|</span>
              </div>
            </div>
          </div>
          <Transition name="system-actions">
            <div v-if="systemDialogReady" class="distill-dialog-actions distill-dialog-actions--dock">
              <button type="button" class="cyber-btn cyber-btn-primary" @click="beginSkillTreeSequence">开始加载</button>
            </div>
          </Transition>
        </section>

        <section v-else-if="flowStage === 'civilization_eggs'" class="cyber-card distill-egg-scene">
          <div class="distill-scene-kicker">CIVILIZATION</div>
          <h2 class="distill-scene-title">科技树坍塌后，仅留下三枚文明蛋</h2>
          <p class="distill-scene-copy">选择你要投胎进入的文明入口。</p>
          <div class="civilization-egg-grid">
            <button
              v-for="item in civilizationOptions"
              :key="`egg-${item.value}`"
              type="button"
              class="civilization-egg-card"
              :class="[`civilization-egg-card--${item.accent}`, { 'is-disabled': item.value === 'high' }]"
              :disabled="item.value === 'high'"
              @click="chooseEgg(item.value as CivilizationEgg)"
            >
              <span class="civilization-egg-shell" />
              <span class="civilization-egg-core">
                <span class="material-symbols-rounded">{{ item.value === "low" ? "bolt" : item.value === "mid" ? "autorenew" : "lock" }}</span>
              </span>
              <strong>{{ item.label }}</strong>
              <span>{{ item.value === "high" ? "即将开放" : item.blurb }}</span>
            </button>
          </div>
        </section>

        <section v-else-if="flowStage === 'egg_hatch_dialog'" class="cyber-card distill-egg-scene distill-egg-scene--detail">
          <div class="distill-scene-kicker">HATCHING</div>
          <div class="egg-hatch-hero" :class="selectedEggMeta ? `is-${selectedEggMeta.accent}` : ''">
            <span class="egg-hatch-shell" />
            <span class="egg-hatch-core">
              <span class="material-symbols-rounded">{{ flowContext.selectedEggId === "low" ? "bolt" : flowContext.selectedEggId === "mid" ? "autorenew" : "lock" }}</span>
            </span>
          </div>
          <div class="distill-dialog-log">
            <div v-for="(line, index) in eggDialogLines" :key="`egg-line-${index}`" class="distill-dialog-bubble">
              {{ line }}
            </div>
            <div v-if="scriptTypingText" class="distill-dialog-bubble distill-dialog-bubble--typing">
              {{ scriptTypingText }}<span class="cinematic-cursor">|</span>
            </div>
          </div>
          <div class="output-option-list output-option-list--inline">
            <button
              v-for="(item, idx) in outputOptions"
              :key="`egg-output-${item.value}`"
              type="button"
              class="output-option-card"
              :class="{ 'is-selected': selectedOutput === item.value }"
              @click="chooseOutput(item.value)"
            >
              <div class="output-option-icon" :class="`output-option-icon--${idx}`">
                <span class="material-symbols-rounded">{{ item.icon }}</span>
              </div>
              <div class="output-option-body">
                <div class="output-option-header">
                  <strong>{{ item.label }}</strong>
                  <span class="output-option-check" v-if="selectedOutput === item.value">
                    <span class="material-symbols-rounded">check_circle</span>
                  </span>
                </div>
                <p>{{ item.blurb }}</p>
              </div>
            </button>
          </div>
          <div class="distill-dialog-actions">
            <button type="button" class="cyber-btn cyber-btn-primary" :disabled="!eggDialogReady || !selectedOutput" @click="confirmEggCivilizationChoice">
              {{ flowContext.selectedEggId === "mid" && !memoryText.trim() && !memoryFiles.length ? "上传记忆后投胎" : "投胎到此文明" }}
            </button>
          </div>
        </section>

      </template>

        <section v-if="flowStage === 'chat_ready'" ref="chatStageRef" class="chat-stage" @click="closeChatMenu">
          <div class="chat-stage-header">
            <div class="chat-stage-topline">
              <span class="chat-stage-badge">{{ selectedCivilizationMeta?.label || "对话" }}</span>
              <span v-if="isRelationshipSandboxSession" class="chat-stage-badge chat-stage-badge--skill">
                加载 skill · 关系沙盘编排器
              </span>
              <span v-else-if="outputModeSystemSkillLabel" class="chat-stage-badge chat-stage-badge--skill">
                加载 skill · {{ outputModeSystemSkillLabel }}
              </span>
              <span v-if="selectedOutputMeta" class="chat-stage-badge chat-stage-badge--muted">{{ selectedOutputMeta.label }}</span>
              <span v-if="selectedCivilization === 'low'" class="gentle-progress">15 问 {{ gentleProgress }}</span>
            </div>

            <!-- Skill rail as compact icon strip -->
            <div v-if="skillCards.length" class="chat-skill-strip">
              <button
                v-for="(skill, index) in skillCards"
                :key="`strip-${skill.id}`"
                type="button"
                class="chat-skill-strip-item"
                :class="{ 'is-active': selectedSkillId === skill.id }"
                :title="`${skill.roleLabel} · ${cleanDisplayText(skill.title)}`"
                @click="previewSkillDetail(skill.id)"
              >
                <span class="chat-skill-strip-icon" :style="skillCardAvatarStyle(skill, index)">
                  <span class="chat-skill-strip-icon-label">{{ skillCardAvatarText(skill, index) }}</span>
                </span>
              </button>
            </div>
          </div>

          <div v-if="starterPrompts.length && !chatMessages.length" class="starter-prompts">
            <button v-for="prompt in starterPrompts" :key="prompt" type="button" @click="useStarterPrompt(prompt)">
              {{ prompt }}
            </button>
          </div>

          <div ref="messagesPanel" class="chat-messages">
            <article
              v-for="message in chatMessages"
              :key="message.message_id"
              class="chat-message"
              :class="message.role === 'user' ? 'is-user' : 'is-assistant'"
            >
              <div
                v-if="message.role !== 'user' && selectedSkill"
                class="chat-msg-avatar"
                :style="packHeroBackgroundStyle(selectedSkill.heroBackground, skillCards.findIndex((item) => item.id === selectedSkill?.id))"
                :aria-label="cleanDisplayText(selectedSkill.title)"
              >
              </div>
              <img
                v-else-if="message.role !== 'user' && activeTarget"
                class="chat-msg-avatar chat-msg-avatar--target"
                :src="getAvatarUrl(activeTarget, activeTargetIndex >= 0 ? activeTargetIndex : 0)"
                :alt="activeTarget?.label || ''"
                @error="($event.target as HTMLImageElement).src = getFallbackSvg(activeTarget?.label || '')"
              />
              <div class="chat-msg-body">
                <span v-if="message.role !== 'user'" class="chat-msg-name">{{ activeTarget?.label || '' }}</span>
                <p>{{ message.content }}</p>
                <div
                  v-if="messageActionCard(message)"
                  class="chat-action-card"
                  :class="{ 'is-loading': reportGenerating || reportRedirecting }"
                >
                  <div class="chat-action-card-copy">
                    <strong>{{ messageActionCard(message)?.title }}</strong>
                    <span>{{ messageActionCard(message)?.description }}</span>
                  </div>
                  <button
                    type="button"
                    class="cyber-btn cyber-btn-primary chat-action-card-btn"
                    :disabled="chatSending || reportGenerating || reportRedirecting"
                    @click.stop="triggerReportGeneration"
                  >
                    <span v-if="reportGenerating || reportRedirecting" class="chat-action-spinner" aria-hidden="true"></span>
                    <span>{{ reportGenerating || reportRedirecting ? "生成中..." : messageActionCard(message)?.buttonLabel }}</span>
                  </button>
                </div>
              </div>
            </article>

          </div>

          <section v-if="showReportViewCard" class="report-confirm-card report-confirm-card--report">
            <div class="report-confirm-copy">
              <strong>正式报告已就绪</strong>
              <p>点击查看三张命运卡和完整报告页。</p>
            </div>
            <button type="button" class="cyber-btn cyber-btn-primary report-confirm-btn" @click="openReportView">
              查看报告
            </button>
          </section>

          <p v-if="chatStatusText" class="chat-status">{{ chatStatusText }}</p>
          <p v-if="chatError" class="chat-error">{{ chatError }}</p>

          <div class="chat-footer" @click.stop>
            <div class="chat-inline-menus">
              <div class="chat-inline-menu">
                <button
                  type="button"
                  class="chat-inline-menu-trigger"
                  :class="{ 'is-open': activeChatMenu === 'output' }"
                  @click.stop="toggleChatMenu('output')"
                >
                  <span class="chat-inline-menu-label">降临方式</span>
                  <span class="chat-inline-menu-value">{{ selectedOutputMeta?.label || "未选" }}</span>
                  <span class="material-symbols-rounded">expand_more</span>
                </button>
                <div v-if="activeChatMenu === 'output'" class="chat-inline-menu-pop" @click.stop>
                  <button
                    v-for="item in outputOptions"
                    :key="`inline-output-${item.value}`"
                    type="button"
                    class="chat-inline-menu-pop-item"
                    :class="{ 'is-selected': selectedOutput === item.value }"
                    @click.stop="updateChatOutput(item.value)"
                  >
                    <span>{{ item.label }}</span>
                    <span v-if="selectedOutput === item.value" class="material-symbols-rounded">check</span>
                  </button>
                </div>
              </div>

              <div class="chat-inline-menu">
                <button
                  type="button"
                  class="chat-inline-menu-trigger"
                  :class="{ 'is-open': activeChatMenu === 'civilization' }"
                  @click.stop="toggleChatMenu('civilization')"
                >
                  <span class="chat-inline-menu-label">投胎文明</span>
                  <span class="chat-inline-menu-value">{{ selectedCivilizationMeta?.label || "未选" }}</span>
                  <span class="material-symbols-rounded">expand_more</span>
                </button>
                <div v-if="activeChatMenu === 'civilization'" class="chat-inline-menu-pop" @click.stop>
                  <button
                    v-for="item in civilizationOptions"
                    :key="`inline-civ-${item.value}`"
                    type="button"
                    class="chat-inline-menu-pop-item"
                    :class="{ 'is-selected': selectedCivilization === item.value, 'is-disabled': item.value === 'high' }"
                    :disabled="item.value === 'high'"
                    @click.stop="updateChatCivilization(item.value)"
                  >
                    <span>{{ item.label }}</span>
                    <span v-if="selectedCivilization === item.value" class="material-symbols-rounded">check</span>
                  </button>
                </div>
              </div>
            </div>

            <div v-if="memoryFiles.length" class="chat-attachments">
              <div v-for="(file, index) in memoryFiles" :key="`chat-file-${file.name}-${file.size}`" class="chat-attachment-chip">
                <span class="material-symbols-rounded">draft</span>
                <span>{{ file.name }}</span>
                <button type="button" @click="removeMemoryFile(index)">
                  <span class="material-symbols-rounded">close</span>
                </button>
              </div>
            </div>

            <div class="chat-composer">
              <button type="button" class="chat-tool-btn chat-tool-btn--attach" @click="openFilePicker">
                <span class="material-symbols-rounded">add</span>
              </button>
              <textarea
                v-model="chatDraft"
                rows="1"
                class="chat-input"
                :placeholder="chatPlaceholder"
                @keydown="handleChatKeydown"
                @focus="closeChatMenu()"
              />
              <button type="button" class="cyber-btn cyber-btn-primary chat-send" :disabled="chatSending" @click="submitChat">
                {{ chatSendLabel }}
              </button>
            </div>
          </div>
        </section>

      <div v-if="expandedSkillId && previewSkill" class="skill-popup-overlay" @click.self="closeSkillPreview()">
        <div class="skill-popup">
          <button type="button" class="skill-popup-close" @click="closeSkillPreview()">
            <span class="material-symbols-rounded">close</span>
          </button>

          <div class="skill-popup-hero">
            <div class="skill-popup-hero-icon" :style="packHeroBackgroundStyle(previewSkill.heroBackground, previewSkillIndex)">
            </div>
            <div class="skill-popup-hero-glow" />
          </div>

          <div class="skill-popup-body">
            <span class="skill-popup-category">{{ previewSkill.roleLabel }}</span>
            <h2 class="skill-popup-title">{{ cleanDisplayText(previewSkill.title) }}</h2>
            <p class="skill-popup-subtitle">{{ cleanDisplayText(previewSkill.subtitle) }}</p>

            <div class="skill-popup-section">
              <h4 class="skill-popup-section-title">核心技能</h4>
              <div class="skill-popup-skills">
                <span v-for="tag in previewSkill.tags" :key="tag" class="skill-popup-skill-tag">{{ cleanDisplayText(tag) }}</span>
              </div>
            </div>

            <div v-if="previewSkill.starterPrompts?.length" class="skill-popup-section">
              <h4 class="skill-popup-section-title">快速开始</h4>
              <div class="skill-popup-prompts">
                <div
                  v-for="(prompt, i) in previewSkill.starterPrompts"
                  :key="i"
                  class="skill-popup-prompt-item"
                >
                  <span class="material-symbols-rounded">bolt</span>
                  <span>{{ cleanDisplayText(prompt) }}</span>
                </div>
              </div>
            </div>

            <button
              v-if="flowStage !== 'chat_ready'"
              type="button"
              class="cyber-btn cyber-btn-primary skill-popup-cta"
              @click="closeSkillPreview(); handleSkillActivation(previewSkill.id)"
            >
              开始蒸馏
              <span class="material-symbols-rounded" style="font-size: 18px; margin-left: 6px">arrow_forward</span>
            </button>
            <button
              v-else
              type="button"
              class="cyber-btn cyber-btn-ghost skill-popup-cta"
              @click="closeSkillPreview()"
            >
              返回当前对话
            </button>
          </div>
        </div>
      </div>

        <p v-if="chatError && flowStage !== 'chat_ready'" class="chat-error chat-error--inline">{{ chatError }}</p>
    </div>

    <div v-if="currentModal" class="flow-modal-backdrop" :class="{ 'is-cinematic': currentModal === 'output' }" @click.self="closeModal">
      <section class="flow-modal cyber-card" :class="[`is-${currentModal}`, { 'flow-modal--cinematic': currentModal === 'output' }]">
        <button type="button" class="flow-modal-close" aria-label="关闭弹窗" @click="closeModal">
          <span class="material-symbols-rounded">close</span>
        </button>

        <template v-if="currentModal === 'enter'">
          <span class="modal-step">STEP 1</span>
          <h2>抽取系统</h2>
          <p class="modal-copy">当前页面已经完成 skill 抽取，确认后继续进入降临方式选择。</p>
          <div v-if="selectedSkill" class="modal-chip">
            <strong>{{ cleanDisplayText(selectedSkill.title) }}</strong>
            <span>{{ selectedSkill.tags.map(cleanDisplayText).join(" · ") || selectedSkill.avatarLabel }}</span>
          </div>
          <div class="modal-actions modal-actions--single">
            <button type="button" class="cyber-btn cyber-btn-primary" @click="openOutputModal">抽取系统</button>
          </div>
        </template>

        <template v-else-if="currentModal === 'output'">
          <div class="cinematic-output" :class="`cinematic-phase--${cinematicPhase || 'entrance'}`">
            <div class="cinematic-particles" aria-hidden="true">
              <span
                v-for="n in 14"
                :key="`cinematic-particle-${n}`"
                class="cinematic-particle"
                :style="{
                  '--size': `${2 + (n % 4)}px`,
                  '--delay': `${(n - 1) * 0.08}s`,
                  '--dx': `${((n % 2 === 0 ? 1 : -1) * (36 + (n % 5) * 18))}px`,
                  '--dy': `${(-140 + (n % 7) * 40)}px`,
                }"
              />
            </div>

            <div class="cinematic-portal" aria-hidden="true">
              <div class="cinematic-portal-ring cinematic-portal-ring--outer" />
              <div class="cinematic-portal-ring cinematic-portal-ring--inner" />
              <div class="cinematic-portal-core">
                <span class="material-symbols-rounded">auto_awesome</span>
              </div>
            </div>

            <div class="cinematic-text-area">
              <div class="cinematic-ai-avatar">
                <span class="material-symbols-rounded">psychology_alt</span>
              </div>
              <div class="cinematic-bubble">
                {{ cinematicText }}<span v-if="cinematicTyping" class="cinematic-cursor">|</span>
              </div>
            </div>

            <TransitionGroup name="cinematic-card">
              <button
                v-for="item in (cinematicPhase === 'choice' || cinematicPhase === 'confirm' ? cinematicOptions : [])"
                :key="item.value"
                type="button"
                class="cinematic-choice-card"
                :class="[
                  `cinematic-choice--${item.color}`,
                  {
                    'is-confirmed': selectedOutput === item.value,
                    'is-dimmed': cinematicConfirmed && selectedOutput !== item.value,
                  },
                ]"
                :disabled="cinematicTyping || cinematicConfirmed"
                @click="cinematicChoose(item.value)"
              >
                <div class="cinematic-choice-icon">
                  <span class="material-symbols-rounded">{{ item.icon }}</span>
                </div>
                <div class="cinematic-choice-body">
                  <strong>{{ item.label }}</strong>
                  <p>{{ item.desc }}</p>
                </div>
                <div v-if="selectedOutput === item.value" class="cinematic-choice-check">
                  <span class="material-symbols-rounded">check_circle</span>
                </div>
              </button>
            </TransitionGroup>
          </div>
        </template>

        <template v-else-if="currentModal === 'civilization'">
          <span class="modal-step">STEP 3</span>
          <h2>选择投胎文明</h2>
          <p class="modal-copy">低等文明直接开聊，中等文明先上传记忆，高等文明暂未开放。</p>
          <div class="output-option-list">
            <div
              v-for="item in civilizationOptions"
              :key="item.value"
              class="output-option-card"
              :class="[
                { 'is-selected': selectedCivilization === item.value, 'is-disabled': item.value === 'high' },
                `output-option-card--${item.accent}`
              ]"
              role="button"
              tabindex="0"
              @click="item.value !== 'high' && chooseCivilization(item.value)"
              @keydown.enter.prevent="item.value !== 'high' && chooseCivilization(item.value)"
              @keydown.space.prevent="item.value !== 'high' && chooseCivilization(item.value)"
            >
              <div class="output-option-icon" :class="`output-option-icon--civ-${item.accent}`">
                <span class="material-symbols-rounded">
                  {{ item.value === 'low' ? 'bolt' : item.value === 'mid' ? 'autorenew' : 'lock' }}
                </span>
              </div>
              <div class="output-option-body">
                <div class="output-option-header">
                  <strong>{{ item.label }}</strong>
                  <span v-if="item.value === 'high'" class="output-option-badge">即将开放</span>
                  <span class="output-option-check" v-else-if="selectedCivilization === item.value">
                    <span class="material-symbols-rounded">check_circle</span>
                  </span>
                </div>
                <p>{{ item.blurb }}</p>
                <span class="output-option-action">{{ item.action }}</span>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="cyber-btn cyber-btn-ghost" @click="currentModal = 'output'">上一步</button>
            <button type="button" class="cyber-btn cyber-btn-primary" :disabled="!canAdvanceCivilization || selectedCivilization === 'high' || chatBootstrapping" @click="handleCivilizationNext">
              {{ selectedCivilization === "low" ? "进入聊天" : "下一步" }}
            </button>
          </div>
        </template>

        <template v-else-if="currentModal === 'identity'">
          <span class="modal-step">IDENTITY</span>
          <h2>命名你的新身份</h2>
          <p class="modal-copy">这是注册引导中的主人物卡名称，会写入自我蒸馏报告，后续蒸馏他人也会以它作为你的参与身份。</p>
          <div class="identity-field">
            <label class="identity-label" for="selfIdentityName">新身份名称</label>
            <input
              id="selfIdentityName"
              v-model="selfIdentityName"
              class="identity-input"
              type="text"
              maxlength="40"
              placeholder="例如：醒来的我、赛博 Wade、第二身份"
              @keyup.enter="handleSelfIdentitySubmit"
            />
            <p v-if="selfIdentityError" class="identity-error">{{ selfIdentityError }}</p>
          </div>
          <div class="modal-actions">
            <button type="button" class="cyber-btn cyber-btn-ghost" @click="currentModal = 'civilization'">返回</button>
            <button type="button" class="cyber-btn cyber-btn-primary" @click="handleSelfIdentitySubmit">
              确认身份
            </button>
          </div>
        </template>

        <template v-else-if="currentModal === 'upload'">
          <span class="modal-step">STEP 4</span>
          <h2>{{ memoryIntakeGuide.title || "上传记忆后进入轮回" }}</h2>
          <p class="modal-copy">{{ memoryIntakeGuide.copy || "中等文明需要聊天记录、简历或文字记忆，随后会穿过轮回之门落地到聊天页。" }}</p>
          <textarea
            v-model="memoryText"
            class="memory-textarea"
            :placeholder="memoryIntakeGuide.placeholder || '写下一段关键记忆、关系背景、想让神明先理解的上下文。'"
          />
          <button type="button" class="upload-zone" @click="openFilePicker">
            <span class="material-symbols-rounded">upload_file</span>
            <strong>上传记忆碎片</strong>
            <p>支持聊天记录、简历、文字、图片等附件。</p>
          </button>
          <div v-if="memoryFiles.length" class="memory-files">
            <div v-for="(file, index) in memoryFiles" :key="`${file.name}-${file.size}`" class="memory-file">
              <span class="material-symbols-rounded">description</span>
              <span>{{ file.name }}</span>
              <button type="button" @click="removeMemoryFile(index)">
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>
          </div>
          <p v-if="restoredDraftHint" class="draft-hint">{{ restoredDraftHint }}</p>
          <div class="modal-actions">
            <button type="button" class="cyber-btn cyber-btn-ghost" @click="currentModal = 'civilization'">上一步</button>
            <button type="button" class="cyber-btn cyber-btn-gold" :disabled="chatBootstrapping" @click="handleUploadNext">
              {{ chatBootstrapping ? "轮回中..." : "穿过轮回之门" }}
            </button>
          </div>
        </template>
      </section>

      <input ref="uploadInput" type="file" class="hidden-input" multiple @change="handleFileChange" />
    </div>

    <div v-if="transitionActive" class="transition-overlay" aria-live="polite" aria-busy="true">
      <div class="vessel-scene">
        <div v-if="activeTarget" class="vessel-avatar">
          <div class="vessel-avatar-ring">
            <img
              :src="getAvatarUrl(activeTarget, activeTargetIndex >= 0 ? activeTargetIndex : 0)"
              :alt="activeTarget.label"
              @error="($event.target as HTMLImageElement).src = getFallbackSvg(activeTarget.label)"
            />
          </div>
          <div class="vessel-avatar-pulse" />
        </div>

        <svg class="vessel-svg" viewBox="0 0 320 480" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="vGradMain" x1="160" y1="60" x2="160" y2="270" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#ff758f" />
              <stop offset="100%" stop-color="#c1121f" />
            </linearGradient>
            <linearGradient id="vGradL" x1="160" y1="260" x2="70" y2="396" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#ff758f" />
              <stop offset="100%" stop-color="rgba(255,190,11,0.72)" />
            </linearGradient>
            <linearGradient id="vGradC" x1="160" y1="260" x2="160" y2="406" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#ff758f" />
              <stop offset="100%" stop-color="rgba(255,255,255,0.6)" />
            </linearGradient>
            <linearGradient id="vGradR" x1="160" y1="260" x2="250" y2="396" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#ff758f" />
              <stop offset="100%" stop-color="rgba(126,105,255,0.78)" />
            </linearGradient>
          </defs>

          <path class="vessel-trunk" d="M160 88 C160 146 160 198 160 262" />
          <path class="vessel-cap vessel-cap--1" d="M160 152 C145 164 138 178 132 194" />
          <path class="vessel-cap vessel-cap--2" d="M160 188 C176 198 184 214 188 230" />
          <path class="vessel-cap vessel-cap--3" d="M160 224 C146 236 138 248 132 264" />
          <path class="vessel-branch vessel-branch--left" d="M160 262 C145 300 112 344 70 396" />
          <path class="vessel-branch vessel-branch--center" d="M160 262 C160 308 160 356 160 406" />
          <path class="vessel-branch vessel-branch--right" d="M160 262 C175 300 208 344 250 396" />

          <circle class="vessel-fruit vessel-fruit--left" cx="70" cy="396" r="18" fill="rgba(255,190,11,0.16)" />
          <circle class="vessel-fruit vessel-fruit--center" cx="160" cy="406" r="18" fill="rgba(255,255,255,0.12)" />
          <circle class="vessel-fruit vessel-fruit--right" cx="250" cy="396" r="18" fill="rgba(126,105,255,0.16)" />
          <circle class="vessel-fruit-core vessel-fruit-core--left" cx="70" cy="396" r="7" fill="rgba(255,190,11,0.7)" />
          <circle class="vessel-fruit-core vessel-fruit-core--center" cx="160" cy="406" r="7" fill="rgba(255,255,255,0.76)" />
          <circle class="vessel-fruit-core vessel-fruit-core--right" cx="250" cy="396" r="7" fill="rgba(126,105,255,0.78)" />
        </svg>
      </div>

      <h2 class="vessel-title">{{ transitionTitle }}</h2>
      <p class="vessel-copy">{{ transitionCopy }}</p>
    </div>
  </div>
</template>

<style scoped>
.cyber-flow-page {
  box-sizing: border-box;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 20px 16px calc(var(--safe-bottom) + 28px);
}

.cyber-flow-shell {
  width: min(100%, 460px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cyber-flow-shell--idle {
  width: min(100%, 1180px);
}

.cyber-flow-page.is-chat-ready {
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  padding: 10px 14px calc(var(--tab-bar-height) + var(--safe-bottom) + 48px);
  overflow: hidden;
}

.cyber-flow-page.is-chat-ready .cyber-flow-shell {
  height: 100%;
  min-height: 0;
  gap: 8px;
}

.cyber-flow-page.is-chat-ready .flow-topbar {
  flex: 0 0 auto;
}

.cyber-flow-page.is-chat-ready .title-area {
  display: none;
}

.flow-topbar {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 12px;
  padding-top: calc(env(safe-area-inset-top, 0px) + 4px);
}

.topbar-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(232, 230, 227, 0.8);
  margin: 0;
  letter-spacing: 0.04em;
}

.topbar-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: rgba(232, 230, 227, 0.86);
  letter-spacing: 0.08em;
  font-size: 0.8rem;
}

.title-area {
  text-align: center;
  margin-bottom: 2px;
}

.title-area h1 {
  margin: 0;
  display: inline-block;
  font-family: var(--font-display);
  font-size: clamp(2rem, 7.8vw, 2.55rem);
  font-weight: 900;
  color: #e8e6e3 !important;
  letter-spacing: 0.26em;
  text-shadow: 0 0 16px rgba(0, 245, 212, 0.16);
}

.title-area h1::after {
  content: "";
  display: block;
  width: 116px;
  height: 2px;
  margin: 12px auto 0;
  background: linear-gradient(90deg, transparent, var(--neon-cyan), transparent);
}

.title-area p {
  margin: 10px 0 0;
  color: rgba(232, 230, 227, 0.66);
  font-size: 0.82rem;
  letter-spacing: 0.22em;
}

.title-area--constellation h1 {
  font-size: clamp(1.5rem, 6.2vw, 2rem);
  letter-spacing: 0.08em;
}

.title-area--constellation h1::after {
  width: 88px;
  margin-top: 10px;
}

.title-area--constellation p {
  margin-top: 8px;
  font-size: 0.74rem;
  letter-spacing: 0.14em;
}

.title-area--scan {
  gap: 8px;
}

.title-area--scan h1 {
  font-size: clamp(1.12rem, 4.6vw, 1.42rem);
  letter-spacing: 0.12em;
}

.title-area--scan h1::after {
  width: 64px;
  margin-top: 8px;
}

.title-area--scan p {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.8;
  letter-spacing: 0.08em;
}

.cyber-card,
.flow-loading,
.flow-error,
.selection-stage,
.entry-stage,
.chat-stage {
  background: rgba(18, 18, 30, 0.86) !important;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.26);
}

.flow-loading,
.flow-error {
  padding: 22px 18px;
  text-align: center;
}

.flow-error {
  display: grid;
  gap: 12px;
}

.social-stage {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: calc(100dvh - 160px);
  padding-bottom: calc(var(--tab-bar-height) + var(--safe-bottom) + 8px);
}

.social-stage-copy {
  display: grid;
  gap: 8px;
  justify-items: center;
  text-align: center;
}

.social-stage-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(0, 245, 212, 0.1);
  border: 1px solid rgba(0, 245, 212, 0.12);
  color: var(--neon-cyan);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
}

.social-stage-copy h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.5rem;
  letter-spacing: 0.04em;
}

.social-stage-copy p {
  margin: 0;
  max-width: 300px;
  color: rgba(232, 230, 227, 0.56);
  font-size: 0.76rem;
  line-height: 1.7;
}

.social-field {
  position: relative;
  min-height: 62vh;
  padding: 18px 10px 12px;
  overflow: hidden;
}

.social-stage--idle .social-field {
  min-height: calc(100dvh - var(--topbar-h, 48px) - var(--tab-bar-height) - var(--safe-bottom) - 18px);
  padding: 6px 10px 18px;
}

.social-field::before {
  display: none;
}

.social-target {
  position: absolute;
  top: 10%;
  left: 50%;
  z-index: 6;
  display: grid;
  gap: 8px;
  justify-items: center;
  transform: translateX(-50%);
}

.social-target .seed-vortex--idle-preview {
  top: -34px;
  left: 50%;
  width: 260px;
  height: 260px;
  opacity: 0.78;
  transform: translateX(-50%) scale(0.96);
  animation: idleVortexReveal 540ms cubic-bezier(0.22, 1, 0.36, 1) forwards, vortexSpinSlow 8s linear infinite 540ms;
  filter: saturate(0.86) brightness(0.92);
  pointer-events: none;
  z-index: 1;
}

.idle-skill-emission {
  position: absolute;
  top: -116px;
  left: 50%;
  z-index: 1;
  width: 340px;
  height: 340px;
  pointer-events: none;
  transform: translateX(-50%);
  filter: saturate(1.08);
}

.idle-vortex-ripple,
.idle-vortex-spiral,
.idle-vortex-spark {
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
}

.idle-vortex-ripple {
  inset: 96px;
  border: 1px solid rgba(0, 245, 212, 0.26);
  background:
    conic-gradient(
      from 0deg,
      rgba(0, 245, 212, 0),
      rgba(0, 245, 212, 0.34),
      rgba(245, 166, 35, 0.22),
      rgba(126, 105, 255, 0.28),
      rgba(0, 245, 212, 0)
    );
  box-shadow: 0 0 34px rgba(0, 245, 212, 0.12);
  opacity: 0;
  -webkit-mask: radial-gradient(circle, transparent 61%, #000 62%, #000 64%, transparent 66%);
  mask: radial-gradient(circle, transparent 61%, #000 62%, #000 64%, transparent 66%);
  animation: idleVortexRipple 3.9s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.idle-vortex-ripple--2 {
  animation-delay: 0.42s;
}

.idle-vortex-ripple--3 {
  animation-delay: 0.86s;
}

.idle-vortex-spiral {
  inset: 82px;
  opacity: 0;
  background:
    conic-gradient(
      from 24deg,
      transparent 0deg,
      rgba(0, 245, 212, 0.56) 28deg,
      transparent 62deg,
      transparent 150deg,
      rgba(245, 166, 35, 0.42) 178deg,
      transparent 214deg,
      transparent 360deg
    );
  -webkit-mask: radial-gradient(circle, transparent 50%, #000 51%, #000 54%, transparent 56%);
  mask: radial-gradient(circle, transparent 50%, #000 51%, #000 54%, transparent 56%);
  animation: idleVortexSpiral 4.8s linear infinite, idleVortexSpiralFade 3.9s ease-in-out infinite;
}

.idle-vortex-spiral--2 {
  inset: 116px;
  animation-delay: 0.28s;
  animation-direction: reverse, normal;
  background:
    conic-gradient(
      from 180deg,
      transparent 0deg,
      rgba(126, 105, 255, 0.48) 34deg,
      transparent 74deg,
      transparent 204deg,
      rgba(0, 245, 212, 0.4) 236deg,
      transparent 274deg,
      transparent 360deg
    );
}

.idle-vortex-spark {
  top: 50%;
  left: 50%;
  width: 5px;
  height: 5px;
  background: rgba(0, 245, 212, 0.9);
  box-shadow: 0 0 14px rgba(0, 245, 212, 0.78);
  opacity: 0;
  animation: idleVortexSpark 3.9s ease-out infinite;
}

.idle-vortex-spark--1 {
  animation-delay: 0.72s;
  --spark-angle: -18deg;
  --spark-distance: 146px;
}

.idle-vortex-spark--2 {
  width: 4px;
  height: 4px;
  background: rgba(245, 166, 35, 0.9);
  box-shadow: 0 0 12px rgba(245, 166, 35, 0.64);
  animation-delay: 1s;
  --spark-angle: 196deg;
  --spark-distance: 132px;
}

.idle-vortex-spark--3 {
  width: 6px;
  height: 6px;
  background: rgba(126, 105, 255, 0.92);
  box-shadow: 0 0 14px rgba(126, 105, 255, 0.68);
  animation-delay: 1.24s;
  --spark-angle: 22deg;
  --spark-distance: 158px;
}

.social-target-main {
  position: relative;
  z-index: 2;
  display: grid;
  justify-items: center;
  gap: 8px;
  width: 148px;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: center;
  cursor: pointer;
  animation: idleMainSkillArrival 760ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.social-target-main::before {
  content: "";
  position: absolute;
  top: -14px;
  left: 50%;
  z-index: 0;
  width: 124px;
  height: 124px;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(0, 245, 212, 0.18), rgba(0, 245, 212, 0.04) 48%, transparent 70%);
  transform: translateX(-50%);
  animation: idleMainSkillHalo 2.8s ease-in-out infinite;
}

.social-target-main-avatar {
  position: relative;
  z-index: 1;
  display: inline-flex;
  width: 78px;
  height: 78px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.26), 0 0 30px rgba(0, 245, 212, 0.12);
  overflow: hidden;
  animation: hostBreath 3.2s ease-in-out infinite;
}

.social-target-main.is-loading-preview {
  cursor: default;
}

.social-target-main.is-loading-preview .social-target-main-avatar {
  animation: hostBreath 3.2s ease-in-out infinite, loadingSkillFocus 1.4s ease-in-out infinite;
}

.social-target-main strong,
.social-target-main > span:last-child,
.social-target-main .social-skill-tap-guide {
  position: relative;
  z-index: 1;
}

.social-target-main-avatar::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(7, 12, 22, 0.04), rgba(7, 12, 22, 0.36));
}

.social-target-main .social-skill-tap-guide {
  right: 20px;
  bottom: 48px;
}

.social-target-main strong {
  font-size: 0.84rem;
  line-height: 1.32;
}

.social-target-main > span:last-child {
  max-width: 14ch;
  color: rgba(232, 230, 227, 0.56);
  font-size: 0.68rem;
  line-height: 1.36;
}

.social-target-ring {
  position: relative;
  z-index: 2;
  display: inline-flex;
  width: 136px;
  height: 136px;
  padding: 3px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 14px 42px rgba(0, 0, 0, 0.28), 0 0 36px rgba(0, 245, 212, 0.08);
  background: radial-gradient(circle at 35% 18%, rgba(0, 245, 212, 0.18), rgba(16, 16, 24, 0.92));
  animation: hostBreath 3.2s ease-in-out infinite;
}

.social-target-ring img {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  object-fit: cover;
}

.social-target strong {
  font-size: 0.96rem;
}

.social-target span {
  color: rgba(232, 230, 227, 0.48);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
}

.social-ghost-avatar {
  position: absolute;
  width: 74px;
  height: 74px;
  border-radius: 999px;
  overflow: hidden;
  opacity: 0.22;
  filter: grayscale(0.08) blur(0.4px) brightness(0.78);
}

.social-ghost-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 999px;
}

.social-loading {
  position: absolute;
  inset: auto 0 16%;
  text-align: center;
  color: rgba(232, 230, 227, 0.72);
  font-size: 0.76rem;
  letter-spacing: 0.18em;
}

.social-loading--error {
  color: #ffb4c7;
}

.social-skill {
  position: absolute;
  z-index: 4;
  display: grid;
  gap: 8px;
  justify-items: center;
  width: 136px;
  border: 0;
  background: transparent;
  text-align: center;
  cursor: pointer;
  opacity: 0;
  transform: translateY(12px) scale(0.92);
  animation: socialSkillIn 0.45s ease forwards;
}

.social-skill:active {
  transform: scale(0.96);
}

.social-skill-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 76px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24);
  overflow: hidden;
}

.social-skill-avatar::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(7, 12, 22, 0.08), rgba(7, 12, 22, 0.58));
}

.social-skill strong {
  font-size: 0.78rem;
  line-height: 1.32;
}

.social-skill span:last-child {
  color: rgba(232, 230, 227, 0.46);
  font-size: 0.62rem;
  line-height: 1.32;
}

.social-skill.is-selected .social-skill-avatar {
  box-shadow: 0 0 0 2px rgba(0, 245, 212, 0.16), 0 0 26px rgba(0, 245, 212, 0.18), 0 16px 32px rgba(0, 0, 0, 0.26);
  transform: scale(1.04);
}

.social-skill.is-selected strong {
  color: var(--neon-cyan);
}

.social-skill--avatar {
  gap: 10px;
  opacity: 1;
  transform: none;
}

.social-skill--aux {
  transform-origin: center center;
}

.social-skill--aux::before {
  content: "";
  position: absolute;
  top: 43px;
  left: 50%;
  z-index: -1;
  width: 168px;
  height: 1px;
  background: linear-gradient(90deg, rgba(0, 245, 212, 0), rgba(0, 245, 212, 0.34), rgba(245, 166, 35, 0));
  opacity: 0;
  transform: translateX(calc(var(--idle-enter-x, 0) * -0.62)) scaleX(0.2);
  transform-origin: center;
  filter: drop-shadow(0 0 8px rgba(0, 245, 212, 0.28));
  animation: idleAuxSignalLine 840ms cubic-bezier(0.22, 1, 0.36, 1) var(--idle-line-delay, 0.78s) both;
}

.social-skill--avatar.is-recommended .social-skill-avatar {
  animation: socialSkillAvatarSpawn 0.62s cubic-bezier(0.22, 1, 0.36, 1) var(--skill-label-delay, 0.52s) both, recommendedPulse 2.2s ease-in-out calc(var(--skill-pulse-delay, 1.1s) + 0.6s) infinite;
}

.social-skill--avatar .social-skill-avatar {
  opacity: 1;
  transform: scale(1);
  filter: none;
  animation: socialSkillAvatarSpawn 0.62s cubic-bezier(0.22, 1, 0.36, 1) var(--skill-label-delay, 0.52s) both;
}

.social-skill--aux .social-skill-avatar {
  animation:
    idleAuxSkillAvatarReveal 1.12s cubic-bezier(0.22, 1, 0.36, 1) var(--skill-label-delay, 0.96s) both,
    idleAuxSkillFloat 4.6s ease-in-out calc(var(--skill-label-delay, 0.96s) + 1.12s) infinite;
}

.social-skill-tap-guide {
  position: absolute;
  right: -10px;
  bottom: 8px;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: rgba(18, 22, 30, 0.94);
  border: 1px solid rgba(0, 245, 212, 0.18);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--neon-cyan);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
  animation: tapGuideBounce 1.2s ease-in-out infinite;
}

.social-skill-tap-guide .material-symbols-rounded {
  font-size: 18px;
}

.social-skill--avatar strong {
  font-size: 0.8rem;
  opacity: 1;
  transform: translateY(0);
  animation: skillLabelReveal 0.36s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--skill-label-delay, 0.52s) + 0.18s) both;
}

.social-skill--avatar span:last-child {
  font-size: 0.7rem;
  opacity: 1;
  transform: translateY(0);
  animation: skillLabelReveal 0.36s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--skill-label-delay, 0.52s) + 0.3s) both;
}

.social-skill--aux strong,
.social-skill--aux span:last-child {
  animation-duration: 0.42s;
}

.social-orb {
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  opacity: 0.55;
}

.social-orb--a {
  top: 24%;
  left: 20%;
  width: 10px;
  height: 10px;
  background: rgba(0, 245, 212, 0.72);
  box-shadow: 0 0 16px rgba(0, 245, 212, 0.52);
}

.social-orb--b {
  right: 16%;
  top: 58%;
  width: 14px;
  height: 14px;
  background: rgba(126, 105, 255, 0.76);
  box-shadow: 0 0 18px rgba(126, 105, 255, 0.44);
}

.social-orb--c {
  left: 46%;
  bottom: 12%;
  width: 8px;
  height: 8px;
  background: rgba(245, 166, 35, 0.88);
  box-shadow: 0 0 14px rgba(245, 166, 35, 0.48);
}

.social-skill-sheet {
  display: grid;
  gap: 10px;
  padding: 16px;
}

.social-skill-sheet-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.social-action-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: center;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(0, 245, 212, 0.14);
  color: rgba(232, 230, 227, 0.9);
  font-size: 0.78rem;
  letter-spacing: 0.06em;
}

.social-action-chip .material-symbols-rounded {
  font-size: 18px;
  color: var(--neon-cyan);
}

.social-skill-sheet-head .material-symbols-rounded {
  font-size: 26px;
  color: var(--neon-cyan);
}

.social-skill-sheet-head strong {
  display: block;
  font-size: 0.92rem;
}

.social-skill-sheet-head p {
  margin: 4px 0 0;
  color: rgba(232, 230, 227, 0.54);
  font-size: 0.72rem;
  line-height: 1.6;
}

.social-skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.social-skill-tags span {
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(232, 230, 227, 0.76);
  font-size: 0.66rem;
}

.social-stage-actions {
  margin-top: auto;
}

/* ===== Skill Search Bar ===== */
.skill-search-bar {
  position: relative;
  display: flex;
  align-items: center;
  margin: 0 4px;
  padding: 0 14px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: border-color 0.2s;
}

.skill-search-bar:focus-within {
  border-color: rgba(0, 245, 212, 0.25);
}

.skill-search-icon {
  font-size: 18px;
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-right: 8px;
}

.skill-search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.78rem;
  font-family: inherit;
  min-width: 0;
}

.skill-search-input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.skill-search-clear {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: var(--text-secondary);
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.skill-search-clear:active {
  background: rgba(255, 255, 255, 0.15);
}

/* Search dropdown */
.skill-search-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 280px;
  overflow-y: auto;
  border-radius: 14px;
  background: rgba(22, 22, 28, 0.96);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  z-index: 50;
  padding: 6px;
}

.skill-search-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px 12px;
  font-size: 0.76rem;
  color: var(--text-secondary);
}

.skill-search-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 8px;
  border-radius: 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
  text-align: left;
}

.skill-search-item:active {
  background: rgba(255, 255, 255, 0.06);
}

.skill-search-item-avatar {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  overflow: hidden;
  background-size: cover;
  background-position: center;
}

.skill-search-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.skill-search-item-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-search-item-sub {
  font-size: 0.65rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-search-item-arrow {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}

/* Search dropdown transition */
.search-dropdown-enter-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.search-dropdown-leave-active {
  transition: all 0.12s ease-in;
}
.search-dropdown-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
.search-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-3px) scale(0.99);
}

.social-stage-next {
  width: 100%;
  justify-content: center;
  min-height: 48px;
}

/* Skill detail popup — fullscreen overlay */
.skill-popup-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  padding: 20px;
  animation: popupFadeIn 0.2s ease;
}

.skill-popup {
  position: relative;
  width: 100%;
  max-width: 460px;
  max-height: 85vh;
  background: #0a0a0f;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow-y: auto;
  overscroll-behavior: contain;
  animation: popupScaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Close button — top right */
.skill-popup-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.7);
  display: grid;
  place-items: center;
  cursor: pointer;
  z-index: 2;
}

.skill-popup-close:active { transform: scale(0.9); }
.skill-popup-close .material-symbols-rounded { font-size: 20px; }

/* Hero area */
.skill-popup-hero {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 20px 24px;
}

.skill-popup-hero-icon {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  position: relative;
  z-index: 1;
  overflow: hidden;
}

.skill-popup-hero-icon::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(4, 8, 14, 0.08), rgba(4, 8, 14, 0.48));
}

.skill-popup-hero-glow {
  position: absolute;
  width: 160px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(0, 245, 212, 0.12), transparent 70%);
  filter: blur(20px);
}

/* Body content */
.skill-popup-body {
  padding: 0 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Category badge */
.skill-popup-category {
  display: inline-block;
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(0, 245, 212, 0.1);
  border: 1px solid rgba(0, 245, 212, 0.2);
  color: var(--neon-cyan);
  font-size: 0.65rem;
  letter-spacing: 1px;
}

/* Title */
.skill-popup-title {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
  line-height: 1.3;
}

/* Subtitle */
.skill-popup-subtitle {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.6;
  margin: 0;
}

/* Section */
.skill-popup-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skill-popup-section-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  letter-spacing: 0.04em;
}

/* Skill tags */
.skill-popup-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.skill-popup-skill-tag {
  padding: 5px 14px;
  border-radius: 999px;
  background: rgba(0, 245, 212, 0.08);
  border: 1px solid rgba(0, 245, 212, 0.15);
  color: var(--neon-cyan);
  font-size: 0.75rem;
}

/* Starter prompts */
.skill-popup-prompts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-popup-prompt-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
}

.skill-popup-prompt-item .material-symbols-rounded {
  font-size: 16px;
  color: var(--neon-cyan);
  flex-shrink: 0;
}

/* CTA button */
.skill-popup-cta {
  width: 100%;
  padding: 14px 24px;
  font-size: 0.95rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
}

@keyframes popupFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes popupScaleIn {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes socialSkillIn {
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ===== Skill Detail Panel ===== */
.skill-detail-panel {
  margin-top: 16px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(0, 245, 212, 0.12);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.skill-detail-header .material-symbols-rounded {
  font-size: 28px;
}

.skill-detail-header strong {
  display: block;
  font-size: 0.96rem;
}

.skill-detail-header span {
  color: rgba(232, 230, 227, 0.55);
  font-size: 0.72rem;
  line-height: 1.5;
}

.skill-detail-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.skill-detail-tag {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 600;
  background: rgba(0, 245, 212, 0.08);
  border: 1px solid rgba(0, 245, 212, 0.15);
  color: var(--neon-cyan);
}

.skill-detail-prompts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-detail-prompts-label {
  font-size: 0.68rem;
  color: rgba(232, 230, 227, 0.4);
  letter-spacing: 0.1em;
}

.skill-detail-prompt-chip {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(232, 230, 227, 0.75);
  font-size: 0.74rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.skill-detail-prompt-chip:active {
  background: rgba(255, 255, 255, 0.06);
}

.skill-detail-enter-btn {
  margin-top: 4px;
  width: 100%;
  justify-content: center;
}

/* Skill detail transition */
.skill-detail-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.skill-detail-leave-active {
  transition: all 0.2s ease-in;
}
.skill-detail-enter-from {
  opacity: 0;
  max-height: 0;
  transform: translateY(-8px);
  margin-top: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.skill-detail-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-4px);
}

.social-stage-hint {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(232, 230, 227, 0.58);
  text-align: center;
}

.social-stage-intro {
  width: min(100%, 460px);
  margin: 0 auto;
  padding-top: clamp(300px, 36vh, 380px);
  display: grid;
  gap: 10px;
  justify-items: center;
  text-align: center;
}

.social-stage-intro-line {
  max-width: 34ch;
  color: var(--text-primary);
  font-size: clamp(0.9rem, 2vw, 1rem);
  line-height: 1.78;
  animation: textFadeIn 220ms ease;
}

.social-stage-intro-line--typing {
  color: rgba(232, 230, 227, 0.88);
}

.social-stage-intro-hint {
  margin: 4px 0 0;
  color: rgba(0, 245, 212, 0.82);
  font-size: 0.76rem;
  line-height: 1.7;
  letter-spacing: 0.08em;
}

.distill-dialog-scene,
.distill-egg-scene {
  display: grid;
  gap: 16px;
  padding: 20px 16px 18px;
}

.distill-system-stage {
  min-height: calc(100dvh - 224px - var(--tab-bar-height) - var(--safe-bottom));
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 18px;
  padding: 10px 0 calc(var(--tab-bar-height) + var(--safe-bottom) + 12px);
}

.distill-system-content {
  width: min(100%, 460px);
  margin: 0 auto;
  display: grid;
  align-content: center;
  gap: 18px;
}

.distill-scene-kicker {
  font-size: 0.68rem;
  letter-spacing: 0.24em;
  color: var(--neon-cyan);
}

.distill-system-console {
  display: grid;
  gap: 14px;
}

.distill-system-line {
  font-size: clamp(1rem, 2.6vw, 1.18rem);
  line-height: 1.8;
  color: var(--text-primary);
}

.distill-system-line--typing {
  color: var(--text-primary);
}

.distill-scene-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.14rem;
  letter-spacing: 0.08em;
}

.distill-scene-copy {
  margin: -8px 0 0;
  color: rgba(232, 230, 227, 0.62);
  font-size: 0.8rem;
  line-height: 1.7;
}

.distill-dialog-log {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.distill-dialog-bubble {
  max-width: 100%;
  padding: 12px 14px;
  border-radius: 16px 16px 16px 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
  font-size: 0.84rem;
  line-height: 1.75;
}

.distill-dialog-bubble--typing {
  border-color: rgba(0, 245, 212, 0.18);
  box-shadow: 0 0 24px rgba(0, 245, 212, 0.06);
}

.distill-dialog-actions {
  display: flex;
  gap: 10px;
}

.distill-dialog-actions--dock {
  position: sticky;
  bottom: calc(var(--tab-bar-height) + var(--safe-bottom) + 10px);
  width: min(100%, 460px);
  margin: 0 auto;
  padding-top: 8px;
  background:
    linear-gradient(180deg, rgba(5, 7, 13, 0), rgba(5, 7, 13, 0.92) 24%, rgba(5, 7, 13, 0.98));
}

.distill-dialog-actions > * {
  flex: 1;
}

.system-actions-enter-active,
.system-actions-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}

.system-actions-enter-from,
.system-actions-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.idle-hint-enter-active,
.idle-hint-leave-active {
  transition: opacity 260ms ease, transform 260ms ease;
}

.idle-hint-enter-from,
.idle-hint-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.civilization-egg-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.civilization-egg-card {
  position: relative;
  min-height: 180px;
  padding: 16px 12px 14px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  text-align: center;
  color: inherit;
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.24s ease, border-color 0.24s ease, box-shadow 0.24s ease;
  -webkit-tap-highlight-color: transparent;
}

.civilization-egg-card:active {
  transform: scale(0.98);
}

.civilization-egg-card strong {
  font-size: 0.86rem;
}

.civilization-egg-card span:last-child {
  font-size: 0.72rem;
  line-height: 1.6;
  color: rgba(232, 230, 227, 0.6);
}

.civilization-egg-shell,
.egg-hatch-shell {
  position: absolute;
  inset: 22px 22px auto;
  height: 88px;
  border-radius: 48% 48% 44% 44% / 56% 56% 40% 40%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 12px 24px rgba(255, 255, 255, 0.04);
}

.civilization-egg-core,
.egg-hatch-core {
  position: absolute;
  top: 46px;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.civilization-egg-core .material-symbols-rounded,
.egg-hatch-core .material-symbols-rounded {
  font-size: 20px;
}

.civilization-egg-card--cyan:hover,
.civilization-egg-card--cyan:focus-visible {
  border-color: rgba(0, 245, 212, 0.28);
  box-shadow: 0 0 30px rgba(0, 245, 212, 0.08);
}

.civilization-egg-card--gold:hover,
.civilization-egg-card--gold:focus-visible {
  border-color: rgba(245, 166, 35, 0.28);
  box-shadow: 0 0 30px rgba(245, 166, 35, 0.08);
}

.civilization-egg-card--purple:hover,
.civilization-egg-card--purple:focus-visible {
  border-color: rgba(126, 105, 255, 0.28);
  box-shadow: 0 0 30px rgba(126, 105, 255, 0.08);
}

.civilization-egg-card--cyan .civilization-egg-core,
.egg-hatch-hero.is-cyan .egg-hatch-core {
  color: var(--neon-cyan);
  border-color: rgba(0, 245, 212, 0.22);
  background: rgba(0, 245, 212, 0.12);
}

.civilization-egg-card--gold .civilization-egg-core,
.egg-hatch-hero.is-gold .egg-hatch-core {
  color: #f5a623;
  border-color: rgba(245, 166, 35, 0.22);
  background: rgba(245, 166, 35, 0.12);
}

.civilization-egg-card--purple .civilization-egg-core,
.egg-hatch-hero.is-purple .egg-hatch-core {
  color: #7e69ff;
  border-color: rgba(126, 105, 255, 0.22);
  background: rgba(126, 105, 255, 0.12);
}

.civilization-egg-card.is-disabled,
.civilization-egg-card:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.distill-egg-scene--detail {
  align-items: stretch;
}

.egg-hatch-hero {
  position: relative;
  height: 160px;
  display: grid;
  place-items: center;
}

.egg-hatch-shell {
  inset: 18px auto auto;
  width: 112px;
  height: 124px;
  animation: hatchFloat 2.8s ease-in-out infinite;
}

.egg-hatch-core {
  top: 54px;
  width: 56px;
  height: 56px;
}

@keyframes hatchFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.output-option-list--inline {
  margin-top: 4px;
}

.seed-growth-overlay.is-collapse .seed-tree-svg {
  opacity: 0.18;
  transform: scale(0.92);
  filter: blur(2px);
  transition: all 0.6s ease;
}

.seed-growth-overlay.is-collapse .seed-fruit-group,
.seed-growth-overlay.is-collapse .seed-glow-line,
.seed-growth-overlay.is-collapse .seed-branch {
  opacity: 0.16;
}

.flow-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 64;
  display: grid;
  place-items: center;
  padding:
    calc(env(safe-area-inset-top, 0px) + 16px)
    16px
    calc(env(safe-area-inset-bottom, 0px) + 16px);
  background: rgba(4, 8, 14, 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.flow-modal {
  position: relative;
  width: min(100%, 460px);
  max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 32px);
  overflow-y: auto;
  margin: 0 auto;
  padding: 22px 18px 18px;
  border-radius: 24px;
  display: grid;
  gap: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.42);
}

.flow-modal--cinematic {
  width: 100%;
  max-width: none;
  max-height: none;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent !important;
  box-shadow: none;
  overflow: hidden;
}

.flow-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(232, 230, 227, 0.76);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.flow-modal h2 {
  margin: 0;
  padding-right: 40px;
  font-family: var(--font-display);
  font-size: 1.18rem;
  letter-spacing: 0.12em;
}

.modal-step {
  color: var(--neon-cyan);
  font-size: 0.68rem;
  letter-spacing: 0.28em;
}

.modal-copy {
  margin: -4px 0 0;
  color: rgba(232, 230, 227, 0.68);
  font-size: 0.82rem;
  line-height: 1.8;
}

.identity-field {
  display: grid;
  gap: 8px;
}

.identity-label {
  color: rgba(232, 230, 227, 0.72);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
}

.identity-input {
  width: 100%;
  min-height: 48px;
  border: 1px solid rgba(0, 245, 212, 0.22);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  color: #f4fffd;
  padding: 0 14px;
  font: inherit;
  outline: none;
}

.identity-input:focus {
  border-color: rgba(0, 245, 212, 0.58);
  box-shadow: 0 0 0 3px rgba(0, 245, 212, 0.1);
}

.identity-error {
  margin: 0;
  color: #ff6b8b;
  font-size: 0.76rem;
}

.modal-chip {
  display: grid;
  gap: 4px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(0, 245, 212, 0.07);
  border: 1px solid rgba(0, 245, 212, 0.18);
}

.modal-chip strong {
  font-size: 0.96rem;
}

.modal-chip span {
  color: rgba(232, 230, 227, 0.62);
  font-size: 0.76rem;
}

/* ─── Output option list (降临方式) ─── */
.output-option-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.output-option-card {
  width: 100%;
  appearance: none;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: all 0.25s ease;
  -webkit-tap-highlight-color: transparent;
}

.output-option-card:active {
  transform: scale(0.98);
}

.output-option-card.is-selected {
  border-color: rgba(0, 245, 212, 0.4);
  background: rgba(0, 245, 212, 0.05);
  box-shadow: 0 0 24px rgba(0, 245, 212, 0.08), inset 0 0 24px rgba(0, 245, 212, 0.03);
}

.output-option-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: all 0.25s ease;
}

.output-option-icon .material-symbols-rounded {
  font-size: 26px;
  color: var(--neon-cyan);
  transition: all 0.25s ease;
}

.output-option-icon--0 {
  background: linear-gradient(135deg, rgba(0, 245, 212, 0.12), rgba(0, 245, 212, 0.04));
  border: 1px solid rgba(0, 245, 212, 0.15);
}

.output-option-icon--1 {
  background: linear-gradient(135deg, rgba(126, 105, 255, 0.12), rgba(126, 105, 255, 0.04));
  border: 1px solid rgba(126, 105, 255, 0.15);
}

.output-option-icon--1 .material-symbols-rounded {
  color: #7e69ff;
}

.output-option-icon--2 {
  background: linear-gradient(135deg, rgba(245, 166, 35, 0.12), rgba(245, 166, 35, 0.04));
  border: 1px solid rgba(245, 166, 35, 0.15);
}

.output-option-icon--2 .material-symbols-rounded {
  color: #f5a623;
}

.output-option-card.is-selected .output-option-icon--0 {
  background: linear-gradient(135deg, rgba(0, 245, 212, 0.2), rgba(0, 245, 212, 0.08));
  box-shadow: 0 0 16px rgba(0, 245, 212, 0.15);
}

.output-option-card.is-selected .output-option-icon--1 {
  background: linear-gradient(135deg, rgba(126, 105, 255, 0.2), rgba(126, 105, 255, 0.08));
  box-shadow: 0 0 16px rgba(126, 105, 255, 0.15);
}

.output-option-card.is-selected .output-option-icon--2 {
  background: linear-gradient(135deg, rgba(245, 166, 35, 0.2), rgba(245, 166, 35, 0.08));
  box-shadow: 0 0 16px rgba(245, 166, 35, 0.15);
}

.output-option-body {
  flex: 1;
  min-width: 0;
}

.output-option-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.output-option-header strong {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
}

.output-option-check {
  display: flex;
  align-items: center;
  color: var(--neon-cyan);
  animation: checkPop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.output-option-check .material-symbols-rounded {
  font-size: 20px;
}

@keyframes checkPop {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}

.output-option-body p {
  margin: 0;
  color: rgba(232, 230, 227, 0.5);
  font-size: 0.78rem;
  line-height: 1.6;
}

.output-option-card.is-selected .output-option-body p {
  color: rgba(232, 230, 227, 0.65);
}

/* ─── Civilization option variants ─── */
.output-option-card.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: auto;
}

.output-option-card.is-disabled:active {
  transform: none;
}

.output-option-icon--civ-cyan {
  background: linear-gradient(135deg, rgba(0, 245, 212, 0.12), rgba(0, 245, 212, 0.04));
  border: 1px solid rgba(0, 245, 212, 0.15);
}

.output-option-icon--civ-gold {
  background: linear-gradient(135deg, rgba(245, 166, 35, 0.12), rgba(245, 166, 35, 0.04));
  border: 1px solid rgba(245, 166, 35, 0.15);
}

.output-option-icon--civ-gold .material-symbols-rounded {
  color: #f5a623;
}

.output-option-icon--civ-purple {
  background: linear-gradient(135deg, rgba(126, 105, 255, 0.12), rgba(126, 105, 255, 0.04));
  border: 1px solid rgba(126, 105, 255, 0.15);
}

.output-option-icon--civ-purple .material-symbols-rounded {
  color: #7e69ff;
}

.output-option-card--cyan.is-selected {
  border-color: rgba(0, 245, 212, 0.4);
  background: rgba(0, 245, 212, 0.05);
  box-shadow: 0 0 24px rgba(0, 245, 212, 0.08), inset 0 0 24px rgba(0, 245, 212, 0.03);
}

.output-option-card--gold.is-selected {
  border-color: rgba(245, 166, 35, 0.4);
  background: rgba(245, 166, 35, 0.05);
  box-shadow: 0 0 24px rgba(245, 166, 35, 0.08), inset 0 0 24px rgba(245, 166, 35, 0.03);
}

.output-option-card--cyan.is-selected .output-option-icon--civ-cyan,
.output-option-card--gold.is-selected .output-option-icon--civ-gold {
  box-shadow: 0 0 16px rgba(0, 245, 212, 0.15);
}

.output-option-card--gold.is-selected .output-option-icon--civ-gold {
  box-shadow: 0 0 16px rgba(245, 166, 35, 0.15);
}

.output-option-card--cyan.is-selected .output-option-check {
  color: var(--neon-cyan);
}

.output-option-card--gold.is-selected .output-option-check {
  color: #f5a623;
}

.output-option-badge {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.62rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  letter-spacing: 0.04em;
}

.output-option-action {
  display: inline-block;
  margin-top: 6px;
  font-size: 0.68rem;
  color: rgba(232, 230, 227, 0.3);
  letter-spacing: 0.04em;
}

.output-option-card.is-selected .output-option-action {
  color: rgba(232, 230, 227, 0.45);
}

.modal-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.modal-actions--single {
  grid-template-columns: 1fr;
}

.modal-option-grid {
  display: grid;
  gap: 10px;
}

.modal-option-grid--triple {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.modal-option-card {
  position: relative;
  display: grid;
  gap: 8px;
  align-content: start;
  min-height: 144px;
  padding: 14px 12px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  text-align: left;
  cursor: pointer;
  outline: none;
}

.modal-option-card.is-selected {
  border-color: rgba(0, 245, 212, 0.56);
  box-shadow: 0 0 18px rgba(0, 245, 212, 0.16);
}

.modal-option-card strong {
  font-size: 0.9rem;
}

.modal-option-card p {
  margin: 0;
  color: rgba(232, 230, 227, 0.64);
  font-size: 0.72rem;
  line-height: 1.65;
}

.modal-option-card--output .material-symbols-rounded {
  color: var(--neon-cyan);
}

.help-chip {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(232, 230, 227, 0.88);
  font-size: 0.74rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.help-pop {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(6, 10, 16, 0.94);
  border: 1px solid rgba(0, 245, 212, 0.22);
  color: rgba(232, 230, 227, 0.82);
  font-size: 0.68rem;
  line-height: 1.55;
  opacity: 0;
  transform: translateY(6px);
  pointer-events: none;
  transition: opacity 180ms ease, transform 180ms ease;
}

.help-pop.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.modal-option-card--civilization span {
  color: rgba(232, 230, 227, 0.54);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
}

.modal-option-card--civilization.is-gold.is-selected {
  border-color: rgba(245, 166, 35, 0.62);
  box-shadow: 0 0 18px rgba(245, 166, 35, 0.16);
}

.modal-option-card--civilization.is-purple {
  opacity: 0.72;
}

.modal-note {
  margin: -2px 0 0;
  color: #ffb4c7;
  font-size: 0.74rem;
  line-height: 1.7;
}

.selection-stage,
.entry-stage {
  padding: 18px;
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - var(--topbar-h, 48px) - var(--tab-bar-height) - var(--safe-bottom) - 24px);
  overflow: visible;
}

.chat-stage {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 0 8px;
  display: flex;
  flex-direction: column;
  background: transparent !important;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  overflow: hidden;
}

.stage-heading h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.14em;
}

.stage-heading p {
  margin: 8px 0 0;
  color: rgba(232, 230, 227, 0.66);
  line-height: 1.7;
  font-size: 0.8rem;
}

.option-grid {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.option-grid--triple {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.option-card {
  display: grid;
  gap: 8px;
  align-content: start;
  min-height: 132px;
  padding: 14px 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  text-align: left;
}

.option-card.is-selected {
  border-color: rgba(0, 245, 212, 0.56);
  box-shadow: 0 0 18px rgba(0, 245, 212, 0.16);
}

.option-card .material-symbols-rounded {
  color: var(--neon-cyan);
}

.option-card strong {
  font-size: 0.9rem;
}

.option-card p {
  margin: 0;
  color: rgba(232, 230, 227, 0.62);
  font-size: 0.7rem;
  line-height: 1.65;
}

.option-card--civilization span {
  color: rgba(232, 230, 227, 0.54);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
}

.option-card--civilization.is-gold.is-selected {
  border-color: rgba(245, 166, 35, 0.62);
  box-shadow: 0 0 18px rgba(245, 166, 35, 0.16);
}

.option-card--civilization.is-purple.is-selected,
.option-card--civilization.is-disabled {
  opacity: 0.72;
}

.entry-callout {
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: 12px;
  margin-top: 14px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(0, 245, 212, 0.06);
  border: 1px solid rgba(0, 245, 212, 0.16);
}

.entry-callout span {
  color: var(--neon-cyan);
  font-size: 1.35rem;
}

.entry-callout strong {
  display: block;
  margin-bottom: 4px;
}

.entry-callout p,
.draft-hint {
  margin: 0;
  color: rgba(232, 230, 227, 0.68);
  font-size: 0.76rem;
  line-height: 1.7;
}

.entry-btn {
  width: 100%;
  margin-top: 16px;
  justify-content: center;
}

.memory-textarea {
  width: 100%;
  min-height: 118px;
  margin-top: 14px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-primary);
  font: inherit;
  line-height: 1.75;
  resize: vertical;
}

.upload-zone {
  width: 100%;
  margin-top: 12px;
  padding: 18px 14px;
  border-radius: 16px;
  border: 1px dashed rgba(245, 166, 35, 0.36);
  background: rgba(245, 166, 35, 0.04);
  display: grid;
  gap: 6px;
  justify-items: center;
}

.upload-zone span {
  color: var(--neon-gold);
  font-size: 1.7rem;
}

.upload-zone strong {
  font-size: 0.92rem;
}

.upload-zone p {
  margin: 0;
  color: rgba(232, 230, 227, 0.6);
  font-size: 0.74rem;
}

.hidden-input {
  display: none;
}

.memory-files {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.memory-file {
  display: grid;
  grid-template-columns: 18px 1fr 28px;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
}

.memory-file span:first-child {
  color: var(--neon-gold);
}

.memory-file span:nth-child(2) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.74rem;
}

.memory-file button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: rgba(232, 230, 227, 0.5);
}

/* ===== Vessel Constellation — Natural Scattered Avatars ===== */
.vessel-constellation {
  position: relative;
  width: 100%;
  height: calc(100vh - 180px);
  min-height: 400px;
  overflow: hidden;
  background: transparent;
}

/* Central avatar — largest, brightest focal point */
.constellation-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 3;
  opacity: 0;
  animation: centerPop 0.6s 0.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.constellation-center-ring {
  width: 96px;
  height: 96px;
  border-radius: 999px;
  padding: 3px;
  border: 2px solid rgba(230, 57, 70, 0.5);
  box-shadow: 0 0 24px rgba(230, 57, 70, 0.3), 0 0 48px rgba(230, 57, 70, 0.1);
  animation: centerPulse 3s ease-in-out infinite;
}

.constellation-center-ring img {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  object-fit: cover;
  background: #0a0508;
}

.constellation-center-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(232, 230, 227, 0.7);
  letter-spacing: 0.08em;
}

@keyframes centerPop {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes centerPulse {
  0%, 100% { box-shadow: 0 0 24px rgba(230, 57, 70, 0.3), 0 0 48px rgba(230, 57, 70, 0.1); }
  50% { box-shadow: 0 0 32px rgba(230, 57, 70, 0.5), 0 0 64px rgba(230, 57, 70, 0.2); }
}

/* Skill avatars — bright foreground, real avatar images */
.constellation-skill-avatar {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  z-index: 4;
  opacity: 0;
  transform: scale(0.4);
  animation: skillAvatarIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  transition: transform 0.2s ease;
}

.constellation-skill-avatar:active {
  transform: scale(0.9) !important;
}

.constellation-skill-avatar.is-selected .skill-avatar-ring {
  box-shadow: 0 0 20px rgba(0, 245, 212, 0.4), 0 0 6px rgba(0, 245, 212, 0.6);
  border-color: rgba(0, 245, 212, 0.6);
}

.skill-avatar-ring {
  width: 64px;
  height: 64px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  overflow: hidden;
  display: block;
  transition: all 0.3s ease;
}

.skill-avatar-ring img {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  object-fit: cover;
}

@keyframes skillAvatarIn {
  from { opacity: 0; transform: scale(0.4); }
  to { opacity: 1; transform: scale(1); }
}

/* Background unknown avatars — blurred & dimmed, scattered */
.constellation-bg-avatar {
  position: absolute;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  overflow: hidden;
  z-index: 1;
  opacity: 0;
  filter: blur(2px) brightness(0.3);
  animation: bgAvatarFadeIn 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  pointer-events: none;
}

.constellation-bg-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  object-fit: cover;
}

@keyframes bgAvatarFadeIn {
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 0.45; transform: scale(1); }
}

/* Constellation bottom chat input */
.constellation-composer {
  position: fixed;
  bottom: var(--tab-bar-height);
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  padding-bottom: calc(8px + var(--safe-bottom, 0px));
  background: linear-gradient(to top, rgba(4, 4, 10, 0.98) 70%, rgba(4, 4, 10, 0.8));
  border-top: 1px solid rgba(0, 245, 212, 0.08);
}

.constellation-input {
  flex: 1;
  min-height: 38px;
  max-height: 80px;
  padding: 8px 14px;
  font-size: 0.82rem;
  line-height: 1.4;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(0, 245, 212, 0.15);
  border-radius: 20px;
  outline: none;
  resize: none;
  font-family: inherit;
  transition: border-color 0.2s ease;
}

.constellation-input::placeholder {
  color: var(--text-tertiary);
}

.constellation-input:focus {
  border-color: rgba(0, 245, 212, 0.4);
  box-shadow: 0 0 12px rgba(0, 245, 212, 0.1);
}

.constellation-send {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 0;
}

.constellation-send .material-symbols-rounded {
  font-size: 18px;
}

.constellation-send:disabled {
  opacity: 0.3;
}

.chat-stage-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 0 0 auto;
}

.chat-stage-topline {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* ─── Compact skill icon strip ─── */
.chat-skill-strip {
  display: flex;
  gap: 8px;
  align-items: center;
}

.chat-skill-strip-item {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  background: transparent;
  appearance: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.chat-skill-strip-item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 245, 212, 0.26);
}

.chat-skill-strip-item:active {
  transform: scale(0.9);
}

.chat-skill-strip-item.is-active {
  box-shadow: 0 0 0 2px rgba(0, 245, 212, 0.4);
}

.chat-skill-strip-icon {
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.chat-skill-strip-icon::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(6, 8, 14, 0.06), rgba(6, 8, 14, 0.48));
}

.chat-skill-strip-icon-label {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  margin: 0 0 4px 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #111827;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
  box-shadow: 0 3px 8px rgba(6, 8, 14, 0.28);
}

.chat-stage-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(0, 245, 212, 0.12);
  border: 1px solid rgba(0, 245, 212, 0.14);
  color: var(--neon-cyan);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.chat-stage-badge--muted {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.07);
  color: rgba(232, 230, 227, 0.72);
}

.chat-stage-badge--skill {
  background: rgba(245, 166, 35, 0.12);
  border-color: rgba(245, 166, 35, 0.22);
  color: var(--neon-gold);
}

.gentle-progress {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(0, 245, 212, 0.1);
  color: var(--neon-cyan);
  font-size: 0.72rem;
  white-space: nowrap;
}

.starter-prompts {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
  overflow-x: auto;
  margin-top: 10px;
  padding-bottom: 4px;
}

.starter-prompts button {
  flex: 0 0 auto;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(232, 230, 227, 0.78);
  font-size: 0.72rem;
}

.chat-messages {
  display: grid;
  gap: 12px;
  align-content: start;
  flex: 1 1 auto;
  min-height: 0;
  margin-top: 10px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 2px 12px 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.16) transparent;
}

.chat-message {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  max-width: 88%;
  line-height: 1.78;
  font-size: 0.82rem;
}

.chat-message.is-user {
  justify-self: end;
  flex-direction: row-reverse;
}

.chat-message.is-assistant {
  justify-self: start;
}

.chat-msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
  margin-top: 2px;
  background: #0a0a12;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.chat-msg-avatar--target {
  display: block;
  object-fit: cover;
}

.chat-msg-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chat-msg-name {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.35);
  padding-left: 2px;
}

.chat-msg-body p {
  margin: 0;
  white-space: pre-wrap;
  padding: 10px 14px;
  border-radius: 16px;
}

.chat-message.is-user .chat-msg-body p {
  background: rgba(0, 245, 212, 0.14);
  border: 1px solid rgba(0, 245, 212, 0.18);
}

.chat-message.is-assistant .chat-msg-body p {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.chat-action-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 16px;
  background:
    radial-gradient(circle at top right, rgba(0, 245, 212, 0.12), transparent 34%),
    rgba(255, 255, 255, 0.055);
  border: 1px solid rgba(0, 245, 212, 0.18);
}

.chat-action-card.is-loading {
  border-color: rgba(48, 209, 88, 0.34);
  background:
    linear-gradient(90deg, rgba(48, 209, 88, 0.08), rgba(0, 245, 212, 0.1), rgba(48, 209, 88, 0.08)),
    rgba(255, 255, 255, 0.055);
  background-size: 220% 100%;
  animation: report-card-scan 1.35s linear infinite;
}

.chat-action-card-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.chat-action-card-copy strong {
  color: #f4fffd;
  font-size: 0.82rem;
  line-height: 1.35;
}

.chat-action-card-copy span {
  color: rgba(232, 230, 227, 0.7);
  font-size: 0.72rem;
  line-height: 1.5;
}

.chat-action-card-btn {
  min-width: 108px;
  min-height: 38px;
  padding-inline: 12px;
  justify-content: center;
  flex: 0 0 auto;
}

.chat-action-spinner {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.38);
  border-top-color: #ffffff;
  animation: report-spinner 0.72s linear infinite;
}

@keyframes report-spinner {
  to {
    transform: rotate(360deg);
  }
}

@keyframes report-card-scan {
  from {
    background-position: 0% 50%;
  }
  to {
    background-position: 220% 50%;
  }
}

.chat-status,
.chat-error {
  flex: 0 0 auto;
  margin: 12px 0 10px;
  font-size: 0.74rem;
  line-height: 1.7;
}

.chat-status {
  color: rgba(232, 230, 227, 0.62);
}

.chat-error {
  color: #ff8ea4;
}

.chat-error--inline {
  margin: 0;
  text-align: center;
}

.report-confirm-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  align-self: start;
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 16px;
  background:
    radial-gradient(circle at top right, rgba(0, 245, 212, 0.12), transparent 34%),
    rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(0, 245, 212, 0.16);
}

.report-confirm-copy {
  display: grid;
  gap: 6px;
}

.report-confirm-copy strong {
  font-size: 0.9rem;
  color: #f4fffd;
}

.report-confirm-copy p {
  margin: 0;
  color: rgba(232, 230, 227, 0.72);
  font-size: 0.76rem;
  line-height: 1.5;
}

.report-confirm-btn {
  width: auto;
  min-width: 120px;
  justify-content: center;
  flex: 0 0 auto;
}

@media (max-width: 767px) {
  .report-confirm-card {
    align-items: stretch;
    padding: 10px;
  }

  .chat-action-card {
    align-items: stretch;
    padding: 10px;
  }

  .chat-action-card-btn {
    min-width: 96px;
  }

  .report-confirm-copy {
    min-width: 0;
  }

  .report-confirm-copy p {
    font-size: 0.7rem;
  }

  .report-confirm-btn {
    min-width: 96px;
    padding-inline: 12px;
  }
}

.chat-attachments {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.chat-attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.chat-attachment-chip > span:first-child {
  color: var(--neon-cyan);
  font-size: 18px;
}

.chat-attachment-chip > span:nth-child(2) {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.72rem;
  color: rgba(232, 230, 227, 0.82);
}

.chat-attachment-chip button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  padding: 0;
  background: transparent;
  color: rgba(232, 230, 227, 0.54);
}

.chat-footer {
  flex: 0 0 auto;
  width: 100%;
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 6px 0 0;
  background: transparent;
  isolation: isolate;
}

@media (max-width: 767px) {
  .chat-stage {
    padding: 0 0 8px;
  }

}

.chat-inline-menus {
  display: flex;
  gap: 8px;
  align-items: center;
  overflow: visible;
  padding: 0 0 2px;
}

.chat-inline-menu {
  position: relative;
  flex: 0 0 auto;
}

.chat-inline-menu-trigger {
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(58, 58, 62, 0.52);
  color: rgba(244, 244, 246, 0.9);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.chat-inline-menu-trigger.is-open {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(66, 66, 70, 0.88);
}

.chat-inline-menu-label {
  font-size: 0.66rem;
  color: rgba(232, 230, 227, 0.48);
}

.chat-inline-menu-value {
  font-size: 0.7rem;
  color: inherit;
}

.chat-inline-menu-trigger .material-symbols-rounded {
  font-size: 16px;
  color: rgba(232, 230, 227, 0.82);
}

.chat-inline-menu-pop {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  z-index: 48;
  min-width: 118px;
  padding: 10px 0;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(46, 46, 48, 0.96);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.chat-inline-menu-pop-item {
  width: 100%;
  min-height: 46px;
  padding: 0 18px;
  border: 0;
  background: transparent;
  color: rgba(250, 250, 252, 0.96);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 0.9rem;
  text-align: left;
}

.chat-inline-menu-pop-item.is-selected {
  color: #ffffff;
}

.chat-inline-menu-pop-item .material-symbols-rounded {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.92);
}

.chat-inline-menu-pop-item.is-disabled {
  opacity: 0.34;
}

.chat-composer {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  padding: 6px 8px;
  border-radius: 28px;
  background: rgba(18, 18, 30, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.chat-input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  min-height: 42px;
  height: 42px;
  max-height: 112px;
  margin-top: 0;
  padding: 10px 14px;
  border-radius: 22px;
  border: 0;
  background: transparent;
  line-height: 1.5;
  resize: none;
  overflow-y: auto;
}

.chat-send {
  min-width: 58px;
  min-height: 42px;
  padding: 0 12px;
  justify-content: center;
  border-radius: 22px;
  white-space: nowrap;
  letter-spacing: 0;
}

.chat-tool-btn {
  width: 42px;
  height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(232, 230, 227, 0.86);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chat-tool-btn .material-symbols-rounded {
  font-size: 22px;
}

.chat-tool-btn--attach {
  color: rgba(232, 230, 227, 0.92);
}

@media (max-width: 767px) {
  .chat-composer {
    grid-template-columns: 40px minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px;
    min-height: 50px;
    padding: 5px 6px;
    border-radius: 26px;
  }

  .chat-input {
    min-height: 40px;
    height: 40px;
    padding: 9px 12px;
    font-size: 0.78rem;
    line-height: 1.4;
  }

  .chat-send {
    min-width: 56px;
    min-height: 40px;
    padding: 0 12px;
    font-size: 0.82rem;
    letter-spacing: 0;
  }

  .chat-tool-btn {
    width: 40px;
    height: 40px;
  }
}

.transition-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  text-align: center;
  background: radial-gradient(ellipse at 50% 30%, rgba(20, 5, 8, 0.95), rgba(4, 4, 10, 0.98));
  backdrop-filter: blur(16px);
  overflow: hidden;
}

/* ===== Vessel Scene ===== */
.vessel-scene {
  position: relative;
  width: min(85vw, 320px);
  height: min(70vh, 480px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

/* ===== Avatar ===== */
.vessel-avatar {
  position: absolute;
  top: 2%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
}

.vessel-avatar-ring {
  width: 64px;
  height: 64px;
  border-radius: 999px;
  padding: 2px;
  border: 2px solid rgba(230, 57, 70, 0.6);
  box-shadow: 0 0 20px rgba(230, 57, 70, 0.3), 0 0 40px rgba(230, 57, 70, 0.1);
  animation: avatarPulse 2s ease-in-out infinite;
}

.vessel-avatar-ring img {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  object-fit: cover;
  background: #0a0508;
}

.vessel-avatar-pulse {
  position: absolute;
  inset: -8px;
  border-radius: 999px;
  border: 1px solid rgba(230, 57, 70, 0.2);
  animation: avatarRingExpand 2.5s ease-out infinite;
}

/* ===== Vessel SVG ===== */
.vessel-svg {
  width: 100%;
  height: 100%;
}

/* Trunk - main red vessel growing down */
.vessel-trunk {
  fill: none;
  stroke: url(#vGradMain);
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-dasharray: 220;
  stroke-dashoffset: 220;
  animation: trunkGrow 1.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

/* Branches - fork out from trunk end */
.vessel-branch {
  fill: none;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-dasharray: 250;
  stroke-dashoffset: 250;
  animation: branchGrow 1.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.vessel-branch--left {
  stroke: url(#vGradL);
  animation-delay: 1.6s;
}

.vessel-branch--center {
  stroke: url(#vGradC);
  animation-delay: 2.0s;
}

.vessel-branch--right {
  stroke: url(#vGradR);
  animation-delay: 2.4s;
}

/* Capillaries - small side branches on trunk */
.vessel-cap {
  fill: none;
  stroke: rgba(193, 18, 31, 0.5);
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-dasharray: 60;
  stroke-dashoffset: 60;
  animation: capillaryGrow 0.8s ease forwards;
}

.vessel-cap--1 { animation-delay: 0.8s; }
.vessel-cap--2 { animation-delay: 1.1s; }
.vessel-cap--3 { animation-delay: 1.4s; }

/* Fruits - appear after branches reach their ends */
.vessel-fruit {
  opacity: 0;
  animation: fruitAppear 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.vessel-fruit--left { animation-delay: 3.0s; }
.vessel-fruit--center { animation-delay: 3.4s; }
.vessel-fruit--right { animation-delay: 3.8s; }

.vessel-fruit-core {
  opacity: 0;
  animation: coreGlow 0.6s ease forwards;
}

.vessel-fruit-core--left { animation-delay: 3.4s; }
.vessel-fruit-core--center { animation-delay: 3.8s; }
.vessel-fruit-core--right { animation-delay: 4.2s; }

/* ===== Title & Copy ===== */
.vessel-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.14em;
  color: rgba(232, 230, 227, 0.9);
  opacity: 0;
  animation: textFadeIn 0.8s 3.5s ease forwards;
}

.vessel-copy {
  margin: 0;
  max-width: 260px;
  color: rgba(232, 230, 227, 0.5);
  line-height: 1.8;
  font-size: 0.78rem;
  opacity: 0;
  animation: textFadeIn 0.8s 3.8s ease forwards;
}

/* ===== Vessel Keyframes ===== */
@keyframes trunkGrow {
  to { stroke-dashoffset: 0; }
}

@keyframes branchGrow {
  to { stroke-dashoffset: 0; }
}

@keyframes capillaryGrow {
  to { stroke-dashoffset: 0; }
}

@keyframes fruitAppear {
  0% { opacity: 0; r: 4; }
  60% { opacity: 0.8; r: 22; }
  100% { opacity: 1; r: 18; }
}

@keyframes coreGlow {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes avatarPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(230, 57, 70, 0.3), 0 0 40px rgba(230, 57, 70, 0.1); }
  50% { box-shadow: 0 0 28px rgba(230, 57, 70, 0.5), 0 0 56px rgba(230, 57, 70, 0.2); }
}

@keyframes avatarRingExpand {
  0% { transform: scale(1); opacity: 0.4; }
  100% { transform: scale(1.6); opacity: 0; }
}

@keyframes textFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes hostBreath {
  0%, 100% {
    box-shadow: 0 14px 42px rgba(0, 0, 0, 0.28), 0 0 24px rgba(0, 245, 212, 0.08);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 16px 46px rgba(0, 0, 0, 0.32), 0 0 36px rgba(0, 245, 212, 0.16);
    transform: scale(1.018);
  }
}

@keyframes idleVortexReveal {
  from {
    opacity: 0;
    transform: translateX(-50%) scale(0.42);
    filter: blur(8px) saturate(0.7);
  }
  to {
    opacity: 0.72;
    transform: translateX(-50%) scale(0.94);
    filter: saturate(0.86) brightness(0.92);
  }
}

@keyframes idleVortexRipple {
  0% {
    opacity: 0;
    transform: scale(0.22) rotate(-30deg);
    filter: blur(4px);
  }
  18% {
    opacity: 0.72;
    filter: blur(0);
  }
  58% {
    opacity: 0.22;
  }
  100% {
    opacity: 0;
    transform: scale(1.48) rotate(168deg);
    filter: blur(2px);
  }
}

@keyframes idleVortexSpiral {
  to {
    transform: rotate(360deg);
  }
}

@keyframes idleVortexSpiralFade {
  0%, 100% {
    opacity: 0.1;
  }
  38%, 72% {
    opacity: 0.62;
  }
}

@keyframes idleVortexSpark {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--spark-angle, 0deg)) translateX(0) scale(0.3);
  }
  20% {
    opacity: 0.94;
  }
  70% {
    opacity: 0.28;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--spark-angle, 0deg)) translateX(var(--spark-distance, 140px)) scale(0.86);
  }
}

@keyframes idleMainSkillArrival {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.84);
    filter: blur(5px);
  }
  64% {
    opacity: 1;
    transform: translateY(-2px) scale(1.04);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@keyframes idleMainSkillHalo {
  0%, 100% {
    opacity: 0.4;
    transform: translateX(-50%) scale(0.92);
  }
  50% {
    opacity: 0.72;
    transform: translateX(-50%) scale(1.08);
  }
}

@keyframes loadingSkillFocus {
  0%, 100% {
    filter: saturate(0.92) brightness(0.94);
  }
  50% {
    filter: saturate(1.12) brightness(1.08);
  }
}

@keyframes recommendedPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(0, 245, 212, 0.12), 0 10px 28px rgba(0, 0, 0, 0.24);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(0, 245, 212, 0), 0 0 28px rgba(0, 245, 212, 0.22), 0 12px 30px rgba(0, 0, 0, 0.28);
    transform: scale(1.05);
  }
}

@keyframes socialSkillAvatarSpawn {
  0% {
    opacity: 0;
    transform: scale(0.52);
    filter: blur(8px);
  }
  62% {
    opacity: 1;
    transform: scale(1.08);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }
}

@keyframes idleAuxSkillAvatarReveal {
  0% {
    opacity: 0;
    transform: translate(var(--idle-enter-x, 0), var(--idle-enter-y, 0)) rotate(-16deg) scale(0.2);
    filter: blur(12px) brightness(1.9);
  }
  54% {
    opacity: 1;
    transform: translate(calc(var(--idle-enter-x, 0) * 0.12), calc(var(--idle-enter-y, 0) * 0.2)) rotate(5deg) scale(1.08);
    filter: blur(0) brightness(1.18);
  }
  100% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg) scale(1);
    filter: blur(0) brightness(1);
  }
}

@keyframes idleAuxSignalLine {
  0% {
    opacity: 0;
    transform: translateX(calc(var(--idle-enter-x, 0) * -0.32)) scaleX(0.12);
  }
  42% {
    opacity: 0.84;
  }
  100% {
    opacity: 0;
    transform: translateX(calc(var(--idle-enter-x, 0) * -0.08)) scaleX(1);
  }
}

@keyframes idleAuxSkillFloat {
  0%, 100% {
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24), 0 0 0 rgba(0, 245, 212, 0);
    filter: brightness(1);
  }
  50% {
    box-shadow: 0 13px 32px rgba(0, 0, 0, 0.28), 0 0 18px rgba(0, 245, 212, 0.12);
    filter: brightness(1.06);
  }
}

@keyframes socialSkillAvatarReveal {
  from {
    opacity: 0;
    transform: scale(0.42);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }
}

@keyframes tapGuideBounce {
  0%, 100% {
    transform: translateY(0) scale(1);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
  }
  45% {
    transform: translateY(-4px) scale(1.06);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.26);
  }
  60% {
    transform: translateY(1px) scale(0.98);
  }
}

@media (max-width: 380px) {
  .title-area h1 {
    letter-spacing: 0.18em;
  }

  .distill-system-stage {
    min-height: calc(100dvh - 204px - var(--tab-bar-height) - var(--safe-bottom));
  }

  .distill-system-line {
    font-size: 0.96rem;
  }
}

@media (max-width: 430px) {
  .flow-modal-backdrop {
    padding:
      calc(env(safe-area-inset-top, 0px) + 12px)
      12px
      calc(env(safe-area-inset-bottom, 0px) + 12px);
  }

  .flow-modal {
    width: min(100%, 392px);
    max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 24px);
    padding: 20px 16px 16px;
    border-radius: 22px;
  }

  .modal-option-grid--triple,
  .modal-actions {
    grid-template-columns: 1fr;
  }
}

/* ===== Cinematic Output Mode ===== */
.flow-modal-backdrop.is-cinematic {
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: rgba(6, 6, 12, 0.97);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
}

.cinematic-output {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 24px;
  overflow: hidden;
}

/* Particles */
.cinematic-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.cinematic-particle {
  position: absolute;
  width: var(--size, 3px);
  height: var(--size, 3px);
  border-radius: 50%;
  background: var(--neon-cyan);
  opacity: 0;
  top: 50%;
  left: 50%;
  animation: particleFly 2.5s var(--delay, 0s) ease-out forwards;
}

@keyframes particleFly {
  0% { opacity: 0; transform: translate(0, 0) scale(0); }
  20% { opacity: 0.8; transform: translate(calc(var(--dx) * 0.3), calc(var(--dy) * 0.3)) scale(1); }
  100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.3); }
}

/* Portal gate */
.cinematic-portal {
  position: relative;
  width: 120px;
  height: 120px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.cinematic-portal-ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid transparent;
}

.cinematic-portal-ring--outer {
  inset: 0;
  border-color: rgba(0, 245, 212, 0.15);
  animation: portalSpin 4s linear infinite, portalPulseOuter 2s ease-in-out infinite;
}

.cinematic-portal-ring--inner {
  inset: 16px;
  border-color: rgba(0, 245, 212, 0.3);
  border-style: dashed;
  animation: portalSpin 3s linear infinite reverse, portalPulseInner 2s ease-in-out infinite;
}

@keyframes portalSpin {
  to { transform: rotate(360deg); }
}

@keyframes portalPulseOuter {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.08); opacity: 1; }
}

@keyframes portalPulseInner {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(0.92); opacity: 1; }
}

.cinematic-portal-core {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 245, 212, 0.2), rgba(0, 245, 212, 0.05));
  border: 1px solid rgba(0, 245, 212, 0.25);
  display: grid;
  place-items: center;
  animation: coreGlowCinematic 2s ease-in-out infinite;
  z-index: 1;
}

.cinematic-portal-core .material-symbols-rounded {
  font-size: 28px;
  color: var(--neon-cyan);
}

@keyframes coreGlowCinematic {
  0%, 100% { box-shadow: 0 0 20px rgba(0, 245, 212, 0.1), inset 0 0 10px rgba(0, 245, 212, 0.05); }
  50% { box-shadow: 0 0 40px rgba(0, 245, 212, 0.25), inset 0 0 20px rgba(0, 245, 212, 0.1); }
}

/* Phase entrance: portal scales in */
.cinematic-phase--entrance .cinematic-portal {
  animation: portalEntrance 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes portalEntrance {
  0% { transform: scale(0) rotate(-180deg); opacity: 0; }
  60% { transform: scale(1.1) rotate(10deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

/* AI text area */
.cinematic-text-area {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 420px;
  width: 100%;
  opacity: 0;
  transform: translateY(12px);
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.cinematic-phase--welcome .cinematic-text-area,
.cinematic-phase--choice .cinematic-text-area,
.cinematic-phase--confirm .cinematic-text-area {
  opacity: 1;
  transform: translateY(0);
}

.cinematic-ai-avatar {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(0, 245, 212, 0.15), rgba(0, 245, 212, 0.05));
  border: 1px solid rgba(0, 245, 212, 0.2);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.cinematic-ai-avatar .material-symbols-rounded {
  font-size: 18px;
  color: var(--neon-cyan);
}

.cinematic-bubble {
  flex: 1;
  padding: 12px 16px;
  border-radius: 4px 16px 16px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.85rem;
  line-height: 1.7;
  color: var(--text-primary);
  min-height: 24px;
}

.cinematic-cursor {
  display: inline-block;
  color: var(--neon-cyan);
  font-weight: 300;
  animation: cursorBlink 0.6s step-end infinite;
  margin-left: 1px;
}

@keyframes cursorBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Choice cards */
.cinematic-output > .cinematic-choice-card {
  /* TransitionGroup container children */
}

.cinematic-choice-card {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 420px;
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: all 0.3s ease;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  overflow: hidden;
}

.cinematic-choice-card::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.cinematic-choice-card:active {
  transform: scale(0.98);
}

/* Color variants */
.cinematic-choice--cyan::before {
  background: linear-gradient(135deg, rgba(0, 245, 212, 0.06), transparent);
}
.cinematic-choice--cyan .cinematic-choice-icon {
  background: linear-gradient(135deg, rgba(0, 245, 212, 0.15), rgba(0, 245, 212, 0.05));
  border-color: rgba(0, 245, 212, 0.2);
}
.cinematic-choice--cyan .cinematic-choice-icon .material-symbols-rounded { color: var(--neon-cyan); }
.cinematic-choice--cyan:hover, .cinematic-choice--cyan.is-confirmed {
  border-color: rgba(0, 245, 212, 0.35);
  box-shadow: 0 0 30px rgba(0, 245, 212, 0.08);
}
.cinematic-choice--cyan:hover::before, .cinematic-choice--cyan.is-confirmed::before { opacity: 1; }

.cinematic-choice--purple::before {
  background: linear-gradient(135deg, rgba(126, 105, 255, 0.06), transparent);
}
.cinematic-choice--purple .cinematic-choice-icon {
  background: linear-gradient(135deg, rgba(126, 105, 255, 0.15), rgba(126, 105, 255, 0.05));
  border-color: rgba(126, 105, 255, 0.2);
}
.cinematic-choice--purple .cinematic-choice-icon .material-symbols-rounded { color: #7e69ff; }
.cinematic-choice--purple:hover, .cinematic-choice--purple.is-confirmed {
  border-color: rgba(126, 105, 255, 0.35);
  box-shadow: 0 0 30px rgba(126, 105, 255, 0.08);
}
.cinematic-choice--purple:hover::before, .cinematic-choice--purple.is-confirmed::before { opacity: 1; }

.cinematic-choice--gold::before {
  background: linear-gradient(135deg, rgba(245, 166, 35, 0.06), transparent);
}
.cinematic-choice--gold .cinematic-choice-icon {
  background: linear-gradient(135deg, rgba(245, 166, 35, 0.15), rgba(245, 166, 35, 0.05));
  border-color: rgba(245, 166, 35, 0.2);
}
.cinematic-choice--gold .cinematic-choice-icon .material-symbols-rounded { color: #f5a623; }
.cinematic-choice--gold:hover, .cinematic-choice--gold.is-confirmed {
  border-color: rgba(245, 166, 35, 0.35);
  box-shadow: 0 0 30px rgba(245, 166, 35, 0.08);
}
.cinematic-choice--gold:hover::before, .cinematic-choice--gold.is-confirmed::before { opacity: 1; }

.cinematic-choice-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 1px solid;
  transition: all 0.3s ease;
}

.cinematic-choice-icon .material-symbols-rounded {
  font-size: 24px;
  transition: all 0.3s ease;
}

.cinematic-choice-body {
  flex: 1;
  min-width: 0;
}

.cinematic-choice-body strong {
  display: block;
  font-size: 0.92rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}

.cinematic-choice-body p {
  margin: 0;
  font-size: 0.74rem;
  color: rgba(232, 230, 227, 0.5);
  line-height: 1.6;
}

.cinematic-choice-card.is-confirmed .cinematic-choice-body p {
  color: rgba(232, 230, 227, 0.7);
}

.cinematic-choice-card.is-dimmed {
  opacity: 0.3;
  transform: scale(0.97);
  pointer-events: none;
}

.cinematic-choice-check {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  color: var(--neon-cyan);
  animation: checkPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.cinematic-choice-check .material-symbols-rounded {
  font-size: 22px;
}

/* Card transition */
.cinematic-card-enter-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.cinematic-card-leave-active {
  transition: all 0.3s ease-in;
}
.cinematic-card-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
.cinematic-card-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

/* Close button */
.cinematic-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.cinematic-close:active {
  background: rgba(255, 255, 255, 0.1);
}

.cinematic-close .material-symbols-rounded {
  font-size: 20px;
}

/* Portal shrink after choice */
.cinematic-phase--choice .cinematic-portal,
.cinematic-phase--confirm .cinematic-portal {
  transform: scale(0.7);
  opacity: 0.5;
  transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ===== Seed Growth Animation ===== */
.seed-growth-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 20;
  pointer-events: none;
  overflow: hidden;
}

/* Overlay transition */
.seed-overlay-enter-active { transition: opacity 0.5s ease; }
.seed-overlay-leave-active { transition: opacity 0.4s ease; }
.seed-overlay-enter-from, .seed-overlay-leave-to { opacity: 0; }

/* ===== Background Particles ===== */
.seed-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.seed-particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--ps);
  height: var(--ps);
  border-radius: 50%;
  background: var(--neon-cyan);
  opacity: 0;
  animation: particleSpiral var(--pdu) ease-in-out var(--pd) forwards;
}

@keyframes particleSpiral {
  0% {
    transform: translate(0, 0) scale(0);
    opacity: 0;
  }
  30% {
    opacity: 0.8;
    transform: translate(calc(var(--px) * 0.6), calc(var(--py) * 0.6)) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(var(--px), var(--py)) scale(0.3);
  }
}

/* ===== Skill Card States ===== */
.social-skill.is-absorbing {
  animation: skillAbsorbing 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
  z-index: 15 !important;
}

@keyframes skillAbsorbing {
  0% { transform: translateY(0) scale(1); opacity: 1; filter: brightness(1); }
  30% { transform: translateY(-10px) scale(1.08); opacity: 1; filter: brightness(1.5); }
  60% { transform: translateY(5vh) scale(0.7); opacity: 0.8; filter: brightness(2) hue-rotate(30deg); }
  100% { transform: translateY(50%) scale(0.05); opacity: 0; filter: brightness(3); }
}

.social-skill.is-absorbed {
  opacity: 0 !important;
  transform: scale(0.05) !important;
  pointer-events: none !important;
  transition: all 0.3s ease !important;
}

.social-skill.is-dimmed {
  opacity: 0.12 !important;
  filter: blur(3px) grayscale(0.5);
  transition: all 0.8s ease !important;
}

/* ===== Vortex Portal ===== */
.seed-vortex {
  position: absolute;
  width: 200px;
  height: 200px;
  display: grid;
  place-items: center;
  opacity: 0;
  transform: scale(0.2) rotate(-180deg);
  transition: all 1.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.seed-vortex.is-appearing {
  opacity: 1;
  transform: scale(1) rotate(0deg);
  animation: vortexSpinSlow 3s linear infinite;
}

.seed-vortex.is-absorbing {
  opacity: 1;
  transform: scale(1.4);
  animation: vortexSpinFast 0.6s linear infinite;
  filter: brightness(1.8);
}

.seed-vortex.is-collapsing {
  opacity: 0;
  transform: scale(0) rotate(360deg);
  transition: all 1s cubic-bezier(0.4, 0, 1, 1);
}

@keyframes vortexSpinSlow {
  to { transform: rotate(360deg); }
}

@keyframes vortexSpinFast {
  to { transform: rotate(720deg); }
}

.seed-vortex-ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid transparent;
}

.seed-vortex-ring--1 {
  inset: 0;
  border-color: rgba(0, 245, 212, 0.4);
  border-style: dashed;
  border-width: 3px;
  animation: vortexPulse 1.2s ease-in-out infinite;
}

.seed-vortex-ring--2 {
  inset: 14px;
  border-color: rgba(0, 245, 212, 0.55);
  border-width: 3px;
  animation: vortexPulse 0.9s ease-in-out infinite reverse;
}

.seed-vortex-ring--3 {
  inset: 32px;
  border-color: rgba(245, 166, 35, 0.45);
  border-style: dotted;
  border-width: 2.5px;
  animation: vortexPulse 1.4s ease-in-out infinite 0.3s;
}

.seed-vortex-ring--4 {
  inset: 48px;
  border-color: rgba(126, 105, 255, 0.5);
  border-width: 2px;
  animation: vortexPulse 0.7s ease-in-out infinite reverse 0.2s;
}

@keyframes vortexPulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.12); opacity: 1; }
}

.seed-vortex-core {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 245, 212, 0.45), rgba(0, 245, 212, 0.08));
  border: 2px solid rgba(0, 245, 212, 0.5);
  display: grid;
  place-items: center;
  box-shadow:
    0 0 60px rgba(0, 245, 212, 0.35),
    0 0 120px rgba(0, 245, 212, 0.15),
    inset 0 0 30px rgba(0, 245, 212, 0.2);
}

.seed-vortex-avatar {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(0, 245, 212, 0.15);
  border: 1.5px solid rgba(0, 245, 212, 0.35);
  box-shadow: 0 0 20px rgba(0, 245, 212, 0.2);
}

/* ===== Seed Pod ===== */
.seed-pod {
  position: absolute;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  opacity: 0;
  transform: scale(0);
  transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.seed-pod.is-forming {
  opacity: 1;
  transform: scale(1);
  animation: seedPulse 1.2s ease-in-out infinite;
}

.seed-pod.is-sprouting {
  opacity: 1;
  transform: scale(1.3);
  animation: seedCrackOpen 1.2s ease-out forwards;
}

.seed-pod.is-fading {
  opacity: 0;
  transform: scale(0.5) translateY(-20px);
  transition: all 0.8s ease-out;
}

@keyframes seedPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(0, 245, 212, 0.2); }
  50% { transform: scale(1.1); box-shadow: 0 0 40px rgba(0, 245, 212, 0.4); }
}

@keyframes seedCrackOpen {
  0% { transform: scale(1.3); }
  40% { transform: scale(1.5); filter: brightness(2); }
  100% { transform: scale(1.8); opacity: 0.6; }
}

.seed-pod-glow {
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 245, 212, 0.25), transparent);
  animation: seedGlow 1.5s ease-in-out infinite;
}

@keyframes seedGlow {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.4); opacity: 1; }
}

.seed-pod-icon {
  font-size: 28px;
  color: var(--neon-cyan);
  z-index: 1;
  filter: drop-shadow(0 0 6px rgba(0, 245, 212, 0.5));
}

.seed-pod-crack {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: rgba(0, 245, 212, 0.6);
  opacity: 0;
}

.seed-pod.is-sprouting .seed-pod-crack {
  opacity: 1;
  animation: crackRotate 0.6s linear infinite;
}

@keyframes crackRotate {
  to { transform: rotate(360deg); }
}

/* ===== Tech Tree SVG ===== */
.seed-tree-svg {
  position: absolute;
  width: 100%;
  height: 100%;
  max-width: 360px;
  max-height: 320px;
}

.seed-tree-enter-enter-active { transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
.seed-tree-enter-leave-active { transition: all 0.5s ease-in; }
.seed-tree-enter-enter-from { opacity: 0; transform: scale(0.8); }
.seed-tree-enter-leave-to { opacity: 0; transform: scale(1.1); }

.seed-branch {
  fill: none;
  stroke: rgba(0, 245, 212, 0.4);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  animation: branchGrow 2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.seed-branch--trunk { animation-delay: 0s; stroke-width: 3.5; stroke: rgba(0, 245, 212, 0.55); }
.seed-branch--l1 { animation-delay: 0.4s; stroke: rgba(245, 166, 35, 0.45); stroke-width: 2.5; }
.seed-branch--r1 { animation-delay: 0.6s; stroke: rgba(126, 105, 255, 0.45); stroke-width: 2.5; }
.seed-branch--t1 { animation-delay: 0.5s; stroke: rgba(0, 245, 212, 0.4); stroke-width: 2.5; }
.seed-branch--l2 { animation-delay: 0.9s; stroke: rgba(245, 166, 35, 0.35); stroke-width: 1.5; }
.seed-branch--r2 { animation-delay: 1s; stroke: rgba(126, 105, 255, 0.35); stroke-width: 1.5; }
.seed-branch--tl { animation-delay: 1.1s; stroke: rgba(0, 245, 212, 0.3); stroke-width: 1.5; }
.seed-branch--tr { animation-delay: 1.2s; stroke: rgba(245, 166, 35, 0.3); stroke-width: 1.5; }

@keyframes branchGrow {
  to { stroke-dashoffset: 0; }
}

/* Glow lines (animated energy flow) */
.seed-glow-line {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 8 16;
  opacity: 0;
  animation: glowFlow 2s ease-in-out forwards;
}

.seed-glow-line--l { stroke: rgba(245, 166, 35, 0.5); animation-delay: 1.4s; }
.seed-glow-line--r { stroke: rgba(126, 105, 255, 0.5); animation-delay: 1.5s; }
.seed-glow-line--t { stroke: rgba(0, 245, 212, 0.5); animation-delay: 1.3s; }

@keyframes glowFlow {
  0% { opacity: 0; stroke-dashoffset: 200; }
  50% { opacity: 0.8; }
  100% { opacity: 0.3; stroke-dashoffset: 0; }
}

/* Fruit nodes */
.seed-fruit-group {
  opacity: 0;
  animation: fruitPop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.seed-fruit-ring {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 1.5;
  animation: fruitRingPulse 2s ease-in-out infinite;
}

@keyframes fruitRingPulse {
  0%, 100% { stroke: rgba(255, 255, 255, 0.1); r: 26; }
  50% { stroke: rgba(255, 255, 255, 0.2); }
}

.seed-fruit-core {
  filter: drop-shadow(0 0 10px rgba(0, 245, 212, 0.3));
}

@keyframes fruitPop {
  0% { opacity: 0; transform: scale(0.2); }
  50% { transform: scale(1.2); }
  70% { transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}

/* ===== Phase Hints ===== */
.seed-phase-hint {
  position: absolute;
  bottom: 10%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 999px;
  background: rgba(8, 10, 18, 0.75);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 245, 212, 0.12);
  font-size: 0.76rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.seed-phase-hint--done {
  color: var(--neon-cyan);
  border-color: rgba(0, 245, 212, 0.25);
  background: rgba(0, 245, 212, 0.06);
}

.seed-hint-enter-active { transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
.seed-hint-leave-active { transition: all 0.3s ease-in; }
.seed-hint-enter-from { opacity: 0; transform: translateY(12px) scale(0.92); }
.seed-hint-leave-to { opacity: 0; transform: translateY(-8px) scale(0.95); }

/* Responsive */

@media (max-width: 480px) {
  .social-stage--idle .social-skill--aux {
    width: 112px;
  }

  .social-stage--idle .social-skill--aux-left {
    top: 18% !important;
    left: 2% !important;
  }

  .social-stage--idle .social-skill--aux-right {
    top: 18% !important;
    left: 63% !important;
  }

  .social-stage--idle .social-skill--aux .social-skill-avatar {
    width: 68px;
    height: 68px;
  }

  .seed-vortex { width: 120px; height: 120px; }
  .seed-vortex-core { width: 50px; height: 50px; }
  .seed-vortex-avatar { width: 36px; height: 36px; }
  .seed-tree-svg { max-width: 280px; max-height: 260px; }
  .seed-pod { width: 46px; height: 46px; }
  .seed-pod-icon { font-size: 22px; }
}
@media (max-width: 480px) {
  .cinematic-output {
    padding: 20px 16px;
    gap: 18px;
  }
  .cinematic-portal {
    width: 90px;
    height: 90px;
  }
  .cinematic-portal-core {
    width: 44px;
    height: 44px;
  }
  .cinematic-portal-core .material-symbols-rounded {
    font-size: 22px;
  }
  .cinematic-choice-card {
    padding: 14px;
  }
  .cinematic-choice-icon {
    width: 40px;
    height: 40px;
  }
}

</style>

<style>
html[data-theme="apple"] .cyber-flow-page {
  background: var(--bg-base);
  color: var(--text-primary);
}

html[data-theme="apple"] .title-area h1,
html[data-theme="apple"] .stage-heading h2,
html[data-theme="apple"] .social-stage-copy h2 {
  color: var(--text-primary) !important;
  text-shadow: none;
}

html[data-theme="apple"] .title-area h1::after,
html[data-theme="apple"] .cyber-line {
  background: color-mix(in srgb, var(--accent-primary) 64%, transparent);
}

html[data-theme="apple"] .cyber-card,
html[data-theme="apple"] .flow-loading,
html[data-theme="apple"] .flow-error,
html[data-theme="apple"] .selection-stage,
html[data-theme="apple"] .entry-stage {
  background: var(--card-bg) !important;
  border-color: var(--ink-mist);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
}

html[data-theme="apple"] .chat-stage {
  background: transparent !important;
}

html[data-theme="apple"] .cyber-btn-primary,
html[data-theme="apple"] .report-confirm-btn,
html[data-theme="apple"] .chat-action-card-btn,
html[data-theme="apple"] .chat-send {
  background: var(--accent-primary) !important;
  border-color: var(--accent-primary) !important;
  color: #fff !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .cyber-btn-primary:hover,
html[data-theme="apple"] .chat-send:hover {
  background: var(--accent-primary-strong) !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .chat-stage-badge,
html[data-theme="apple"] .gentle-progress,
html[data-theme="apple"] .social-stage-badge {
  background: color-mix(in srgb, var(--accent-primary) 12%, var(--card-bg)) !important;
  border-color: color-mix(in srgb, var(--accent-primary) 22%, transparent) !important;
  color: var(--accent-primary) !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .chat-stage-badge--muted,
html[data-theme="apple"] .chat-inline-menu-trigger {
  background: color-mix(in srgb, var(--card-bg) 94%, transparent) !important;
  border-color: var(--ink-mist) !important;
  color: var(--text-secondary) !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .chat-stage-badge--skill {
  background: color-mix(in srgb, #f5a623 12%, var(--card-bg)) !important;
  border-color: color-mix(in srgb, #f5a623 24%, transparent) !important;
  color: #b26a00 !important;
}

html[data-theme="apple"] .chat-message.is-user .chat-msg-body p {
  background: var(--accent-primary) !important;
  border-color: var(--accent-primary) !important;
  color: #fff !important;
}

html[data-theme="apple"] .chat-message.is-assistant .chat-msg-body p {
  background: var(--card-bg) !important;
  border-color: var(--ink-mist) !important;
  color: var(--text-primary) !important;
}

html[data-theme="apple"] .report-confirm-card,
html[data-theme="apple"] .chat-action-card {
  background: var(--card-bg) !important;
  border-color: var(--ink-mist) !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .report-confirm-copy strong,
html[data-theme="apple"] .chat-action-card-copy strong {
  color: var(--text-primary) !important;
}

html[data-theme="apple"] .report-confirm-copy p,
html[data-theme="apple"] .chat-action-card-copy span,
html[data-theme="apple"] .chat-msg-name,
html[data-theme="apple"] .chat-status,
html[data-theme="apple"] .starter-prompts button {
  color: var(--text-secondary) !important;
}

html[data-theme="apple"] .chat-composer {
  background: var(--bg-elevated) !important;
  border-color: var(--ink-mist) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08) !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

html[data-theme="apple"] .chat-input {
  color: var(--text-primary) !important;
}

html[data-theme="apple"] .chat-input::placeholder {
  color: var(--text-secondary) !important;
}

html[data-theme="apple"] .chat-tool-btn {
  background: color-mix(in srgb, var(--bg-elevated) 86%, var(--text-primary) 6%) !important;
  border-color: var(--ink-mist) !important;
  color: var(--text-secondary) !important;
}

html[data-theme="apple"] .chat-skill-strip-item.is-active {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-primary) 70%, transparent) !important;
}

html[data-theme="apple"] .chat-skill-strip-item:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-primary) 54%, transparent) !important;
}

html[data-theme="apple"] .chat-skill-strip-icon::after,
html[data-theme="apple"] .social-skill-avatar::after,
html[data-theme="apple"] .skill-popup-hero-icon::after {
  background: rgba(0, 0, 0, 0.12) !important;
}

html[data-theme="apple"] .chat-skill-strip-icon-label {
  background: color-mix(in srgb, var(--bg-elevated) 84%, white 16%) !important;
  color: var(--text-primary) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14) !important;
}

html[data-theme="apple"] .social-orb {
  opacity: 0.18 !important;
  filter: blur(22px) saturate(0.7);
}

html[data-theme="apple"] .seed-particles {
  opacity: 0.58 !important;
}

html[data-theme="apple"] .seed-growth-overlay {
  background: radial-gradient(circle at center, rgba(10, 132, 255, 0.08), rgba(255, 255, 255, 0)) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

html[data-theme="apple"][data-appearance="dark"] .cyber-flow-page {
  background: #000;
}

html[data-theme="apple"][data-appearance="dark"] .cyber-card,
html[data-theme="apple"][data-appearance="dark"] .flow-loading,
html[data-theme="apple"][data-appearance="dark"] .flow-error,
html[data-theme="apple"][data-appearance="dark"] .selection-stage,
html[data-theme="apple"][data-appearance="dark"] .entry-stage,
html[data-theme="apple"][data-appearance="dark"] .report-confirm-card,
html[data-theme="apple"][data-appearance="dark"] .chat-action-card,
html[data-theme="apple"][data-appearance="dark"] .chat-message.is-assistant .chat-msg-body p {
  background: rgba(28, 28, 30, 0.88) !important;
  border-color: rgba(84, 84, 88, 0.42) !important;
  box-shadow: none !important;
}

html[data-theme="apple"][data-appearance="dark"] .chat-composer {
  background: rgba(28, 28, 30, 0.96) !important;
  border-color: rgba(84, 84, 88, 0.55) !important;
  box-shadow: none !important;
}

html[data-theme="apple"][data-appearance="dark"] .chat-stage-badge--muted,
html[data-theme="apple"][data-appearance="dark"] .chat-inline-menu-trigger,
html[data-theme="apple"][data-appearance="dark"] .chat-tool-btn,
html[data-theme="apple"][data-appearance="dark"] .starter-prompts button {
  background: rgba(44, 44, 46, 0.92) !important;
  border-color: rgba(84, 84, 88, 0.42) !important;
}

html[data-theme="apple"][data-appearance="dark"] .chat-stage-badge,
html[data-theme="apple"][data-appearance="dark"] .gentle-progress,
html[data-theme="apple"][data-appearance="dark"] .social-stage-badge {
  background: rgba(10, 132, 255, 0.14) !important;
  border-color: rgba(10, 132, 255, 0.28) !important;
  color: #0a84ff !important;
}

/* Apple light/dark normalization for the historical V3 cyber flow class names. */
html[data-theme="apple"] .cyber-flow-shell {
  color: var(--text-primary);
}

html[data-theme="apple"] .cyber-flow-shell--idle {
  width: min(100%, 1180px);
}

html[data-theme="apple"] .flow-topbar {
  padding-top: calc(env(safe-area-inset-top, 0px) + 2px);
}

html[data-theme="apple"] .topbar-link {
  color: var(--text-secondary) !important;
  letter-spacing: 0;
  font-weight: 600;
}

html[data-theme="apple"] .topbar-title {
  color: var(--text-primary) !important;
  letter-spacing: 0;
}

html[data-theme="apple"] .title-area {
  margin-top: 2px;
}

html[data-theme="apple"] .title-area h1 {
  font-size: clamp(1.8rem, 7vw, 2.25rem);
  font-weight: 700;
  letter-spacing: 0;
}

html[data-theme="apple"] .title-area--scan h1 {
  font-size: clamp(1.08rem, 4.2vw, 1.32rem);
}

html[data-theme="apple"] .title-area h1::after {
  width: 72px;
  height: 1px;
  background: var(--separator-soft) !important;
}

html[data-theme="apple"] .title-area p,
html[data-theme="apple"] .stage-heading p,
html[data-theme="apple"] .social-stage-copy p,
html[data-theme="apple"] .social-target span,
html[data-theme="apple"] .social-skill span:last-child,
html[data-theme="apple"] .modal-copy,
html[data-theme="apple"] .modal-chip span,
html[data-theme="apple"] .output-option-body p,
html[data-theme="apple"] .output-option-action,
html[data-theme="apple"] .modal-option-card p,
html[data-theme="apple"] .social-skill-sheet-head p,
html[data-theme="apple"] .social-skill-tags span,
html[data-theme="apple"] .skill-popup-subtitle,
html[data-theme="apple"] .skill-popup-section-title,
html[data-theme="apple"] .skill-popup-prompt-item,
html[data-theme="apple"] .skill-detail-header span,
html[data-theme="apple"] .skill-detail-prompts-label,
html[data-theme="apple"] .skill-detail-prompt-chip,
html[data-theme="apple"] .chat-inline-menu-label,
html[data-theme="apple"] .chat-inline-menu-trigger .material-symbols-rounded,
html[data-theme="apple"] .chat-attachment-chip > span:nth-child(2),
html[data-theme="apple"] .chat-attachment-chip button {
  color: var(--text-secondary) !important;
}

html[data-theme="apple"] .social-stage-intro-line {
  color: var(--text-primary) !important;
}

html[data-theme="apple"] .social-stage-intro-hint {
  color: var(--accent-primary) !important;
}

html[data-theme="apple"] .social-action-chip {
  background: var(--fill-secondary) !important;
  border-color: color-mix(in srgb, var(--accent-primary) 18%, transparent) !important;
  color: var(--text-primary) !important;
}

html[data-theme="apple"] .stage-heading h2,
html[data-theme="apple"] .social-stage-copy h2,
html[data-theme="apple"] .social-target strong,
html[data-theme="apple"] .social-skill strong,
html[data-theme="apple"] .flow-modal h2,
html[data-theme="apple"] .modal-chip strong,
html[data-theme="apple"] .output-option-header strong,
html[data-theme="apple"] .modal-option-card strong,
html[data-theme="apple"] .skill-popup-title,
html[data-theme="apple"] .skill-detail-header strong,
html[data-theme="apple"] .chat-inline-menu-value {
  color: var(--text-primary) !important;
}

html[data-theme="apple"] .stage-heading h2,
html[data-theme="apple"] .flow-modal h2,
html[data-theme="apple"] .modal-step,
html[data-theme="apple"] .social-stage-badge,
html[data-theme="apple"] .social-loading,
html[data-theme="apple"] .seed-phase-hint {
  letter-spacing: 0;
}

html[data-theme="apple"] .social-stage {
  gap: 12px;
}

html[data-theme="apple"] .social-field {
  min-height: 62vh;
  padding: 18px 10px 12px;
  overflow: hidden;
}

html[data-theme="apple"] .social-stage--idle .social-field {
  min-height: calc(100dvh - var(--topbar-h, 48px) - var(--tab-bar-height) - var(--safe-bottom) - 18px);
  padding: 8px 12px 22px;
}

html[data-theme="apple"] .social-ghost-avatar {
  display: none !important;
}

html[data-theme="apple"] .social-target {
  position: absolute !important;
  top: 9% !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  display: grid !important;
  justify-items: center;
  margin: 0;
}

html[data-theme="apple"] .social-target-main {
  width: 148px;
  gap: 8px;
}

html[data-theme="apple"] .social-target-main-avatar {
  width: 78px;
  height: 78px;
  border: 1px solid var(--separator-soft) !important;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14) !important;
}

html[data-theme="apple"] .social-target-main-avatar::after {
  background: rgba(0, 0, 0, 0.1) !important;
}

html[data-theme="apple"] .social-target-main strong {
  color: var(--text-primary) !important;
}

html[data-theme="apple"] .social-target-main > span:last-child {
  color: var(--text-secondary) !important;
}

html[data-theme="apple"] .social-target-ring {
  width: 112px;
  height: 112px;
  padding: 3px;
}

html[data-theme="apple"] .social-target .seed-vortex--idle-preview {
  width: 240px;
  height: 240px;
  top: -30px;
  filter: none !important;
  opacity: 0.58 !important;
}

html[data-theme="apple"] .idle-skill-emission {
  top: -116px;
  opacity: 0.74;
  filter: none !important;
}

html[data-theme="apple"] .idle-vortex-ripple {
  border-color: color-mix(in srgb, var(--accent-primary) 26%, transparent) !important;
  background:
    conic-gradient(
      from 0deg,
      transparent,
      color-mix(in srgb, var(--accent-primary) 34%, transparent),
      rgba(245, 166, 35, 0.2),
      color-mix(in srgb, var(--accent-primary) 22%, transparent),
      transparent
    ) !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .idle-vortex-spiral {
  background:
    conic-gradient(
      from 24deg,
      transparent 0deg,
      color-mix(in srgb, var(--accent-primary) 48%, transparent) 28deg,
      transparent 62deg,
      transparent 150deg,
      rgba(245, 166, 35, 0.26) 178deg,
      transparent 214deg,
      transparent 360deg
    ) !important;
}

html[data-theme="apple"] .idle-vortex-spark {
  background: var(--accent-primary) !important;
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent-primary) 42%, transparent) !important;
}

html[data-theme="apple"] .social-target-main::before {
  background:
    radial-gradient(
      circle,
      color-mix(in srgb, var(--accent-primary) 18%, transparent),
      color-mix(in srgb, var(--accent-primary) 5%, transparent) 48%,
      transparent 70%
    ) !important;
}

html[data-theme="apple"] .social-skill--aux::before {
  background:
    linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--accent-primary) 30%, transparent),
      transparent
    ) !important;
  filter: none !important;
}

html[data-theme="apple"] .social-skill-tap-guide {
  background: var(--bg-elevated) !important;
  border-color: color-mix(in srgb, var(--accent-primary) 22%, transparent) !important;
  color: var(--accent-primary) !important;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12) !important;
}

html[data-theme="apple"] .social-skill {
  position: static !important;
  width: 100% !important;
  display: grid;
  grid-template-columns: 48px minmax(72px, max-content) minmax(0, 1fr);
  align-items: center;
  justify-items: start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 18px;
  border: 1px solid var(--separator-soft);
  background: var(--bg-elevated);
  text-align: left;
  opacity: 1 !important;
  transform: none !important;
  animation: none !important;
  box-shadow: none;
}

html[data-theme="apple"] .social-skill--avatar {
  position: absolute !important;
  width: 136px !important;
  display: grid !important;
  grid-template-columns: none !important;
  align-items: start !important;
  justify-items: center !important;
  gap: 10px !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  text-align: center !important;
  opacity: 1 !important;
  transform: none !important;
  animation: none !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .social-skill.is-selected {
  border-color: color-mix(in srgb, var(--accent-primary) 36%, transparent);
  background: color-mix(in srgb, var(--accent-primary) 8%, var(--bg-elevated));
}

html[data-theme="apple"] .social-skill--avatar.is-selected {
  border-color: transparent !important;
  background: transparent !important;
}

html[data-theme="apple"] .social-skill.is-absorbing,
html[data-theme="apple"] .social-skill.is-absorbed,
html[data-theme="apple"] .social-skill.is-dimmed {
  opacity: 1 !important;
  filter: none !important;
  pointer-events: auto !important;
  transform: none !important;
  animation: none !important;
}

html[data-theme="apple"] .social-skill--avatar.is-absorbing,
html[data-theme="apple"] .social-skill--avatar.is-absorbed,
html[data-theme="apple"] .social-skill--avatar.is-dimmed {
  opacity: 1 !important;
  pointer-events: auto !important;
  filter: none !important;
}

html[data-theme="apple"] .social-skill-avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
}

html[data-theme="apple"] .social-skill--avatar .social-skill-avatar {
  width: 72px;
  height: 72px;
  border-radius: 999px;
  border: 1px solid var(--separator-soft);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16) !important;
  opacity: 1;
  transform: scale(1);
  filter: none;
  animation: socialSkillAvatarSpawn 0.62s cubic-bezier(0.22, 1, 0.36, 1) var(--skill-label-delay, 0.52s) both !important;
}

html[data-theme="apple"] .social-skill--aux .social-skill-avatar {
  animation:
    idleAuxSkillAvatarReveal 1.12s cubic-bezier(0.22, 1, 0.36, 1) var(--skill-label-delay, 0.96s) both,
    idleAuxSkillFloat 4.6s ease-in-out calc(var(--skill-label-delay, 0.96s) + 1.12s) infinite !important;
}

html[data-theme="apple"] .social-skill-avatar::after {
  background: rgba(0, 0, 0, 0.14) !important;
}

html[data-theme="apple"] .social-skill strong {
  font-size: 0.76rem;
  white-space: nowrap;
}

html[data-theme="apple"] .social-skill--avatar strong {
  white-space: normal;
}

html[data-theme="apple"] .social-skill span:last-child {
  width: 100%;
  font-size: 0.68rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

html[data-theme="apple"] .social-skill--avatar span:last-child {
  width: auto;
  max-width: 124px;
  white-space: normal;
  line-height: 1.45;
}

html[data-theme="apple"] .social-stage-intro {
  width: min(100%, 540px);
  padding-top: clamp(300px, 36vh, 380px);
  gap: 10px;
}

html[data-theme="apple"] .social-stage-intro-line {
  max-width: 30ch;
  font-size: clamp(0.9rem, 2vw, 1rem);
  line-height: 1.78;
}

html[data-theme="apple"] .social-stage-intro-hint {
  margin-top: 4px;
  font-size: 0.76rem;
}

html[data-theme="apple"] .social-target-ring,
html[data-theme="apple"] .skill-avatar-ring {
  background: var(--bg-elevated) !important;
  border-color: var(--separator-soft) !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .social-skill.is-selected .social-skill-avatar,
html[data-theme="apple"] .constellation-skill-avatar.is-selected .skill-avatar-ring {
  border-color: color-mix(in srgb, var(--accent-primary) 48%, transparent) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-primary) 26%, transparent) !important;
}

html[data-theme="apple"] .social-skill.is-selected strong,
html[data-theme="apple"] .modal-step,
html[data-theme="apple"] .output-option-check,
html[data-theme="apple"] .modal-option-card--output .material-symbols-rounded,
html[data-theme="apple"] .social-skill-sheet-head .material-symbols-rounded,
html[data-theme="apple"] .skill-popup-prompt-item .material-symbols-rounded,
html[data-theme="apple"] .skill-detail-tag,
html[data-theme="apple"] .chat-attachment-chip > span:first-child {
  color: var(--accent-primary) !important;
}

html[data-theme="apple"] .skill-search-bar,
html[data-theme="apple"] .starter-prompts button,
html[data-theme="apple"] .chat-inline-menu-trigger,
html[data-theme="apple"] .chat-attachment-chip {
  background: var(--fill-secondary) !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .skill-search-bar {
  height: 44px;
  border-radius: 16px;
}

html[data-theme="apple"] .skill-search-bar:focus-within,
html[data-theme="apple"] .chat-inline-menu-trigger.is-open {
  background: var(--fill-primary) !important;
  border-color: color-mix(in srgb, var(--accent-primary) 28%, transparent) !important;
}

html[data-theme="apple"] .skill-search-input {
  color: var(--text-primary) !important;
}

html[data-theme="apple"] .skill-search-input::placeholder {
  color: var(--text-tertiary) !important;
}

html[data-theme="apple"] .skill-search-clear {
  background: var(--fill-primary) !important;
  color: var(--text-secondary) !important;
}

html[data-theme="apple"] .skill-search-dropdown,
html[data-theme="apple"] .chat-inline-menu-pop {
  background: color-mix(in srgb, var(--bg-elevated) 96%, transparent) !important;
  border-color: var(--separator-soft) !important;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.14) !important;
}

html[data-theme="apple"] .skill-search-item:active,
html[data-theme="apple"] .chat-inline-menu-pop-item:active {
  background: var(--fill-secondary) !important;
}

html[data-theme="apple"] .skill-search-item-avatar {
  color: #fff !important;
  border-radius: 10px;
}

html[data-theme="apple"] .skill-search-item-title,
html[data-theme="apple"] .chat-inline-menu-pop-item {
  color: var(--text-primary) !important;
}

html[data-theme="apple"] .skill-search-item-sub,
html[data-theme="apple"] .skill-search-item-arrow {
  color: var(--text-secondary) !important;
}

html[data-theme="apple"] .flow-modal-backdrop,
html[data-theme="apple"] .skill-popup-overlay {
  background: rgba(0, 0, 0, 0.24) !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

html[data-theme="apple"] .flow-modal,
html[data-theme="apple"] .skill-popup,
html[data-theme="apple"] .selection-stage,
html[data-theme="apple"] .entry-stage,
html[data-theme="apple"] .social-skill-sheet,
html[data-theme="apple"] .skill-detail-panel {
  background: var(--bg-elevated) !important;
  border-color: var(--separator-soft) !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .flow-modal-close,
html[data-theme="apple"] .skill-popup-close,
html[data-theme="apple"] .help-chip {
  background: var(--fill-secondary) !important;
  border-color: transparent !important;
  color: var(--text-secondary) !important;
}

html[data-theme="apple"] .modal-chip,
html[data-theme="apple"] .output-option-card,
html[data-theme="apple"] .modal-option-card,
html[data-theme="apple"] .skill-popup-prompt-item,
html[data-theme="apple"] .skill-popup-skill-tag,
html[data-theme="apple"] .skill-popup-category,
html[data-theme="apple"] .skill-detail-tag,
html[data-theme="apple"] .skill-detail-prompt-chip,
html[data-theme="apple"] .social-skill-tags span,
html[data-theme="apple"] .output-option-badge {
  background: var(--fill-tertiary) !important;
  border-color: var(--separator-soft) !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .output-option-card.is-selected,
html[data-theme="apple"] .output-option-card--cyan.is-selected,
html[data-theme="apple"] .output-option-card--gold.is-selected,
html[data-theme="apple"] .modal-option-card.is-selected,
html[data-theme="apple"] .option-card.is-selected {
  background: color-mix(in srgb, var(--accent-primary) 10%, var(--bg-elevated)) !important;
  border-color: color-mix(in srgb, var(--accent-primary) 42%, transparent) !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .output-option-icon,
html[data-theme="apple"] .output-option-icon--0,
html[data-theme="apple"] .output-option-icon--1,
html[data-theme="apple"] .output-option-icon--2,
html[data-theme="apple"] .output-option-icon--civ-cyan,
html[data-theme="apple"] .output-option-icon--civ-gold,
html[data-theme="apple"] .output-option-icon--civ-purple,
html[data-theme="apple"] .cinematic-choice-icon {
  background: var(--fill-secondary) !important;
  border: 1px solid var(--separator-soft) !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .output-option-icon .material-symbols-rounded,
html[data-theme="apple"] .output-option-icon--1 .material-symbols-rounded,
html[data-theme="apple"] .output-option-icon--2 .material-symbols-rounded,
html[data-theme="apple"] .output-option-icon--civ-gold .material-symbols-rounded,
html[data-theme="apple"] .output-option-icon--civ-purple .material-symbols-rounded {
  color: var(--accent-primary) !important;
}

html[data-theme="apple"] .distill-dialog-bubble,
html[data-theme="apple"] .civilization-egg-card,
html[data-theme="apple"] .distill-dialog-scene,
html[data-theme="apple"] .distill-egg-scene {
  background: var(--card-bg) !important;
  border-color: var(--ink-mist) !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .distill-scene-kicker {
  color: var(--accent-primary) !important;
}

html[data-theme="apple"] .distill-system-line {
  color: var(--text-primary) !important;
}

html[data-theme="apple"] .distill-dialog-actions--dock {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0), color-mix(in srgb, var(--bg-base) 86%, transparent) 24%, var(--bg-base)) !important;
}

html[data-theme="apple"] .distill-scene-copy,
html[data-theme="apple"] .civilization-egg-card span:last-child,
html[data-theme="apple"] .social-stage-hint {
  color: var(--text-secondary) !important;
}

html[data-theme="apple"] .civilization-egg-shell,
html[data-theme="apple"] .egg-hatch-shell {
  background: color-mix(in srgb, var(--fill-secondary) 88%, white 12%) !important;
  border-color: var(--separator-soft) !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .civilization-egg-core,
html[data-theme="apple"] .egg-hatch-core {
  background: var(--bg-elevated) !important;
  border-color: var(--separator-soft) !important;
  box-shadow: none !important;
}

html[data-theme="apple"] .help-pop {
  background: var(--bg-elevated) !important;
  border-color: var(--separator-soft) !important;
  color: var(--text-secondary) !important;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
}

html[data-theme="apple"] .chat-messages {
  scrollbar-color: var(--separator) transparent;
}

html[data-theme="apple"] .chat-message {
  font-size: 0.86rem;
  line-height: 1.55;
}

html[data-theme="apple"] .chat-msg-body p {
  padding: 9px 13px;
  border-radius: 18px;
}

html[data-theme="apple"] .chat-message.is-user .chat-msg-body p {
  border-bottom-right-radius: 6px;
}

html[data-theme="apple"] .chat-message.is-assistant .chat-msg-body p {
  border-bottom-left-radius: 6px;
}

html[data-theme="apple"] .chat-footer {
  gap: 6px;
  padding-top: 4px;
}

html[data-theme="apple"] .chat-composer {
  grid-template-columns: 40px minmax(0, 1fr) auto;
  min-height: 48px;
  padding: 4px 6px;
  border-radius: 24px;
}

html[data-theme="apple"] .chat-input {
  min-height: 40px;
  height: 40px;
  max-height: 104px;
  padding: 9px 10px;
  font-size: 0.86rem;
  line-height: 1.45;
}

html[data-theme="apple"] .chat-tool-btn {
  width: 40px;
  height: 40px;
  background: transparent !important;
  border-color: transparent !important;
}

html[data-theme="apple"] .chat-send {
  min-width: 52px;
  min-height: 40px;
  border-radius: 20px;
  padding: 0 14px;
  font-size: 0.84rem;
}

html[data-theme="apple"] .report-confirm-card,
html[data-theme="apple"] .chat-action-card {
  border-radius: 18px;
  padding: 14px;
}

html[data-theme="apple"][data-appearance="dark"] .skill-search-dropdown,
html[data-theme="apple"][data-appearance="dark"] .chat-inline-menu-pop {
  box-shadow: none !important;
}

html[data-theme="apple"][data-appearance="dark"] .flow-modal-backdrop,
html[data-theme="apple"][data-appearance="dark"] .skill-popup-overlay {
  background: rgba(0, 0, 0, 0.5) !important;
}

html[data-theme="apple"][data-appearance="dark"] .flow-modal,
html[data-theme="apple"][data-appearance="dark"] .skill-popup,
html[data-theme="apple"][data-appearance="dark"] .selection-stage,
html[data-theme="apple"][data-appearance="dark"] .entry-stage,
html[data-theme="apple"][data-appearance="dark"] .skill-detail-panel {
  background: var(--bg-elevated) !important;
  border-color: var(--separator-soft) !important;
}

html[data-theme="apple"][data-appearance="dark"] .distill-dialog-actions--dock {
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0), color-mix(in srgb, var(--bg-base) 86%, transparent) 24%, var(--bg-base)) !important;
}

@media (max-width: 480px) {
  html[data-theme="apple"] .social-stage--idle .social-skill--aux {
    width: 112px !important;
  }

  html[data-theme="apple"] .social-stage--idle .social-skill--aux-left {
    top: 18% !important;
    left: 2% !important;
  }

  html[data-theme="apple"] .social-stage--idle .social-skill--aux-right {
    top: 18% !important;
    left: 63% !important;
  }

  html[data-theme="apple"] .social-stage--idle .social-skill--aux .social-skill-avatar {
    width: 68px !important;
    height: 68px !important;
  }
}
</style>
