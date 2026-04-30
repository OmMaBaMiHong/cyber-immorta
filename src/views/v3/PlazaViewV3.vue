<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import axios from "axios"
import SkillDetailSheet from "@/components/v3/SkillDetailSheet.vue"
import { api } from "@/lib/api"
import { skillAvatarImageUrl } from "@/lib/skillAvatar"
import { useAuthStore } from "@/stores/auth"
import {
  sbtiCardAccentStyle,
  sbtiRebirthBackgroundUrl,
  sbtiRebirthCards,
  type SbtiArchetype,
  type SbtiRebirthCard,
} from "@/v2/data/sbtiRebirthCatalog"
import type {
  PlazaComment,
  PlazaCommentListResponse,
  PlazaPost,
  PlazaPostLikeToggleResponse,
  PlazaPostListResponse,
} from "@/types"

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8091"
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

type PlazaSection = "square" | "map" | "human" | "rebirth"
type PackFilterKey = "all" | "person" | "system" | "skill"
type RebirthFilterKey = "all" | SbtiArchetype

interface PackSummary {
  slug: string
  title: string
  subtitle: string
  domain: string
  avatar_label: string
  hero_background: string
  tags: string[]
  skills: string[]
  suitable_for: string[]
  source_count: number
  source_types: string[]
  factory_category: string
  factory_category_label: string
  display_group: string
  display_group_label: string
  like_count?: number
  usage_count?: number
}

const packs = ref<PackSummary[]>([])
const loading = ref(true)
const loadError = ref(false)
const activeFilter = ref<PackFilterKey>("all")
const selectedSlug = ref<string | null>(null)
const searchText = ref("")
const activeSection = ref<PlazaSection>("human")
const viewMode = ref<"planet" | "card" | "list">("planet")
const networkRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const networkNodes = ref<{ id: string; x: number; y: number; vx: number; vy: number; color: typeof COSMOS_PALETTE[0]; label: string; sublabel: string; image: string; r: number }[]>([])
const networkDrag = ref<{ active: boolean; nodeId: string | null; offsetX: number; offsetY: number }>({ active: false, nodeId: null, offsetX: 0, offsetY: 0 })
const networkHover = ref<string | null>(null)
let networkRAF = 0
const showImportMenu = ref(false)
const showGithubImport = ref(false)
const importRepoUrl = ref("")
const importing = ref(false)
const importError = ref("")
const importSuccess = ref("")
const squareLoading = ref(true)
const squareError = ref("")
const plazaPosts = ref<PlazaPost[]>([])
const expandedPostId = ref("")
const loadingCommentsFor = ref("")
const submittingCommentFor = ref("")
const likingPostId = ref("")
const commentMap = ref<Record<string, PlazaComment[]>>({})
const commentDraftMap = ref<Record<string, string>>({})
const rebirthFilter = ref<RebirthFilterKey>("all")
const selectedPersonality = ref<SbtiRebirthCard | null>(null)
const brokenPortraitCodes = ref<Record<string, true>>({})
const rebirthVariantSeed = ref(Math.floor(Math.random() * 100000))

const sections: Array<{ key: PlazaSection; label: string; icon: string }> = [
  { key: "human", label: "新人类", icon: "smart_toy" },
  { key: "square", label: "广场", icon: "grid_view" },
  { key: "rebirth", label: "重生模板", icon: "auto_awesome" },
  { key: "map", label: "地图", icon: "public" },
]

const filters: Array<{ key: PackFilterKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "person", label: "人物" },
  { key: "system", label: "系统" },
  { key: "skill", label: "技能" },
]

const rebirthFilters: Array<{ key: RebirthFilterKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "command", label: "统筹型" },
  { key: "care", label: "抚慰型" },
  { key: "detached", label: "观察型" },
  { key: "chaotic", label: "高动能" },
  { key: "fragile", label: "低电量" },
]

function normalizePackCategory(pack: PackSummary): Exclude<PackFilterKey, "all"> {
  switch (pack.display_group) {
    case "person": return "person"
    case "theme": return "system"
    case "system": return "system"
    case "tool_entry": return "skill"
    case "tool": return "skill"
    case "skill": return "skill"
    default:
      if (pack.factory_category === "professional_role") return "system"
      if (pack.factory_category === "tool_agent") return "skill"
      return "person"
  }
}

const categoryCounts = computed<Record<PackFilterKey, number>>(() => {
  const counts: Record<PackFilterKey, number> = {
    all: packs.value.length,
    person: 0,
    system: 0,
    skill: 0,
  }
  for (const pack of packs.value) {
    counts[normalizePackCategory(pack)] += 1
  }
  return counts
})

function filterCount(key: PackFilterKey) {
  return categoryCounts.value[key] || 0
}

function cycleViewMode() {
  viewMode.value = viewMode.value === "planet" ? "card" : viewMode.value === "card" ? "list" : "planet"
}

const filteredPacks = computed(() => {
  let result = packs.value
  if (activeFilter.value !== "all") {
    result = result.filter((p) => normalizePackCategory(p) === activeFilter.value)
  }
  const q = searchText.value.trim().toLowerCase()
  if (q) {
    result = result.filter((p) => {
      return (
        p.title.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.skills.some((s) => s.toLowerCase().includes(q)) ||
        (p.display_group_label || "").toLowerCase().includes(q) ||
        (p.factory_category_label || "").toLowerCase().includes(q)
      )
    })
  }
  return result
})

const leftCol = computed(() => filteredPacks.value.filter((_, i) => i % 2 === 0))
const rightCol = computed(() => filteredPacks.value.filter((_, i) => i % 2 === 1))
const viewModeIcon = computed(() => {
  if (viewMode.value === "planet") return "blur_circular"
  if (viewMode.value === "card") return "grid_view"
  return "view_list"
})
const viewModeTitle = computed(() => {
  if (viewMode.value === "planet") return "星球视图，点击切换卡片"
  if (viewMode.value === "card") return "卡片视图，点击切换列表"
  return "列表视图，点击切换星球"
})
const isAuthenticated = computed(() => Boolean(auth.token))
const highlightPostId = computed(() => {
  const raw = Array.isArray(route.query.postId) ? route.query.postId[0] : route.query.postId
  return typeof raw === "string" ? raw : ""
})
const squarePostsOrdered = computed(() => {
  if (!highlightPostId.value) return plazaPosts.value
  const target = plazaPosts.value.find((item) => item.post_id === highlightPostId.value)
  if (!target) return plazaPosts.value
  return [target, ...plazaPosts.value.filter((item) => item.post_id !== highlightPostId.value)]
})
const squareLeftCol = computed(() => squarePostsOrdered.value.filter((_, index) => index % 2 === 0))
const squareRightCol = computed(() => squarePostsOrdered.value.filter((_, index) => index % 2 === 1))
const filteredRebirthCards = computed(() => {
  if (rebirthFilter.value === "all") return sbtiRebirthCards
  return sbtiRebirthCards.filter((item) => item.visual.archetype === rebirthFilter.value)
})

watch(activeFilter, () => {})
watch(
  () => route.query.section,
  (value) => {
    const normalized = Array.isArray(value) ? value[0] : value
    if (normalized === "square" || normalized === "map" || normalized === "human" || normalized === "rebirth") {
      activeSection.value = normalized
    }
  },
  { immediate: true },
)

async function loadPacks() {
  loading.value = true
  loadError.value = false
  try {
    const token = localStorage.getItem("distill-human-token")
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    const { data } = await axios.get<{ items: PackSummary[] }>(`${API_BASE}/packs`, { headers, timeout: 10000 })
    packs.value = data.items || []
  } catch (err: any) {
    if (err.response?.status === 401) {
      packs.value = []
    } else {
      loadError.value = true
      packs.value = []
    }
  } finally {
    loading.value = false
  }
}

function formatFeedTime(value: string) {
  if (!value) return "刚刚"
  try {
    const now = Date.now()
    const time = new Date(value).getTime()
    const diff = Math.max(0, now - time)
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour
    if (diff < hour) return `${Math.max(1, Math.round(diff / minute || 1))} 分钟前`
    if (diff < day) return `${Math.max(1, Math.round(diff / hour))} 小时前`
    if (diff < 7 * day) return `${Math.max(1, Math.round(diff / day))} 天前`
    return new Date(value).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })
  } catch {
    return value
  }
}

function upsertPlazaPost(next: PlazaPost) {
  const cloned = [...plazaPosts.value]
  const index = cloned.findIndex((item) => item.post_id === next.post_id)
  if (index >= 0) cloned[index] = next
  else cloned.unshift(next)
  plazaPosts.value = cloned
}

function displayComments(postId: string) {
  return commentMap.value[postId] || plazaPosts.value.find((item) => item.post_id === postId)?.comments_preview || []
}

async function loadPlazaPosts() {
  squareLoading.value = true
  squareError.value = ""
  try {
    const { data } = await api.get<PlazaPostListResponse>("/plaza/posts", { params: { limit: 60 } })
    plazaPosts.value = data.items || []
  } catch (error: any) {
    squareError.value = error?.response?.data?.detail || error?.message || "广场加载失败"
  } finally {
    squareLoading.value = false
  }
}

async function requireLogin() {
  if (isAuthenticated.value) return true
  await router.push({ name: "auth", query: { redirect: route.fullPath } })
  return false
}

async function togglePostLike(postId: string) {
  if (!(await requireLogin())) return
  likingPostId.value = postId
  try {
    const { data } = await api.post<PlazaPostLikeToggleResponse>(`/plaza/posts/${postId}/like`)
    upsertPlazaPost(data.post)
  } finally {
    likingPostId.value = ""
  }
}

async function loadComments(postId: string) {
  loadingCommentsFor.value = postId
  try {
    const { data } = await api.get<PlazaCommentListResponse>(`/plaza/posts/${postId}/comments`, { params: { limit: 200 } })
    commentMap.value = {
      ...commentMap.value,
      [postId]: data.items,
    }
  } finally {
    loadingCommentsFor.value = ""
  }
}

async function toggleComments(postId: string) {
  if (expandedPostId.value === postId) {
    expandedPostId.value = ""
    return
  }
  expandedPostId.value = postId
  if (!commentMap.value[postId]) {
    await loadComments(postId)
  }
}

async function submitComment(postId: string) {
  if (!(await requireLogin())) return
  const draft = String(commentDraftMap.value[postId] || "").trim()
  if (!draft) return
  submittingCommentFor.value = postId
  try {
    const { data } = await api.post<PlazaComment>(`/plaza/posts/${postId}/comments`, { content: draft })
    const existing = commentMap.value[postId] || []
    commentMap.value = {
      ...commentMap.value,
      [postId]: [...existing, data],
    }
    commentDraftMap.value = {
      ...commentDraftMap.value,
      [postId]: "",
    }
    const target = plazaPosts.value.find((item) => item.post_id === postId)
    if (target) {
      upsertPlazaPost({
        ...target,
        comment_count: target.comment_count + 1,
        comments_preview: [...target.comments_preview.slice(-1), data].slice(-2),
      })
    }
  } finally {
    submittingCommentFor.value = ""
  }
}

function getHeroImage(pack: PackSummary): string {
  return skillAvatarImageUrl(pack, pack.slug)
}

function cardAccentStyle(item: SbtiRebirthCard) {
  return sbtiCardAccentStyle(item)
}

function resolvedPortrait(item: SbtiRebirthCard) {
  return brokenPortraitCodes.value[item.code] ? item.portraitFallbackUrl : item.portraitUrl
}

function rebirthTemplateBackground(item: SbtiRebirthCard) {
  return sbtiRebirthBackgroundUrl(item, String(rebirthVariantSeed.value))
}

function hasRebirthTemplateBackground(item: SbtiRebirthCard) {
  return Boolean(rebirthTemplateBackground(item))
}

function rebirthTemplateStageStyle(item: SbtiRebirthCard) {
  const background = rebirthTemplateBackground(item)
  if (!background) return undefined
  return { "--rebirth-template-bg": `url("${background}")` }
}

function markPortraitBroken(code: string) {
  brokenPortraitCodes.value = {
    ...brokenPortraitCodes.value,
    [code]: true,
  }
}

function distillEntryLink(item: SbtiRebirthCard) {
  return {
    name: "projects-cyber",
    query: {
      targetKey: "self",
      subjectName: "我",
      projectName: `${item.label} ${item.cardTitle} 对照蒸馏`,
      source: "rebirth-template",
      template: item.code,
    },
  }
}

function openRebirthDetail(item: SbtiRebirthCard) {
  selectedPersonality.value = item
  document.body.style.overflow = "hidden"
}

function closeRebirthDetail() {
  selectedPersonality.value = null
  document.body.style.overflow = ""
}

// ── Network Graph (Planet View) ──
const COSMOS_PALETTE = [
  { ring: "#00d4ff", sphere: "#0066ff", deep: "#001a44", glow: "rgba(0, 212, 255, 0.5)" },
  { ring: "#a855f7", sphere: "#7c3aed", deep: "#1a0044", glow: "rgba(168, 85, 247, 0.5)" },
  { ring: "#ff6b35", sphere: "#dc2626", deep: "#441100", glow: "rgba(255, 107, 53, 0.5)" },
  { ring: "#00f5d4", sphere: "#059669", deep: "#002211", glow: "rgba(0, 245, 212, 0.5)" },
  { ring: "#f472b6", sphere: "#db2777", deep: "#440022", glow: "rgba(244, 114, 182, 0.5)" },
  { ring: "#facc15", sphere: "#ca8a04", deep: "#332200", glow: "rgba(250, 204, 21, 0.5)" },
  { ring: "#38bdf8", sphere: "#0284c7", deep: "#001a33", glow: "rgba(56, 189, 248, 0.5)" },
  { ring: "#fb923c", sphere: "#ea580c", deep: "#331100", glow: "rgba(251, 146, 60, 0.5)" },
  { ring: "#c084fc", sphere: "#9333ea", deep: "#220044", glow: "rgba(192, 132, 252, 0.5)" },
]

function cosmosColor(index: number) {
  return COSMOS_PALETTE[index % COSMOS_PALETTE.length]
}

// Edge list for network connections
const networkEdges = ref<{ source: number; target: number }[]>([])

// Build network nodes from packs
function buildNetwork(packs: PackSummary[]) {
  const container = networkRef.value
  if (!container) return
  const W = container.clientWidth
  const H = container.clientHeight
  const cx = W / 2
  const cy = H / 2
  const maxR = Math.min(W, H) * 0.42
  const items = packs.slice(0, 24)
  const n = items.length

  // Place nodes in a golden-angle spiral for organic feel
  networkNodes.value = items.map((pack, i) => {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)) // ~137.5°
    const angle = i * goldenAngle
    const dist = i === 0 ? 0 : maxR * Math.sqrt((i / n)) * 0.9
    return {
      id: pack.slug,
      x: cx + Math.cos(angle) * dist + (Math.random() - 0.5) * 10,
      y: cy + Math.sin(angle) * dist + (Math.random() - 0.5) * 10,
      vx: 0,
      vy: 0,
      color: cosmosColor(i),
      label: pack.title,
      sublabel: pack.display_group_label || pack.factory_category_label,
      image: getHeroImage(pack),
      r: i === 0 ? 44 : 26 + Math.min(pack.usage_count || 0, 500) * 0.01,
    }
  })

  // Build edges
  const edges: { source: number; target: number }[] = []
  const edgeSet = new Set<string>()
  const addEdge = (a: number, b: number) => {
    const key = Math.min(a, b) + '-' + Math.max(a, b)
    if (a !== b && !edgeSet.has(key)) {
      edgeSet.add(key)
      edges.push({ source: a, target: b })
    }
  }
  // Hub connections: every node connects to center (node 0)
  for (let i = 1; i < n; i++) addEdge(0, i)
  // Ring connections
  for (let i = 0; i < n - 1; i++) {
    addEdge(i, i + 1)
    if (i + 2 < n && i % 2 === 0) addEdge(i, i + 2)
  }
  // Random cross-links
  for (let k = 0; k < Math.floor(n * 0.25); k++) {
    const a = Math.floor(Math.random() * n)
    const b = Math.floor(Math.random() * n)
    if (Math.abs(a - b) > 3) addEdge(a, b)
  }
  networkEdges.value = edges

  // Setup canvas
  const canvas = canvasRef.value
  if (canvas) {
    canvas.width = W * devicePixelRatio
    canvas.height = H * devicePixelRatio
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'
  }

  startNetworkSimulation()
}

// Force-directed simulation with Canvas edge rendering
function startNetworkSimulation() {
  if (networkRAF) cancelAnimationFrame(networkRAF)
  const nodes = networkNodes.value
  const edges = networkEdges.value
  if (!nodes.length) return
  const container = networkRef.value!
  const canvas = canvasRef.value!
  if (!container || !canvas) return
  const ctx = canvas.getContext('2d')!
  const dpr = devicePixelRatio

  function tick() {
    const W = container!.clientWidth
    const H = container!.clientHeight
    const cx = W / 2
    const cy = H / 2
    const n = nodes.length

    // ── Spring forces along edges ──
    for (const edge of edges) {
      const a = nodes[edge.source]
      const b = nodes[edge.target]
      if (!a || !b) continue
      let dx = b.x - a.x
      let dy = b.y - a.y
      let dist = Math.sqrt(dx * dx + dy * dy) || 1
      const idealDist = a.r + b.r + 70
      const force = (dist - idealDist) * 0.002
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      a.vx += fx; a.vy += fy
      b.vx -= fx; b.vy -= fy
    }

    for (let i = 0; i < n; i++) {
      const a = nodes[i]
      // Center gravity (very gentle)
      a.vx += (cx - a.x) * 0.0003
      a.vy += (cy - a.y) * 0.0003

      // Strong repulsion between all pairs
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let dist = Math.sqrt(dx * dx + dy * dy) || 1
        const minDist = a.r + b.r + 50
        if (dist < minDist) {
          const force = (minDist - dist) * 0.025
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          a.vx += fx; a.vy += fy
          b.vx -= fx; b.vy -= fy
        }
      }

      // Boundary
      const pad = a.r + 18
      if (a.x < pad) a.vx += (pad - a.x) * 0.05
      if (a.x > W - pad) a.vx += (W - pad - a.x) * 0.05
      if (a.y < pad) a.vy += (pad - a.y) * 0.05
      if (a.y > H - pad) a.vy += (H - pad - a.y) * 0.05

      // Damping
      a.vx *= 0.82
      a.vy *= 0.82

      // Don't move if being dragged
      if (networkDrag.value.nodeId === a.id) continue
      a.x += a.vx
      a.y += a.vy
    }

    // ── Draw edges on canvas ──
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    for (const edge of edges) {
      const a = nodes[edge.source]
      const b = nodes[edge.target]
      if (!a || !b) continue
      // Outer glow layer
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = a.color.ring
      ctx.globalAlpha = 0.06
      ctx.lineWidth = 6
      ctx.stroke()
      // Inner glow layer
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = a.color.ring
      ctx.globalAlpha = 0.12
      ctx.lineWidth = 2.5
      ctx.stroke()
      // Core line
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = '#ffffff'
      ctx.globalAlpha = 0.08
      ctx.lineWidth = 0.8
      ctx.stroke()
    }
    ctx.restore()

    networkRAF = requestAnimationFrame(tick)
  }
  tick()
}

// Drag handlers
let dragStartPos = { x: 0, y: 0 }

function onNodePointerDown(e: PointerEvent, id: string) {
  const node = networkNodes.value.find(n => n.id === id)
  if (!node) return
  const container = networkRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  dragStartPos = { x: e.clientX, y: e.clientY }
  networkDrag.value = {
    active: true,
    nodeId: id,
    offsetX: e.clientX - rect.left - node.x,
    offsetY: e.clientY - rect.top - node.y,
  }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onNodePointerMove(e: PointerEvent) {
  if (!networkDrag.value.active || !networkDrag.value.nodeId) return
  const container = networkRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  const node = networkNodes.value.find(n => n.id === networkDrag.value.nodeId)
  if (!node) return
  node.x = e.clientX - rect.left - networkDrag.value.offsetX
  node.y = e.clientY - rect.top - networkDrag.value.offsetY
  node.vx = 0
  node.vy = 0
}

function onNodePointerUp(e: PointerEvent) {
  const wasDrag = networkDrag.value.active &&
    Math.abs(e.clientX - dragStartPos.x) + Math.abs(e.clientY - dragStartPos.y) > 5
  const nodeId = networkDrag.value.nodeId
  networkDrag.value = { active: false, nodeId: null, offsetX: 0, offsetY: 0 }
  // If it was just a click (not a drag), navigate
  if (!wasDrag && nodeId) {
    goToPack(nodeId)
  }
}

// Rebuild on data change
watch([filteredPacks, () => viewMode.value], ([packs, mode]) => {
  if (mode === "planet" && packs.length) {
    nextTick(() => buildNetwork(packs))
  } else {
    if (networkRAF) cancelAnimationFrame(networkRAF)
  }
}, { immediate: true })

onUnmounted(() => {
  if (networkRAF) cancelAnimationFrame(networkRAF)
  document.body.style.overflow = ""
})

function goToPack(slug: string) {
  selectedSlug.value = slug
}

function closeSheet() {
  selectedSlug.value = null
}

onMounted(() => {
  auth.hydrate()
  void loadPacks()
  void loadPlazaPosts()
})

function getToken(): string | null {
  return localStorage.getItem("distill-human-token")
}

async function importGithubPack() {
  const token = getToken()
  if (!token) { importError.value = "请先登录"; return }
  const url = importRepoUrl.value.trim()
  if (!url) { importError.value = "请输入 GitHub 仓库地址"; return }
  importing.value = true
  importError.value = ""
  importSuccess.value = ""
  try {
    const { data } = await axios.post(`${API_BASE}/packs/import/github`, { repo_url: url }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    importSuccess.value = data?.pack_slug ? "导入成功！" : "导入任务已提交"
    importRepoUrl.value = ""
    showGithubImport.value = false
    showImportMenu.value = false
    setTimeout(() => { loadPacks() }, 2000)
  } catch (e: any) {
    importError.value = e?.response?.data?.detail || e?.message || "导入失败"
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="plaza-page cyber-page">
    <!-- Header -->
    <header class="plaza-header cyber-animate-in-down">
      <h1 class="cyber-title cyber-title-md">技能广场</h1>
      <span class="cyber-line" />
      <p class="cyber-subtitle" style="margin-top: 8px">探索技能包 · 发现新想法</p>
      <button type="button" class="plaza-add-btn" @click="showImportMenu = !showImportMenu">
        <span class="material-symbols-rounded">add</span>
      </button>
      <!-- Import dropdown -->
      <div v-if="showImportMenu" class="plaza-add-dropdown">
        <button type="button" class="plaza-add-dropdown-item" @click="showGithubImport = true; showImportMenu = false">
          <span class="material-symbols-rounded">code</span>
          <span>GitHub 导入</span>
        </button>
        <button type="button" class="plaza-add-dropdown-item" @click="showImportMenu = false">
          <span class="material-symbols-rounded">travel_explore</span>
          <span>联网搜索</span>
        </button>
      </div>
    </header>

    <!-- GitHub Import Modal -->
    <div v-if="showGithubImport" class="import-modal-overlay" @click.self="showGithubImport = false">
      <div class="import-modal cyber-card">
        <div class="import-modal-head">
          <h3>GitHub 导入</h3>
          <button type="button" class="import-modal-close" @click="showGithubImport = false">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
        <p class="import-modal-copy">输入 GitHub 仓库地址，自动解析为技能包。</p>
        <input
          v-model="importRepoUrl"
          class="import-modal-input"
          placeholder="https://github.com/user/repo"
          @keydown.enter="importGithubPack"
        />
        <p v-if="importError" class="import-modal-error">{{ importError }}</p>
        <p v-if="importSuccess" class="import-modal-success">{{ importSuccess }}</p>
        <button
          type="button"
          class="cyber-btn cyber-btn-primary import-modal-submit"
          :disabled="importing"
          @click="importGithubPack"
        >
          {{ importing ? "导入中..." : "开始导入" }}
        </button>
      </div>
    </div>

    <!-- Section Tabs -->
    <div class="plaza-section-tabs cyber-animate-in" style="animation-delay: 80ms">
      <button
        v-for="sec in sections"
        :key="sec.key"
        class="section-tab"
        :class="{ 'is-active': activeSection === sec.key }"
        @click="activeSection = sec.key"
      >
        <span class="material-symbols-rounded section-tab-icon">{{ sec.icon }}</span>
        <span class="section-tab-label">{{ sec.label }}</span>
        <div v-if="activeSection === sec.key" class="section-tab-indicator" />
      </button>
    </div>

    <!-- ===== 广场 Tab ===== -->
    <div v-if="activeSection === 'square'" class="plaza-section-content">
      <section v-if="!isAuthenticated" class="square-login-banner cyber-card cyber-animate-in">
        <div>
          <strong>登录后可点赞、评论、发布报告动态</strong>
          <p>先逛广场也可以，想参与互动时再进入账号。</p>
        </div>
        <button type="button" class="cyber-btn cyber-btn-primary square-login-btn" @click="requireLogin">登录参与</button>
      </section>

      <div v-if="squareLoading" class="masonry">
        <div v-for="i in 6" :key="`square-${i}`" class="masonry-col">
          <div class="card-skeleton" :style="{ height: i % 2 === 0 ? '260px' : '220px' }">
            <div class="skeleton-img" />
            <div class="skeleton-body">
              <div class="skeleton-line w60" />
              <div class="skeleton-line w80" />
              <div class="skeleton-tags" />
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="squareError" class="plaza-state plaza-state--tall">
        <span class="material-symbols-rounded" style="font-size: 40px; color: var(--neon-red); opacity: 0.48">cloud_off</span>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 14px; font-weight: 600">{{ squareError }}</p>
        <button class="cyber-btn cyber-btn-ghost" style="margin-top: 12px" @click="loadPlazaPosts">重新加载</button>
      </div>

      <div v-else-if="!squarePostsOrdered.length" class="plaza-state plaza-state--tall">
        <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.2">auto_awesome</span>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 14px; font-weight: 600">还没有广场动态</p>
        <p class="plaza-muted-copy" style="max-width: 260px">
          去蒸馏报告页点分享，就会生成一条图文动态出现在这里。
        </p>
      </div>

      <div v-else class="masonry square-feed">
        <div class="masonry-col">
          <article
            v-for="post in squareLeftCol"
            :key="post.post_id"
            class="square-post-card cyber-animate-in"
            :class="{ 'is-highlighted': highlightPostId === post.post_id }"
          >
            <div class="square-post-cover-wrap">
              <img v-if="post.image_url" :src="post.image_url" :alt="post.title" class="square-post-cover" loading="lazy" />
              <div v-else class="square-post-cover square-post-cover--fallback">
                <span>{{ post.title.slice(0, 1) || "蒸" }}</span>
              </div>
              <div class="square-post-cover-mask" />
              <div class="square-post-cover-meta">
                <span class="square-post-author-chip">{{ post.author.nickname }}</span>
                <span class="square-post-time">{{ formatFeedTime(post.created_at) }}</span>
              </div>
            </div>

            <div class="square-post-body">
              <h3 class="square-post-title">{{ post.title }}</h3>
              <p class="square-post-summary">{{ post.summary || post.content }}</p>

              <div v-if="post.tags.length" class="square-post-tags">
                <span v-for="tag in post.tags.slice(0, 4)" :key="`${post.post_id}-${tag}`" class="square-post-tag">#{{ tag }}</span>
              </div>

              <div class="square-post-actions">
                <button
                  type="button"
                  class="square-post-action"
                  :class="{ active: post.liked_by_me }"
                  :disabled="likingPostId === post.post_id"
                  @click="togglePostLike(post.post_id)"
                >
                  <span class="material-symbols-rounded">{{ post.liked_by_me ? "favorite" : "favorite_border" }}</span>
                  <span>{{ post.like_count }}</span>
                </button>
                <button
                  type="button"
                  class="square-post-action"
                  :class="{ active: expandedPostId === post.post_id }"
                  @click="toggleComments(post.post_id)"
                >
                  <span class="material-symbols-rounded">chat_bubble</span>
                  <span>{{ post.comment_count }}</span>
                </button>
              </div>

              <div v-if="expandedPostId === post.post_id" class="square-post-comments">
                <div class="square-post-comment-list">
                  <p v-if="loadingCommentsFor === post.post_id" class="square-post-empty-copy">评论加载中...</p>
                  <p v-else-if="displayComments(post.post_id).length === 0" class="square-post-empty-copy">还没有评论，抢个前排。</p>
                  <article v-else v-for="comment in displayComments(post.post_id)" :key="comment.comment_id" class="square-post-comment-item">
                    <strong>{{ comment.nickname }}</strong>
                    <p>{{ comment.content }}</p>
                  </article>
                </div>
                <div class="square-post-comment-editor">
                  <textarea
                    v-model="commentDraftMap[post.post_id]"
                    class="square-post-comment-input"
                    placeholder="写下你的看法..."
                  />
                  <button
                    type="button"
                    class="cyber-btn cyber-btn-primary square-post-comment-submit"
                    :disabled="submittingCommentFor === post.post_id"
                    @click="submitComment(post.post_id)"
                  >
                    {{ submittingCommentFor === post.post_id ? "发送中..." : "发送" }}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>

        <div class="masonry-col">
          <article
            v-for="post in squareRightCol"
            :key="post.post_id"
            class="square-post-card cyber-animate-in"
            :class="{ 'is-highlighted': highlightPostId === post.post_id }"
          >
            <div class="square-post-cover-wrap">
              <img v-if="post.image_url" :src="post.image_url" :alt="post.title" class="square-post-cover" loading="lazy" />
              <div v-else class="square-post-cover square-post-cover--fallback">
                <span>{{ post.title.slice(0, 1) || "蒸" }}</span>
              </div>
              <div class="square-post-cover-mask" />
              <div class="square-post-cover-meta">
                <span class="square-post-author-chip">{{ post.author.nickname }}</span>
                <span class="square-post-time">{{ formatFeedTime(post.created_at) }}</span>
              </div>
            </div>

            <div class="square-post-body">
              <h3 class="square-post-title">{{ post.title }}</h3>
              <p class="square-post-summary">{{ post.summary || post.content }}</p>

              <div v-if="post.tags.length" class="square-post-tags">
                <span v-for="tag in post.tags.slice(0, 4)" :key="`${post.post_id}-${tag}`" class="square-post-tag">#{{ tag }}</span>
              </div>

              <div class="square-post-actions">
                <button
                  type="button"
                  class="square-post-action"
                  :class="{ active: post.liked_by_me }"
                  :disabled="likingPostId === post.post_id"
                  @click="togglePostLike(post.post_id)"
                >
                  <span class="material-symbols-rounded">{{ post.liked_by_me ? "favorite" : "favorite_border" }}</span>
                  <span>{{ post.like_count }}</span>
                </button>
                <button
                  type="button"
                  class="square-post-action"
                  :class="{ active: expandedPostId === post.post_id }"
                  @click="toggleComments(post.post_id)"
                >
                  <span class="material-symbols-rounded">chat_bubble</span>
                  <span>{{ post.comment_count }}</span>
                </button>
              </div>

              <div v-if="expandedPostId === post.post_id" class="square-post-comments">
                <div class="square-post-comment-list">
                  <p v-if="loadingCommentsFor === post.post_id" class="square-post-empty-copy">评论加载中...</p>
                  <p v-else-if="displayComments(post.post_id).length === 0" class="square-post-empty-copy">还没有评论，抢个前排。</p>
                  <article v-else v-for="comment in displayComments(post.post_id)" :key="comment.comment_id" class="square-post-comment-item">
                    <strong>{{ comment.nickname }}</strong>
                    <p>{{ comment.content }}</p>
                  </article>
                </div>
                <div class="square-post-comment-editor">
                  <textarea
                    v-model="commentDraftMap[post.post_id]"
                    class="square-post-comment-input"
                    placeholder="写下你的看法..."
                  />
                  <button
                    type="button"
                    class="cyber-btn cyber-btn-primary square-post-comment-submit"
                    :disabled="submittingCommentFor === post.post_id"
                    @click="submitComment(post.post_id)"
                  >
                    {{ submittingCommentFor === post.post_id ? "发送中..." : "发送" }}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>

    <!-- ===== 地图 Tab ===== -->
    <div v-if="activeSection === 'map'" class="plaza-section-content">
      <div class="plaza-state plaza-state--tall">
        <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.2">explore</span>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 14px; font-weight: 600">地图即将上线</p>
        <p class="plaza-muted-copy">
          探索全球注册用户的技能分布<br/>发现与你兴趣相近的伙伴
        </p>
      </div>
    </div>

    <!-- ===== 新人类 Tab ===== -->
    <template v-if="activeSection === 'human'">

    <!-- Filter tabs + View mode toggle -->
    <div class="plaza-filters cyber-animate-in" style="animation-delay: 150ms">
      <button
        class="view-mode-btn view-mode-btn--cycle"
        :title="viewModeTitle"
        :aria-label="viewModeTitle"
        @click="cycleViewMode"
      >
        <span class="material-symbols-rounded" style="font-size: 18px">{{ viewModeIcon }}</span>
      </button>
      <div class="view-mode-divider" />
      <button
        v-for="f in filters"
        :key="f.key"
        class="filter-btn"
        :class="{ active: activeFilter === f.key }"
        @click="activeFilter = f.key"
      >
        <span>{{ f.label }}</span>
        <span class="filter-count">{{ filterCount(f.key) }}</span>
      </button>
    </div>

    <!-- Search bar -->
    <div class="plaza-search cyber-animate-in" style="animation-delay: 250ms">
      <span class="material-symbols-rounded search-icon">search</span>
      <input
        v-model="searchText"
        type="text"
        class="search-input"
        placeholder="搜索名字、标签、技能，比如 SBTI / 张雪峰 / 志愿填报"
        enterkeyhint="search"
      />
      <button v-if="searchText.trim()" class="search-clear" @click="searchText = ''">
        <span class="material-symbols-rounded" style="font-size: 18px">close</span>
      </button>
    </div>

    <!-- Search result hint -->
    <div v-if="searchText.trim()" class="plaza-search-hint">
      关键词「{{ searchText.trim() }}」共命中 {{ filteredPacks.length }} 个技能包
    </div>

    <!-- Loading -->
    <div v-if="loading" class="masonry">
      <div v-for="i in 6" :key="i" class="masonry-col">
        <div class="card-skeleton" :style="{ height: i % 2 === 0 ? '220px' : '180px' }">
          <div class="skeleton-img" />
          <div class="skeleton-body">
            <div class="skeleton-line w60" />
            <div class="skeleton-line w80" />
            <div class="skeleton-tags" />
          </div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="loadError" class="plaza-state">
      <span class="material-symbols-rounded" style="font-size: 36px; color: var(--neon-red); opacity: 0.6">cloud_off</span>
      <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 10px">无法连接服务器</p>
      <button class="cyber-btn cyber-btn-ghost" style="margin-top: 12px; padding: 6px 16px; font-size: 0.7rem" @click="loadPacks">重新加载</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!filteredPacks.length" class="plaza-state">
      <span class="material-symbols-rounded" style="font-size: 36px; color: var(--text-secondary); opacity: 0.4">explore</span>
      <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 10px">暂无技能包</p>
    </div>

    <!-- ===== Planet View (星球网络图) ===== -->
    <div v-else-if="viewMode === 'planet'" class="planet-cosmos">
      <!-- Network graph container (transparent — global nebula bg shows through) -->
      <div
        class="cosmos-network"
        ref="networkRef"
        @pointermove="onNodePointerMove"
        @pointerup="onNodePointerUp"
        @pointerleave="onNodePointerUp"
      >
        <!-- Canvas for connection lines -->
        <canvas ref="canvasRef" class="network-canvas" />

        <!-- Draggable planet nodes -->
        <div
          v-for="node in networkNodes"
          :key="node.id"
          class="network-node"
          :class="{ 'is-dragging': networkDrag.nodeId === node.id, 'is-hovered': networkHover === node.id }"
          :style="{
            left: node.x + 'px',
            top: node.y + 'px',
            '--ring-color': node.color.ring,
            '--sphere-color': node.color.sphere,
            '--sphere-deep': node.color.deep,
            '--glow-color': node.color.glow,
            '--node-r': node.r + 'px',
            '--node-image': `url(${node.image})`,
          }"
          @pointerdown="onNodePointerDown($event, node.id)"
          @pointerenter="networkHover = node.id"
          @pointerleave="networkHover = null"
        >
          <span class="cosmos-glow" />
          <span class="cosmos-ring" />
          <span class="cosmos-sphere" />
          <span class="network-label" :style="{ color: node.color.ring }">{{ node.label }}</span>
        </div>
      </div>

      <!-- Floating orbs -->
      <span class="cosmos-orb cosmos-orb--a" />
      <span class="cosmos-orb cosmos-orb--b" />
      <span class="cosmos-orb cosmos-orb--c" />
      <span class="cosmos-orb cosmos-orb--d" />
    </div>

    <!-- ===== Card View (卡片视图 — 原瀑布流) ===== -->
    <div v-else-if="viewMode === 'card'" class="masonry pack-masonry">
      <!-- Left column -->
      <div class="masonry-col">
        <div
          v-for="pack in leftCol"
          :key="pack.slug"
          class="pack-card cyber-animate-in"
          @click="goToPack(pack.slug)"
        >
          <div class="card-photo" :style="{ '--hero-img': `url(${getHeroImage(pack)})` }" />
          <div class="card-content">
            <h3 class="card-title">{{ pack.title }}</h3>
            <p class="card-subtitle">{{ pack.subtitle }}</p>
          </div>
        </div>
      </div>
      <!-- Right column -->
      <div class="masonry-col">
        <div
          v-for="pack in rightCol"
          :key="pack.slug"
          class="pack-card cyber-animate-in"
          @click="goToPack(pack.slug)"
        >
          <div class="card-photo" :style="{ '--hero-img': `url(${getHeroImage(pack)})` }" />
          <div class="card-content">
            <h3 class="card-title">{{ pack.title }}</h3>
            <p class="card-subtitle">{{ pack.subtitle }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== List View (列表视图) ===== -->
    <div v-else class="list-view">
      <div
        v-for="pack in filteredPacks"
        :key="pack.slug"
        class="list-item cyber-animate-in"
        @click="goToPack(pack.slug)"
      >
        <div
          class="list-item-avatar"
          :style="{
            '--avatar-image': `url(${getHeroImage(pack)})`,
            '--avatar-fallback': `radial-gradient(circle at 35% 35%, ${cosmosColor(0).sphere}, ${cosmosColor(0).deep} 70%)`,
          }"
        />
        <div class="list-item-body">
          <div class="list-item-top">
            <span class="list-item-category">{{ pack.display_group_label || pack.factory_category_label }}</span>
            <span class="material-symbols-rounded list-item-arrow">chevron_right</span>
          </div>
          <h3 class="list-item-title">{{ pack.title }}</h3>
          <p class="list-item-subtitle">{{ pack.subtitle }}</p>
          <div v-if="pack.skills.length" class="list-item-tags">
            <span v-for="skill in pack.skills.slice(0, 3)" :key="skill" class="card-skill-tag">{{ skill }}</span>
          </div>
        </div>
      </div>
    </div>

    </template>
    <!-- End 新人类 Tab -->

    <!-- ===== 重生模板 Tab ===== -->
    <section v-if="activeSection === 'rebirth'" class="plaza-section-content rebirth-v3-section cyber-animate-in">
      <div class="rebirth-v3-summary">
        <div>
          <p class="rebirth-v3-kicker">27 型 SBTI 重生卡</p>
          <h2 class="rebirth-v3-title">选择一个灵魂模板</h2>
        </div>
        <span class="rebirth-v3-count">{{ filteredRebirthCards.length }} 张</span>
      </div>

      <div class="rebirth-v3-filters" aria-label="重生模板筛选">
        <button
          v-for="filter in rebirthFilters"
          :key="filter.key"
          type="button"
          class="rebirth-v3-filter"
          :class="{ active: rebirthFilter === filter.key }"
          @click="rebirthFilter = filter.key"
        >
          {{ filter.label }}
        </button>
      </div>

      <div class="rebirth-v3-grid" aria-label="重生模板卡片">
        <article
          v-for="item in filteredRebirthCards"
          :key="item.code"
          class="rebirth-v3-card"
        >
          <button type="button" class="rebirth-v3-card-shell" :style="cardAccentStyle(item)" @click="openRebirthDetail(item)">
            <div
              class="rebirth-v3-card-stage"
              :class="{ 'rebirth-v3-card-stage--template-bg': hasRebirthTemplateBackground(item) }"
              :style="rebirthTemplateStageStyle(item)"
            >
              <div class="rebirth-v3-card-topline">
                <span class="rebirth-v3-card-code">{{ item.cardCode }}</span>
                <span class="rebirth-v3-card-label">{{ item.topTitle }}</span>
              </div>

              <div v-if="!hasRebirthTemplateBackground(item)" class="rebirth-v3-card-portrait-wrap">
                <span class="rebirth-v3-card-watermark">{{ item.code }}</span>
                <img
                  :src="resolvedPortrait(item)"
                  :alt="`${item.label} ${item.cardTitle}`"
                  class="rebirth-v3-card-image"
                  loading="lazy"
                  @error="markPortraitBroken(item.code)"
                />
              </div>
            </div>
            <div class="rebirth-v3-card-body">
              <span v-if="hasRebirthTemplateBackground(item)" class="rebirth-v3-template-tag rebirth-v3-template-tag-inline">{{ item.label }}</span>
              <p class="rebirth-v3-card-title">{{ item.bottomTitle }}</p>
              <p class="rebirth-v3-card-copy">{{ item.bodyCopy }}</p>

              <div class="rebirth-v3-card-foot">
                <span>{{ item.footerLeft }}</span>
                <strong>{{ item.footerRight }}</strong>
              </div>
            </div>
          </button>
        </article>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="selectedPersonality" class="rebirth-v3-modal" @click.self="closeRebirthDetail">
        <section
          class="rebirth-v3-modal-panel"
          :class="{ 'rebirth-v3-modal-panel--template': hasRebirthTemplateBackground(selectedPersonality) }"
          :style="cardAccentStyle(selectedPersonality)"
        >
          <button type="button" class="rebirth-v3-modal-close" @click="closeRebirthDetail">
            <span class="material-symbols-rounded">close</span>
          </button>

          <div class="rebirth-v3-modal-card">
            <div
              class="rebirth-v3-modal-stage"
              :class="{ 'rebirth-v3-card-stage--template-bg': hasRebirthTemplateBackground(selectedPersonality) }"
              :style="rebirthTemplateStageStyle(selectedPersonality)"
            >
              <div class="rebirth-v3-card-topline">
                <span class="rebirth-v3-card-code">{{ selectedPersonality.cardCode }}</span>
                <span class="rebirth-v3-card-label">{{ selectedPersonality.topTitle }}</span>
              </div>

              <div v-if="!hasRebirthTemplateBackground(selectedPersonality)" class="rebirth-v3-modal-portrait-wrap">
                <span class="rebirth-v3-card-watermark rebirth-v3-card-watermark-modal">{{ selectedPersonality.code }}</span>
                <img
                  :src="resolvedPortrait(selectedPersonality)"
                  :alt="`${selectedPersonality.label} ${selectedPersonality.cardTitle}`"
                  class="rebirth-v3-card-image"
                  @error="markPortraitBroken(selectedPersonality.code)"
                />
              </div>

              <div class="rebirth-v3-modal-glass">
                <span v-if="hasRebirthTemplateBackground(selectedPersonality)" class="rebirth-v3-template-tag rebirth-v3-template-tag-modal">
                  {{ selectedPersonality.label }}
                </span>
                <p class="rebirth-v3-card-title">{{ selectedPersonality.bottomTitle }}</p>
                <p class="rebirth-v3-modal-copy">{{ selectedPersonality.summary }}</p>
                <div class="rebirth-v3-card-foot">
                  <span>{{ selectedPersonality.footerLeft }}</span>
                  <strong>{{ selectedPersonality.footerRight }}</strong>
                </div>
              </div>
            </div>

            <div class="rebirth-v3-modal-content">
              <div class="rebirth-v3-modal-meta">
                <span class="rebirth-v3-modal-chip">{{ selectedPersonality.rarity.label }}</span>
                <span class="rebirth-v3-modal-chip">{{ selectedPersonality.rarity.populationShare }}</span>
                <span class="rebirth-v3-modal-chip">{{ selectedPersonality.mbtiMirrors.join(" / ") }}</span>
              </div>

              <p class="rebirth-v3-modal-line">“{{ selectedPersonality.openingLine }}”</p>
              <p class="rebirth-v3-modal-paragraph">{{ selectedPersonality.description }}</p>
              <p class="rebirth-v3-modal-paragraph">{{ selectedPersonality.sbtiLens }}</p>

              <div v-if="selectedPersonality.soulQuestions.length" class="rebirth-v3-question-list">
                <article
                  v-for="(question, index) in selectedPersonality.soulQuestions"
                  :key="`${selectedPersonality.code}-${index}`"
                  class="rebirth-v3-question-card"
                >
                  <span>{{ index + 1 }}</span>
                  <p>{{ question }}</p>
                </article>
              </div>

              <div class="rebirth-v3-modal-actions">
                <RouterLink
                  class="cyber-btn cyber-btn-primary rebirth-v3-modal-primary"
                  :to="distillEntryLink(selectedPersonality)"
                  @click="closeRebirthDetail"
                >
                  去蒸馏一下
                </RouterLink>
                <button type="button" class="cyber-btn cyber-btn-ghost rebirth-v3-modal-secondary" @click="closeRebirthDetail">关闭</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Teleport>

    <SkillDetailSheet :slug="selectedSlug" @close="closeSheet" />
  </div>
</template>

<style scoped>
.plaza-page {
  padding: 0 12px;
  padding-bottom: calc(var(--tab-bar-height) + var(--safe-bottom) + 24px);
  background: var(--bg-base);
  color: var(--text-primary);
}

/* Header */
.plaza-header {
  text-align: center;
  padding: 50px 0 16px;
  position: relative;
}

/* ===== Add Button & Dropdown ===== */
.plaza-add-btn {
  position: absolute;
  top: 50px;
  right: 16px;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: var(--fill-secondary);
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.plaza-add-btn:active { transform: scale(0.9); }
.plaza-add-btn .material-symbols-rounded { font-size: 22px; }

.plaza-add-dropdown {
  position: absolute;
  top: 98px;
  right: 16px;
  min-width: 160px;
  border-radius: 14px;
  border: 1px solid var(--separator-soft);
  background: color-mix(in srgb, var(--bg-elevated) 96%, transparent);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.14);
  padding: 6px;
  z-index: 30;
  animation: dropFadeIn 0.15s ease;
}

.plaza-add-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.plaza-add-dropdown-item:hover { background: color-mix(in srgb, var(--card-bg) 88%, transparent); }
.plaza-add-dropdown-item:active { background: color-mix(in srgb, var(--card-bg) 80%, transparent); }
.plaza-add-dropdown-item .material-symbols-rounded { font-size: 18px; color: var(--accent-primary); }

@keyframes dropFadeIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ===== Import Modal ===== */
.import-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(10px);
  padding: 20px;
  animation: popupFadeIn 0.15s ease;
}

.import-modal {
  width: 100%;
  max-width: 380px;
  padding: 24px;
  animation: popupScaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.import-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.import-modal-head h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.import-modal-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--ink-mist);
  background: color-mix(in srgb, var(--card-bg) 88%, transparent);
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.import-modal-close .material-symbols-rounded { font-size: 18px; }

.import-modal-copy {
  margin: 0 0 16px;
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.import-modal-input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--ink-mist);
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  color: var(--text-primary);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.import-modal-input:focus { border-color: color-mix(in srgb, var(--accent-primary) 40%, transparent); }
.import-modal-input::placeholder { color: var(--fg-tertiary); }

.import-modal-error {
  margin: 10px 0 0;
  font-size: 0.75rem;
  color: #ff6b6b;
}

.import-modal-success {
  margin: 10px 0 0;
  font-size: 0.75rem;
  color: var(--accent-primary);
}

.import-modal-submit {
  width: 100%;
  margin-top: 16px;
  justify-content: center;
}

@keyframes popupFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes popupScaleIn {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}

/* ===== Section Tabs ===== */
.plaza-section-tabs {
  display: flex;
  align-items: stretch;
  margin: 0 4px 16px;
  border-bottom: 1px solid var(--separator-soft);
  position: relative;
}

.section-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px 0 9px;
  border: 0;
  background: transparent;
  cursor: pointer;
  transition: all 0.25s ease;
  -webkit-tap-highlight-color: transparent;
  position: relative;
}

.section-tab:active {
  opacity: 0.6;
}

.section-tab-icon {
  font-size: 17px;
  color: var(--text-secondary);
  transition: color 0.25s ease;
}

.section-tab.is-active .section-tab-icon {
  color: var(--accent-primary);
}

.section-tab-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: 0;
  transition: all 0.25s ease;
}

.section-tab.is-active .section-tab-label {
  color: var(--accent-primary);
}

.section-tab-indicator {
  position: absolute;
  bottom: -1px;
  left: 25%;
  right: 25%;
  height: 2.5px;
  border-radius: 2px;
  background: var(--accent-primary);
}

/* Section content */
.plaza-section-content {
  min-height: 50vh;
}

.plaza-state--tall {
  padding: 100px 20px;
}

.plaza-muted-copy {
  color: var(--text-tertiary);
  font-size: 0.72rem;
  margin: 6px 0 0;
  max-width: 240px;
  text-align: center;
  line-height: 1.6;
}

.square-login-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 0 4px 14px;
  padding: 14px 16px;
}

.square-login-banner strong {
  display: block;
  color: var(--text-primary);
  font-size: 0.86rem;
}

.square-login-banner p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 0.72rem;
  line-height: 1.55;
}

.square-login-btn {
  flex: 0 0 auto;
  min-height: 38px;
}

.square-feed {
  margin-top: 4px;
}

.square-post-card {
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid var(--separator-soft);
  background: var(--bg-elevated);
  box-shadow: none;
}

.square-post-card.is-highlighted {
  border-color: color-mix(in srgb, var(--accent-primary) 42%, transparent);
  box-shadow: none;
}

.square-post-cover-wrap {
  position: relative;
  aspect-ratio: 0.82;
  background: var(--fill-secondary);
}

.square-post-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.square-post-cover--fallback {
  display: grid;
  place-items: center;
}

.square-post-cover--fallback span {
  font-size: 3rem;
  font-weight: 900;
  color: var(--text-secondary);
  letter-spacing: 0;
}

.square-post-cover-mask {
  position: absolute;
  inset: auto 0 0;
  height: 44%;
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.52));
}

.square-post-cover-meta {
  position: absolute;
  inset: auto 12px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.square-post-author-chip,
.square-post-time {
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(8, 10, 14, 0.54);
  backdrop-filter: blur(12px);
  color: #fff;
  font-size: 0.68rem;
}

.square-post-body {
  display: grid;
  gap: 10px;
  padding: 14px 14px 16px;
}

.square-post-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 0.92rem;
  line-height: 1.45;
}

.square-post-summary {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.76rem;
  line-height: 1.65;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.square-post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.square-post-tag {
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--fill-secondary);
  color: var(--text-secondary);
  font-size: 0.66rem;
}

.square-post-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.square-post-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: var(--fill-secondary);
  color: var(--text-secondary);
  font-size: 0.72rem;
  cursor: pointer;
}

.square-post-action .material-symbols-rounded {
  font-size: 16px;
}

.square-post-action.active {
  background: rgba(255, 77, 109, 0.16);
  color: #ff6b88;
}

.square-post-comments {
  display: grid;
  gap: 10px;
  padding-top: 2px;
}

.square-post-comment-list {
  display: grid;
  gap: 8px;
}

.square-post-comment-item {
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--fill-tertiary);
}

.square-post-comment-item strong {
  display: block;
  color: var(--text-primary);
  font-size: 0.72rem;
}

.square-post-comment-item p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 0.72rem;
  line-height: 1.6;
}

.square-post-empty-copy {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 0.72rem;
}

.square-post-comment-editor {
  display: grid;
  gap: 8px;
}

.square-post-comment-input {
  width: 100%;
  min-height: 72px;
  padding: 11px 12px;
  border-radius: 14px;
  border: 1px solid var(--separator-soft);
  background: var(--fill-tertiary);
  color: var(--text-primary);
  font: inherit;
  resize: vertical;
}

.square-post-comment-input::placeholder {
  color: var(--text-tertiary);
}

.square-post-comment-submit {
  width: 100%;
  justify-content: center;
}

/* Filter tabs */
.plaza-filters {
  display: flex;
  gap: 8px;
  padding: 0 4px;
  margin-bottom: 12px;
  overflow-x: auto;
  scrollbar-width: none;
}
.plaza-filters::-webkit-scrollbar { display: none; }

.filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
  padding: 6px 16px;
  border-radius: var(--radius-full);
  background: var(--fill-secondary);
  border: 1px solid transparent;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
  -webkit-tap-highlight-color: transparent;
  text-shadow: none;
}
.filter-btn.active {
  background: color-mix(in srgb, var(--accent-primary) 12%, var(--bg-elevated));
  border-color: color-mix(in srgb, var(--accent-primary) 42%, transparent);
  color: var(--accent-primary);
}
.filter-btn:active { transform: scale(0.95); }

.filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-elevated) 80%, transparent);
  color: var(--text-tertiary);
  font-size: 0.66rem;
  font-weight: 800;
  line-height: 1;
}

.filter-btn.active .filter-count {
  background: color-mix(in srgb, var(--accent-primary) 18%, transparent);
  color: var(--accent-primary);
}

/* Search bar */
.plaza-search {
  position: relative;
  display: flex;
  align-items: center;
  margin: 0 4px 12px;
  padding: 0 14px;
  height: 44px;
  border-radius: var(--radius-full);
  background: var(--fill-secondary);
  border: 1px solid transparent;
  transition: background var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default);
}

.plaza-search:focus-within {
  background: var(--bg-elevated);
  border-color: color-mix(in srgb, var(--accent-primary) 32%, transparent);
}

.search-icon {
  font-size: 18px;
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-right: 8px;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.8rem;
  letter-spacing: 0;
  font-family: inherit;
  text-shadow: none;
}

.search-input::placeholder {
  color: var(--text-tertiary);
  text-shadow: none;
}

.search-clear {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--fill-primary);
  border: none;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.search-clear:active {
  background: var(--fill-secondary);
}

/* Search hint */
.plaza-search-hint {
  padding: 0 16px;
  margin-bottom: 12px;
  font-size: 0.7rem;
  color: #8e8e93;
  letter-spacing: 0.5px;
}

/* Masonry — two columns */
.masonry {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.masonry-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* State */
.plaza-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
}

/* Skeleton */
.card-skeleton {
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-elevated);
  border: 1px solid var(--separator-soft);
}

.skeleton-img {
  width: 100%;
  height: 100%;
  background: var(--ink-wash);
  animation: cyber-pulse 1.5s ease-in-out infinite;
}

.skeleton-body {
  padding: 10px 12px 12px;
}

.skeleton-line {
  height: 10px;
  border-radius: 5px;
  background: var(--ink-wash);
  animation: cyber-pulse 1.5s ease-in-out infinite;
  margin-bottom: 6px;
}

.skeleton-line.w60 { width: 60%; }
.skeleton-line.w80 { width: 80%; }

.skeleton-tags {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.skeleton-tags::before,
.skeleton-tags::after {
  content: "";
  width: 40px;
  height: 16px;
  border-radius: var(--radius-full);
  background: var(--ink-wash);
  animation: cyber-pulse 1.5s ease-in-out infinite;
}

.skeleton-tags::after {
  width: 32px;
}

/* ── View Mode Toggle ── */
.view-mode-divider {
  width: 1px;
  height: 20px;
  background: var(--separator-soft);
  margin: 0 4px;
  flex-shrink: 0;
}

.view-mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.view-mode-btn.active {
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
}

.view-mode-btn--cycle {
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
}

/* ── Cosmos (Planet View) — Soul Nebula Network Graph ── */
.planet-cosmos {
  position: relative;
  height: 70vh;
  min-height: 400px;
  overflow: hidden;
  background: transparent;
  margin-bottom: 8px;
}

/* Network container */
.cosmos-network {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.network-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

/* Network node */
.network-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: grab;
  z-index: 1;
  transform: translate(-50%, -50%);
  transition: filter 0.2s ease;
  touch-action: none;
}

.network-node:active,
.network-node.is-dragging {
  cursor: grabbing;
  z-index: 10;
  filter: brightness(1.3);
}

.network-node.is-hovered {
  z-index: 5;
  filter: brightness(1.15);
}

/* Planet sphere */
.cosmos-sphere {
  position: relative;
  width: var(--node-r);
  height: var(--node-r);
  border-radius: 999px;
  background-image:
    linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.34)),
    var(--node-image),
    radial-gradient(circle at 35% 35%, var(--sphere-color), var(--sphere-deep) 70%);
  background-size: cover, cover, cover;
  background-position: center, center, center;
  border: 1px solid color-mix(in srgb, var(--ring-color) 42%, rgba(255, 255, 255, 0.28));
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  flex-shrink: 0;
}

/* Energy ring */
.cosmos-ring {
  position: absolute;
  top: 50%; left: 50%;
  width: calc(var(--node-r) * 1.5);
  height: calc(var(--node-r) * 0.45);
  transform: translate(-50%, -50%) rotateX(72deg);
  border: 1.5px solid var(--ring-color);
  border-radius: 999px;
  opacity: 0.45;
  box-shadow: 0 0 10px var(--ring-color), inset 0 0 6px var(--ring-color);
  z-index: 1;
  animation: ringRotate 20s linear infinite;
  pointer-events: none;
}

@keyframes ringRotate {
  to { transform: translate(-50%, -50%) rotateX(72deg) rotateZ(360deg); }
}

/* Glow */
.cosmos-glow {
  position: absolute;
  top: 50%; left: 50%;
  width: calc(var(--node-r) * 2);
  height: calc(var(--node-r) * 2);
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: radial-gradient(circle, var(--glow-color), transparent 65%);
  z-index: 0;
  pointer-events: none;
  animation: glowPulse 4s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.9; transform: translate(-50%, -50%) scale(1.06); }
}

/* Label */
.network-label {
  font-family: var(--font-display);
  font-size: 0.65rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  text-shadow: 0 0 10px currentColor;
  margin-top: 4px;
  white-space: nowrap;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  z-index: 3;
}

/* Floating orbs */
.cosmos-orb {
  position: absolute; border-radius: 999px; pointer-events: none; z-index: 1;
}
.cosmos-orb--a { top: 20%; left: 15%; width: 6px; height: 6px; background: rgba(0, 212, 255, 0.8); box-shadow: 0 0 16px rgba(0, 212, 255, 0.6); animation: cosmosOrbFloat 5s ease-in-out infinite; }
.cosmos-orb--b { top: 40%; right: 10%; width: 8px; height: 8px; background: rgba(168, 85, 247, 0.7); box-shadow: 0 0 18px rgba(168, 85, 247, 0.5); animation: cosmosOrbFloat 6s ease-in-out infinite 1.5s; }
.cosmos-orb--c { top: 65%; left: 25%; width: 5px; height: 5px; background: rgba(255, 107, 53, 0.8); box-shadow: 0 0 14px rgba(255, 107, 53, 0.5); animation: cosmosOrbFloat 4s ease-in-out infinite 0.8s; }
.cosmos-orb--d { top: 80%; right: 20%; width: 7px; height: 7px; background: rgba(0, 245, 212, 0.6); box-shadow: 0 0 12px rgba(0, 245, 212, 0.4); animation: cosmosOrbFloat 7s ease-in-out infinite 2s; }

@keyframes cosmosOrbFloat {
  0%, 100% { transform: translateY(0) translateX(0); opacity: 0.5; }
  25% { transform: translateY(-12px) translateX(4px); opacity: 0.8; }
  50% { transform: translateY(-6px) translateX(-3px); opacity: 0.6; }
  75% { transform: translateY(-15px) translateX(2px); opacity: 0.9; }
}

/* ── List View ── */
.list-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--separator-soft);
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.list-item:active {
  transform: scale(0.98);
  background: var(--fill-tertiary);
}

.list-item-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  border: 1px solid var(--separator-soft);
  background-image:
    linear-gradient(180deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.32)),
    var(--avatar-image),
    var(--avatar-fallback);
  background-size: cover, cover, cover;
  background-position: center, center, center;
  box-shadow: none;
  overflow: hidden;
  flex-shrink: 0;
}

.list-item-avatar::after {
  content: "";
  position: absolute;
  inset: 0;
  background: transparent;
  border-radius: 999px;
}

.list-item-body {
  flex: 1;
  min-width: 0;
}

.list-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.list-item-category {
  font-size: 0.58rem;
  letter-spacing: 0;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.list-item-arrow {
  font-size: 18px;
  color: var(--text-tertiary);
}

.list-item-title {
  font-family: var(--font-display);
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 2px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-item-subtitle {
  font-size: 0.68rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin: 0 0 6px;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.list-item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* ===== Rebirth Template Tab ===== */
.rebirth-v3-section {
  display: grid;
  gap: 14px;
  padding: 0 4px 8px;
}

.rebirth-v3-summary {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  padding: 2px 2px 0;
}

.rebirth-v3-kicker {
  margin: 0 0 4px;
  color: var(--text-tertiary);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0;
}

.rebirth-v3-title {
  margin: 0;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 1.08rem;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: 0;
}

.rebirth-v3-count {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--separator-soft);
  background: var(--fill-secondary);
  color: var(--text-secondary);
  font-size: 0.68rem;
  font-weight: 700;
}

.rebirth-v3-filters {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 0 0 2px;
  scrollbar-width: none;
}

.rebirth-v3-filters::-webkit-scrollbar {
  display: none;
}

.rebirth-v3-filter {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 13px;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  background: var(--fill-secondary);
  color: var(--text-secondary);
  font-size: 0.73rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.rebirth-v3-filter.active {
  background: color-mix(in srgb, var(--accent-primary) 12%, var(--bg-elevated));
  border-color: color-mix(in srgb, var(--accent-primary) 42%, transparent);
  color: var(--accent-primary);
}

.rebirth-v3-filter:active {
  transform: scale(0.96);
}

.rebirth-v3-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.rebirth-v3-card,
.rebirth-v3-card-shell {
  min-width: 0;
}

.rebirth-v3-card-shell {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--separator-soft);
  border-radius: 18px;
  background: var(--bg-elevated);
  text-align: left;
  cursor: pointer;
  box-shadow: none;
  -webkit-tap-highlight-color: transparent;
}

.rebirth-v3-card-stage,
.rebirth-v3-modal-stage {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.46), rgba(255, 255, 255, 0.06) 30%, transparent 62%),
    radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.72), transparent 34%),
    radial-gradient(circle at 82% 86%, var(--rebirth-glow), transparent 44%),
    var(--rebirth-canvas);
  border: 1px solid color-mix(in srgb, var(--separator-soft) 48%, rgba(255, 255, 255, 0.78));
  box-shadow: none;
}

.rebirth-v3-card-stage {
  position: absolute;
  inset: 0;
  height: 100%;
  border: 0;
  border-radius: 0;
  transition: transform 0.22s ease, border-color 0.22s ease;
}

.rebirth-v3-card-stage--template-bg {
  isolation: isolate;
  background:
    linear-gradient(180deg, rgba(8, 12, 22, 0.28) 0%, rgba(8, 12, 22, 0.04) 38%, rgba(8, 12, 22, 0.62) 100%),
    var(--rebirth-template-bg),
    var(--rebirth-canvas);
  background-position: center;
  background-size: cover;
}

.rebirth-v3-card-stage--template-bg::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(circle at 26% 18%, rgba(255, 255, 255, 0.26), transparent 30%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.18), transparent 32%),
    linear-gradient(0deg, rgba(0, 0, 0, 0.2), transparent 46%);
  mix-blend-mode: screen;
}

.rebirth-v3-card-shell:active {
  transform: scale(0.98);
}

.rebirth-v3-card-topline {
  position: absolute;
  top: 12px;
  left: 13px;
  right: 13px;
  z-index: 3;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.rebirth-v3-card-code,
.rebirth-v3-card-label {
  color: var(--rebirth-ink);
  font-size: 0.74rem;
  font-weight: 900;
  line-height: 1.2;
  letter-spacing: 0;
}

.rebirth-v3-card-code {
  opacity: 0.76;
}

.rebirth-v3-card-label {
  max-width: 72px;
  text-align: right;
}

.rebirth-v3-card-stage--template-bg .rebirth-v3-card-code,
.rebirth-v3-card-stage--template-bg .rebirth-v3-card-label {
  color: rgba(255, 255, 255, 0.94);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.34);
}

.rebirth-v3-modal-stage .rebirth-v3-card-topline {
  right: 56px;
}

.rebirth-v3-card-portrait-wrap,
.rebirth-v3-modal-portrait-wrap {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rebirth-v3-card-portrait-wrap {
  height: 100%;
  min-height: 0;
  padding: 0;
}

.rebirth-v3-card-watermark {
  position: absolute;
  top: 24px;
  left: 50%;
  z-index: 0;
  color: rgba(255, 255, 255, 0.34);
  font-size: 2.9rem;
  font-weight: 900;
  letter-spacing: 0;
  transform: translateX(-50%);
  white-space: nowrap;
  pointer-events: none;
}

.rebirth-v3-card-watermark-modal {
  top: 38px;
  font-size: 4.4rem;
}

.rebirth-v3-card-image {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  max-width: min(82%, 310px);
  object-fit: contain;
  transform:
    translateX(var(--portrait-shift-x))
    translateY(var(--portrait-shift-y))
    scaleX(var(--portrait-flip))
    scale(var(--portrait-scale));
  transform-origin: center bottom;
  filter: drop-shadow(0 18px 16px rgba(37, 28, 48, 0.14));
}

.rebirth-v3-card-portrait-wrap .rebirth-v3-card-image {
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
  transform: none;
  filter: none;
}

.rebirth-v3-template-tag {
  position: absolute;
  left: 13px;
  bottom: 136px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  max-width: calc(100% - 26px);
  padding: 0 11px;
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: var(--radius-full);
  background: rgba(15, 20, 30, 0.38);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.4);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(12px);
}

.rebirth-v3-template-tag-modal {
  position: static;
  justify-self: start;
  min-height: 34px;
  margin-bottom: 10px;
  padding: 0 14px;
  font-size: 0.86rem;
}

.rebirth-v3-template-tag-inline {
  position: static;
  justify-self: start;
  min-height: 26px;
  margin-bottom: 2px;
  padding: 0 10px;
  font-size: 0.68rem;
}

.rebirth-v3-modal-glass {
  position: absolute;
  left: 9px;
  right: 9px;
  bottom: 9px;
  z-index: 2;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.74);
  background:
    radial-gradient(circle at 52% 0%, rgba(255, 255, 255, 0.22), transparent 34%),
    var(--rebirth-mist);
  backdrop-filter: blur(16px);
}

.rebirth-v3-card-stage--template-bg .rebirth-v3-modal-glass {
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  gap: 8px;
  padding: 116px 20px 20px;
  border: 0;
  border-radius: 0;
  background:
    linear-gradient(180deg, transparent 0%, rgba(12, 17, 23, 0.22) 24%, rgba(12, 17, 23, 0.72) 58%, rgba(12, 17, 23, 0.94) 100%);
  backdrop-filter: none;
}

.rebirth-v3-card-stage--template-bg .rebirth-v3-modal-glass .rebirth-v3-card-title,
.rebirth-v3-card-stage--template-bg .rebirth-v3-modal-glass .rebirth-v3-modal-copy,
.rebirth-v3-card-stage--template-bg .rebirth-v3-modal-glass .rebirth-v3-card-foot span {
  color: rgba(255, 255, 255, 0.94);
}

.rebirth-v3-card-stage--template-bg .rebirth-v3-modal-glass .rebirth-v3-card-title {
  font-size: 1.36rem;
  line-height: 1.18;
}

.rebirth-v3-card-stage--template-bg .rebirth-v3-modal-glass .rebirth-v3-modal-copy {
  max-width: 30em;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.78rem;
}

.rebirth-v3-card-stage--template-bg .rebirth-v3-modal-glass .rebirth-v3-card-foot {
  margin-top: 6px;
}

.rebirth-v3-card-body {
  position: relative;
  z-index: 4;
  display: grid;
  gap: 8px;
  align-content: end;
  min-height: 100%;
  padding: 46% 14px 14px;
  background:
    linear-gradient(180deg, transparent 0%, rgba(15, 16, 20, 0.08) 34%, rgba(15, 16, 20, 0.74) 68%, rgba(15, 16, 20, 0.9) 100%);
  pointer-events: none;
}

.rebirth-v3-card-title {
  margin: 0;
  color: rgba(255, 255, 255, 0.96);
  font-family: var(--font-display);
  font-size: 0.96rem;
  font-weight: 900;
  line-height: 1.25;
  letter-spacing: 0;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.42);
}

.rebirth-v3-card-copy,
.rebirth-v3-modal-copy {
  margin: 0;
  color: rgba(255, 255, 255, 0.74);
  font-size: 0.68rem;
  line-height: 1.55;
}

.rebirth-v3-card-copy {
  display: -webkit-box;
  min-height: 2.1em;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.rebirth-v3-card-foot {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  margin-top: 2px;
}

.rebirth-v3-card-foot span {
  min-width: 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.68rem;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rebirth-v3-card-foot strong {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 9px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.82);
  color: var(--rebirth-chip-ink);
  font-size: 0.62rem;
  font-weight: 900;
}

.rebirth-v3-modal {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: end center;
  padding: 12px;
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(12px);
}

.rebirth-v3-modal-panel {
  position: relative;
  width: min(720px, 100%);
  max-height: calc(100vh - 24px);
  overflow: auto;
  border-radius: 24px;
  border: 1px solid var(--separator-soft);
  background: var(--bg-elevated);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24);
}

.rebirth-v3-modal-panel--template {
  border-color: rgba(255, 255, 255, 0.1);
  background: #15171b;
  box-shadow: 0 26px 80px rgba(0, 0, 0, 0.34);
}

.rebirth-v3-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 4;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.52);
  border-radius: var(--radius-full);
  background: rgba(20, 20, 24, 0.14);
  color: var(--text-primary);
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.rebirth-v3-modal-close .material-symbols-rounded {
  font-size: 18px;
}

.rebirth-v3-modal-card {
  display: grid;
  gap: 14px;
  padding: 14px;
}

.rebirth-v3-modal-panel--template .rebirth-v3-modal-card {
  gap: 16px;
  padding: 10px;
}

.rebirth-v3-modal-stage {
  min-height: 520px;
}

.rebirth-v3-modal-stage.rebirth-v3-card-stage--template-bg {
  width: 100%;
  min-height: min(62vh, 560px);
  aspect-ratio: auto;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.rebirth-v3-modal-stage.rebirth-v3-card-stage--template-bg .rebirth-v3-card-label {
  display: none;
}

.rebirth-v3-modal-portrait-wrap {
  min-height: 382px;
  padding: 72px 14px 0;
}

.rebirth-v3-modal-portrait-wrap .rebirth-v3-card-image {
  max-width: 320px;
}

.rebirth-v3-modal-glass {
  left: 12px;
  right: 12px;
  bottom: 12px;
  padding: 16px;
}

.rebirth-v3-modal-content {
  display: grid;
  gap: 13px;
  padding: 2px 2px 6px;
}

.rebirth-v3-modal-panel--template .rebirth-v3-modal-content {
  padding: 0 16px 12px;
}

.rebirth-v3-modal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rebirth-v3-modal-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--separator-soft);
  background: var(--fill-secondary);
  color: var(--text-secondary);
  font-size: 0.68rem;
  font-weight: 700;
}

.rebirth-v3-modal-panel--template .rebirth-v3-modal-chip {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.72);
}

.rebirth-v3-modal-line {
  margin: 0;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 1.12rem;
  font-weight: 800;
  line-height: 1.45;
  letter-spacing: 0;
}

.rebirth-v3-modal-panel--template .rebirth-v3-modal-line {
  color: rgba(255, 255, 255, 0.94);
}

.rebirth-v3-modal-paragraph {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
  line-height: 1.75;
}

.rebirth-v3-modal-panel--template .rebirth-v3-modal-paragraph {
  color: rgba(255, 255, 255, 0.62);
}

.rebirth-v3-question-list {
  display: grid;
  gap: 8px;
}

.rebirth-v3-question-card {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--separator-soft);
  background: var(--fill-tertiary);
}

.rebirth-v3-question-card span {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--fill-secondary);
  color: var(--text-secondary);
  font-size: 0.68rem;
  font-weight: 800;
}

.rebirth-v3-question-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.78rem;
  line-height: 1.65;
}

.rebirth-v3-modal-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.rebirth-v3-modal-primary,
.rebirth-v3-modal-secondary {
  justify-content: center;
  min-height: 42px;
}

@media (min-width: 700px) {
  .rebirth-v3-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .rebirth-v3-modal {
    place-items: center;
  }

  .rebirth-v3-modal-card {
    grid-template-columns: minmax(280px, 0.9fr) minmax(0, 1fr);
    gap: 18px;
  }

  .rebirth-v3-modal-stage {
    min-height: 560px;
  }
}

@media (max-width: 380px) {
  .section-tab {
    gap: 3px;
  }

  .section-tab-icon {
    font-size: 15px;
  }

  .section-tab-label {
    font-size: 0.68rem;
  }

  .rebirth-v3-grid {
    gap: 8px;
  }

  .rebirth-v3-card-title {
    font-size: 0.88rem;
  }
}
</style>
