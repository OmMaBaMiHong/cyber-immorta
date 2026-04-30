<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from "vue"
import { useRouter } from "vue-router"
import jsQR from "jsqr"
import QRCode from "qrcode"
import { api } from "@/lib/api"
import SkillDetailSheet from "@/components/v3/SkillDetailSheet.vue"
import { isSelfProject } from "@/lib/onboarding"
import {
  projectPrimaryPackSlug,
  skillAvatarBackgroundStyle,
  type SkillAvatarPack,
} from "@/lib/skillAvatar"
import { useAuthStore } from "@/stores/auth"
import type {
  FriendAddResponse,
  FriendQrResponse,
  ProjectSummary,
  GitHubPackImportJob,
  ProductGuidanceResponse,
  ProjectSkillPublishResponse,
} from "@/types"

const auth = useAuthStore()
const router = useRouter()

const projects = ref<ProjectSummary[]>([])
const packAvatarMap = ref<Record<string, SkillAvatarPack>>({})
const activeTab = ref<"distill" | "favorites" | "likes" | "imports">("distill")
const selectedSlug = ref<string | null>(null)
const showMenu = ref(false)
const importJobs = ref<GitHubPackImportJob[]>([])
const importJobsLoading = ref(false)
const activeProject = ref<ProjectSummary | null>(null)
const selectedSandboxPartnerId = ref("")
const actionNotice = ref("")
const profileActionGuide = ref<Record<string, any>>({})
const copiedSkillProjectIds = ref<string[]>([])
const possession = ref<{ projectId: string; expiresAt: string } | null>(null)
const identityMode = ref<"rebirth" | "copy" | "possess">("rebirth")
const publishingProjectId = ref("")
const deletingProjectId = ref("")
const showQrSheet = ref(false)
const qrCanvasRef = ref<HTMLCanvasElement | null>(null)
const friendQr = ref<FriendQrResponse | null>(null)
const qrLoading = ref(false)
const qrError = ref("")
const showScanSheet = ref(false)
const scanVideoRef = ref<HTMLVideoElement | null>(null)
const scanFileInputRef = ref<HTMLInputElement | null>(null)
const scanNotice = ref("")
const scanError = ref("")
const scanBusy = ref(false)
let scanStream: MediaStream | null = null
let scanFrameId = 0
let scanDetector: any = null

const PROFILE_PLAY_STATE_KEY = "distill-human:v3:profile-play-state"

const isLoggedIn = computed(() => Boolean(auth.token && auth.user))
const displayName = computed(() => auth.user?.nickname || "未登录")
const emailDisplay = computed(() => {
  if (!auth.user?.email) return ""
  const [local, domain] = auth.user.email.split("@")
  if (!domain) return auth.user.email
  return local.length > 4
    ? `${local.slice(0, 2)}***@${domain}`
    : `${local}***@${domain}`
})
const accountDisplay = computed(() => emailDisplay.value || auth.user?.user_id || "")
const isAdmin = computed(() => auth.user?.role === "admin")
const avatarLetter = computed(() => displayName.value.slice(0, 1).toUpperCase())
const avatarHue = computed(() => {
  let hash = 0
  for (const c of displayName.value) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return hash % 360
})

const tabItems = computed(() => [
  { key: "distill" as const, label: "蒸馏", count: projects.value.length },
  { key: "favorites" as const, label: "收藏", count: 0 },
  { key: "likes" as const, label: "点赞", count: 0 },
  { key: "imports" as const, label: "导入", count: importJobs.value.length },
])

const sortedProjects = computed(() =>
  [...projects.value].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
)
function byCreatedAsc(a: ProjectSummary, b: ProjectSummary) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
}
const selfProject = computed(() => {
  const selfProjects = projects.value.filter((project) => isSelfProject(project))
  const reported = selfProjects.filter((project) => project.has_report).sort(byCreatedAsc)
  if (reported[0]) return reported[0]
  const inProgress = selfProjects
    .filter((project) => project.status === "chat_ready" || project.status === "report_ready")
    .sort(byCreatedAsc)
  if (inProgress[0]) return inProgress[0]
  return (
    [...selfProjects].sort(byCreatedAsc)[0] ||
    null
  )
})
const nonSelfProjects = computed(() => sortedProjects.value.filter((project) => !isSelfProject(project)))
const projectGridItems = computed(() => sortedProjects.value)
const activePossessionProject = computed(() => {
  const state = possession.value
  if (!state) return null
  if (new Date(state.expiresAt).getTime() <= Date.now()) return null
  return projects.value.find((project) => project.project_id === state.projectId) || null
})
const identityModeLabel = computed(() => {
  if (identityMode.value === "possess") {
    return activePossessionProject.value ? `夺舍魔 · ${activePossessionProject.value.subject_name}` : "夺舍魔"
  }
  if (identityMode.value === "copy") return `复制者 · ${copiedSkillProjectIds.value.length} 个附属 skill`
  return "重生者"
})
const canCopyAbility = computed(() => identityMode.value === "copy")
const canPossess = computed(() => identityMode.value === "possess")
const canSwitchSandboxPerspective = computed(() => identityMode.value !== "rebirth")
const identityBoundaryCopy = computed(() =>
  profileActionGuide.value.copy ||
  (identityMode.value === "rebirth"
    ? "重生者不能复制/夺舍，只能以自己的主人物卡继续蒸馏和参与。"
    : identityMode.value === "copy"
      ? "复制者不能夺舍，只能把他人能力复刻成自己的附属 skill。"
      : "夺舍魔不能复制能力，只能限时封印自己并代入目标 skill。")
)
const sandboxPartners = computed(() => {
  const active = activeProject.value
  if (!active) return []
  return nonSelfProjects.value.filter((project) => project.project_id !== active.project_id)
})
const selectedSandboxPartner = computed(() =>
  sandboxPartners.value.find((project) => project.project_id === selectedSandboxPartnerId.value) || null
)

function isActiveJob(status?: string | null) {
  return ["queued", "parsing", "extracting", "distilling", "report_ready"].includes(String(status || ""))
}

function getProjectCardStatus(project: ProjectSummary) {
  if (project.latest_job_status === "failed") {
    return {
      label: "草稿",
      color: "var(--text-secondary)",
      href: {
        name: "projects-cyber" as const,
        query: {
          projectId: project.project_id,
          ...(project.intake_profile?.output_mode ? { output: project.intake_profile.output_mode } : {}),
          ...(project.intake_profile?.civilization_level ? { civ: project.intake_profile.civilization_level } : {}),
        },
      },
    }
  }
  if (project.latest_job_id && isActiveJob(project.latest_job_status)) {
    return {
      label: "蒸馏中",
      color: "var(--neon-gold)",
      href: `/projects/${project.project_id}/jobs/${project.latest_job_id}`,
    }
  }
  if (project.has_report) {
    return {
      label: "查看报告",
      color: "var(--neon-cyan)",
      href: `/projects/${project.project_id}/report`,
    }
  }
  if (project.can_chat_now || project.pack_slug || project.status === "chat_ready" || project.status === "report_ready") {
    return {
      label: "继续对话",
      color: "var(--neon-cyan)",
      href: {
        name: "projects-cyber" as const,
        query: projectFlowQuery(project),
      },
    }
  }
  return {
    label: "草稿",
    color: "var(--text-secondary)",
    href: {
      name: "projects-cyber" as const,
      query: {
        projectId: project.project_id,
        ...(project.intake_profile?.output_mode ? { output: project.intake_profile.output_mode } : {}),
        ...(project.intake_profile?.civilization_level ? { civ: project.intake_profile.civilization_level } : {}),
      },
    },
  }
}

function getStatusLabel(project: ProjectSummary) {
  return getProjectCardStatus(project).label
}

function getStatusColor(project: ProjectSummary) {
  const status = getProjectCardStatus(project)
  if (status.label === "查看报告") return "var(--accent-primary)"
  if (status.label === "继续对话") return "var(--accent-primary)"
  if (status.label === "蒸馏中") return "var(--accent-warning)"
  return "var(--text-secondary)"
}

function projectScopeLabel(project: ProjectSummary) {
  if (isSelfProject(project)) return "主人物卡"
  if (project.has_report) return "报告人物卡"
  if (project.has_preview_report || project.report_source_kind === "pack_seed") return "Skill 预览"
  if (project.subject_type === "private_person") return "私域对象"
  return "蒸馏对象"
}

function projectCardStateLabel(project: ProjectSummary) {
  if (project.has_report) return "人物卡已出"
  if (project.latest_job_id && isActiveJob(project.latest_job_status)) return "蒸馏中"
  if (project.has_preview_report || project.report_source_kind === "pack_seed") return "预览可聊"
  if (project.can_chat_now || project.pack_slug || project.status === "chat_ready") return "对话中"
  return "未知对象"
}

function goToProject(project: ProjectSummary) {
  router.push(getProjectCardStatus(project).href as any)
}

function projectFlowQuery(project: ProjectSummary, extra?: Record<string, string | undefined>) {
  const pack = primaryPackSlug(project)
  return {
    projectId: project.project_id,
    ...(pack ? { pack } : {}),
    ...(project.intake_profile?.output_mode ? { output: project.intake_profile.output_mode } : {}),
    ...(project.intake_profile?.civilization_level ? { civ: project.intake_profile.civilization_level } : {}),
    ...extra,
  }
}

function goToProjectChat(project: ProjectSummary) {
  router.push({ name: "projects-cyber", query: projectFlowQuery(project) })
}

function upsertProjectSummary(project: ProjectSummary) {
  projects.value = projects.value.map((item) => item.project_id === project.project_id ? project : item)
  if (activeProject.value?.project_id === project.project_id) activeProject.value = project
}

async function togglePublicSkill(project: ProjectSummary) {
  if (!isSelfProject(project)) return
  if (!project.has_report) {
    actionNotice.value = "生成自我蒸馏报告后才能公开到新人类列表。"
    return
  }
  publishingProjectId.value = project.project_id
  try {
    const endpoint = `/projects/${project.project_id}/public-skill`
    const { data } = project.public_skill_published
      ? await api.delete<ProjectSkillPublishResponse>(endpoint)
      : await api.post<ProjectSkillPublishResponse>(endpoint)
    upsertProjectSummary(data.project)
    await loadPackAvatars()
    actionNotice.value = data.published
      ? "已公开到赛博世界新人类列表，可被搜索到。"
      : "已取消公开，新人类列表不再搜索到这张主人物卡。"
  } catch (error: any) {
    actionNotice.value = error?.response?.data?.detail || "公开状态更新失败，请稍后再试。"
  } finally {
    publishingProjectId.value = ""
  }
}

function openProjectActions(project: ProjectSummary) {
  activeProject.value = project
  selectedSandboxPartnerId.value = sandboxPartners.value[0]?.project_id || ""
  actionNotice.value = ""
  void refreshProfileActionGuide()
}

function closeProjectActions() {
  activeProject.value = null
  selectedSandboxPartnerId.value = ""
  actionNotice.value = ""
  profileActionGuide.value = {}
}

async function deleteProject(project: ProjectSummary) {
  if (deletingProjectId.value) return
  if (isSelfProject(project)) {
    actionNotice.value = "主人物卡不能在这里删除。"
    return
  }
  const confirmed = typeof window === "undefined"
    ? true
    : window.confirm(`确定删除「${project.subject_name}」这个蒸馏项目？删除后对应报告、对话和人物卡结果会一并移除。`)
  if (!confirmed) return

  deletingProjectId.value = project.project_id
  try {
    await api.delete(`/projects/${project.project_id}`)
    projects.value = projects.value.filter((item) => item.project_id !== project.project_id)
    copiedSkillProjectIds.value = copiedSkillProjectIds.value.filter((id) => id !== project.project_id)
    if (possession.value?.projectId === project.project_id) {
      possession.value = null
      if (identityMode.value === "possess") identityMode.value = "rebirth"
    }
    persistPlayState()
    if (activeProject.value?.project_id === project.project_id) closeProjectActions()
    actionNotice.value = "已删除项目。"
  } catch (error: any) {
    actionNotice.value = error?.response?.data?.detail || "删除失败，请稍后再试。"
  } finally {
    deletingProjectId.value = ""
  }
}

async function refreshProfileActionGuide() {
  const project = activeProject.value
  if (!project || !auth.token) return
  try {
    const { data } = await api.post<ProductGuidanceResponse>("/guidance", {
      surface: "profile_action",
      context: {
        project_id: project.project_id,
        subject_name: project.subject_name,
        is_self: isSelfProject(project),
        identity_mode: identityMode.value,
        citizen_level: citizenLevel(project),
        citizen_score: citizenScore(project),
        copied_skill_count: copiedSkillProjectIds.value.length,
        has_possession: Boolean(activePossessionProject.value),
        sandbox_partner_count: sandboxPartners.value.length,
      },
    })
    profileActionGuide.value = data.payload || {}
  } catch {
    profileActionGuide.value = {}
  }
}

function citizenLevel(project: ProjectSummary | null | undefined) {
  return Math.max(1, Math.min(5, Number(project?.citizen_level || 1)))
}

function citizenScore(project: ProjectSummary | null | undefined) {
  return Math.max(0, Math.min(100, Number(project?.citizen_score || 0)))
}

function citizenLabel(project: ProjectSummary | null | undefined) {
  return project?.citizen_label || `L${citizenLevel(project)} 游民`
}

function citizenProgress(project: ProjectSummary | null | undefined) {
  return `${citizenScore(project)}%`
}

function persistPlayState() {
  if (typeof window === "undefined") return
  window.localStorage.setItem(PROFILE_PLAY_STATE_KEY, JSON.stringify({
    identityMode: identityMode.value,
    copiedSkillProjectIds: copiedSkillProjectIds.value,
    possession: possession.value,
  }))
}

function loadPlayState() {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem(PROFILE_PLAY_STATE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as {
      identityMode?: "rebirth" | "copy" | "possess"
      copiedSkillProjectIds?: string[]
      possession?: { projectId: string; expiresAt: string } | null
    }
    identityMode.value = parsed.identityMode === "copy" || parsed.identityMode === "possess" ? parsed.identityMode : "rebirth"
    copiedSkillProjectIds.value = Array.isArray(parsed.copiedSkillProjectIds) ? parsed.copiedSkillProjectIds : []
    possession.value = parsed.possession || null
    if (possession.value && new Date(possession.value.expiresAt).getTime() <= Date.now()) {
      possession.value = null
      if (identityMode.value === "possess") identityMode.value = "rebirth"
      persistPlayState()
    }
  } catch {
    identityMode.value = "rebirth"
    copiedSkillProjectIds.value = []
    possession.value = null
  }
}

function setIdentityMode(mode: "rebirth" | "copy" | "possess") {
  identityMode.value = mode
  if (mode === "rebirth") {
    copiedSkillProjectIds.value = []
    possession.value = null
    actionNotice.value = "已切回重生者：只能以自己的主人物卡成长，不复制、不夺舍。"
  } else if (mode === "copy") {
    possession.value = null
    actionNotice.value = "已切换为复制者：可以把达到 L4 的人物能力复刻到自己的技能树。"
  } else {
    copiedSkillProjectIds.value = []
    actionNotice.value = "已切换为夺舍魔：可以对达到 L3 的人物开启 24 小时限时夺舍。"
  }
  persistPlayState()
  void refreshProfileActionGuide()
}

function copyProjectAbility(project: ProjectSummary) {
  if (!canCopyAbility.value) {
    actionNotice.value = "当前身份不是复制者，不能复制能力。先点自己的主人物卡切换为复制者。"
    return
  }
  if (citizenLevel(project) < 4) {
    actionNotice.value = "复制能力需要该 skill 达到 L4 精英公民。继续补材料、对话和报告会自动升级。"
    return
  }
  if (!copiedSkillProjectIds.value.includes(project.project_id)) {
    copiedSkillProjectIds.value = [...copiedSkillProjectIds.value, project.project_id]
    persistPlayState()
  }
  actionNotice.value = `${project.subject_name} 已成为你的附属 skill，可作为主人物卡的能力参考。`
}

function possessProject(project: ProjectSummary) {
  if (!canPossess.value) {
    actionNotice.value = "当前身份不是夺舍魔，不能夺舍。先点自己的主人物卡切换为夺舍魔。"
    return
  }
  if (citizenLevel(project) < 3) {
    actionNotice.value = "夺舍模拟需要该 skill 至少达到 L3 公民，避免材料不足导致人格漂移。"
    return
  }
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  possession.value = { projectId: project.project_id, expiresAt }
  persistPlayState()
  actionNotice.value = `已进入 ${project.subject_name} 的 24 小时夺舍模拟。你的主人物卡暂时封印，可随时解除。`
}

function releasePossession() {
  possession.value = null
  if (identityMode.value === "possess") identityMode.value = "rebirth"
  persistPlayState()
  actionNotice.value = "已解除夺舍模拟，主人物卡恢复为当前主身份。"
}

function startRelationshipSandbox(mode: "observe" | "left" | "right") {
  if (mode !== "observe" && !canSwitchSandboxPerspective.value) {
    actionNotice.value = "重生者不能切换为别人视角，只能旁观或以自己的主人物卡参与后续对话。"
    return
  }
  const source = activeProject.value
  const partner = selectedSandboxPartner.value
  if (!source || !partner) {
    actionNotice.value = "请先选择另一张人物卡。"
    return
  }
  const modeLabel = mode === "observe" ? "旁观" : mode === "left" ? `以 ${source.subject_name} 视角` : `以 ${partner.subject_name} 视角`
  if (typeof window !== "undefined") {
    window.localStorage.setItem("distill-human:v3:relationship-sandbox-draft", JSON.stringify({
      leftProjectId: source.project_id,
      rightProjectId: partner.project_id,
      mode,
      createdAt: new Date().toISOString(),
    }))
  }
  actionNotice.value = `关系沙盘已准备：${source.subject_name} × ${partner.subject_name}，模式：${modeLabel}。`
  router.push({ name: "messages", query: { sandbox: "1" } })
}

function importJobStatusText(status: GitHubPackImportJob["status"], kind: GitHubPackImportJob["import_kind"]) {
  const prefix = kind === "persona_lookup" ? "人物包" : "GitHub"
  const labels: Record<string, string> = {
    queued: "排队中",
    parsing: "解析中",
    extracting: "提取中",
    distilling: "蒸馏中",
    report_ready: "报告就绪",
    chat_ready: "导入完成",
    failed: "导入失败",
  }
  return `${prefix} · ${labels[status] || status}`
}

function importJobStatusColor(status: GitHubPackImportJob["status"]) {
  if (status === "chat_ready" || status === "report_ready") return "var(--accent-primary)"
  if (status === "failed") return "var(--accent-danger)"
  if (status === "distilling" || status === "extracting") return "var(--accent-warning)"
  return "var(--text-secondary)"
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "刚刚"
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}小时前`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}天前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function extractRepoName(url: string) {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean)
    return parts.length >= 2 ? parts.slice(-2).join("/") : url
  } catch {
    return url
  }
}

const retryingJobId = ref("")

async function loadImportJobs() {
  if (!auth.token) return
  importJobsLoading.value = true
  try {
    const { data } = await api.get<{ items: GitHubPackImportJob[] }>("/import-jobs", { params: { limit: 20 } })
    importJobs.value = data.items || []
  } catch {
    // silent
  } finally {
    importJobsLoading.value = false
  }
}

async function retryImportJob(jobId: string) {
  retryingJobId.value = jobId
  try {
    await api.post(`/import-jobs/${jobId}/retry`)
    await loadImportJobs()
  } catch {
    // silent
  } finally {
    retryingJobId.value = ""
  }
}

function goToPack(slug: string) {
  selectedSlug.value = slug
}

function primaryPackSlug(project: ProjectSummary) {
  return projectPrimaryPackSlug(project).toLowerCase()
}

function projectAvatarPack(project: ProjectSummary) {
  const slug = primaryPackSlug(project)
  return slug ? packAvatarMap.value[slug] : null
}

function projectAvatarStyle(project: ProjectSummary) {
  return skillAvatarBackgroundStyle(projectAvatarPack(project), primaryPackSlug(project) || project.subject_name)
}

function importJobPackSlug(job: GitHubPackImportJob) {
  return String(job.pack_slug || job.imported_pack_slugs?.[0] || "").trim().toLowerCase()
}

function importJobAvatarPack(job: GitHubPackImportJob) {
  const slug = importJobPackSlug(job)
  return slug ? packAvatarMap.value[slug] : null
}

function importJobAvatarStyle(job: GitHubPackImportJob) {
  return skillAvatarBackgroundStyle(importJobAvatarPack(job), importJobPackSlug(job) || job.pack_title || job.source_value)
}

async function loadPackAvatars() {
  try {
    const { data } = await api.get<{ items: SkillAvatarPack[] }>("/packs")
    packAvatarMap.value = Object.fromEntries((data.items || []).map((pack) => [pack.slug.toLowerCase(), pack]))
  } catch {
    packAvatarMap.value = {}
  }
}

async function loadData() {
  if (!auth.token) return
  try {
    const { data } = await api.get<{ items: ProjectSummary[] }>("/projects")
    projects.value = data.items || []
  } catch {
    // silent
  }
  void loadImportJobs()
}

function handleLogout() {
  auth.logout()
  router.push("/auth")
}

function toggleMenu() {
  showMenu.value = !showMenu.value
}

function closeMenu() {
  showMenu.value = false
}

function onMenuClick(action: string) {
  closeMenu()
  switch (action) {
    case "scan": void openScanSheet(); break
    case "admin": router.push("/admin/settings"); break
    case "privacy": router.push("/legal/privacy"); break
    case "logout": handleLogout(); break
  }
}

async function openQrSheet() {
  if (!isLoggedIn.value) {
    router.push("/auth")
    return
  }
  showQrSheet.value = true
  if (!friendQr.value) {
    await loadFriendQr()
  } else {
    await renderFriendQr()
  }
}

function closeQrSheet() {
  showQrSheet.value = false
}

async function loadFriendQr() {
  qrLoading.value = true
  qrError.value = ""
  try {
    const { data } = await api.get<FriendQrResponse>("/friends/qr")
    friendQr.value = data
    await renderFriendQr()
  } catch (error: any) {
    qrError.value = error?.response?.data?.detail || "二维码加载失败"
  } finally {
    qrLoading.value = false
  }
}

async function renderFriendQr() {
  await nextTick()
  const canvas = qrCanvasRef.value
  const data = friendQr.value
  if (!canvas || !data?.qr_text) return
  await QRCode.toCanvas(canvas, data.qr_text, {
    width: 220,
    margin: 1,
    color: {
      dark: "#0d1117",
      light: "#ffffff",
    },
  })
}

async function openScanSheet() {
  if (!isLoggedIn.value) {
    router.push("/auth")
    return
  }
  scanNotice.value = ""
  scanError.value = ""
  showScanSheet.value = true
  await nextTick()
  void startQrCamera()
}

function closeScanSheet() {
  stopQrCamera()
  showScanSheet.value = false
}

function stopQrCamera() {
  if (scanFrameId) cancelAnimationFrame(scanFrameId)
  scanFrameId = 0
  if (scanStream) {
    scanStream.getTracks().forEach((track) => track.stop())
    scanStream = null
  }
  if (scanVideoRef.value) {
    scanVideoRef.value.srcObject = null
  }
}

async function startQrCamera() {
  if (typeof window === "undefined") return
  if (!navigator.mediaDevices?.getUserMedia) {
    scanError.value = "当前浏览器不支持摄像头扫码，请上传二维码图片。"
    return
  }
  const Detector = (window as any).BarcodeDetector
  if (!Detector) {
    scanError.value = "当前浏览器不支持实时扫码，请上传二维码图片。"
    return
  }
  try {
    scanDetector = scanDetector || new Detector({ formats: ["qr_code"] })
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    })
    const video = scanVideoRef.value
    if (!video) return
    video.srcObject = scanStream
    await video.play()
    scanQrLoop()
  } catch (error: any) {
    scanError.value = error?.message || "摄像头启动失败，请上传二维码图片。"
  }
}

function scanQrLoop() {
  const video = scanVideoRef.value
  if (!showScanSheet.value || !scanDetector || !video || scanBusy.value) return
  scanDetector.detect(video)
    .then((codes: Array<{ rawValue?: string }>) => {
      const value = codes?.[0]?.rawValue || ""
      if (value) {
        void submitScannedPayload(value)
        return
      }
      scanFrameId = requestAnimationFrame(scanQrLoop)
    })
    .catch(() => {
      scanFrameId = requestAnimationFrame(scanQrLoop)
    })
}

async function submitScannedPayload(payload: string) {
  if (scanBusy.value) return
  scanBusy.value = true
  scanError.value = ""
  scanNotice.value = ""
  stopQrCamera()
  try {
    const { data } = await api.post<FriendAddResponse>("/friends/scan", { payload })
    const name = data.friend.user.nickname || data.friend.user.email || "好友"
    scanNotice.value = data.already_friend ? `你已经添加过 ${name}` : `已添加 ${name}`
  } catch (error: any) {
    scanError.value = error?.response?.data?.detail || "二维码识别失败"
  } finally {
    scanBusy.value = false
  }
}

function chooseQrImage() {
  scanFileInputRef.value?.click()
}

async function onQrFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""
  if (!file) return
  scanError.value = ""
  scanNotice.value = ""
  try {
    const image = await loadImageFromFile(file)
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth || image.width
    canvas.height = image.naturalHeight || image.height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("无法读取图片")
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height)
    if (!code?.data) throw new Error("没有识别到二维码")
    await submitScannedPayload(code.data)
  } catch (error: any) {
    scanError.value = error?.message || "二维码图片识别失败"
  }
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("图片加载失败"))
    }
    image.src = url
  })
}

function onClickOutside(e: MouseEvent) {
  if (showMenu.value) {
    const target = e.target as HTMLElement
    if (!target.closest(".profile-menu-trigger") && !target.closest(".profile-dropdown")) {
      closeMenu()
    }
  }
}

onMounted(() => {
  loadPlayState()
  void Promise.all([loadPackAvatars(), loadData()])
  document.addEventListener("click", onClickOutside, true)
})

watch(activeTab, (tab) => {
  if (tab === "imports" && auth.token && !importJobs.value.length) {
    void loadImportJobs()
  }
})

onBeforeUnmount(() => {
  stopQrCamera()
  document.removeEventListener("click", onClickOutside, true)
})
</script>

<template>
  <div class="profile-page">
    <div class="profile-top-spacer" />

    <!-- Right-top menu button -->
    <div class="profile-top-actions">
      <button class="profile-menu-trigger" @click.stop="toggleMenu">
        <span class="material-symbols-rounded">more_horiz</span>
      </button>

      <!-- Dropdown menu -->
      <Transition name="dropdown">
        <div v-if="showMenu" class="profile-dropdown">
          <div v-if="isLoggedIn" class="profile-dropdown-item" @click="onMenuClick('scan')">
            <span class="material-symbols-rounded" style="color: var(--accent-primary)">qr_code_scanner</span>
            <span>扫一扫</span>
          </div>
          <div v-if="isAdmin" class="profile-dropdown-item" @click="onMenuClick('admin')">
            <span class="material-symbols-rounded" style="color: var(--neon-red)">admin_panel_settings</span>
            <span>管理后台</span>
            <span class="profile-dropdown-badge">Admin</span>
          </div>
          <div class="profile-dropdown-item" @click="onMenuClick('privacy')">
            <span class="material-symbols-rounded" style="color: var(--text-secondary)">shield</span>
            <span>隐私政策</span>
          </div>
          <div v-if="isLoggedIn" class="profile-dropdown-item" @click="onMenuClick('logout')">
            <span class="material-symbols-rounded" style="color: var(--text-secondary)">logout</span>
            <span>退出登录</span>
          </div>
          <div class="profile-dropdown-item" @click="closeMenu">
            <span class="material-symbols-rounded" style="color: var(--text-secondary)">info</span>
            <span>关于蒸馏人类</span>
          </div>
        </div>
      </Transition>
    </div>

    <section class="profile-header cyber-animate-in">
      <button
        v-if="!isLoggedIn"
        class="profile-avatar profile-avatar--guest"
        @click="router.push('/auth')"
      >
        <span class="material-symbols-rounded" style="font-size: 28px; opacity: 0.5">person</span>
      </button>
      <div
        v-else
        class="profile-avatar"
        :style="{
          background: `linear-gradient(135deg, hsl(${avatarHue} 60% 48%), hsl(${(avatarHue + 50) % 360} 70% 55%))`,
        }"
      >
        <span class="profile-avatar-letter">{{ avatarLetter }}</span>
      </div>

      <h2 class="profile-name">{{ displayName }}</h2>
      <p v-if="isLoggedIn && emailDisplay" class="profile-id">
        <span class="material-symbols-rounded" style="font-size: 13px; margin-right: 2px; opacity: 0.6">alternate_email</span>
        {{ emailDisplay }}
        <button type="button" class="profile-qr-mini" aria-label="打开我的二维码" @click.stop="openQrSheet">
          <span class="material-symbols-rounded">qr_code_2</span>
        </button>
      </p>
      <p v-else-if="!isLoggedIn" class="profile-id">点击头像登录</p>

      <div v-if="isLoggedIn && selfProject" class="profile-user-citizen">
        <div class="profile-user-citizen-head">
          <span>公民身份</span>
          <strong>{{ citizenLabel(selfProject) }} · {{ citizenScore(selfProject) }} 分</strong>
        </div>
        <div class="citizen-meter-bar profile-user-citizen-bar">
          <span :style="{ width: citizenProgress(selfProject) }" />
        </div>
      </div>

      <button
        v-if="!isLoggedIn"
        class="profile-edit-btn profile-edit-btn--primary"
        @click="router.push('/auth')"
      >
        登录 / 注册
      </button>
    </section>

    <!-- Tab Bar — clickable stats -->
    <div v-if="isLoggedIn" class="profile-tabs cyber-animate-in" style="animation-delay: 80ms">
      <button
        v-for="tab in tabItems"
        :key="tab.key"
        class="profile-tab"
        :class="{ 'is-active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <span class="profile-tab-value">{{ tab.count }}</span>
        <span class="profile-tab-label">{{ tab.label }}</span>
        <div v-if="activeTab === tab.key" class="profile-tab-indicator" />
      </button>
    </div>

    <!-- Tab Content -->
    <div class="profile-tab-content cyber-animate-in" style="animation-delay: 140ms">
      <!-- 蒸馏 Tab — 宫格项目 -->
      <template v-if="activeTab === 'distill'">
        <div v-if="!projects.length" class="profile-empty">
          <span class="material-symbols-rounded" style="font-size: 36px; opacity: 0.3">science</span>
          <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 10px">还没有蒸馏项目</p>
          <button class="profile-empty-btn" @click="router.push('/projects')">
            <span class="material-symbols-rounded" style="font-size: 15px">add</span>
            开始蒸馏
          </button>
        </div>
        <template v-else-if="projectGridItems.length">
          <div class="profile-grid">
            <div
              v-for="(project, idx) in projectGridItems"
              :key="project.project_id"
              class="profile-grid-item"
              :class="{ 'is-reported': project.has_report, 'is-unknown': !project.has_report }"
              :style="{ animationDelay: `${idx * 40}ms` }"
            >
              <div
                class="profile-grid-portrait"
                :style="projectAvatarStyle(project)"
                @click="goToProject(project)"
              >
                <span class="profile-grid-scope">{{ projectScopeLabel(project) }}</span>
                <button
                  v-if="isSelfProject(project)"
                  type="button"
                  class="profile-grid-public"
                  :class="{ 'is-on': project.public_skill_published }"
                  :disabled="publishingProjectId === project.project_id || !project.has_report"
                  :aria-label="project.public_skill_published ? `取消公开 ${project.subject_name}` : `公开 ${project.subject_name}`"
                  @click.stop="togglePublicSkill(project)"
                >
                  <span class="material-symbols-rounded">
                    {{ publishingProjectId === project.project_id ? "progress_activity" : "travel_explore" }}
                  </span>
                </button>
                <div v-if="!project.has_report" class="profile-grid-unknown-mark">
                  <span class="material-symbols-rounded">person_search</span>
                </div>
                <button
                  v-if="!isSelfProject(project)"
                  type="button"
                  class="profile-grid-delete"
                  :disabled="deletingProjectId === project.project_id"
                  :aria-label="`删除 ${project.subject_name}`"
                  @click.stop="deleteProject(project)"
                >
                  <span class="material-symbols-rounded">
                    {{ deletingProjectId === project.project_id ? 'progress_activity' : 'delete' }}
                  </span>
                </button>
              </div>
              <div class="profile-grid-copy" @click="goToProject(project)">
                <p class="profile-grid-name">{{ project.subject_name }}</p>
                <div class="profile-grid-actions">
                  <button
                    v-if="project.has_report"
                    type="button"
                    class="profile-grid-action"
                    @click.stop="goToProject(project)"
                  >
                    查看报告
                  </button>
                  <button
                    type="button"
                    class="profile-grid-action profile-grid-action--ghost"
                    @click.stop="goToProjectChat(project)"
                  >
                    继续蒸馏
                  </button>
                </div>
              </div>
            </div>
          </div>
          <p v-if="actionNotice" class="profile-grid-notice">{{ actionNotice }}</p>
        </template>
      </template>

      <!-- 收藏 Tab -->
      <template v-if="activeTab === 'favorites'">
        <div class="profile-empty">
          <span class="material-symbols-rounded" style="font-size: 36px; opacity: 0.3">bookmark</span>
          <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 10px">暂无收藏</p>
          <p class="profile-empty-hint">为喜欢的 Skill 点赞即可收藏</p>
        </div>
      </template>

      <!-- 点赞 Tab -->
      <template v-if="activeTab === 'likes'">
        <div class="profile-empty">
          <span class="material-symbols-rounded" style="font-size: 36px; opacity: 0.3">favorite</span>
          <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 10px">暂无点赞</p>
          <p class="profile-empty-hint">为喜欢的 Skill 点赞</p>
        </div>
      </template>

      <!-- 导入 Tab -->
      <template v-if="activeTab === 'imports'">
        <div v-if="importJobsLoading" class="profile-empty">
          <span class="material-symbols-rounded import-loading-icon">progress_activity</span>
          <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 10px">加载中…</p>
        </div>
        <div v-else-if="!importJobs.length" class="profile-empty">
          <span class="material-symbols-rounded" style="font-size: 36px; opacity: 0.3">download</span>
          <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 10px">暂无导入记录</p>
          <p class="profile-empty-hint">点击右上角导入 GitHub 仓库</p>
          <button class="profile-empty-btn" @click="router.push('/projects/cyber')">
            <span class="material-symbols-rounded" style="font-size: 15px">add</span>
            去导入
          </button>
        </div>
        <div v-else class="import-job-list">
          <div
            v-for="(job, idx) in importJobs"
            :key="job.job_id"
            class="import-job-item"
            :style="{ animationDelay: `${idx * 40}ms` }"
          >
            <div
              class="import-job-icon"
              :class="{ 'import-job-icon--skill': Boolean(importJobAvatarPack(job)) }"
              :style="importJobAvatarPack(job) ? importJobAvatarStyle(job) : undefined"
            >
              <span v-if="!importJobAvatarPack(job)" class="material-symbols-rounded">
                {{ job.import_kind === 'persona_lookup' ? 'person_search' : 'code' }}
              </span>
            </div>
            <div class="import-job-info">
              <p class="import-job-name">{{ job.pack_title || extractRepoName(job.repo_url) }}</p>
              <p class="import-job-url">{{ extractRepoName(job.repo_url) }}</p>
              <div class="import-job-meta">
                <span
                  class="import-job-status"
                  :style="{ color: importJobStatusColor(job.status) }"
                >
                  {{ importJobStatusText(job.status, job.import_kind) }}
                </span>
                <span class="import-job-time">{{ formatTime(job.created_at) }}</span>
              </div>
              <p v-if="job.status === 'failed' && job.error_message" class="import-job-error">
                {{ job.error_message }}
              </p>
            </div>
            <div class="import-job-actions">
              <button
                v-if="job.status === 'failed'"
                class="import-job-btn import-job-btn--retry"
                :disabled="retryingJobId === job.job_id"
                @click="retryImportJob(job.job_id)"
              >
                <span class="material-symbols-rounded" style="font-size: 16px">
                  {{ retryingJobId === job.job_id ? 'progress_activity' : 'refresh' }}
                </span>
                重试
              </button>
              <button
                v-else-if="job.pack_slug && (job.status === 'chat_ready' || job.status === 'report_ready')"
                class="import-job-btn import-job-btn--view"
                @click="goToPack(job.pack_slug)"
              >
                <span class="material-symbols-rounded" style="font-size: 16px">arrow_forward</span>
                查看
              </button>
              <span
                v-else
                class="import-job-pending"
              >
                <span class="material-symbols-rounded" style="font-size: 16px; animation: spin 1.2s linear infinite">progress_activity</span>
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <SkillDetailSheet :slug="selectedSlug" @close="selectedSlug = null" />

    <Teleport to="body">
      <Transition name="profile-sheet">
        <div v-if="showQrSheet" class="profile-modal-mask" @click.self="closeQrSheet">
          <section class="profile-qr-sheet" role="dialog" aria-modal="true">
            <div class="project-action-handle" />
            <header class="profile-modal-header">
              <div>
                <span>我的专属二维码</span>
                <strong>{{ displayName }}</strong>
              </div>
              <button class="project-action-close" type="button" aria-label="关闭" @click="closeQrSheet">
                <span class="material-symbols-rounded">close</span>
              </button>
            </header>

            <div class="profile-qr-stage">
              <div v-if="qrLoading" class="profile-qr-loading">
                <span class="material-symbols-rounded import-loading-icon">progress_activity</span>
              </div>
              <canvas v-show="!qrLoading && !qrError" ref="qrCanvasRef" class="profile-qr-canvas" />
              <p v-if="qrError" class="profile-modal-error">{{ qrError }}</p>
            </div>
            <p class="profile-qr-caption">对方用“扫一扫”识别后，会添加你为好友。</p>
          </section>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="profile-sheet">
        <div v-if="showScanSheet" class="profile-modal-mask" @click.self="closeScanSheet">
          <section class="profile-scan-sheet" role="dialog" aria-modal="true">
            <div class="project-action-handle" />
            <header class="profile-modal-header">
              <div>
                <span>扫一扫</span>
                <strong>添加好友</strong>
              </div>
              <button class="project-action-close" type="button" aria-label="关闭" @click="closeScanSheet">
                <span class="material-symbols-rounded">close</span>
              </button>
            </header>

            <div class="profile-scan-frame">
              <video ref="scanVideoRef" class="profile-scan-video" muted playsinline />
              <div class="profile-scan-reticle">
                <i />
                <i />
                <i />
                <i />
              </div>
              <div v-if="scanBusy" class="profile-scan-busy">
                <span class="material-symbols-rounded import-loading-icon">progress_activity</span>
              </div>
            </div>
            <p v-if="scanNotice" class="profile-modal-success">{{ scanNotice }}</p>
            <p v-if="scanError" class="profile-modal-error">{{ scanError }}</p>
            <div class="profile-scan-actions">
              <button type="button" @click="startQrCamera">
                <span class="material-symbols-rounded">photo_camera</span>
                摄像头
              </button>
              <button type="button" @click="chooseQrImage">
                <span class="material-symbols-rounded">image_search</span>
                识别图片
              </button>
            </div>
            <input
              ref="scanFileInputRef"
              class="profile-scan-file"
              type="file"
              accept="image/*"
              @change="onQrFileSelected"
            />
          </section>
        </div>
      </Transition>
    </Teleport>

    <p class="profile-version">蒸馏人类 v0.1 · Distill.Human</p>
  </div>
</template>

<style scoped>
.profile-page {
  position: relative;
  padding: 0 0 calc(var(--tab-bar-height) + var(--safe-bottom) + 20px);
  min-height: 100vh;
  background: var(--bg-base);
  color: var(--text-primary);
}

/* ===== Top Spacer ===== */
.profile-top-spacer {
  height: 24px;
}

/* ===== Identity Summary ===== */
.profile-identity-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 42px 20px 18px;
  text-align: center;
}

.profile-main-avatar {
  width: 112px;
  height: 112px;
  padding: 0;
  border-radius: 50%;
  overflow: hidden;
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  border: 2px solid color-mix(in srgb, var(--accent-primary) 34%, transparent);
  box-shadow:
    0 0 0 8px color-mix(in srgb, var(--accent-primary) 7%, transparent),
    0 18px 44px rgba(0, 0, 0, 0.34);
  cursor: pointer;
}

.profile-identity-copy {
  display: grid;
  justify-items: center;
  gap: 8px;
  margin-top: 14px;
  min-width: 0;
  max-width: min(360px, 88vw);
}

.profile-identity-title-row {
  min-width: 0;
  cursor: pointer;
}

.profile-identity-kicker {
  color: var(--accent-primary);
  font-size: 0.68rem;
  font-weight: 900;
  line-height: 1.3;
}

.profile-identity-copy h1 {
  margin: 3px 0 0;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: clamp(1.34rem, 7vw, 1.85rem);
  font-weight: 900;
  line-height: 1.12;
  overflow-wrap: anywhere;
}

.profile-identity-tags {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 7px;
}

.profile-identity-tags span {
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
  font-size: 0.68rem;
  font-weight: 900;
  line-height: 1.35;
}

.profile-account-row {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  max-width: 100%;
  color: var(--text-secondary);
}

.profile-account-qr {
  width: 22px;
  height: 22px;
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 28%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
  color: var(--accent-primary);
  cursor: zoom-in;
}

.profile-account-qr .material-symbols-rounded {
  font-size: 14px;
}

.profile-account-copy {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.profile-account-copy span {
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.35;
}

.profile-account-copy strong {
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-citizen-summary {
  width: 100%;
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 18%, transparent);
  border-radius: 16px;
  background:
    radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--accent-primary) 14%, transparent), transparent 44%),
    var(--fill-secondary);
}

.profile-citizen-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.profile-citizen-heading span {
  color: var(--text-secondary);
  font-size: 0.68rem;
  font-weight: 800;
}

.profile-citizen-heading strong {
  color: var(--text-primary);
  font-size: 0.98rem;
  font-weight: 900;
}

.profile-citizen-bar {
  height: 10px;
}

.profile-identity-actions {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.profile-identity-action {
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--accent-primary);
  color: #fff;
  font: inherit;
  font-size: 0.74rem;
  font-weight: 800;
  cursor: pointer;
}

.profile-identity-action--ghost {
  border-color: var(--separator-soft);
  background: var(--fill-secondary);
  color: var(--text-primary);
}

.profile-identity-alert,
.profile-identity-mode-panel {
  width: 100%;
}

.profile-identity-mode-panel {
  margin-top: 0;
  text-align: left;
}

/* ===== Header ===== */
.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 20px 20px;
}

/* ===== Avatar ===== */
.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14);
}

.profile-avatar--guest {
  background: var(--fill-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  border: 1px solid var(--separator-soft);
  transition: transform 0.2s;
}
.profile-avatar--guest:active { transform: scale(0.95); }

.profile-avatar-letter {
  font-size: 2rem;
  font-weight: 900;
  color: #000;
  font-family: var(--font-display);
}

/* ===== Name ===== */
.profile-name {
  margin: 12px 0 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-primary);
}

.profile-id {
  margin: 3px 0 0;
  font-size: 0.7rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.profile-qr-mini {
  width: 24px;
  height: 24px;
  display: inline-grid;
  place-items: center;
  margin-left: 4px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 26%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent-primary) 9%, transparent);
  color: var(--accent-primary);
  cursor: pointer;
}

.profile-qr-mini .material-symbols-rounded {
  font-size: 15px;
}

.profile-user-citizen {
  width: min(320px, 100%);
  margin-top: 12px;
  display: grid;
  gap: 7px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 18%, transparent);
  border-radius: 14px;
  background:
    radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--accent-primary) 12%, transparent), transparent 44%),
    var(--fill-secondary);
}

.profile-user-citizen-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.profile-user-citizen-head span {
  color: var(--text-secondary);
  font-size: 0.68rem;
  font-weight: 800;
}

.profile-user-citizen-head strong {
  color: var(--text-primary);
  font-size: 0.8rem;
  font-weight: 900;
  text-align: center;
}

.profile-user-citizen-bar {
  height: 10px;
}

/* ===== Edit Button ===== */
.profile-edit-btn {
  margin-top: 14px;
  padding: 6px 24px;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  background: var(--fill-secondary);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}
.profile-edit-btn:active { transform: scale(0.96); background: var(--fill-primary); }
.profile-edit-btn--primary {
  border-color: transparent;
  background: var(--accent-primary);
  color: #fff;
}
.profile-edit-btn--primary:active { opacity: 0.88; }

/* ===== Tab Bar ===== */
.profile-tabs {
  display: flex;
  align-items: stretch;
  margin: 12px 16px 0;
  border-bottom: 1px solid var(--separator-soft);
  position: relative;
}

.profile-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 14px 0 12px;
  border: 0;
  background: transparent;
  cursor: pointer;
  transition: all 0.25s ease;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  min-height: 56px;
  border-radius: 8px 8px 0 0;
}

.profile-tab:active {
  background: var(--fill-tertiary);
  transform: scale(0.97);
}

.profile-tab-value {
  font-size: 1.25rem;
  font-weight: 900;
  color: var(--text-primary);
  font-family: var(--font-display);
  transition: all 0.25s ease;
  line-height: 1.2;
}

.profile-tab.is-active .profile-tab-value {
  color: var(--text-primary);
  text-shadow: none;
}

.profile-tab-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  letter-spacing: 0;
  font-weight: 600;
  transition: all 0.25s ease;
}

.profile-tab.is-active .profile-tab-label {
  color: var(--accent-primary);
  font-weight: 700;
}

.profile-tab-indicator {
  position: absolute;
  bottom: -1px;
  left: 20%;
  right: 20%;
  height: 3px;
  border-radius: 2px;
  background: var(--accent-primary);
  box-shadow: none;
}

@keyframes tab-glow {
  from { box-shadow: 0 0 8px rgba(245, 166, 35, 0.3), 0 0 3px rgba(245, 166, 35, 0.5); }
  to { box-shadow: 0 0 16px rgba(245, 166, 35, 0.5), 0 0 6px rgba(245, 166, 35, 0.7); }
}

/* ===== Tab Content ===== */
.profile-tab-content {
  padding: 16px;
  min-height: 200px;
}

/* ===== Empty State ===== */
.profile-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.profile-empty-hint {
  color: var(--text-tertiary);
  font-size: 0.7rem;
  margin: 4px 0 0;
}

.profile-empty-btn {
  margin-top: 14px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 18px;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  background: var(--fill-secondary);
  color: var(--accent-primary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}
.profile-empty-btn:active { transform: scale(0.96); background: var(--fill-primary); }

.profile-self-card {
  display: grid;
  grid-template-columns: 58px 1fr auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 14px;
  border-radius: 16px;
  background:
    radial-gradient(circle at top left, rgba(0, 245, 212, 0.14), transparent 38%),
    var(--fill-secondary);
  border: 1px solid rgba(0, 245, 212, 0.18);
  cursor: pointer;
}

.profile-self-avatar {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  border: 1px solid rgba(0, 245, 212, 0.28);
  box-shadow: 0 10px 28px rgba(0, 245, 212, 0.12);
}

.profile-self-copy {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.profile-self-copy span {
  color: var(--accent-primary);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.profile-self-copy strong {
  color: var(--text-primary);
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-self-copy p {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 700;
}

.profile-self-arrow {
  color: var(--text-secondary);
  font-size: 20px;
}

.profile-empty--compact {
  min-height: 72px;
}

/* ===== Grid ===== */
.profile-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 10px;
}

.profile-grid-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: transform 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  animation: profile-fade-in 0.35s ease both;
}

.profile-grid-item:active {
  transform: scale(0.97);
}

@keyframes profile-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.profile-grid-portrait {
  position: relative;
  width: 100%;
  aspect-ratio: 0.82;
  overflow: hidden;
  border: 1px solid var(--separator-soft);
  border-radius: 12px;
  background-size: cover;
  background-position: center;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
}

.profile-grid-portrait::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.08), transparent 42%),
    linear-gradient(0deg, rgba(0, 0, 0, 0.46), transparent 58%);
  pointer-events: none;
}

.profile-grid-item.is-unknown .profile-grid-portrait {
  background:
    radial-gradient(circle at 30% 18%, color-mix(in srgb, var(--accent-primary) 18%, transparent), transparent 34%),
    linear-gradient(145deg, var(--fill-tertiary), var(--bg-elevated)) !important;
}

.profile-grid-item.is-unknown .profile-grid-portrait::before {
  content: "";
  position: absolute;
  inset: -8px;
  background: inherit;
  filter: blur(6px) saturate(0.55);
  opacity: 0.72;
}

.profile-grid-scope {
  position: absolute;
  left: 7px;
  bottom: 7px;
  z-index: 2;
  max-width: calc(100% - 14px);
  padding: 3px 6px;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-elevated) 72%, transparent);
  color: var(--accent-primary);
  font-size: 0.52rem;
  font-weight: 800;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.profile-grid-unknown-mark {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  color: color-mix(in srgb, var(--text-primary) 78%, transparent);
}

.profile-grid-unknown-mark .material-symbols-rounded {
  font-size: 30px;
  text-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
}

.profile-grid-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 3;
  width: 28px;
  height: 28px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--neon-red) 36%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--bg-elevated) 72%, transparent);
  color: var(--neon-red);
  cursor: pointer;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.profile-grid-delete:disabled {
  opacity: 0.7;
  cursor: wait;
}

.profile-grid-delete .material-symbols-rounded {
  font-size: 17px;
}

.profile-grid-delete:disabled .material-symbols-rounded {
  animation: spin 1.2s linear infinite;
}

.profile-grid-public {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 3;
  width: 28px;
  height: 28px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--bg-elevated) 72%, transparent);
  color: var(--text-secondary);
  cursor: pointer;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.profile-grid-public.is-on {
  border-color: color-mix(in srgb, var(--accent-primary) 40%, transparent);
  color: var(--accent-primary);
}

.profile-grid-public:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.profile-grid-public .material-symbols-rounded {
  font-size: 17px;
}

.profile-grid-public:disabled .material-symbols-rounded {
  animation: spin 1.2s linear infinite;
}

.profile-grid-copy {
  min-width: 0;
}

.profile-grid-name {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--text-primary);
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.profile-grid-actions {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 6px;
}

.profile-grid-action {
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 28%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
  font: inherit;
  font-size: 0.58rem;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
}

.profile-grid-action--ghost {
  border-color: var(--separator-soft);
  background: var(--fill-secondary);
  color: var(--text-secondary);
}

.profile-grid-meta {
  display: flex;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 0.54rem;
  font-weight: 800;
  line-height: 1.25;
}

.profile-grid-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-grid-notice {
  margin: 12px 2px 0;
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 700;
  text-align: center;
}

/* ===== Project Action Sheet ===== */
.project-action-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.project-action-sheet {
  width: min(100%, 520px);
  max-height: min(86vh, 720px);
  overflow-y: auto;
  padding: 10px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  border: 1px solid var(--separator-soft);
  border-radius: 22px 22px 18px 18px;
  background: color-mix(in srgb, var(--bg-elevated) 96%, transparent);
  box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.32);
}

.project-action-handle {
  width: 42px;
  height: 4px;
  margin: 0 auto 14px;
  border-radius: var(--radius-full);
  background: var(--separator-soft);
}

.project-action-header {
  display: grid;
  grid-template-columns: 58px 1fr 36px;
  align-items: center;
  gap: 12px;
}

.project-action-avatar {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  border: 1px solid var(--separator-soft);
}

.project-action-title {
  min-width: 0;
}

.project-action-title span {
  color: var(--accent-primary);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.project-action-title strong {
  display: block;
  margin-top: 3px;
  color: var(--text-primary);
  font-size: 1.05rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-action-title p {
  margin: 3px 0 0;
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
}

.project-action-close {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: var(--fill-secondary);
  color: var(--text-secondary);
  display: inline-grid;
  place-items: center;
  cursor: pointer;
}

.project-action-close .material-symbols-rounded {
  font-size: 19px;
}

.citizen-meter {
  margin-top: 16px;
}

.citizen-meter-bar {
  height: 8px;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: var(--fill-secondary);
}

.citizen-meter-bar span {
  display: block;
  height: 100%;
  min-width: 6px;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent-primary), var(--neon-gold));
}

.citizen-meter p,
.skill-tree-panel p {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 0.7rem;
  line-height: 1.6;
}

.identity-alert {
  display: grid;
  grid-template-columns: 22px 1fr auto;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--neon-red) 24%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--neon-red) 10%, transparent);
}

.identity-alert p {
  margin: 0;
  color: var(--text-primary);
  font-size: 0.74rem;
  font-weight: 700;
}

.identity-alert button {
  border: 0;
  background: transparent;
  color: var(--neon-red);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 800;
}

.project-action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.project-action-btn {
  min-height: 96px;
  display: grid;
  align-content: start;
  gap: 5px;
  padding: 12px;
  border: 1px solid var(--separator-soft);
  border-radius: 14px;
  background: var(--fill-secondary);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}

.project-action-btn .material-symbols-rounded {
  color: var(--accent-primary);
  font-size: 22px;
}

.project-action-btn strong {
  font-size: 0.84rem;
}

.project-action-btn small {
  color: var(--text-secondary);
  font-size: 0.66rem;
  line-height: 1.45;
}

.project-action-btn--danger .material-symbols-rounded {
  color: var(--neon-red);
}

.identity-mode-panel,
.public-skill-panel,
.sandbox-panel,
.skill-tree-panel {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid var(--separator-soft);
  border-radius: 14px;
  background: var(--fill-secondary);
}

.identity-mode-panel {
  background:
    radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--accent-primary) 16%, transparent), transparent 42%),
    var(--fill-secondary);
}

.public-skill-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.public-skill-copy {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.public-skill-copy .material-symbols-rounded {
  color: var(--accent-primary);
  font-size: 22px;
}

.public-skill-copy strong {
  display: block;
  color: var(--text-primary);
  font-size: 0.82rem;
}

.public-skill-copy p {
  margin: 3px 0 0;
  color: var(--text-secondary);
  font-size: 0.68rem;
  line-height: 1.35;
}

.public-skill-toggle {
  flex: 0 0 auto;
  height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 5px 4px 10px;
  border: 1px solid var(--separator-soft);
  border-radius: 999px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 0.68rem;
  font-weight: 800;
  cursor: pointer;
}

.public-skill-toggle i {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: background 0.2s ease;
}

.public-skill-toggle.is-on {
  border-color: color-mix(in srgb, var(--accent-primary) 36%, transparent);
  color: var(--accent-primary);
}

.public-skill-toggle.is-on i {
  background: var(--accent-primary);
}

.public-skill-toggle:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.sandbox-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: 0.82rem;
  font-weight: 800;
}

.sandbox-heading .material-symbols-rounded {
  color: var(--accent-primary);
  font-size: 20px;
}

.identity-mode-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.identity-mode-btn {
  min-height: 70px;
  display: grid;
  align-content: center;
  gap: 4px;
  padding: 10px 6px;
  border: 1px solid var(--separator-soft);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-elevated) 72%, transparent);
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.identity-mode-btn:active {
  transform: scale(0.96);
}

.identity-mode-btn strong {
  color: var(--text-primary);
  font-size: 0.78rem;
  line-height: 1.25;
}

.identity-mode-btn small {
  color: var(--text-secondary);
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1.35;
}

.identity-mode-btn.is-active {
  border-color: color-mix(in srgb, var(--accent-primary) 42%, transparent);
  background: color-mix(in srgb, var(--accent-primary) 13%, var(--bg-elevated));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-primary) 12%, transparent);
}

.identity-mode-btn.is-active strong,
.identity-mode-btn.is-active small {
  color: var(--accent-primary);
}

.identity-mode-copy {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 0.7rem;
  line-height: 1.6;
}

.identity-boundary-note {
  margin: 12px 0 0;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--accent-warning) 24%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent-warning) 10%, transparent);
  color: var(--text-primary);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.6;
}

.sandbox-select {
  width: 100%;
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid var(--separator-soft);
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  font: inherit;
  font-size: 0.78rem;
}

.sandbox-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.sandbox-actions button {
  min-height: 34px;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
  color: var(--accent-primary);
  font: inherit;
  font-size: 0.7rem;
  font-weight: 800;
  cursor: pointer;
}

.project-action-notice {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
  color: var(--text-primary);
  font-size: 0.74rem;
  line-height: 1.6;
}

.profile-sheet-enter-active,
.profile-sheet-leave-active {
  transition: opacity 0.18s ease;
}

.profile-sheet-enter-active .project-action-sheet,
.profile-sheet-leave-active .project-action-sheet {
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.profile-sheet-enter-from,
.profile-sheet-leave-to {
  opacity: 0;
}

.profile-sheet-enter-from .project-action-sheet,
.profile-sheet-leave-to .project-action-sheet {
  transform: translateY(22px);
}

.profile-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.profile-qr-sheet,
.profile-scan-sheet {
  width: min(100%, 520px);
  padding: 10px 16px calc(18px + env(safe-area-inset-bottom, 0px));
  border: 1px solid var(--separator-soft);
  border-radius: 22px 22px 18px 18px;
  background: color-mix(in srgb, var(--bg-elevated) 96%, transparent);
  box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.32);
}

.profile-modal-header {
  display: grid;
  grid-template-columns: 1fr 36px;
  align-items: center;
  gap: 12px;
}

.profile-modal-header span {
  color: var(--accent-primary);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.profile-modal-header strong {
  display: block;
  margin-top: 3px;
  color: var(--text-primary);
  font-size: 1.04rem;
}

.profile-qr-stage {
  display: grid;
  place-items: center;
  min-height: 250px;
  margin-top: 16px;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 18%, transparent);
  border-radius: 16px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, transparent), transparent),
    var(--fill-secondary);
}

.profile-qr-canvas {
  width: 220px;
  height: 220px;
  padding: 10px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.22);
}

.profile-qr-loading {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  color: var(--accent-primary);
}

.profile-qr-caption,
.profile-modal-success,
.profile-modal-error {
  margin: 12px 0 0;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.55;
  text-align: center;
}

.profile-qr-caption {
  color: var(--text-secondary);
}

.profile-modal-success {
  color: var(--accent-primary);
}

.profile-modal-error {
  color: var(--neon-red);
}

.profile-scan-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  max-height: 420px;
  margin-top: 16px;
  overflow: hidden;
  border: 1px solid var(--separator-soft);
  border-radius: 18px;
  background: var(--fill-secondary);
}

.profile-scan-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #05070a;
}

.profile-scan-reticle {
  position: absolute;
  inset: 15%;
  pointer-events: none;
}

.profile-scan-reticle i {
  position: absolute;
  width: 28px;
  height: 28px;
  border-color: var(--accent-primary);
  border-style: solid;
}

.profile-scan-reticle i:nth-child(1) { top: 0; left: 0; border-width: 3px 0 0 3px; }
.profile-scan-reticle i:nth-child(2) { top: 0; right: 0; border-width: 3px 3px 0 0; }
.profile-scan-reticle i:nth-child(3) { right: 0; bottom: 0; border-width: 0 3px 3px 0; }
.profile-scan-reticle i:nth-child(4) { bottom: 0; left: 0; border-width: 0 0 3px 3px; }

.profile-scan-busy {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.38);
  color: var(--accent-primary);
}

.profile-scan-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.profile-scan-actions button {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 22%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
  color: var(--accent-primary);
  font: inherit;
  font-size: 0.74rem;
  font-weight: 800;
  cursor: pointer;
}

.profile-scan-actions .material-symbols-rounded {
  font-size: 18px;
}

.profile-scan-file {
  display: none;
}

/* ===== Top Actions / Dropdown Menu ===== */
.profile-top-actions {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 10px);
  right: 10px;
  display: flex;
  justify-content: flex-end;
  padding: 0;
  z-index: 140;
}

.profile-menu-trigger {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--text-primary) 10%, transparent);
  background: color-mix(in srgb, var(--bg-elevated) 78%, transparent);
  color: var(--text-secondary);
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.profile-menu-trigger:active {
  transform: scale(0.92);
  background: var(--fill-primary);
}
.profile-menu-trigger .material-symbols-rounded {
  font-size: 22px;
}

.profile-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg-elevated) 96%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--separator-soft);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.14);
  overflow: hidden;
  z-index: 150;
}

.profile-dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
  position: relative;
}
.profile-dropdown-item:not(:last-child)::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 44px;
  right: 16px;
  height: 1px;
  background: var(--separator-soft);
}
.profile-dropdown-item:active {
  background: var(--fill-secondary);
}
.profile-dropdown-item .material-symbols-rounded {
  font-size: 20px;
  flex-shrink: 0;
}

.profile-dropdown-badge {
  margin-left: auto;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  font-size: 0.6rem;
  font-weight: 700;
  background: rgba(255, 59, 48, 0.12);
  border: 1px solid rgba(255, 59, 48, 0.18);
  color: var(--neon-red);
}

/* Dropdown transition */
.dropdown-enter-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown-leave-active {
  transition: all 0.15s ease-in;
}
.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

/* ===== Version ===== */
.profile-version {
  text-align: center;
  font-size: 0.65rem;
  color: var(--text-tertiary);
  margin: 24px 0 0;
  letter-spacing: 0;
}

/* ===== Import Job List ===== */
.import-loading-icon {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.import-job-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.import-job-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--separator-soft);
  transition: all 0.2s;
  animation: profile-fade-in 0.35s ease both;
}

.import-job-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent-primary) 10%, var(--bg-elevated));
  border: 1px solid color-mix(in srgb, var(--accent-primary) 18%, transparent);
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
}

.import-job-icon--skill {
  overflow: hidden;
  border-color: var(--separator-soft);
}

.import-job-icon .material-symbols-rounded {
  font-size: 20px;
  color: var(--accent-primary);
}

.import-job-info {
  flex: 1;
  min-width: 0;
}

.import-job-name {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.import-job-url {
  margin: 2px 0 0;
  font-size: 0.68rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.import-job-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.import-job-status {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.import-job-time {
  font-size: 0.62rem;
  color: var(--text-tertiary);
}

.import-job-error {
  margin: 6px 0 0;
  font-size: 0.65rem;
  color: var(--neon-red);
  opacity: 0.8;
  line-height: 1.4;
  word-break: break-all;
}

.import-job-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  align-self: center;
}

.import-job-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 5px 12px;
  border-radius: var(--radius-full);
  border: 1px solid;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}

.import-job-btn:active {
  transform: scale(0.95);
}

.import-job-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.import-job-btn--retry {
  border-color: rgba(255, 59, 48, 0.25);
  background: rgba(255, 59, 48, 0.06);
  color: var(--neon-red);
}

.import-job-btn--retry:active:not(:disabled) {
  background: rgba(255, 59, 48, 0.12);
}

.import-job-btn--view {
  border-color: color-mix(in srgb, var(--accent-primary) 24%, transparent);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
  color: var(--accent-primary);
}

.import-job-btn--view:active {
  background: color-mix(in srgb, var(--accent-primary) 14%, transparent);
}

.import-job-pending {
  display: inline-flex;
  align-items: center;
  color: var(--text-secondary);
  opacity: 0.5;
}

@media (max-width: 430px) {
  .project-action-mask {
    padding: 10px;
  }

  .project-action-grid {
    grid-template-columns: 1fr;
  }

  .project-action-btn {
    min-height: 78px;
  }

  .sandbox-actions {
    grid-template-columns: 1fr;
  }

  .identity-mode-grid {
    grid-template-columns: 1fr;
  }
}
</style>
