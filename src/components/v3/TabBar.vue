<script setup lang="ts">
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"

const route = useRoute()
const router = useRouter()

interface TabItem {
  name: string
  path: string
  icon: string
  label: string
  accent: string
}

const tabs: TabItem[] = [
  { name: "plaza", path: "/plaza", icon: "public", label: "广场", accent: "var(--accent-primary)" },
  { name: "distill", path: "/projects", icon: "science", label: "蒸馏", accent: "var(--accent-primary)" },
  { name: "bottle", path: "/bottle", icon: "water_drop", label: "漂流瓶", accent: "var(--accent-primary)" },
  { name: "friends", path: "/friends", icon: "group", label: "好友", accent: "var(--accent-primary)" },
  { name: "messages", path: "/messages", icon: "chat_bubble", label: "消息", accent: "var(--accent-primary)" },
  { name: "profile", path: "/profile", icon: "person", label: "我的", accent: "var(--accent-primary)" },
]

const activeTab = computed(() => {
  const matched = tabs.find((t) => route.path.startsWith(t.path))
  return matched?.name || "distill"
})

function switchTab(tab: TabItem) {
  if (activeTab.value !== tab.name) {
    router.push(tab.path)
  }
}
</script>

<template>
  <nav class="cyber-tab-bar">
    <button
      v-for="tab in tabs"
      :key="tab.name"
      class="cyber-tab-item"
      :class="{ active: activeTab === tab.name }"
      :style="{ '--tab-accent': tab.accent }"
      @click="switchTab(tab)"
    >
      <span class="material-symbols-rounded cyber-tab-icon">{{ tab.icon }}</span>
      <span class="cyber-tab-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.cyber-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: var(--tab-bar-height);
  padding-bottom: var(--safe-bottom);
  background: color-mix(in srgb, var(--bg-elevated) 94%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-top: 1px solid var(--separator-soft, var(--ink-mist));
}

.cyber-tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  flex: 1;
  height: 100%;
  background: none;
  border: none;
  outline: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  color: var(--text-secondary);
  transition: color var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
}

.cyber-tab-item:active {
  transform: scale(0.9);
}

.cyber-tab-icon {
  font-size: 23px;
  color: var(--text-secondary);
  transition: color var(--duration-fast) var(--ease-default);
  line-height: 1;
}

.cyber-tab-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: color var(--duration-fast) var(--ease-default);
  letter-spacing: 0;
}

.cyber-tab-item.active .cyber-tab-icon {
  color: var(--tab-accent);
}

.cyber-tab-item.active .cyber-tab-label {
  color: var(--tab-accent);
}
</style>
