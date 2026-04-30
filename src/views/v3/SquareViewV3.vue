<script setup lang="ts">
/* 广场 Tab 首页 — 小红书风格信息流（占位） */
</script>

<template>
  <div class="cyber-page">
    <header class="cyber-page-header">
      <div class="cyber-animate-in">
        <p class="cyber-caption" style="color: var(--ink-blue); margin-bottom: 8px">SQUARE</p>
        <h1 class="cyber-title cyber-title-md">蒸馏广场</h1>
        <p class="cyber-caption" style="margin-top: 8px">发现有趣的蒸馏报告与 Skill</p>
      </div>
    </header>

    <div class="v3-page-content">
      <div class="v3-placeholder cyber-animate-in" style="animation-delay: 120ms">
        <span class="material-symbols-rounded" style="font-size: 48px; color: var(--neon-cyan)">grid_view</span>
        <p class="cyber-title cyber-title-sm" style="color: var(--text-secondary); margin-top: 12px">广场即将上线</p>
        <p class="cyber-caption" style="margin-top: 4px">小红书风格信息流 · 点赞评论收藏</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.v3-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}
</style>
