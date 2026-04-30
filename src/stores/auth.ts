import { defineStore } from "pinia"
import { ref } from "vue"

import { api } from "@/lib/api"
import type { AuthSession, EmailCodeResponse, EmailDeliveryMode, PublicAuthSettings, User } from "@/types"

const TOKEN_KEY = "distill-human-token"
const USER_KEY = "distill-human-user"

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(null)
  const user = ref<User | null>(null)
  const lastDebugCode = ref<string>("")
  const lastDeliveryChannel = ref<EmailDeliveryMode>("console")

  function hydrate() {
    token.value = localStorage.getItem(TOKEN_KEY)
    const rawUser = localStorage.getItem(USER_KEY)
    user.value = rawUser ? JSON.parse(rawUser) : null
  }

  async function requestCode(email: string) {
    const { data } = await api.post<EmailCodeResponse>("/auth/email/request-code", { email })
    lastDebugCode.value = data.debug_code || ""
    lastDeliveryChannel.value = data.delivery_channel || "console"
    return data
  }

  async function verifyCode(email: string, code: string, nickname: string) {
    const { data } = await api.post<AuthSession>("/auth/email/verify-code", { email, code, nickname })
    token.value = data.token
    user.value = data.user
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data
  }

  async function loginWithPassword(email: string, password: string) {
    const { data } = await api.post<AuthSession>("/auth/email/password-login", { email, password })
    token.value = data.token
    user.value = data.user
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data
  }

  async function registerWithPassword(email: string, password: string, nickname: string, code?: string) {
    const { data } = await api.post<AuthSession>("/auth/email/register", { email, password, nickname, code })
    token.value = data.token
    user.value = data.user
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data
  }

  async function fetchPublicAuthSettings() {
    const { data } = await api.get<PublicAuthSettings>("/auth/settings")
    return data
  }

  async function adminLogin(loginName: string, password: string) {
    const { data } = await api.post<AuthSession>("/admin/auth/login", {
      login_name: loginName,
      password
    })
    token.value = data.token
    user.value = data.user
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data
  }

  async function fetchMe() {
    if (!token.value) return null
    const { data } = await api.get<User>("/auth/me")
    user.value = data
    localStorage.setItem(USER_KEY, JSON.stringify(data))
    return data
  }

  async function logout() {
    if (token.value) {
      await api.post("/auth/logout")
    }
    token.value = null
    user.value = null
    lastDebugCode.value = ""
    lastDeliveryChannel.value = "console"
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return {
    token,
    user,
    lastDebugCode,
    lastDeliveryChannel,
    hydrate,
    requestCode,
    verifyCode,
    loginWithPassword,
    registerWithPassword,
    fetchPublicAuthSettings,
    adminLogin,
    fetchMe,
    logout
  }
})
