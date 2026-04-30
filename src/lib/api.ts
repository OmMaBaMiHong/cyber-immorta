import axios from "axios"

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8091"

export const api = axios.create({
  baseURL,
  timeout: 30000
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("distill-human-token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("distill-human-token")
      localStorage.removeItem("distill-human-user")
    }
    return Promise.reject(error)
  }
)

export function assetUrl(path?: string) {
  if (!path) return ""
  if (path.startsWith("http")) return path
  return `${baseURL}${path}`
}
