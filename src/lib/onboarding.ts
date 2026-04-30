import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from "vue-router"

import { api } from "@/lib/api"
import type { ProjectSummary } from "@/types"

export type SelfOnboardingState = {
  selfProject: ProjectSummary | null
  hasSelfReport: boolean
}

export const SELF_ONBOARDING_QUERY = {
  targetKey: "self",
  onboarding: "1",
} as const

function isNotFound(error: any) {
  return error?.response?.status === 404
}

export function isSelfProject(project: ProjectSummary | null | undefined) {
  return project?.subject_type === "self"
}

export function isPlaceholderSelfName(value: string | null | undefined) {
  const normalized = normalizeSelfName(value)
  return !normalized || normalized === "我自己" || normalized === "自己"
}

function normalizeSelfName(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/[.。．·\s]+$/g, "")
}

function isLegacySelfReportProject(project: ProjectSummary | null | undefined) {
  if (!project?.has_report) return false
  if (isSelfProject(project)) return true
  const subjectName = normalizeSelfName(project.subject_name)
  const projectName = normalizeSelfName(project.name)
  return subjectName === "自己" || subjectName === "我自己" || projectName === "自己" || projectName === "我自己"
}

export function selfIdentityNameFromProject(project: ProjectSummary | null | undefined) {
  if (!isSelfProject(project) || isPlaceholderSelfName(project?.subject_name)) return ""
  return String(project?.subject_name || "").trim()
}

function byCreatedAsc(a: ProjectSummary, b: ProjectSummary) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
}

function pickPrimarySelfProject(projects: ProjectSummary[]) {
  const selfProjects = projects.filter((project) => isSelfProject(project))
  const reported = selfProjects.filter((project) => project.has_report).sort(byCreatedAsc)
  if (reported[0]) return reported[0]
  const inProgress = selfProjects
    .filter((project) => project.status === "chat_ready" || project.status === "report_ready")
    .sort(byCreatedAsc)
  if (inProgress[0]) return inProgress[0]
  return [...selfProjects].sort(byCreatedAsc)[0] || null
}

export async function findSelfProject() {
  const { data } = await api.get<{ items: ProjectSummary[] }>("/projects")
  const projects = data.items || []
  const selfProject = pickPrimarySelfProject(projects)
  if (selfProject) return selfProject
  const legacySelfReport = projects.find((project) => isLegacySelfReportProject(project))
  return (
    legacySelfReport ||
    null
  )
}

export async function hasProjectReport(projectId: string) {
  if (!projectId) return false
  try {
    await api.get(`/projects/${projectId}/report`)
    return true
  } catch (error: any) {
    if (isNotFound(error)) return false
    throw error
  }
}

export async function resolveSelfOnboardingState(): Promise<SelfOnboardingState> {
  const { data } = await api.get<{ items: ProjectSummary[] }>("/projects")
  const projects = data.items || []
  const selfProjects = projects.filter((project) => isSelfProject(project))

  const reportedFromSummary = selfProjects.filter((project) => project.has_report).sort(byCreatedAsc)[0]
  if (reportedFromSummary) return { selfProject: reportedFromSummary, hasSelfReport: true }

  const legacySelfReport = projects.find((project) => isLegacySelfReportProject(project))
  if (legacySelfReport) return { selfProject: legacySelfReport, hasSelfReport: true }
  if (!selfProjects.length) return { selfProject: null, hasSelfReport: false }

  const reportChecks = await Promise.all(
    selfProjects.map(async (project) => ({
      project,
      hasReport: await hasProjectReport(project.project_id),
    })),
  )
  const reported = reportChecks
    .filter((item) => item.hasReport)
    .map((item) => item.project)
    .sort(byCreatedAsc)[0] || null
  const selfProject =
    reported ||
    pickPrimarySelfProject(projects) ||
    null
  const hasSelfReport = Boolean(reported)
  return { selfProject, hasSelfReport }
}

export function selfOnboardingRoute(redirect?: string): RouteLocationRaw {
  return {
    name: "projects-cyber",
    query: {
      ...SELF_ONBOARDING_QUERY,
      ...(redirect ? { redirect } : {}),
    },
  }
}

export function isSelfCyberRoute(to: Pick<RouteLocationNormalizedLoaded, "name" | "query">) {
  return (
    to.name === "projects-cyber" &&
    (to.query.targetKey === "self" || to.query.onboarding === "1")
  )
}
