<script setup lang="ts">
import { computed } from "vue"
import { useRoute } from "vue-router"
import TabBar from "./TabBar.vue"
import { themeMode, toggleTheme } from "@/lib/theme"

const route = useRoute()

const showTabBar = computed(() => {
  const tabRoutes = [
    /^\/$/,
    /^\/projects$/,
    /^\/projects\/list$/,
    /^\/projects\/cyber/,
    /^\/projects\/[^/]+\/report$/,
    /^\/projects\/[^/]+\/jobs\/[^/]+$/,
    /^\/plaza$/,
    /^\/bottle$/,
    /^\/friends$/,
    /^\/messages$/,
    /^\/profile$/,
  ]
  return tabRoutes.some((pattern) => pattern.test(route.path))
})
</script>

<template>
  <div class="cyber-root">
    <button
      type="button"
      class="theme-toggle"
      :class="[`theme-toggle--${themeMode}`, { 'theme-toggle--profile': route.path === '/profile' }]"
      @click="toggleTheme"
    >
      <span class="material-symbols-rounded">{{ themeMode === "apple-light" ? "dark_mode" : "light_mode" }}</span>
      <span>{{ themeMode === "apple-light" ? "深色" : "浅色" }}</span>
    </button>

    <main class="cyber-main">
      <RouterView v-slot="{ Component }">
        <transition name="cyber-page" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>

    <!-- Tab Bar -->
    <TabBar v-if="showTabBar" />
  </div>
</template>

<style scoped>
.cyber-main {
  position: relative;
  z-index: 1;
  min-height: 100vh;
}

.theme-toggle {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 14px);
  right: 14px;
  z-index: 120;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--ink-mist);
  background: color-mix(in srgb, var(--bg-elevated) 94%, transparent);
  color: var(--text-primary);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: none;
  font-size: 0.78rem;
  font-weight: 600;
}

.theme-toggle .material-symbols-rounded {
  font-size: 18px;
  color: inherit;
}

.theme-toggle--apple-dark {
  border-color: var(--ink-mist);
  color: var(--text-primary);
}

.cyber-page-enter-active,
.cyber-page-leave-active {
  transition: opacity var(--duration-normal) var(--ease-default),
              transform var(--duration-normal) var(--ease-default);
}

.cyber-page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.cyber-page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 767px) {
  .theme-toggle {
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    right: 10px;
    min-height: 34px;
    padding: 0 10px;
    font-size: 0.74rem;
  }
}

.theme-toggle--profile {
  right: 62px;
}
</style>
