import { assetUrl } from "@/lib/api"
import { sbtiPortraitManifest } from "@/v2/data/sbtiPortraitManifest.generated"

export interface SkillAvatarPack {
  slug: string
  title?: string
  avatar_label?: string
  hero_background?: string
}

const UNSPLASH_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=400&h=500&fit=crop",
]
const REBIRTH_BASE_FALLBACK_IMAGE = "/images/rebirth-portrait-base.png"
const REBIRTH_FALLBACK_IMAGES = Object.values(sbtiPortraitManifest)
  .map((item) => String(item.imageUrl || "").trim())
  .filter(Boolean)
const REBIRTH_FALLBACK_OVERLAYS = [
  "linear-gradient(180deg, rgba(12, 14, 26, 0.12), rgba(12, 14, 26, 0.34))",
  "linear-gradient(180deg, rgba(37, 24, 44, 0.1), rgba(37, 24, 44, 0.34))",
  "linear-gradient(180deg, rgba(18, 33, 48, 0.1), rgba(18, 33, 48, 0.32))",
  "linear-gradient(180deg, rgba(44, 28, 18, 0.1), rgba(44, 28, 18, 0.34))",
  "linear-gradient(180deg, rgba(32, 18, 32, 0.12), rgba(32, 18, 32, 0.36))",
  "linear-gradient(180deg, rgba(16, 28, 24, 0.1), rgba(16, 28, 24, 0.32))",
]
const REBIRTH_FALLBACK_POSITIONS = ["center", "center top", "center 28%", "center 36%", "center 42%"]

function hashKey(value: string) {
  let hash = 0
  for (const char of value || "skill") hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash
}

function fallbackImage(key: string) {
  return UNSPLASH_FALLBACK_IMAGES[hashKey(key) % UNSPLASH_FALLBACK_IMAGES.length]
}

function rebirthFallbackImage(key: string) {
  if (!REBIRTH_FALLBACK_IMAGES.length) return REBIRTH_BASE_FALLBACK_IMAGE
  return REBIRTH_FALLBACK_IMAGES[hashKey(`${key}:rebirth`) % REBIRTH_FALLBACK_IMAGES.length]
}

function fallbackStyle(key: string, primaryImage?: string) {
  const position = REBIRTH_FALLBACK_POSITIONS[hashKey(`${key}:position`) % REBIRTH_FALLBACK_POSITIONS.length]
  const overlay = REBIRTH_FALLBACK_OVERLAYS[hashKey(`${key}:overlay`) % REBIRTH_FALLBACK_OVERLAYS.length]
  const firstImage = primaryImage || fallbackImage(key)
  return {
    backgroundImage: `${overlay}, url("${firstImage}"), url("${rebirthFallbackImage(key)}"), url("${REBIRTH_BASE_FALLBACK_IMAGE}")`,
    backgroundSize: "cover, cover, cover, cover",
    backgroundPosition: `${position}, ${position}, ${position}, center`,
  }
}

function looksLikeImage(raw: string) {
  return (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("/") ||
    /\.(png|jpe?g|gif|svg|webp|avif)$/i.test(raw)
  )
}

export function skillAvatarImageUrl(pack: SkillAvatarPack | null | undefined, fallbackKey = "skill") {
  const raw = String(pack?.hero_background || "").trim()
  const key = pack?.slug || fallbackKey || "skill"
  if (raw && looksLikeImage(raw)) {
    return raw.startsWith("/images/") ? raw : assetUrl(raw)
  }
  return fallbackImage(key)
}

export function projectPrimaryPackSlug(project: {
  pack_slug?: string
  public_skill_slug?: string | null
  public_skill_published?: boolean
  intake_profile?: { skill_router_config?: { selected_pack_slugs?: string[] } }
}) {
  return String(
    project.intake_profile?.skill_router_config?.selected_pack_slugs?.[0] ||
    (project.public_skill_published ? project.public_skill_slug : "") ||
    project.pack_slug ||
    "",
  ).trim()
}

export function skillAvatarLabel(pack: SkillAvatarPack | null | undefined, fallback = "") {
  return String(pack?.avatar_label || pack?.title?.slice(0, 1) || fallback.slice(0, 1) || "S").trim()
}

export function skillAvatarBackgroundStyle(pack: SkillAvatarPack | null | undefined, fallbackKey = "skill") {
  const raw = String(pack?.hero_background || "").trim()
  const key = pack?.slug || fallbackKey || "skill"

  if (raw && looksLikeImage(raw)) {
    return fallbackStyle(key, skillAvatarImageUrl(pack, fallbackKey))
  }

  if (raw.includes("gradient(")) {
    return fallbackStyle(key)
  }

  return fallbackStyle(key)
}
