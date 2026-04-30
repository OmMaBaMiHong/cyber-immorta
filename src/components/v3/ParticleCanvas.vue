<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue"

const canvas = ref<HTMLCanvasElement | null>(null)
let animId = 0

interface Particle {
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  opacity: number
  color: string
}

let particles: Particle[] = []

function resize() {
  if (!canvas.value) return
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
}

function createParticles() {
  particles = []
  const count = Math.min(80, Math.floor(window.innerWidth * window.innerHeight / 15000))
  const colors = ["0,245,212", "245,166,35", "181,55,242"]
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * (canvas.value?.width || window.innerWidth),
      y: Math.random() * (canvas.value?.height || window.innerHeight),
      size: Math.random() * 2 + 0.5,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.5 + 0.1,
      color: colors[Math.floor(Math.random() * 3)],
    })
  }
}

function animate() {
  if (!canvas.value) return
  const ctx = canvas.value.getContext("2d")
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  // Update & draw particles
  particles.forEach((p) => {
    p.x += p.speedX
    p.y += p.speedY
    if (p.x < 0 || p.x > canvas.value!.width || p.y < 0 || p.y > canvas.value!.height) {
      p.x = Math.random() * canvas.value!.width
      p.y = Math.random() * canvas.value!.height
    }
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${p.color},${p.opacity})`
    ctx.fill()
  })

  // Draw connections
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 120) {
        ctx.beginPath()
        ctx.moveTo(particles[i].x, particles[i].y)
        ctx.lineTo(particles[j].x, particles[j].y)
        ctx.strokeStyle = `rgba(0,245,212,${0.06 * (1 - dist / 120)})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }
  }

  animId = requestAnimationFrame(animate)
}

onMounted(() => {
  resize()
  createParticles()
  animate()
  window.addEventListener("resize", () => {
    resize()
    createParticles()
  })
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
})
</script>

<template>
  <canvas ref="canvas" class="particle-canvas" />
</template>

<style scoped>
.particle-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>
