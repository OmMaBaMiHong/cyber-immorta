<template>
  <div class="shell-grid">
    <aside class="shell-side shell-left hidden lg:flex lg:flex-col lg:gap-5">
      <RouterLink to="/" class="glass-card shell-brand-card">
        <span class="shell-brand-mark">蒸</span>
        <div class="min-w-0">
          <p class="mini-kicker">Distill Human</p>
          <h1 class="mt-2 text-2xl font-semibold text-ink">蒸馏人类</h1>
        </div>
      </RouterLink>

      <nav class="shell-nav-stack">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="glass-card shell-nav-link"
        >
          <p class="shell-nav-link-label">{{ item.label }}</p>
          <p class="shell-nav-link-hint">{{ item.hint }}</p>
        </RouterLink>
      </nav>
    </aside>

    <main class="min-w-0">
      <header class="page-wrap shell-topbar shell-topbar-wrap pb-0 md:hidden">
        <RouterLink to="/" class="shell-mobile-brand md:hidden">
          <span class="shell-mobile-brand-mark">蒸</span>
          <span class="text-lg font-semibold text-ink">蒸馏人类</span>
        </RouterLink>
        <div class="user-topbar">
          <div class="user-topbar-id">
            <span class="user-topbar-avatar">{{ userAvatarText }}</span>
            <div class="user-topbar-meta">
              <p class="user-topbar-name">{{ user?.nickname || "未登录" }}</p>
              <p class="user-topbar-email">{{ user?.email || "" }}</p>
            </div>
          </div>
          <RouterLink v-if="!isAuthenticated" to="/auth" class="button-primary px-4 py-2">登录 / 注册</RouterLink>
          <button v-else class="button-secondary px-4 py-2" @click="handleLogout">退出</button>
        </div>
      </header>
      <slot />
      <nav class="shell-mobile-dock md:hidden" aria-label="主导航">
        <RouterLink
          v-for="item in mobileNavItems"
          :key="`dock-${item.to}`"
          :to="item.to"
          class="shell-mobile-dock-link"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </main>

    <aside class="shell-side shell-right hidden lg:flex lg:flex-col">
      <div class="glass-card user-rail-card shell-account-card">
        <p class="mini-kicker">账户</p>
        <h2 class="mt-2 text-2xl font-semibold text-ink">{{ user?.nickname || "公开浏览" }}</h2>
        <p class="mt-2 text-sm text-dusk/80 break-all">{{ user?.email || "专家列表可直接查看" }}</p>
        <p v-if="user?.role === 'admin'" class="stat-pill mt-3">管理员</p>
        <RouterLink v-if="!isAuthenticated" to="/auth" class="button-primary mt-4 block w-full text-center">登录 / 注册</RouterLink>
        <button v-else class="button-secondary mt-4 w-full" @click="handleLogout">退出登录</button>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useRouter } from "vue-router"

import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()
const router = useRouter()
const user = computed(() => auth.user)
const isAuthenticated = computed(() => Boolean(auth.token))
const userAvatarText = computed(() => {
  const raw = user.value?.nickname || user.value?.email || "U"
  return raw.trim().slice(0, 1).toUpperCase()
})

const navItems = computed(() => {
  if (!isAuthenticated.value) {
    return [
      { to: "/plaza", label: "蒸馏工厂", hint: "公开专家列表" },
      { to: "/square", label: "广场", hint: "图文动态与互动" }
    ]
  }
  const items = [
    { to: "/projects", label: "蒸馏人类 3.0", hint: "报告与对话" },
    { to: "/projects/new", label: "蒸馏器", hint: "导入素材开始蒸馏" },
    { to: "/plaza", label: "蒸馏工厂", hint: "预制人物包" },
    { to: "/square", label: "广场", hint: "图文动态与互动" }
  ]
  if (user.value?.role === "admin") {
    items.push({ to: "/admin/settings", label: "系统设置", hint: "模型与渠道配置" })
  }
  return items
})

const mobileNavItems = computed(() => [
  { to: "/square", label: "广场" },
  { to: "/plaza", label: "蒸馏工厂" },
  { to: "/projects/new", label: "蒸馏器" },
  { to: "/projects", label: "人类 3.0" }
])

async function handleLogout() {
  await auth.logout()
  router.push("/")
}
</script>
