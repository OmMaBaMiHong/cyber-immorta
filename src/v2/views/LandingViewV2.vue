<template>
  <V2AppShell>
    <div class="v2-page v2-page--landing">
      <section class="v2-landing-hero">
        <div class="v2-landing-container">
          <div class="v2-landing-head">
            <div class="v2-landing-badge">
              <span class="v2-landing-badge-dot" />
              蒸馏人类 3.0 已上线
            </div>

            <h1 class="v2-landing-title">
              蒸馏你身边的<br>
              <span class="v2-landing-title-gradient">每一个人类</span>
            </h1>

            <p class="v2-landing-copy">
              上传聊天记录、对话、表达与作品，生成稳定的人物画像、MBTI性格卡片与决策镜像。选择比盲目努力更重要。
            </p>

            <div class="v2-landing-actions">
              <RouterLink :to="createLink" class="v2-btn v2-btn--primary v2-landing-action">
                <span class="v2-inline-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 3h6v2l-1.6 4.8a5 5 0 0 1 3.6 4.8V18H7v-3.2a5 5 0 0 1 3.6-4.8L9 5V3Z" fill="currentColor" />
                  </svg>
                </span>
                开始蒸馏
              </RouterLink>
              <RouterLink to="/plaza" class="v2-btn v2-btn--ghost v2-landing-action">
                <span class="v2-inline-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 8h4l2-3h4l2 3h4v11H4V8Zm2 2v7h12v-7h-2.9l-2-3H10.9l-2 3H6Z" fill="currentColor" />
                  </svg>
                </span>
                蒸馏工厂
              </RouterLink>
            </div>
          </div>

          <div class="v2-landing-grid">
            <RouterLink
              v-for="card in landingCards"
              :key="card.title"
              :to="card.to"
              class="v2-landing-card"
            >
              <div class="v2-landing-card-icon" :style="card.iconStyle">
                <span class="v2-inline-icon" aria-hidden="true" v-html="card.icon" />
              </div>
              <h3 class="v2-landing-card-title">{{ card.title }}</h3>
              <p class="v2-landing-card-copy">{{ card.copy }}</p>
            </RouterLink>
          </div>

          <div class="v2-landing-stats">
            <div class="v2-landing-stat">
              <div class="v2-landing-stat-value v2-landing-stat-value--amber">{{ stats.experts }}</div>
              <div class="v2-landing-stat-label">人类专家已蒸馏</div>
            </div>
            <div class="v2-landing-stat">
              <div class="v2-landing-stat-value v2-landing-stat-value--cyan">{{ stats.reports }}</div>
              <div class="v2-landing-stat-label">画像报告已生成</div>
            </div>
            <div class="v2-landing-stat">
              <div class="v2-landing-stat-value">{{ stats.skills }}</div>
              <div class="v2-landing-stat-label">技能标签已提取</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </V2AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"

import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import type { PackSummary } from "@/types"
import V2AppShell from "@/v2/components/V2AppShell.vue"

const auth = useAuthStore()
const packs = ref<PackSummary[]>([])

const createLink = computed(() => (
  auth.token ? { name: "new-project" } : { name: "auth", query: { redirect: "/projects/new" } }
))

function buildCreateEntryLink(query: Record<string, string> = {}) {
  const queryString = new URLSearchParams(query).toString()
  const redirect = queryString ? `/projects/new?${queryString}` : "/projects/new"
  return auth.token ? redirect : { name: "auth", query: { redirect } }
}

const stats = computed(() => ({
  experts: packs.value.filter((item) => item.factory_category === "human_expert" || item.factory_category === "professional_role").length,
  reports: packs.value.length * 29,
  skills: packs.value.reduce((total, item) => total + item.skills.length, 0),
}))

const landingCards = computed(() => [
  {
    title: "蒸馏自己",
    copy: "看清表达风格与决策习惯",
    to: buildCreateEntryLink({ targetKey: "self", projectName: "我的人物画像报告", subjectName: "我自己" }),
    iconStyle: { background: "rgba(212,148,58,0.1)", border: "1px solid rgba(212,148,58,0.2)", color: "var(--v2-accent)" },
    icon: `<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.33 0-6 1.79-6 4v1h12v-1c0-2.21-2.67-4-6-4Z" fill="currentColor"/></svg>`,
  },
  {
    title: "蒸馏前任",
    copy: "复盘关系模式与沟通盲区",
    to: buildCreateEntryLink({ targetKey: "ex", projectName: "前任人物画像报告", subjectName: "前任" }),
    iconStyle: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" },
    icon: `<svg viewBox="0 0 24 24"><path d="m16.5 4-.88.02A5.5 5.5 0 0 0 12 5.76 5.5 5.5 0 0 0 8.38 4.02L7.5 4A4.5 4.5 0 0 0 3 8.5c0 5.32 7.38 10.5 9 11.5 1.62-1 9-6.18 9-11.5A4.5 4.5 0 0 0 16.5 4Zm-6.04 8.46-1.42 1.42L12 17l2.96-3.12-1.42-1.42L12 14.04l-1.54-1.58Z" fill="currentColor"/></svg>`,
  },
  {
    title: "蒸馏同事",
    copy: "理解协作风格与利益驱动",
    to: buildCreateEntryLink({ targetKey: "colleague", projectName: "同事人物画像报告", subjectName: "同事" }),
    iconStyle: { background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)", color: "var(--v2-cyan)" },
    icon: `<svg viewBox="0 0 24 24"><path d="M9 6V4h6v2h4a2 2 0 0 1 2 2v3H3V8a2 2 0 0 1 2-2h4Zm12 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5h6v2h6v-2h6Z" fill="currentColor"/></svg>`,
  },
  {
    title: "蒸馏老板",
    copy: "解码决策逻辑与偏好模式",
    to: buildCreateEntryLink({ targetKey: "boss", projectName: "老板人物画像报告", subjectName: "老板" }),
    iconStyle: { background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", color: "#a855f7" },
    icon: `<svg viewBox="0 0 24 24"><path d="m3 7 4 3 5-6 5 6 4-3-2 10H5L3 7Zm4.5 11a1.5 1.5 0 0 0 0 3h9a1.5 1.5 0 0 0 0-3h-9Z" fill="currentColor"/></svg>`,
  },
  {
    title: "蒸馏导师",
    copy: "提炼思维框架与经验精华",
    to: buildCreateEntryLink({ targetKey: "mentor", projectName: "导师人物画像报告", subjectName: "导师" }),
    iconStyle: { background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e" },
    icon: `<svg viewBox="0 0 24 24"><path d="m12 3 10 5-10 5L2 8l10-5Zm0 7 7 3.5V17c0 2.5-3.13 4.5-7 4.5S5 19.5 5 17v-3.5L12 10Zm8 1.53V17h-2v-4.47l2-1Z" fill="currentColor"/></svg>`,
  },
  {
    title: "蒸馏工厂",
    copy: "批量蒸馏，预制人物包",
    to: "/plaza",
    iconStyle: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--v2-muted)" },
    icon: `<svg viewBox="0 0 24 24"><path d="M3 20h18v-2H3v2Zm2-4h14V8l-4 2V6l-4 2V4L5 7v9Z" fill="currentColor"/></svg>`,
  },
])

onMounted(async () => {
  try {
    const { data } = await api.get<{ items: PackSummary[] }>("/packs")
    packs.value = data.items
  } catch {
    packs.value = []
  }
})
</script>
