import { ref } from "vue"

export type AppThemeMode = "apple-light" | "apple-dark"

const STORAGE_KEY = "distill-human-theme-mode"

export const themeMode = ref<AppThemeMode>("apple-light")

function getThemeMetaTag() {
  return document.querySelector('meta[name="theme-color"]')
}

export function applyTheme(mode: AppThemeMode) {
  themeMode.value = mode

  if (typeof document === "undefined") return

  const root = document.documentElement
  const appearance = mode === "apple-dark" ? "dark" : "light"
  root.dataset.theme = "apple"
  root.dataset.appearance = appearance
  root.style.colorScheme = appearance

  getThemeMetaTag()?.setAttribute("content", appearance === "dark" ? "#000000" : "#F5F5F7")
  window.localStorage.setItem(STORAGE_KEY, mode)
}

export function initTheme() {
  if (typeof window === "undefined") return

  const saved = window.localStorage.getItem(STORAGE_KEY)
  applyTheme(saved === "apple-dark" || saved === "dark" || saved === "cyber" ? "apple-dark" : "apple-light")
}

export function toggleTheme() {
  applyTheme(themeMode.value === "apple-light" ? "apple-dark" : "apple-light")
}
