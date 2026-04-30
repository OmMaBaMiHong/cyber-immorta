import { createRouter, createWebHistory } from "vue-router"

import { useAuthStore } from "@/stores/auth"

const routes = [
  // V3 Routes (with TabBar)
  { path: "/", redirect: "/projects" },
  { path: "/projects", name: "projects", component: () => import("@/views/v3/DistillJourneyView.vue") },
  { path: "/projects/cyber", name: "projects-cyber", component: () => import("@/views/v3/DistillCyberFlowView.vue") },
  { path: "/projects/list", name: "projects-list", component: () => import("@/views/v3/ProjectsViewV3.vue"), meta: { auth: true } },
  { path: "/plaza", name: "plaza", component: () => import("@/views/v3/PlazaViewV3.vue") },
  { path: "/bottle", name: "bottle", component: () => import("@/views/v3/BottleViewV3.vue") },
  { path: "/friends", name: "friends", component: () => import("@/views/v3/FriendsViewV3.vue"), meta: { auth: true } },
  { path: "/messages", name: "messages", component: () => import("@/views/v3/MessagesViewV3.vue"), meta: { auth: true } },
  { path: "/profile", name: "profile", component: () => import("@/views/v3/ProfileViewV3.vue") },

  // Auth (no TabBar)
  { path: "/auth", name: "auth", component: () => import("@/views/AuthView.vue") },

  // V2 Routes (kept for now, no TabBar)
  { path: "/legal/terms", name: "legal-terms", component: () => import("@/v2/views/LegalDocumentViewV2.vue"), meta: { documentType: "terms" } },
  { path: "/legal/privacy", name: "legal-privacy", component: () => import("@/v2/views/LegalDocumentViewV2.vue"), meta: { documentType: "privacy" } },
  { path: "/legal/usage", name: "legal-usage", component: () => import("@/v2/views/LegalDocumentViewV2.vue"), meta: { documentType: "usage" } },
  { path: "/admin/settings", name: "admin-settings", component: () => import("@/views/AdminSettingsView.vue"), meta: { auth: true, admin: true } },
  { path: "/projects/new", name: "new-project", redirect: "/projects" },
  { path: "/projects/:projectId/jobs/:jobId", name: "job-progress", component: () => import("@/views/v3/DistillJobViewV3.vue"), meta: { auth: true } },
  { path: "/projects/:projectId/report", name: "report", component: () => import("@/v2/views/ReportViewV2.vue"), meta: { auth: true } },
  {
    path: "/chat/:projectId",
    name: "chat",
    redirect: (to: any) => ({
      name: "projects-cyber",
      query: {
        projectId: String(to.params.projectId || ""),
        ...(typeof to.query.mode === "string" ? { mode: to.query.mode } : {}),
      },
    }),
    meta: { auth: true },
  },
  { path: "/rebirth-template", name: "rebirth-template", component: () => import("@/v2/views/RebirthTemplateViewV2.vue") },
]

export const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.token && !auth.user) {
    try {
      await auth.fetchMe()
    } catch {
      await auth.logout()
    }
  }
  if (to.meta.auth && !auth.token) {
    return { name: "auth", query: { redirect: to.fullPath } }
  }
  if (to.meta.admin && auth.user?.role !== "admin") {
    return { name: "projects" }
  }
  return true
})
