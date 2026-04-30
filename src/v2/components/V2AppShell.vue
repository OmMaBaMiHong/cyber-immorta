<template>
  <div class="v2-app-shell">
    <canvas class="v2-distill-canvas" aria-hidden="true" />
    <div class="v2-bg-atmosphere" aria-hidden="true" />

    <header class="v2-nav">
      <div class="v2-nav-inner">
        <RouterLink to="/" class="v2-brand">
          <span class="v2-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" class="v2-brand-icon">
              <path d="M9 3h6v2l-1.6 4.8a5 5 0 0 1 3.6 4.8V18H7v-3.2a5 5 0 0 1 3.6-4.8L9 5V3Z" fill="currentColor" />
            </svg>
          </span>
          <div class="v2-brand-wordmark">
            <span>DISTILL</span><span class="v2-brand-dot">.</span><span>HUMAN</span>
          </div>
        </RouterLink>

        <nav class="v2-nav-links" aria-label="主导航">
          <RouterLink to="/" class="v2-nav-link" exact-active-class="router-link-active">首页</RouterLink>
          <RouterLink :to="projectHubLink" class="v2-nav-link" exact-active-class="router-link-active">人类 3.0</RouterLink>
          <RouterLink to="/rebirth-template" class="v2-nav-link" exact-active-class="router-link-active">重生模板</RouterLink>
          <RouterLink :to="newProjectLink" class="v2-nav-link" exact-active-class="router-link-active">蒸馏机</RouterLink>
          <RouterLink to="/plaza" class="v2-nav-link">蒸馏工厂</RouterLink>
          <RouterLink to="/square" class="v2-nav-link" exact-active-class="router-link-active">广场</RouterLink>
        </nav>

        <div class="v2-nav-actions">
          <RouterLink :to="primaryActionLink" class="v2-btn v2-btn--primary v2-nav-cta">
            <svg viewBox="0 0 24 24" class="v2-nav-cta-icon" aria-hidden="true">
              <path d="M11 5h2v14h-2zM5 11h14v2H5z" fill="currentColor" />
            </svg>
            开始蒸馏
          </RouterLink>
        </div>
      </div>

      <div v-if="isAuthenticated && auth.user" ref="userMenuRef" class="v2-user-menu v2-user-menu--outer">
        <button
          type="button"
          class="v2-user-trigger"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          @click="menuOpen = !menuOpen"
        >
          <span class="v2-user-avatar">{{ userInitial }}</span>
        </button>

        <div v-if="menuOpen" class="v2-user-popover">
          <div class="v2-user-summary">
            <div class="v2-user-avatar v2-user-avatar--large">{{ userInitial }}</div>
            <div>
              <p class="v2-user-name">{{ auth.user.nickname }}</p>
              <p class="v2-user-email">{{ auth.user.email }}</p>
            </div>
          </div>

          <div class="v2-user-actions">
            <RouterLink to="/projects" class="v2-user-action" @click="closeMenu">人类 3.0 工作台</RouterLink>
            <RouterLink to="/rebirth-template" class="v2-user-action" @click="closeMenu">重生模板</RouterLink>
            <RouterLink to="/plaza" class="v2-user-action" @click="closeMenu">蒸馏工厂</RouterLink>
            <RouterLink to="/square" class="v2-user-action" @click="closeMenu">广场</RouterLink>
            <RouterLink
              v-if="auth.user.role === 'admin'"
              to="/admin/settings"
              class="v2-user-action"
              @click="closeMenu"
            >
              系统设置
            </RouterLink>
            <button type="button" class="v2-user-action v2-user-action--danger" @click="handleLogout">
              退出登录
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="v2-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"

import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const isAuthenticated = computed(() => Boolean(auth.token))
const menuOpen = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)

const newProjectLink = computed(() => (
  isAuthenticated.value
    ? { name: "new-project" }
    : { name: "auth", query: { redirect: "/projects/new" } }
))
const projectHubLink = computed(() => (
  isAuthenticated.value
    ? { name: "projects" }
    : { name: "auth", query: { redirect: "/projects" } }
))
const primaryActionLink = computed(() => (
  isAuthenticated.value
    ? { name: "new-project" }
    : {
        name: "auth",
        query: {
          redirect: route.name === "auth"
            ? "/projects/new"
            : (route.fullPath === "/" ? "/projects/new" : route.fullPath),
        },
      }
))
const userInitial = computed(() => (auth.user?.nickname?.trim()?.slice(0, 1) || "我").toUpperCase())

function closeMenu() {
  menuOpen.value = false
}

function handleDocumentClick(event: MouseEvent) {
  if (!menuOpen.value) return
  const target = event.target as Node | null
  if (target && userMenuRef.value?.contains(target)) return
  menuOpen.value = false
}

async function handleLogout() {
  closeMenu()
  await auth.logout()
  await router.push({ name: "landing" })
}

onMounted(() => {
  document.addEventListener("click", handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocumentClick)
})
</script>
