import type { FactoryCategory, PackSummary } from "@/types"

export const APP_VERSION = "4.0-beta"
export const APP_NAME = "DISTILL HUMAN"

export function formatFactoryLabel(category?: FactoryCategory | null) {
  if (category === "tool_agent") return "工具型"
  if (category === "professional_role") return "职业型"
  if (category === "human_expert") return "专家型"
  return "蒸馏模板"
}

export function categoryDescription(category?: FactoryCategory | null) {
  if (category === "tool_agent") return "加载 skill 后直接进入测试或工具流程"
  if (category === "professional_role") return "以职业角色视角给建议"
  if (category === "human_expert") return "以真人专家的表达和判断方式响应"
  return "当前项目的蒸馏形态"
}

export function projectStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    draft: "待建档",
    ready_for_distill: "待蒸馏",
    distilling: "蒸馏中",
    report_ready: "报告已生成",
    chat_ready: "对话已就绪",
    queued: "排队中",
    parsing: "解析中",
    extracting: "提取中",
    failed: "失败",
  }
  return labels[status || ""] || status || "处理中"
}

export function formatDateTime(value?: string) {
  if (!value) return "刚刚"
  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false })
  } catch {
    return value
  }
}

export function compactLines(items: Array<string | undefined | null>, limit = 4) {
  return items
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit)
}

export function packPreviewTags(pack: PackSummary, limit = 5) {
  const seen = new Set<string>()
  return [...pack.tags, ...pack.skills, ...pack.suitable_for]
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false
      seen.add(item)
      return true
    })
    .slice(0, limit)
}
