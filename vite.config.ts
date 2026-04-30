import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import { VitePWA } from "vite-plugin-pwa"
import path from "node:path"

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [],
      manifest: {
        name: "蒸馏人类",
        short_name: "蒸馏人类",
        description: "把聊天记录、截图和公开材料蒸成可对话、可给建议的人格产品。",
        theme_color: "#f4eadf",
        background_color: "#fcf7f2",
        display: "standalone",
        start_url: "/",
        icons: []
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
})
