<template>
  <div class="v2-report-panel">
    <div class="v2-panel-head">
      <div>
        <p class="v2-section-kicker">{{ kicker }}</p>
        <h3 class="v2-section-title">{{ title }}</h3>
      </div>
      <span class="v2-status-pill">{{ metrics.length }} 维</span>
    </div>

    <div class="v2-radar-wrap">
      <svg viewBox="0 0 260 260" class="v2-radar-svg" aria-hidden="true">
        <g transform="translate(130 130)">
          <polygon
            v-for="level in 4"
            :key="`level-${level}`"
            :points="polygonPoints(level / 4)"
            class="v2-radar-grid"
          />
          <line
            v-for="(metric, index) in metrics"
            :key="`axis-${metric.label}-${index}`"
            :x1="0"
            :y1="0"
            :x2="axisPoint(index).x"
            :y2="axisPoint(index).y"
            class="v2-radar-axis"
          />
          <polygon :points="dataPoints" class="v2-radar-shape" />
          <circle
            v-for="(metric, index) in metrics"
            :key="`dot-${metric.label}-${index}`"
            :cx="valuePoint(index).x"
            :cy="valuePoint(index).y"
            r="4"
            class="v2-radar-dot"
          />
        </g>
      </svg>
    </div>

    <div class="v2-radar-legend">
      <div v-for="metric in metrics" :key="metric.label" class="v2-radar-row">
        <div>
          <p class="v2-radar-label">{{ metric.label }}</p>
          <p class="v2-radar-axis-label">{{ metric.axis }}</p>
        </div>
        <span class="v2-status-pill">{{ Math.round(metric.score * 100) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"

import type { PublicCardDimensionScore } from "@/types"

const props = defineProps<{
  title: string
  kicker?: string
  metrics: PublicCardDimensionScore[]
}>()

function angleFor(index: number) {
  return (-90 + (360 / props.metrics.length) * index) * (Math.PI / 180)
}

function pointFor(index: number, scale: number) {
  const radius = 88 * scale
  const angle = angleFor(index)
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
}

function polygonPoints(scale: number) {
  return props.metrics.map((_, index) => {
    const point = pointFor(index, scale)
    return `${point.x},${point.y}`
  }).join(" ")
}

function axisPoint(index: number) {
  return pointFor(index, 1)
}

function valuePoint(index: number) {
  const metric = props.metrics[index]
  return pointFor(index, Math.max(0.12, metric.score))
}

const dataPoints = computed(() =>
  props.metrics.map((_, index) => {
    const point = valuePoint(index)
    return `${point.x},${point.y}`
  }).join(" ")
)
</script>
