<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue"
import { useRouter } from "vue-router"
import axios from "axios"
import SkillDetailSheet from "@/components/v3/SkillDetailSheet.vue"

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8091"
const router = useRouter()

interface PackSummary {
  slug: string; title: string; subtitle: string; hero_background: string
  tags: string[]; skills: string[]; suitable_for: string[]
  display_group: string; display_group_label: string
  factory_category_label: string; source_count: number
}

const packs = ref<PackSummary[]>([])
const selectedSlug = ref<string | null>(null)
const showCaught = ref(false)
const caughtPack = ref<PackSummary | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const btnLabel = ref("抛竿")
const btnDisabled = ref(false)

const portraitPool = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop",
]

function getHeroImage(p: PackSummary): string {
  if (p.hero_background?.startsWith("http")) return p.hero_background
  return portraitPool[p.slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % portraitPool.length]
}

async function loadPacks() {
  try {
    const token = localStorage.getItem("distill-human-token")
    const h: Record<string, string> = {}
    if (token) h.Authorization = `Bearer ${token}`
    const { data } = await axios.get<{ items: PackSummary[] }>(`${API_BASE}/packs`, { headers: h, timeout: 10000 })
    packs.value = data.items || []
  } catch { packs.value = [] }
}

// ===== Canvas Engine =====
let ctx: CanvasRenderingContext2D | null = null
let W = 0, H = 0, time = 0, animFrame = 0
const HORIZON = 0.35

// Stars
let stars: Array<{ x: number; y: number; s: number; a: number; sp: number }> = []
// Fireflies → 萤火虫
let flies: Array<{ x: number; y: number; vx: number; vy: number; ph: number }> = []
// Ambient bottles
let ambientBottles: Array<{ x: number; y: number; sp: number; sz: number; ph: number }> = []
// Target bottle
let targetBottle: { x: number; y: number; sp: number; sz: number; ph: number; pack: PackSummary | null } | null = null
let nextAmbientSpawn = 60
// Lotus flowers (国风点缀)
let lotusFlowers: Array<{ x: number; y: number; sz: number; ph: number; type: number }> = []

// Fishing state machine
type FState = "idle" | "casting" | "waiting" | "hooked" | "reeling" | "showing"
let fState: FState = "idle"
let fTimer = 0
let rodBend = 0
let waitDuration = 0
let statusAlpha = 0
let statusText = ""

// Scene positions
let boatX = 0, boatBaseY = 0, boatBob = 0
let fisherX = 0, fisherY = 0
let rodHandX = 0, rodHandY = 0
let rodTipX = 0, rodTipBaseY = 0, rodTipY = 0
let bobberX = 0, bobberBaseY = 0, bobberY = 0

function initCanvas() {
  const c = canvasRef.value
  if (!c) return
  ctx = c.getContext("2d")
  resize()
  window.addEventListener("resize", resize)
  initStars()
  initFlies()
  initLotus()
  loop()
}

function resize() {
  const c = canvasRef.value
  if (!c) return
  const dpr = Math.min(devicePixelRatio, 2)
  W = innerWidth; H = innerHeight
  c.width = W * dpr; c.height = H * dpr
  c.style.width = W + "px"; c.style.height = H + "px"
  ctx!.scale(dpr, dpr)
  calcPositions()
}

function calcPositions() {
  const riverTop = H * HORIZON
  const riverH = H - riverTop
  boatX = W * 0.30
  boatBaseY = riverTop + riverH * 0.30
  // Fisher sits at the bow (front-right of boat), ahead of the canopy
  fisherX = boatX + W * 0.06
  fisherY = boatBaseY - 10
  rodHandX = fisherX + 16
  rodHandY = fisherY - 28
  rodTipX = W * 0.62
  rodTipBaseY = riverTop + riverH * 0.06
  bobberX = rodTipX
  bobberBaseY = riverTop + 10
}

function initStars() {
  stars = []
  const hy = H * HORIZON
  for (let i = 0; i < 80; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * hy * 0.85, s: Math.random() * 1.5 + 0.3, a: Math.random() * 0.6 + 0.2, sp: Math.random() * 2 + 0.5 })
  }
}

function initFlies() {
  flies = []
  for (let i = 0; i < 8; i++) {
    flies.push({ x: Math.random() * W * 0.5, y: H * 0.4 + Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.2, ph: Math.random() * Math.PI * 2 })
  }
}

function initLotus() {
  lotusFlowers = []
  const hy = H * HORIZON
  for (let i = 0; i < 6; i++) {
    lotusFlowers.push({
      x: W * (0.5 + Math.random() * 0.45),
      y: hy + 18 + Math.random() * (H * 0.14),
      sz: 10 + Math.random() * 10,
      ph: Math.random() * Math.PI * 2,
      type: Math.floor(Math.random() * 3),
    })
  }
}

// ===== 国风配色 =====
// 天空：靛蓝→青灰→暖月色
// 河水：墨蓝→青绿
// 远山：黛色
// 人物：暖棕+米色
// 漂流瓶：暖金/青瓷

// ===== Drawing =====
function drawSky() {
  const hy = H * HORIZON
  const g = ctx!.createLinearGradient(0, 0, 0, hy)
  g.addColorStop(0, "#0a0e1a")
  g.addColorStop(0.3, "#121a35")
  g.addColorStop(0.6, "#1a2a4a")
  g.addColorStop(0.85, "#243858")
  g.addColorStop(1, "#2d4462")
  ctx!.fillStyle = g; ctx!.fillRect(0, 0, W, hy + 2)
}

function drawMoon() {
  const mx = W * 0.78, my = H * 0.08, r = Math.min(W, H) * 0.04
  const c = ctx!
  // Outer glow - warm
  const g1 = c.createRadialGradient(mx, my, r * 0.5, mx, my, r * 8)
  g1.addColorStop(0, "rgba(255,230,180,0.10)")
  g1.addColorStop(0.3, "rgba(255,220,160,0.04)")
  g1.addColorStop(1, "transparent")
  c.fillStyle = g1; c.fillRect(mx - r * 8, my - r * 8, r * 16, r * 16)
  // Moon body - warm ivory
  c.beginPath(); c.arc(mx, my, r, 0, Math.PI * 2)
  const mg = c.createRadialGradient(mx - r * 0.2, my - r * 0.2, 0, mx, my, r)
  mg.addColorStop(0, "#fff8e8"); mg.addColorStop(0.7, "#f5e6c8"); mg.addColorStop(1, "#e8d4a8")
  c.fillStyle = mg; c.fill()
}

function drawStars() {
  const c = ctx!
  for (const s of stars) {
    const a = s.a * (0.4 + 0.6 * Math.sin(time * 0.015 * s.sp + s.x * 0.1))
    c.beginPath(); c.arc(s.x, s.y, s.s, 0, Math.PI * 2)
    c.fillStyle = `rgba(220,230,255,${a})`; c.fill()
  }
}

function drawDistantMountains() {
  const hy = H * HORIZON, c = ctx!
  // Far mountains - 黛色
  c.beginPath(); c.moveTo(0, hy)
  const peaks1 = [
    [0, hy - 12], [W * 0.08, hy - 30], [W * 0.15, hy - 45], [W * 0.22, hy - 35],
    [W * 0.3, hy - 55], [W * 0.38, hy - 40], [W * 0.45, hy - 50], [W * 0.52, hy - 38],
    [W * 0.6, hy - 48], [W * 0.68, hy - 32], [W * 0.75, hy - 42], [W * 0.82, hy - 28],
    [W * 0.9, hy - 35], [W, hy - 18], [W, hy]
  ]
  for (const [px, py] of peaks1) c.lineTo(px, py)
  c.closePath()
  const mg = c.createLinearGradient(0, hy - 55, 0, hy)
  mg.addColorStop(0, "rgba(30,45,65,0.6)"); mg.addColorStop(1, "rgba(35,55,75,0.3)")
  c.fillStyle = mg; c.fill()

  // Near mountains - 深黛
  c.beginPath(); c.moveTo(0, hy)
  const peaks2 = [
    [0, hy - 5], [W * 0.1, hy - 18], [W * 0.18, hy - 25], [W * 0.25, hy - 15],
    [W * 0.35, hy - 22], [W * 0.42, hy - 30], [W * 0.5, hy - 20],
    [W * 0.58, hy - 26], [W * 0.65, hy - 15], [W * 0.72, hy - 22],
    [W * 0.8, hy - 12], [W * 0.88, hy - 18], [W, hy - 8], [W, hy]
  ]
  for (const [px, py] of peaks2) c.lineTo(px, py)
  c.closePath()
  const mg2 = c.createLinearGradient(0, hy - 30, 0, hy)
  mg2.addColorStop(0, "rgba(25,40,55,0.8)"); mg2.addColorStop(1, "rgba(30,50,65,0.4)")
  c.fillStyle = mg2; c.fill()
}

function drawShore() {
  const hy = H * HORIZON, c = ctx!
  c.beginPath(); c.moveTo(0, hy)
  for (let x = 0; x <= W; x += 12) {
    const h = 3 + Math.sin(x * 0.01) * 4 + Math.sin(x * 0.025) * 2
    c.lineTo(x, hy - h)
  }
  c.lineTo(W, hy + 2); c.lineTo(0, hy + 2); c.closePath()
  c.fillStyle = "#1a2a3a"; c.fill()
}

function drawRiver() {
  const hy = H * HORIZON, c = ctx!
  // River base - 墨蓝→青绿
  const g = c.createLinearGradient(0, hy, 0, H)
  g.addColorStop(0, "#142838")
  g.addColorStop(0.3, "#163040")
  g.addColorStop(0.6, "#1a3848")
  g.addColorStop(1, "#122830")
  c.fillStyle = g; c.fillRect(0, hy, W, H - hy)

  const t = time * 0.006
  // Water ripples - 青色调
  for (let i = 0; i < 20; i++) {
    const y = hy + 4 + i * ((H - hy - 8) / 20)
    const alpha = 0.025 + (i / 20) * 0.035
    const amp = 1.2 + i * 0.25, freq = 0.012 - i * 0.0002, spd = 0.35 + i * 0.06
    c.beginPath(); c.moveTo(-10, y)
    for (let x = -10; x <= W + 10; x += 4) {
      const wave = Math.sin(x * freq + t * spd) * amp + Math.sin(x * freq * 2.1 + t * spd * 1.4) * amp * 0.25
      c.lineTo(x, y + wave)
    }
    c.strokeStyle = `rgba(80,180,200,${alpha})`; c.lineWidth = 0.7; c.stroke()
  }

  // Moon reflection on water - warm golden
  const mx = W * 0.78
  for (let i = 0; i < 8; i++) {
    const ry = hy + 10 + i * 15, rw = 14 - i * 1.5
    c.beginPath(); c.ellipse(mx + Math.sin(t * 0.8 + i) * 3, ry, rw, 1.5, 0, 0, Math.PI * 2)
    c.fillStyle = `rgba(255,230,180,${Math.max(0, 0.06 - i * 0.006)})`; c.fill()
  }
}

function drawLotus() {
  const c = ctx!, t = time * 0.015
  for (const lf of lotusFlowers) {
    const wave = Math.sin(t + lf.ph) * 2
    const lx = lf.x, ly = lf.y + wave, sz = lf.sz

    if (lf.type === 0) {
      // Lotus leaf - 荷叶
      c.save(); c.translate(lx, ly)
      c.beginPath(); c.ellipse(0, 0, sz, sz * 0.6, 0, 0, Math.PI * 2)
      c.fillStyle = "rgba(45,90,55,0.5)"; c.fill()
      c.beginPath(); c.moveTo(0, 0); c.lineTo(sz * 0.8, -sz * 0.1)
      c.strokeStyle = "rgba(35,70,45,0.4)"; c.lineWidth = 0.6; c.stroke()
      c.restore()
    } else if (lf.type === 1) {
      // Lotus flower - 荷花
      c.save(); c.translate(lx, ly)
      for (let p = 0; p < 5; p++) {
        const angle = (p / 5) * Math.PI - Math.PI / 2 + Math.sin(t * 0.5 + lf.ph) * 0.05
        c.save(); c.rotate(angle)
        c.beginPath(); c.ellipse(0, -sz * 0.5, sz * 0.25, sz * 0.5, 0, 0, Math.PI * 2)
        c.fillStyle = `rgba(230,150,170,${0.4 + p * 0.04})`; c.fill()
        c.restore()
      }
      // Center
      c.beginPath(); c.arc(0, 0, sz * 0.15, 0, Math.PI * 2)
      c.fillStyle = "rgba(255,220,100,0.45)"; c.fill()
      c.restore()
    } else {
      // Lotus bud - 花苞
      c.save(); c.translate(lx, ly)
      c.beginPath(); c.ellipse(0, -sz * 0.3, sz * 0.18, sz * 0.45, 0, 0, Math.PI * 2)
      c.fillStyle = "rgba(210,130,150,0.45)"; c.fill()
      c.beginPath(); c.moveTo(0, sz * 0.1); c.quadraticCurveTo(-sz * 0.12, -sz * 0.1, 0, -sz * 0.5)
      c.quadraticCurveTo(sz * 0.12, -sz * 0.1, 0, sz * 0.1)
      c.fillStyle = "rgba(55,100,55,0.4)"; c.fill()
      c.restore()
    }
  }
}

function drawBoat() {
  const c = ctx!, bx = boatX, by = boatBaseY + boatBob

  // 乌篷船 - larger, more detailed
  // Hull shadow
  c.beginPath()
  c.moveTo(bx - 50, by + 2)
  c.quadraticCurveTo(bx - 45, by + 20, bx - 25, by + 22)
  c.lineTo(bx + 40, by + 22)
  c.quadraticCurveTo(bx + 58, by + 20, bx + 62, by + 2)
  c.closePath()
  c.fillStyle = "rgba(0,0,0,0.2)"; c.fill()

  // Hull
  c.beginPath()
  c.moveTo(bx - 48, by - 2)
  c.quadraticCurveTo(bx - 44, by + 16, bx - 24, by + 18)
  c.lineTo(bx + 38, by + 18)
  c.quadraticCurveTo(bx + 55, by + 16, bx + 60, by - 2)
  c.closePath()
  const hg = c.createLinearGradient(bx, by - 2, bx, by + 18)
  hg.addColorStop(0, "#5a4025"); hg.addColorStop(1, "#3a2815")
  c.fillStyle = hg; c.fill()
  c.strokeStyle = "#2a1a08"; c.lineWidth = 1; c.stroke()

  // Rim highlight
  c.beginPath(); c.moveTo(bx - 48, by - 2); c.lineTo(bx + 60, by - 2)
  c.strokeStyle = "#6a5030"; c.lineWidth = 2.5; c.stroke()

  // Plank lines
  for (let i = 0; i < 4; i++) {
    const ly = by + 3 + i * 3.5
    c.beginPath(); c.moveTo(bx - 40 + i * 2, ly); c.lineTo(bx + 52 - i * 2, ly)
    c.strokeStyle = "rgba(42,26,8,0.3)"; c.lineWidth = 0.4; c.stroke()
  }

  // 乌篷 (canopy) - arched cover
  c.beginPath()
  c.moveTo(bx - 30, by - 2)
  c.quadraticCurveTo(bx - 28, by - 30, bx + 5, by - 32)
  c.quadraticCurveTo(bx + 35, by - 30, bx + 38, by - 2)
  c.closePath()
  const cg = c.createLinearGradient(bx, by - 32, bx, by - 2)
  cg.addColorStop(0, "#3a3020"); cg.addColorStop(0.5, "#4a3a25"); cg.addColorStop(1, "#3a2a18")
  c.fillStyle = cg; c.fill()
  c.strokeStyle = "#2a1a0a"; c.lineWidth = 0.8; c.stroke()

  // Canopy ribs
  for (let i = 0; i < 4; i++) {
    const rx = bx - 25 + i * 16
    c.beginPath(); c.moveTo(rx, by - 2)
    c.quadraticCurveTo(rx, by - 28 - Math.sin((i + 1) * 0.8) * 4, rx + 8, by - 30 + Math.sin((i + 1) * 0.5) * 2)
    c.strokeStyle = "rgba(60,45,25,0.5)"; c.lineWidth = 0.5; c.stroke()
  }

  // Lantern on bow - warm glow
  const lx = bx + 42, ly = by - 16
  const lg = c.createRadialGradient(lx, ly, 0, lx, ly, 28)
  lg.addColorStop(0, "rgba(255,180,80,0.18)"); lg.addColorStop(0.5, "rgba(255,160,60,0.06)"); lg.addColorStop(1, "transparent")
  c.fillStyle = lg; c.fillRect(lx - 28, ly - 28, 56, 56)
  // Lantern body
  c.beginPath(); c.ellipse(lx, ly, 4, 5, 0, 0, Math.PI * 2)
  c.fillStyle = "#e8a030"; c.fill()
  c.beginPath(); c.ellipse(lx, ly, 2.5, 3, 0, 0, Math.PI * 2)
  c.fillStyle = "#ffe8a0"; c.fill()
  // Lantern string
  c.beginPath(); c.moveTo(lx, ly - 5); c.lineTo(lx, ly - 10)
  c.strokeStyle = "#8a6030"; c.lineWidth = 0.5; c.stroke()
}

function drawFisherman() {
  const c = ctx!, fx = fisherX, fy = fisherY + boatBob
  const sc = Math.min(W / 375, 1.2) // Scale for different screen sizes

  // ===== 拟人化可爱风格 =====
  // 大头比例: head ~30% of total height

  // 斗笠 (bamboo hat) - larger, cuter
  c.save(); c.translate(fx, fy - 52 * sc)
  // Brim - wider
  c.beginPath(); c.ellipse(0, 0, 30 * sc, 8 * sc, 0, 0, Math.PI * 2)
  const hatG = c.createRadialGradient(0, 0, 0, 0, 0, 30 * sc)
  hatG.addColorStop(0, "#6a5535"); hatG.addColorStop(1, "#4a3520")
  c.fillStyle = hatG; c.fill()
  c.strokeStyle = "#3a2510"; c.lineWidth = 0.8; c.stroke()
  // Cone - taller
  c.beginPath(); c.moveTo(-18 * sc, 0); c.quadraticCurveTo(-5 * sc, -22 * sc, 0, -26 * sc)
  c.quadraticCurveTo(5 * sc, -22 * sc, 18 * sc, 0); c.closePath()
  const coneG = c.createLinearGradient(0, -26 * sc, 0, 0)
  coneG.addColorStop(0, "#7a6540"); coneG.addColorStop(1, "#5a4525")
  c.fillStyle = coneG; c.fill()
  // Hat texture lines
  c.beginPath(); c.moveTo(-16 * sc, -2 * sc); c.quadraticCurveTo(0, -16 * sc, 16 * sc, -2 * sc)
  c.strokeStyle = "rgba(100,75,40,0.4)"; c.lineWidth = 0.5; c.stroke()
  c.beginPath(); c.moveTo(-12 * sc, -5 * sc); c.quadraticCurveTo(0, -18 * sc, 12 * sc, -5 * sc)
  c.strokeStyle = "rgba(100,75,40,0.25)"; c.lineWidth = 0.4; c.stroke()
  c.restore()

  // Head - rounder, bigger (拟人化)
  const headR = 10 * sc
  const headY = fy - 36 * sc
  c.beginPath(); c.arc(fx, headY, headR, 0, Math.PI * 2)
  const headG = c.createRadialGradient(fx - 2 * sc, headY - 2 * sc, 0, fx, headY, headR)
  headG.addColorStop(0, "#f5deb3"); headG.addColorStop(1, "#d4b896")
  c.fillStyle = headG; c.fill()
  c.strokeStyle = "rgba(160,120,80,0.3)"; c.lineWidth = 0.5; c.stroke()

  // Eyes - cute dot eyes
  const eyeY = headY - 1 * sc
  c.beginPath(); c.arc(fx - 3.5 * sc, eyeY, 1.8 * sc, 0, Math.PI * 2)
  c.fillStyle = "#1a1008"; c.fill()
  c.beginPath(); c.arc(fx + 3.5 * sc, eyeY, 1.8 * sc, 0, Math.PI * 2)
  c.fillStyle = "#1a1008"; c.fill()
  // Eye highlights
  c.beginPath(); c.arc(fx - 2.8 * sc, eyeY - 0.8 * sc, 0.6 * sc, 0, Math.PI * 2)
  c.fillStyle = "#ffffff"; c.fill()
  c.beginPath(); c.arc(fx + 4.2 * sc, eyeY - 0.8 * sc, 0.6 * sc, 0, Math.PI * 2)
  c.fillStyle = "#ffffff"; c.fill()
  // Smile - content/happy
  c.beginPath(); c.arc(fx, headY + 2 * sc, 3 * sc, 0.15 * Math.PI, 0.85 * Math.PI)
  c.strokeStyle = "#8a6040"; c.lineWidth = 0.8; c.lineCap = "round"; c.stroke()
  // Blush
  c.beginPath(); c.ellipse(fx - 6 * sc, headY + 1 * sc, 2.5 * sc, 1.5 * sc, 0, 0, Math.PI * 2)
  c.fillStyle = "rgba(220,140,120,0.2)"; c.fill()
  c.beginPath(); c.ellipse(fx + 6 * sc, headY + 1 * sc, 2.5 * sc, 1.5 * sc, 0, 0, Math.PI * 2)
  c.fillStyle = "rgba(220,140,120,0.2)"; c.fill()

  // 蓑衣 (straw raincoat) body - cuter, rounder
  const bodyTop = fy - 26 * sc, bodyBot = fy + 8 * sc
  c.beginPath()
  c.moveTo(fx - 15 * sc, bodyTop)
  c.quadraticCurveTo(fx - 18 * sc, fy - 5 * sc, fx - 12 * sc, bodyBot)
  c.lineTo(fx + 12 * sc, bodyBot)
  c.quadraticCurveTo(fx + 18 * sc, fy - 5 * sc, fx + 15 * sc, bodyTop)
  c.closePath()
  const suoG = c.createLinearGradient(fx, bodyTop, fx, bodyBot)
  suoG.addColorStop(0, "#5a4830"); suoG.addColorStop(1, "#3a3020")
  c.fillStyle = suoG; c.fill()
  c.strokeStyle = "rgba(80,60,30,0.3)"; c.lineWidth = 0.5; c.stroke()

  // Straw texture - layered fringes
  for (let i = 0; i < 6; i++) {
    const sy = bodyTop + 2 + i * 5.5 * sc
    const w = 14 * sc - i * 0.5 * sc
    c.beginPath(); c.moveTo(fx - w, sy); c.lineTo(fx + w, sy)
    c.strokeStyle = `rgba(100,80,45,${0.25 - i * 0.02})`; c.lineWidth = 0.4; c.stroke()
    // Small fringe marks
    for (let j = -3; j <= 3; j++) {
      const fx2 = fx + j * 4 * sc
      c.beginPath(); c.moveTo(fx2, sy); c.lineTo(fx2 + (j % 2 ? 1 : -1) * sc, sy + 2 * sc)
      c.strokeStyle = "rgba(90,70,35,0.2)"; c.lineWidth = 0.3; c.stroke()
    }
  }

  // Legs (sitting cross-legged or dangling)
  c.beginPath(); c.ellipse(fx - 5 * sc, bodyBot + 4 * sc, 6 * sc, 3 * sc, -0.1, 0, Math.PI * 2)
  c.fillStyle = "#2a2015"; c.fill()
  c.beginPath(); c.ellipse(fx + 5 * sc, bodyBot + 4 * sc, 6 * sc, 3 * sc, 0.1, 0, Math.PI * 2)
  c.fillStyle = "#2a2015"; c.fill()

  // Arm holding rod - rounder
  c.beginPath(); c.moveTo(fx + 13 * sc, fy - 20 * sc)
  c.quadraticCurveTo(fx + 20 * sc, fy - 24 * sc, rodHandX, rodHandY)
  c.strokeStyle = "#5a4830"; c.lineWidth = 4 * sc; c.lineCap = "round"; c.stroke()
  // Hand
  c.beginPath(); c.arc(rodHandX, rodHandY, 2.5 * sc, 0, Math.PI * 2)
  c.fillStyle = "#f0d0a0"; c.fill()
}

function drawFishingRod() {
  const c = ctx!
  const tipY = rodTipBaseY + rodBend * 35

  // Rod (bamboo pole) - thicker, with bamboo nodes
  c.beginPath(); c.moveTo(rodHandX, rodHandY)
  const cpx = (rodHandX + rodTipX) / 2, cpy = Math.min(rodHandY, tipY) - 18 + rodBend * 12
  c.quadraticCurveTo(cpx, cpy, rodTipX, tipY)
  c.strokeStyle = "#6a5530"; c.lineWidth = 3.5; c.lineCap = "round"; c.stroke()
  // Bamboo highlight
  c.beginPath(); c.moveTo(rodHandX + 2, rodHandY - 1)
  c.quadraticCurveTo(cpx + 2, cpy + 1, rodTipX, tipY)
  c.strokeStyle = "#8a7545"; c.lineWidth = 1.5; c.stroke()
  // Bamboo nodes
  const nodeCount = 3
  for (let i = 1; i <= nodeCount; i++) {
    const t = i / (nodeCount + 1)
    const nx = rodHandX + (rodTipX - rodHandX) * t
    const ny = rodHandY + (tipY - rodHandY) * t + Math.sin(t * Math.PI) * (-18 + rodBend * 12) * (1 - Math.abs(t - 0.5) * 2)
    c.beginPath(); c.moveTo(nx - 2, ny - 1); c.lineTo(nx + 2, ny - 1)
    c.strokeStyle = "rgba(50,35,15,0.5)"; c.lineWidth = 1.5; c.stroke()
  }

  // Fishing line
  if (fState !== "idle") {
    const lineEndY = fState === "hooked"
      ? bobberBaseY + 10 + Math.sin(time * 0.12) * 4
      : bobberBaseY + Math.sin(time * 0.03) * 2.5
    c.beginPath(); c.moveTo(rodTipX, tipY)
    c.quadraticCurveTo(rodTipX + 8, (tipY + lineEndY) / 2, bobberX, lineEndY)
    c.strokeStyle = "rgba(220,220,220,0.2)"; c.lineWidth = 0.5; c.stroke()

    // Bobber - 红色浮漂
    const bSize = fState === "hooked" ? 4 : 3
    c.beginPath(); c.arc(bobberX, lineEndY, bSize, 0, Math.PI * 2)
    c.fillStyle = fState === "hooked" ? "#e84030" : "#d43020"; c.fill()
    c.beginPath(); c.arc(bobberX, lineEndY - bSize * 0.7, bSize * 0.45, 0, Math.PI * 2)
    c.fillStyle = "#ffffff"; c.fill()

    // Ripples - 涟漪
    if (fState === "waiting" || fState === "hooked") {
      const rippleR = 10 + Math.sin(time * 0.05) * 5
      c.beginPath(); c.ellipse(bobberX, lineEndY + 3, rippleR, rippleR * 0.3, 0, 0, Math.PI * 2)
      c.strokeStyle = `rgba(100,190,210,${0.08 + Math.sin(time * 0.05) * 0.04})`; c.lineWidth = 0.5; c.stroke()
    }
    if (fState === "hooked") {
      const rr = 18 + Math.sin(time * 0.12) * 6
      c.beginPath(); c.ellipse(bobberX, lineEndY + 3, rr, rr * 0.3, 0, 0, Math.PI * 2)
      c.strokeStyle = "rgba(230,80,50,0.12)"; c.lineWidth = 0.8; c.stroke()
      const rr2 = 28 + Math.sin(time * 0.08) * 8
      c.beginPath(); c.ellipse(bobberX, lineEndY + 3, rr2, rr2 * 0.25, 0, 0, Math.PI * 2)
      c.strokeStyle = "rgba(230,80,50,0.06)"; c.lineWidth = 0.5; c.stroke()
    }
  }
}

function drawBottleShape(x: number, y: number, sz: number, glow: number, isTarget: boolean) {
  const c = ctx!
  // Glow - warm gold for target, cool cyan for ambient
  const g = c.createRadialGradient(x, y, 0, x, y, sz * 3.5)
  const gc = isTarget ? "255,200,80" : "120,200,220"
  g.addColorStop(0, `rgba(${gc},${glow * 0.4})`)
  g.addColorStop(0.4, `rgba(${gc},${glow * 0.12})`)
  g.addColorStop(1, "transparent")
  c.fillStyle = g; c.fillRect(x - sz * 3.5, y - sz * 3.5, sz * 7, sz * 7)

  // Bottle body
  const bw = sz * 0.55, bh = sz * 1.15
  c.beginPath()
  c.roundRect(x - bw / 2, y - bh / 2, bw, bh, bw * 0.22)
  if (isTarget) {
    const bg = c.createLinearGradient(x - bw / 2, y, x + bw / 2, y)
    bg.addColorStop(0, `rgba(255,220,130,${glow * 0.75})`)
    bg.addColorStop(1, `rgba(255,200,100,${glow * 0.6})`)
    c.fillStyle = bg
  } else {
    const bg = c.createLinearGradient(x - bw / 2, y, x + bw / 2, y)
    bg.addColorStop(0, `rgba(140,210,230,${glow * 0.5})`)
    bg.addColorStop(1, `rgba(120,190,210,${glow * 0.4})`)
    c.fillStyle = bg
  }
  c.fill()
  c.strokeStyle = isTarget ? `rgba(255,200,80,${glow * 0.5})` : `rgba(160,220,240,${glow * 0.3})`
  c.lineWidth = 0.5; c.stroke()

  // Neck
  const nw = bw * 0.3, nh = sz * 0.35
  c.beginPath(); c.rect(x - nw / 2, y - bh / 2 - nh, nw, nh)
  c.fillStyle = isTarget ? `rgba(255,220,130,${glow * 0.6})` : `rgba(140,210,230,${glow * 0.4})`; c.fill()

  // Cork
  c.beginPath(); c.rect(x - nw / 2 - 1, y - bh / 2 - nh - 2.5, nw + 2, 3)
  c.fillStyle = `rgba(180,140,70,${glow * 0.8})`; c.fill()

  // Inner glow - paper scroll inside
  const ig = c.createRadialGradient(x, y - bh * 0.1, 0, x, y, bw * 0.35)
  ig.addColorStop(0, isTarget ? `rgba(255,245,180,${glow * 0.5})` : `rgba(200,235,255,${glow * 0.3})`)
  ig.addColorStop(1, "transparent")
  c.fillStyle = ig; c.fillRect(x - bw / 2, y - bh / 2, bw, bh)

  // Tiny scroll lines inside (卷轴感)
  if (sz > 9) {
    c.beginPath(); c.moveTo(x - bw * 0.2, y - bh * 0.15); c.lineTo(x + bw * 0.2, y - bh * 0.15)
    c.strokeStyle = isTarget ? `rgba(200,160,60,${glow * 0.3})` : `rgba(100,170,200,${glow * 0.2})`
    c.lineWidth = 0.3; c.stroke()
    c.beginPath(); c.moveTo(x - bw * 0.15, y); c.lineTo(x + bw * 0.15, y)
    c.stroke()
  }
}

function drawAmbientBottles() {
  for (const b of ambientBottles) {
    const wave = Math.sin(time * 0.02 + b.ph) * 3.5
    drawBottleShape(b.x, b.y + wave, b.sz, 0.35 + Math.sin(time * 0.018 + b.ph) * 0.15, false)
  }
}

function drawTargetBottle() {
  if (!targetBottle) return
  const wave = Math.sin(time * 0.02 + targetBottle.ph) * 3.5
  drawBottleShape(targetBottle.x, targetBottle.y + wave, targetBottle.sz, 0.85, true)
}

function drawFlies() {
  const c = ctx!
  for (const f of flies) {
    const a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * 0.035 + f.ph))
    const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, 8)
    g.addColorStop(0, `rgba(200,255,120,${a * 0.5})`)
    g.addColorStop(0.4, `rgba(180,255,100,${a * 0.12})`)
    g.addColorStop(1, "transparent")
    c.fillStyle = g; c.fillRect(f.x - 8, f.y - 8, 16, 16)
    c.beginPath(); c.arc(f.x, f.y, 1.5, 0, Math.PI * 2)
    c.fillStyle = `rgba(230,255,170,${a})`; c.fill()
  }
}

function drawMist() {
  const c = ctx!, hy = H * HORIZON
  const t = time * 0.002
  for (let i = 0; i < 4; i++) {
    const mx = W * (0.15 + i * 0.25) + Math.sin(t + i * 1.8) * 50
    const my = hy + 10 + i * 18
    const g = c.createRadialGradient(mx, my, 0, mx, my, 90 + i * 15)
    g.addColorStop(0, `rgba(120,160,190,${0.035 - i * 0.006})`)
    g.addColorStop(1, "transparent")
    c.fillStyle = g; c.fillRect(mx - 110, my - 60, 220, 120)
  }
}

function drawStatus() {
  if (statusAlpha <= 0 || !statusText) return
  const c = ctx!
  c.save()
  c.globalAlpha = statusAlpha
  c.font = `bold ${Math.min(W * 0.065, 22)}px sans-serif`
  c.textAlign = "center"
  // Warm gold text with glow
  c.shadowColor = "rgba(255,200,80,0.6)"; c.shadowBlur = 18
  c.fillStyle = "#ffe080"
  c.fillText(statusText, W * 0.5, H * 0.32)
  // Second pass for sharper text
  c.shadowBlur = 0; c.fillStyle = "#fff8e0"
  c.fillText(statusText, W * 0.5, H * 0.32)
  c.restore()
}

function drawVignette() {
  const c = ctx!
  const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7)
  g.addColorStop(0, "transparent"); g.addColorStop(1, "rgba(5,10,20,0.35)")
  c.fillStyle = g; c.fillRect(0, 0, W, H)
}

// ===== Update =====
function update() {
  time++
  boatBob = Math.sin(time * 0.018) * 3

  // Fireflies
  for (const f of flies) {
    f.x += f.vx + Math.sin(time * 0.008 + f.ph) * 0.18
    f.y += f.vy + Math.cos(time * 0.01 + f.ph) * 0.14
    if (f.x < 0 || f.x > W * 0.5) f.vx *= -1
    if (f.y < H * 0.32 || f.y > H * 0.88) f.vy *= -1
  }

  // Ambient bottles
  nextAmbientSpawn--
  if (nextAmbientSpawn <= 0 && ambientBottles.length < 4) {
    ambientBottles.push({
      x: W + 20, y: H * HORIZON + 18 + Math.random() * (H * 0.14),
      sp: 0.3 + Math.random() * 0.5, sz: 8 + Math.random() * 5, ph: Math.random() * Math.PI * 2,
    })
    nextAmbientSpawn = 120 + Math.random() * 200
  }
  for (let i = ambientBottles.length - 1; i >= 0; i--) {
    ambientBottles[i].x -= ambientBottles[i].sp
    if (ambientBottles[i].x < -30) ambientBottles.splice(i, 1)
  }

  // Target bottle
  if (targetBottle && fState === "waiting") {
    targetBottle.x -= targetBottle.sp
    if (targetBottle.x <= bobberX + 5) {
      targetBottle.x = bobberX
      fState = "hooked"; fTimer = 0
      statusText = "上货了！"; statusAlpha = 0
    }
  }
  if (targetBottle && fState === "reeling") {
    targetBottle.x += (fisherX - targetBottle.x) * 0.08
    targetBottle.y += (fisherY + boatBob - targetBottle.y) * 0.08
    targetBottle.sz *= 0.98
  }

  updateFishing()
}

function updateFishing() {
  fTimer++
  switch (fState) {
    case "casting":
      rodBend = Math.min(1, fTimer / 15)
      if (fTimer >= 20) {
        fState = "waiting"; fTimer = 0
        waitDuration = 180 + Math.random() * 240
        statusText = "等待鱼儿上钩..."; statusAlpha = 1
        btnLabel.value = "等待中..."; btnDisabled.value = true
        targetBottle = {
          x: W + 30, y: bobberBaseY + Math.random() * 10,
          sp: 0.6 + Math.random() * 0.4, sz: 12, ph: Math.random() * Math.PI * 2,
          pack: packs.value[Math.floor(Math.random() * packs.value.length)] || null,
        }
      }
      break
    case "waiting":
      rodBend = 0.15 + Math.sin(time * 0.03) * 0.05
      if (fTimer >= waitDuration && targetBottle) {
        targetBottle.sp = 1.5
      }
      if (fTimer > waitDuration + 300) {
        if (targetBottle) { targetBottle.x = bobberX; }
        fState = "hooked"; fTimer = 0
        statusText = "上货了！"; statusAlpha = 0
      }
      break
    case "hooked":
      rodBend = 0.7 + Math.sin(time * 0.15) * 0.1
      statusAlpha = Math.min(1, fTimer / 15)
      if (fTimer >= 90) {
        fState = "reeling"; fTimer = 0
        statusAlpha = 0
      }
      break
    case "reeling":
      rodBend = Math.max(0, 0.7 - fTimer / 60)
      if (fTimer >= 60) {
        fState = "showing"; fTimer = 0
        if (targetBottle?.pack) {
          caughtPack.value = targetBottle.pack
          showCaught.value = true
        }
        targetBottle = null
        statusText = ""; statusAlpha = 0
      }
      break
  }
}

// ===== Main Loop =====
function loop() {
  update()
  const c = ctx!
  c.clearRect(0, 0, W, H)
  drawSky(); drawMoon(); drawStars(); drawDistantMountains(); drawShore(); drawRiver()
  drawLotus()
  drawAmbientBottles(); drawTargetBottle()
  drawBoat(); drawFishingRod(); drawFisherman()
  drawFlies(); drawMist(); drawVignette(); drawStatus()
  animFrame = requestAnimationFrame(loop)
}

// ===== Business Logic =====
function castRod() {
  if (fState !== "idle" || !packs.value.length) return
  fState = "casting"; fTimer = 0
  btnLabel.value = ""; btnDisabled.value = true
}

function closeCard() {
  showCaught.value = false
  selectedSlug.value = null
  caughtPack.value = null
  fState = "idle"; fTimer = 0; rodBend = 0
  statusText = ""; statusAlpha = 0
  btnLabel.value = "抛竿"; btnDisabled.value = false
}

function openDetail() {
  if (caughtPack.value) selectedSlug.value = caughtPack.value.slug
}

function useForDistill() {
  if (!caughtPack.value) return
  showCaught.value = false
  selectedSlug.value = null
  void router.push({
    name: "projects-cyber",
    query: {
      pack: caughtPack.value.slug,
      from: "plaza",
    },
  })
}

onMounted(() => { loadPacks(); initCanvas() })
onUnmounted(() => { cancelAnimationFrame(animFrame); window.removeEventListener("resize", resize) })
</script>

<template>
  <div class="bottle-page">
    <canvas ref="canvasRef" class="scene-canvas" />

    <!-- Cast button -->
    <div v-if="fState !== 'showing'" class="action-area">
      <button class="cast-btn" :disabled="btnDisabled || !packs.length" @click="castRod">
        <span class="material-symbols-rounded" style="font-size: 20px">{{ fState === 'idle' ? 'phishing' : 'hourglass_top' }}</span>
        <span>{{ btnLabel }}</span>
      </button>
      <p v-if="fState === 'idle'" class="action-hint">点击抛竿，钓一个随机 Skill</p>
    </div>

    <!-- Caught card -->
    <transition name="caught">
      <div v-if="showCaught && caughtPack" class="caught-overlay">
        <div class="caught-card">
          <div class="caught-hero">
            <img :src="getHeroImage(caughtPack)" :alt="caughtPack.title" />
            <div class="caught-hero-grad" />
            <span class="caught-cat">{{ caughtPack.display_group_label || caughtPack.factory_category_label }}</span>
          </div>
          <div class="caught-body">
            <h3>{{ caughtPack.title }}</h3>
            <p>{{ caughtPack.subtitle }}</p>
            <div v-if="caughtPack.skills.length" class="caught-tags">
              <span v-for="s in caughtPack.skills.slice(0, 3)" :key="s">{{ s }}</span>
            </div>
            <div class="caught-btns">
              <button class="caught-btn-primary" @click="useForDistill">
                <span class="material-symbols-rounded" style="font-size: 16px">auto_awesome</span> 去蒸馏
              </button>
              <button @click="openDetail">
                <span class="material-symbols-rounded" style="font-size: 16px">open_in_new</span> 查看详情
              </button>
              <button @click="closeCard">
                <span class="material-symbols-rounded" style="font-size: 16px">phishing</span> 继续垂钓
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <SkillDetailSheet :slug="selectedSlug" @close="selectedSlug = null" />
  </div>
</template>

<style scoped>
.bottle-page { position: relative; width: 100%; height: 100vh; height: 100dvh; overflow: hidden; background: #0a0e1a; }
.scene-canvas { position: absolute; inset: 0; z-index: 0; display: block; }

.action-area {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.cast-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 36px; border-radius: var(--radius-full);
  background: linear-gradient(135deg, rgba(200,160,80,0.15), rgba(200,160,80,0.05));
  border: 1.5px solid rgba(200,160,80,0.4); color: #fff;
  font-size: 0.95rem; font-weight: 600; letter-spacing: 2px;
  cursor: pointer; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  -webkit-tap-highlight-color: transparent;
  box-shadow: 0 0 25px rgba(200,160,80,0.1);
  transition: all 0.2s;
}
.cast-btn:active:not(:disabled) { transform: scale(0.95); }
.cast-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.action-hint { font-size: 0.7rem; color: rgba(255,255,255,0.35); margin: 0; letter-spacing: 1px; }

/* Caught card */
.caught-overlay {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: center; justify-content: center;
  background: rgba(10,14,26,0.75); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  padding: 20px;
}
.caught-enter-active { transition: opacity 0.4s ease; }
.caught-leave-active { transition: opacity 0.3s ease; }
.caught-enter-from, .caught-leave-to { opacity: 0; }

.caught-card {
  width: 100%; max-width: 340px; border-radius: 20px; overflow: hidden;
  background: #1c1c1e; border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(255,200,80,0.06);
  animation: card-pop 0.5s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes card-pop { 0% { transform: scale(0.7) translateY(40px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }

.caught-hero { position: relative; width: 100%; height: 200px; overflow: hidden; }
.caught-hero img { width: 100%; height: 100%; object-fit: cover; }
.caught-hero-grad { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 30%, #1c1c1e 100%); }
.caught-cat {
  position: absolute; top: 12px; left: 12px;
  padding: 3px 10px; border-radius: var(--radius-full);
  background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 0.6rem; letter-spacing: 1px;
}
.caught-body { padding: 16px; }
.caught-body h3 { font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; color: #fff; margin: 0 0 4px; }
.caught-body p { font-size: 0.78rem; color: #98989d; line-height: 1.5; margin: 0 0 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.caught-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.caught-tags span {
  padding: 3px 10px; border-radius: var(--radius-full);
  background: rgba(200,160,80,0.1); border: 1px solid rgba(200,160,80,0.2);
  color: #e8c870; font-size: 0.63rem; letter-spacing: 0.5px;
}
.caught-btns { display: flex; gap: 10px; }
.caught-btns button {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 10px 0; border-radius: var(--radius-sm); font-size: 0.78rem; font-weight: 500;
  cursor: pointer; transition: all 0.2s; -webkit-tap-highlight-color: transparent;
}
.caught-btn-primary {
  background: linear-gradient(135deg, rgba(200,160,80,0.15), rgba(200,160,80,0.05));
  border: 1px solid rgba(200,160,80,0.35); color: #e8c870;
}
.caught-btns button:nth-child(2) {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); color: #fff;
}
.caught-btns button:last-child {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff;
}
</style>
