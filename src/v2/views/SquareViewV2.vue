<template>
  <V2AppShell>
    <div class="v2-proto-page">
      <div class="v2-proto-container v2-square-shell">
        <header class="v2-square-head">
          <div>
            <p class="v2-proto-kicker">Community Feed</p>
            <h2 class="serif v2-proto-title">蒸馏广场</h2>
            <p class="v2-proto-subtitle">把报告发成图文动态，互相点赞评论，沉淀真实使用场景。</p>
          </div>
          <RouterLink to="/projects" class="btn-ghost">去生成新报告</RouterLink>
        </header>

        <section v-if="!isAuthenticated" class="report-section v2-square-notice">
          <p class="v2-proto-list-title">登录后可点赞和评论</p>
          <p class="v2-proto-list-copy">你现在可以先浏览广场内容，登录后就能参与互动。</p>
          <RouterLink :to="authRedirectLink" class="btn-primary">登录 / 注册</RouterLink>
        </section>

        <section v-if="loading" class="report-section v2-proto-empty">
          <p class="v2-proto-kicker">Loading</p>
          <p class="v2-proto-list-copy">正在拉取广场动态...</p>
        </section>

        <section v-else-if="errorMessage" class="report-section v2-proto-empty">
          <p class="v2-proto-kicker">Error</p>
          <p class="v2-proto-list-copy">{{ errorMessage }}</p>
          <button type="button" class="btn-ghost" @click="loadPosts">重试</button>
        </section>

        <section v-else-if="posts.length" class="v2-square-waterfall">
          <article v-for="post in posts" :key="post.post_id" class="v2-square-card">
            <div v-if="post.image_url" class="v2-square-cover-wrap">
              <img :src="post.image_url" :alt="post.title" class="v2-square-cover" loading="lazy" />
            </div>
            <div v-else class="v2-square-cover-fallback">{{ post.title.slice(0, 1) || "蒸" }}</div>

            <div class="v2-square-body">
              <div class="v2-square-author-row">
                <span class="v2-square-avatar">{{ post.author.nickname.slice(0, 1) }}</span>
                <div class="v2-square-author-meta">
                  <strong>{{ post.author.nickname }}</strong>
                  <span>{{ formatTime(post.created_at) }}</span>
                </div>
              </div>

              <h3 class="v2-square-title">{{ post.title }}</h3>
              <p class="v2-square-summary">{{ post.summary || post.content }}</p>

              <div v-if="post.tags.length" class="v2-square-tag-row">
                <span v-for="tag in post.tags.slice(0, 6)" :key="`${post.post_id}-${tag}`" class="v2-square-tag"># {{ tag }}</span>
              </div>

              <div class="v2-square-action-row">
                <button
                  type="button"
                  class="v2-square-action"
                  :class="{ active: post.liked_by_me }"
                  :disabled="likingPostId === post.post_id"
                  @click="togglePostLike(post.post_id)"
                >
                  {{ post.liked_by_me ? "已赞" : "点赞" }} · {{ post.like_count }}
                </button>
                <button
                  type="button"
                  class="v2-square-action"
                  :class="{ active: expandedPostId === post.post_id }"
                  @click="toggleComments(post.post_id)"
                >
                  评论 · {{ post.comment_count }}
                </button>
              </div>

              <div v-if="expandedPostId === post.post_id" class="v2-square-comments">
                <div class="v2-square-comment-list">
                  <p v-if="loadingCommentsFor === post.post_id" class="v2-proto-list-copy">评论加载中...</p>
                  <p v-else-if="displayComments(post.post_id).length === 0" class="v2-proto-list-copy">还没有评论，抢个沙发。</p>
                  <div v-else v-for="comment in displayComments(post.post_id)" :key="comment.comment_id" class="v2-square-comment-item">
                    <strong>{{ comment.nickname }}</strong>
                    <span>{{ comment.content }}</span>
                  </div>
                </div>
                <div class="v2-square-comment-editor">
                  <textarea
                    v-model="commentDraftMap[post.post_id]"
                    class="v2-proto-textarea v2-proto-textarea--compact"
                    placeholder="写点你的看法..."
                  />
                  <button
                    type="button"
                    class="btn-primary"
                    :disabled="submittingCommentFor === post.post_id"
                    @click="submitComment(post.post_id)"
                  >
                    {{ submittingCommentFor === post.post_id ? "发送中..." : "发送评论" }}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section v-else class="report-section v2-proto-empty">
          <p class="v2-proto-kicker">Plaza</p>
          <p class="v2-proto-list-title">还没有图文动态</p>
          <p class="v2-proto-list-copy">先去项目报告页点“发布到广场”，第一条动态会出现在这里。</p>
        </section>
      </div>
    </div>
  </V2AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"

import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import type {
  PlazaComment,
  PlazaCommentListResponse,
  PlazaPost,
  PlazaPostLikeToggleResponse,
  PlazaPostListResponse,
} from "@/types"
import V2AppShell from "@/v2/components/V2AppShell.vue"

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const errorMessage = ref("")
const posts = ref<PlazaPost[]>([])
const expandedPostId = ref("")
const loadingCommentsFor = ref("")
const submittingCommentFor = ref("")
const likingPostId = ref("")
const commentMap = ref<Record<string, PlazaComment[]>>({})
const commentDraftMap = ref<Record<string, string>>({})

const isAuthenticated = computed(() => Boolean(auth.token))
const authRedirectLink = computed(() => ({ name: "auth", query: { redirect: route.fullPath } }))

function formatTime(value: string) {
  if (!value) return "刚刚"
  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false })
  } catch {
    return value
  }
}

function upsertPost(next: PlazaPost) {
  const cloned = [...posts.value]
  const index = cloned.findIndex((item) => item.post_id === next.post_id)
  if (index >= 0) cloned[index] = next
  else cloned.unshift(next)
  posts.value = cloned
}

function displayComments(postId: string) {
  return commentMap.value[postId] || posts.value.find((item) => item.post_id === postId)?.comments_preview || []
}

async function loadPosts() {
  loading.value = true
  errorMessage.value = ""
  try {
    const { data } = await api.get<PlazaPostListResponse>("/plaza/posts", { params: { limit: 60 } })
    posts.value = data.items
  } catch (error: any) {
    errorMessage.value = error?.response?.data?.detail || error?.message || "广场加载失败"
  } finally {
    loading.value = false
  }
}

async function requireLogin() {
  if (isAuthenticated.value) return true
  await router.push(authRedirectLink.value)
  return false
}

async function togglePostLike(postId: string) {
  if (!(await requireLogin())) return
  likingPostId.value = postId
  try {
    const { data } = await api.post<PlazaPostLikeToggleResponse>(`/plaza/posts/${postId}/like`)
    upsertPost(data.post)
  } finally {
    likingPostId.value = ""
  }
}

async function loadComments(postId: string) {
  loadingCommentsFor.value = postId
  try {
    const { data } = await api.get<PlazaCommentListResponse>(`/plaza/posts/${postId}/comments`, { params: { limit: 200 } })
    commentMap.value = {
      ...commentMap.value,
      [postId]: data.items,
    }
  } finally {
    loadingCommentsFor.value = ""
  }
}

async function toggleComments(postId: string) {
  if (expandedPostId.value === postId) {
    expandedPostId.value = ""
    return
  }
  expandedPostId.value = postId
  if (!commentMap.value[postId]) {
    await loadComments(postId)
  }
}

async function submitComment(postId: string) {
  if (!(await requireLogin())) return
  const draft = String(commentDraftMap.value[postId] || "").trim()
  if (!draft) return
  submittingCommentFor.value = postId
  try {
    const { data } = await api.post<PlazaComment>(`/plaza/posts/${postId}/comments`, { content: draft })
    const existing = commentMap.value[postId] || []
    commentMap.value = {
      ...commentMap.value,
      [postId]: [...existing, data],
    }
    commentDraftMap.value = {
      ...commentDraftMap.value,
      [postId]: "",
    }
    const target = posts.value.find((item) => item.post_id === postId)
    if (target) {
      upsertPost({
        ...target,
        comment_count: target.comment_count + 1,
      })
    }
  } finally {
    submittingCommentFor.value = ""
  }
}

onMounted(() => {
  void loadPosts()
})
</script>
