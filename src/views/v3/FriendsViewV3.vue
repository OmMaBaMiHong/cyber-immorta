<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import { api } from "@/lib/api"
import type { FriendListResponse, FriendSummary } from "@/types"

const router = useRouter()
const friends = ref<FriendSummary[]>([])
const loading = ref(true)
const loadError = ref("")

const friendCount = computed(() => friends.value.length)

function avatarStyle(friend: FriendSummary) {
  const seed = friend.user.user_id || friend.user.email || friend.user.nickname
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const hue = hash % 360
  return {
    background: `linear-gradient(135deg, hsl(${hue} 66% 48%), hsl(${(hue + 52) % 360} 72% 56%))`,
  }
}

function avatarLetter(friend: FriendSummary) {
  return (friend.user.nickname || friend.user.email || "?").slice(0, 1).toUpperCase()
}

function displayAccount(friend: FriendSummary) {
  if (!friend.user.email) return friend.user.user_id
  const [local, domain] = friend.user.email.split("@")
  if (!domain) return friend.user.email
  return `${local.slice(0, 2)}***@${domain}`
}

function formatTime(value: string) {
  const date = new Date(value)
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return "刚刚"
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay}天前`
  return `${date.getMonth() + 1}/${date.getDate()}`
}

async function loadFriends() {
  loading.value = true
  loadError.value = ""
  try {
    const { data } = await api.get<FriendListResponse>("/friends")
    friends.value = data.items || []
  } catch (error: any) {
    loadError.value = error?.response?.data?.detail || "好友加载失败"
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadFriends()
})
</script>

<template>
  <div class="friends-page">
    <header class="friends-header cyber-animate-in">
      <div>
        <p>FRIENDS</p>
        <h1>好友</h1>
      </div>
      <button type="button" @click="router.push('/profile')">
        <span class="material-symbols-rounded">qr_code_scanner</span>
      </button>
    </header>

    <main class="friends-content">
      <section class="friends-count cyber-animate-in" style="animation-delay: 60ms">
        <span class="material-symbols-rounded">group</span>
        <div>
          <strong>{{ friendCount }}</strong>
          <p>已添加好友</p>
        </div>
      </section>

      <div v-if="loading" class="friends-state">
        <span class="material-symbols-rounded friends-spin">progress_activity</span>
        <p>加载中...</p>
      </div>

      <div v-else-if="loadError" class="friends-state">
        <span class="material-symbols-rounded">cloud_off</span>
        <p>{{ loadError }}</p>
        <button type="button" @click="loadFriends">重新加载</button>
      </div>

      <div v-else-if="!friends.length" class="friends-state">
        <span class="material-symbols-rounded">person_add</span>
        <p>还没有好友</p>
        <button type="button" @click="router.push('/profile')">去扫码</button>
      </div>

      <section v-else class="friends-list">
        <article
          v-for="(friend, index) in friends"
          :key="friend.friendship_id"
          class="friend-item cyber-animate-in"
          :style="{ animationDelay: `${index * 45}ms` }"
        >
          <div class="friend-avatar" :style="avatarStyle(friend)">
            {{ avatarLetter(friend) }}
          </div>
          <div class="friend-copy">
            <strong>{{ friend.user.nickname || '未知用户' }}</strong>
            <p>{{ displayAccount(friend) }}</p>
          </div>
          <time>{{ formatTime(friend.updated_at) }}</time>
        </article>
      </section>
    </main>
  </div>
</template>

<style scoped>
.friends-page {
  min-height: 100vh;
  padding: 0 14px calc(var(--tab-bar-height) + var(--safe-bottom) + 24px);
  background: var(--bg-base);
  color: var(--text-primary);
}

.friends-header {
  max-width: 620px;
  margin: 0 auto;
  padding: 54px 2px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.friends-header p {
  margin: 0 0 5px;
  color: var(--text-secondary);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.friends-header h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.7rem;
  line-height: 1.1;
}

.friends-header button {
  width: 42px;
  height: 42px;
  display: inline-grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 26%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
  color: var(--accent-primary);
  cursor: pointer;
}

.friends-content {
  max-width: 620px;
  margin: 0 auto;
}

.friends-count {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--separator-soft);
  border-radius: 16px;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent-primary) 14%, transparent), transparent 42%),
    var(--bg-elevated);
}

.friends-count > .material-symbols-rounded {
  width: 42px;
  height: 42px;
  display: inline-grid;
  place-items: center;
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
}

.friends-count strong {
  display: block;
  font-size: 1.25rem;
  line-height: 1;
}

.friends-count p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
}

.friends-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.friend-item {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--separator-soft);
  border-radius: 14px;
  background: var(--bg-elevated);
}

.friend-avatar {
  width: 48px;
  height: 48px;
  display: inline-grid;
  place-items: center;
  border-radius: 16px;
  color: #fff;
  font-weight: 900;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
}

.friend-copy {
  min-width: 0;
}

.friend-copy strong,
.friend-copy p {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-copy strong {
  color: var(--text-primary);
  font-size: 0.9rem;
}

.friend-copy p,
.friend-item time {
  margin: 3px 0 0;
  color: var(--text-secondary);
  font-size: 0.68rem;
  font-weight: 700;
}

.friend-item time {
  margin: 0;
  color: var(--text-tertiary);
}

.friends-state {
  min-height: 220px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  color: var(--text-secondary);
  text-align: center;
}

.friends-state .material-symbols-rounded {
  color: var(--accent-primary);
  font-size: 38px;
  opacity: 0.65;
}

.friends-state p {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
}

.friends-state button {
  min-height: 34px;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 24%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-primary) 9%, transparent);
  color: var(--accent-primary);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 800;
}

.friends-spin {
  animation: friends-spin 1.2s linear infinite;
}

@keyframes friends-spin {
  to { transform: rotate(360deg); }
}
</style>
