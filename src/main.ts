import { createApp } from "vue"
import { createPinia } from "pinia"

import App from "./App.vue"
import { router } from "./router"
import { initTheme } from "./lib/theme"
import { useAuthStore } from "./stores/auth"
import "./styles.css"
import "./v2/styles.css"
import "./styles/v3-design-system.css"

initTheme()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

const auth = useAuthStore(pinia)
auth.hydrate()

app.use(router)
app.mount("#app")
