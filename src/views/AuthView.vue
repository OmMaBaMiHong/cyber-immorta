<template>
  <div class="page-wrap auth-page auth-shell selection:bg-white/30 selection:text-white">
    <canvas id="fireCanvas" class="auth-canvas"></canvas>

    <main class="auth-window">
      <header class="auth-header">
        <div class="auth-brand-mark" aria-hidden="true">
          <svg class="auth-brand-svg" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="19" stroke="currentColor" stroke-width="1.8" opacity="0.42"/>
            <path d="M20 32H44" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M32 20V44" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M24.5 24.5L39.5 39.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" opacity="0.9"/>
            <path d="M39.5 24.5L24.5 39.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" opacity="0.55"/>
          </svg>
        </div>
      </header>

      <section class="auth-body">
        <div class="auth-headline">
          <h1>{{ pageTitle }}</h1>
        </div>

        <form @submit.prevent="handleFormSubmit" class="auth-form">
          <p v-if="mode === 'register' && publicAuthSettings.require_verification_code_for_signup" class="auth-caption">
            当前系统已开启“注册强制邮箱验证码”。
          </p>

          <!-- 邮箱输入 -->
          <div class="auth-field-group">
            <label class="auth-label">{{ mode === 'login' && !isEmailLogin ? '邮箱 / 管理员账号' : '邮箱' }}</label>
            <div class="input-glow auth-input-shell">
              <svg class="auth-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              <input 
                :value="mode === 'login' ? loginIdentifier : registerEmail" 
                @input="(e) => { const target = e.target as HTMLInputElement; mode === 'login' ? loginIdentifier = target.value : registerEmail = target.value }" 
                :type="mode === 'login' && !isEmailLogin ? 'text' : 'email'"
                :placeholder="mode === 'login' && !isEmailLogin ? 'name@example.com 或 admin' : 'name@example.com'" 
                class="auth-input" 
                required
                autocomplete="email"
              />
            </div>
          </div>

          <!-- 密码输入 (仅密码登录时显示) -->
          <div class="auth-field-group" v-if="mode === 'login' && !isEmailLogin">
            <label class="auth-label auth-label-row">
              <span>密码</span>
              <span class="auth-label-actions">
                <button
                  v-if="canToggleLoginMethod"
                  type="button"
                  class="auth-label-link"
                  @click="toggleCurrentMethod"
                >
                  {{ authMethodAction }}
                </button>
                <button
                  type="button"
                  class="auth-label-link auth-label-link--muted"
                  @click="handleForgotPassword"
                >
                  忘记密码?
                </button>
              </span>
            </label>
            <div class="input-glow auth-input-shell">
              <svg class="auth-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              <input 
                v-model="loginPassword" 
                :type="showPassword ? 'text' : 'password'" 
                placeholder="••••••••" 
                class="auth-input" 
                required
                autocomplete="current-password"
              />
              <button type="button" @click="showPassword = !showPassword" class="auth-icon-btn">
                <svg v-if="!showPassword" class="auth-icon-btn-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                <svg v-else class="auth-icon-btn-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
              </button>
            </div>
          </div>

          <!-- 昵称输入 (仅注册时显示) -->
          <div class="auth-field-group" v-if="mode === 'register'">
            <label class="auth-label">昵称</label>
            <div class="input-glow auth-input-shell">
              <svg class="auth-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              <input 
                v-model.trim="registerNickname" 
                placeholder="输入昵称" 
                class="auth-input"
                autocomplete="nickname"
              />
            </div>
          </div>

          <!-- 注册密码 -->
          <div class="auth-field-group" v-if="mode === 'register' && registerMethod === 'password'">
            <label class="auth-label">设置密码</label>
            <div class="input-glow auth-input-shell">
              <svg class="auth-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              <input
                v-model="registerPassword"
                :type="showPassword ? 'text' : 'password'"
                placeholder="至少 6 位密码"
                class="auth-input"
                autocomplete="new-password"
              />
            </div>
          </div>

          <!-- 验证码 (注册时显示) -->
          <div class="auth-field-group" v-if="mode === 'register' && registerMethod === 'code'">
            <label class="auth-label">验证码</label>
            <div class="auth-inline-field">
              <div class="input-glow auth-input-shell auth-input-shell--inline">
                <svg class="auth-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                <input 
                  v-model.trim="registerCode" 
                  maxlength="6" 
                  placeholder="输入 6 位验证码" 
                  class="auth-input"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                />
              </div>
              <button 
                type="button" 
                @click="handleRequestRegisterCode" 
                :disabled="loading || codeCountdown > 0" 
                class="auth-code-btn"
              >
                {{ codeCountdown > 0 ? `${codeCountdown}s 后重发` : '发送验证码' }}
              </button>
            </div>
            <p v-if="showDebugCode" class="auth-debug-code">{{ auth.lastDebugCode }}</p>
          </div>

          <!-- 验证码 (仅登录时邮箱登录显示) -->
          <div class="auth-field-group" v-if="mode === 'login' && isEmailLogin">
            <label class="auth-label auth-label-row">
              <span>验证码</span>
              <button
                v-if="canToggleLoginMethod"
                type="button"
                class="auth-label-link"
                @click="toggleCurrentMethod"
              >
                {{ authMethodAction }}
              </button>
            </label>
            <div class="auth-inline-field">
              <div class="input-glow auth-input-shell auth-input-shell--inline">
                <svg class="auth-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                <input
                  v-model.trim="loginCode"
                  maxlength="6"
                  placeholder="输入 6 位验证码"
                  class="auth-input"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                />
              </div>
              <button
                type="button"
                @click="handleRequestLoginCode"
                :disabled="loading || codeCountdown > 0"
                class="auth-code-btn"
              >
                {{ codeCountdown > 0 ? `${codeCountdown}s 后重发` : '发送验证码' }}
              </button>
            </div>
            <p v-if="showDebugCode" class="auth-debug-code">{{ auth.lastDebugCode }}</p>
          </div>

          <!-- 协议勾选 -->
          <div class="auth-agreement">
            <input type="checkbox" id="agree-check" class="custom-checkbox mt-0.5" v-model="agreeToTerms" @change="toggleSubmitBtn()">
            <label for="agree-check" class="auth-agreement-copy">
              我已阅读并同意
              <span class="auth-agreement-link" @click.stop="showLegalDoc('terms')">服务条款</span>、
              <span class="auth-agreement-link" @click.stop="showLegalDoc('privacy')">隐私政策</span> 和
              <span class="auth-agreement-link" @click.stop="showLegalDoc('usage')">使用政策</span>
            </label>
          </div>

          <!-- 提交按钮 -->
          <button
            type="button"
            @click="handleFormSubmit"
            :class="['auth-submit-btn', agreeToTerms ? 'btn-active' : 'btn-disabled']"
            :disabled="!agreeToTerms || loading"
          >
            <span>{{ loading ? (mode === 'login' ? '登录中' : '注册中') : (mode === 'login' ? '登录' : '注册') }}</span>
            <svg class="auth-submit-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </button>

          <p v-if="errorMessage" class="auth-error mt-4">
            {{ errorMessage }}
          </p>
        </form>

        <div class="auth-footer-switch">
          <div class="auth-footer-actions">
            <span class="auth-footer-hint">{{ mode === 'login' ? '还没有账号？' : '已有账号？' }}</span>
            <button type="button" @click="toggleMode()" class="auth-footer-link">
              {{ mode === 'login' ? '注册' : '返回登录' }}
            </button>
          </div>
        </div>
      </section>
    </main>

    <!-- 法律文档弹窗 -->
    <div v-if="showLegalModal" class="legal-modal-overlay" @click.self="closeLegalModal">
      <div class="legal-modal-content">
        <div class="legal-modal-header">
          <h2 class="legal-modal-title">{{ currentLegalDoc?.title }}</h2>
          <button class="legal-modal-close" @click="closeLegalModal">×</button>
        </div>
        <div class="legal-modal-body">
          <p class="legal-modal-note">{{ currentLegalDoc?.note }}</p>
          <section v-for="section in currentLegalDoc?.sections" :key="section.title" class="legal-modal-section">
            <h3 class="legal-modal-section-title">{{ section.title }}</h3>
            <p v-for="paragraph in section.paragraphs" :key="paragraph" class="legal-modal-paragraph">{{ paragraph }}</p>
          </section>
        </div>
        <div class="legal-modal-footer">
          <button class="legal-modal-btn" @click="closeLegalModal">我已阅读</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue"
import { useRoute, useRouter } from "vue-router"

import { resolveSelfOnboardingState, selfOnboardingRoute } from "@/lib/onboarding"
import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const mode = ref<"login" | "register">("login")
const loading = ref(false)
const errorMessage = ref("")
const showPassword = ref(false)
const agreeToTerms = ref(false)
const codeCountdown = ref(0)
const publicAuthSettings = ref({
  require_verification_code_for_signup: false,
  allow_email_password_auth: true,
  allow_email_code_auth: false,
})

const loginIdentifier = ref("")
const loginPassword = ref("")
const loginCode = ref("")

const registerEmail = ref("")
const registerNickname = ref("")
const registerCode = ref("")
const registerPassword = ref("")
const registerMethod = ref<"code" | "password">("password")

const isEmailLogin = ref(false)
const showDebugCode = computed(
  () => auth.lastDeliveryChannel === "console" && Boolean(auth.lastDebugCode)
)
const canToggleLoginMethod = computed(
  () => publicAuthSettings.value.allow_email_code_auth && publicAuthSettings.value.allow_email_password_auth
)
const canToggleRegisterMethod = computed(
  () => !publicAuthSettings.value.require_verification_code_for_signup
)
const canToggleCurrentMethod = computed(() =>
  mode.value === "login" ? canToggleLoginMethod.value : canToggleRegisterMethod.value
)
const pageTitle = computed(() => (mode.value === "login" ? "登录" : "创建账户"))
const authMethodAction = computed(() => {
  if (mode.value === "login") {
    return isEmailLogin.value ? "改用密码" : "改用验证码"
  }
  return registerMethod.value === "code" ? "改用密码" : "改用验证码"
})

async function resolveRedirect(role?: string, options?: { forceSelfOnboarding?: boolean }) {
  if (role !== "admin" && options?.forceSelfOnboarding) {
    try {
      const state = await resolveSelfOnboardingState()
      if (!state.hasSelfReport) {
        return selfOnboardingRoute(typeof route.query.redirect === "string" ? route.query.redirect : undefined)
      }
    } catch (error) {
      console.warn("Failed to resolve self onboarding redirect", error)
    }
  }
  if (typeof route.query.redirect === "string") {
    return route.query.redirect
  }
  return role === "admin" ? "/admin/settings" : "/projects"
}

async function redirectAfterAuth(role?: string) {
  const target = await resolveRedirect(role)
  if (typeof target === "string" && route.fullPath === target) return
  await router.replace(target)
}

async function redirectAfterRegister(role?: string) {
  const target = await resolveRedirect(role, { forceSelfOnboarding: true })
  if (typeof target === "string" && route.fullPath === target) return
  await router.replace(target)
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  agreeToTerms.value = false
  errorMessage.value = ""
  isEmailLogin.value = publicAuthSettings.value.allow_email_code_auth && !publicAuthSettings.value.allow_email_password_auth
  registerMethod.value = publicAuthSettings.value.require_verification_code_for_signup ? "code" : "password"
}

function toggleCurrentMethod() {
  errorMessage.value = ""
  if (mode.value === "login" && canToggleLoginMethod.value) {
    isEmailLogin.value = !isEmailLogin.value
    return
  }
  if (mode.value === "register" && canToggleRegisterMethod.value) {
    registerMethod.value = registerMethod.value === "code" ? "password" : "code"
  }
}

function toggleSubmitBtn() {
  // 按钮状态通过计算属性绑定，此函数保持为了与原有逻辑一致
}

function handleForgotPassword() {
  window.alert('跳转找回密码')
}

type LegalSection = {
  title: string
  paragraphs: string[]
}

type LegalDocument = {
  badge: string
  title: string
  summary: string
  note: string
  updatedAt: string
  sections: LegalSection[]
}

const showLegalModal = ref(false)
const currentDocKey = ref<string>('terms')

const legalDocuments: Record<string, LegalDocument> = {
  terms: {
    badge: "服务条款",
    title: "Distill Human 服务条款",
    summary: "本条款规范用户访问、蒸馏、生成、下载及分享 Distill Human 平台内容时的权利义务关系。",
    note: "请在使用前仔细阅读以下条款。",
    updatedAt: "2025 年 1 月 1 日",
    sections: [
      { title: "1. 服务范围", paragraphs: ["本平台向用户提供人物蒸馏、主题整理、报告生成、会话交互、内容导出与分享等数字化服务。平台可以根据产品演进对具体功能、展示方式与入口结构进行调整。", "部分能力可能依赖第三方模型、云服务、邮件发送或外部内容源。当第三方能力不可用时，平台有权暂停相关功能并进行维护提示。"] },
      { title: "2. 账户与访问", paragraphs: ["用户应以真实、合法、可控制的邮箱或管理员账户信息访问平台，并对其账号下发生的操作承担责任。", "若平台发现异常登录、批量滥用、恶意抓取、绕过限制或其他影响系统稳定性的行为，有权中止访问、限制接口调用或要求补充验证。"] },
      { title: "3. 用户内容与授权", paragraphs: ["用户上传、输入、导入、蒸馏、编辑与导出的文本、图片、链接、对话及报告内容，原则上归用户或原始权利人所有。", "为实现平台功能，用户同意授予平台必要的处理授权，包括存储、解析、向量化、生成摘要、形成结构化卡片、生成报告与在用户明确选择的范围内进行分享或导出。"] },
      { title: "4. 合理使用", paragraphs: ["用户不得利用平台制作、传播或诱导生成违法信息、侵权内容、骚扰信息、虚假身份信息，或实施任何破坏系统安全与稳定的行为。", "未经许可，用户不得绕过平台的权限控制、限流规则或导出限制，也不得将平台生成结果冒充为官方事实结论、专业建议或平台背书。"] },
      { title: "5. 知识产权与免责声明", paragraphs: ["平台软件、界面、交互、数据结构与品牌标识相关权益归平台或其权利人所有。未经许可，不得复制、镜像、反向工程或商业转售。", "蒸馏结果、推荐技能、人格画像与自动生成内容仅作为辅助参考，不构成医疗、法律、投资、就业或其他专业意见。用户应自行判断并承担使用后果。"] },
      { title: "6. 终止与争议处理", paragraphs: ["如用户违反本条款、法律法规或平台公告，平台有权暂停、限制或终止全部或部分服务，并视情况保留相关操作记录。", "本条款的订立、履行与争议解决，建议以上线主体所在地有管辖权的人民法院或仲裁机构为准。"] }
    ]
  },
  privacy: {
    badge: "隐私政策",
    title: "Distill Human 隐私政策",
    summary: "本政策说明平台如何收集、使用、存储、共享与保护用户在使用蒸馏服务过程中的个人信息与内容数据。",
    note: "请在使用前仔细阅读以下隐私政策。",
    updatedAt: "2025 年 1 月 1 日",
    sections: [
      { title: "1. 我们收集的信息", paragraphs: ["当用户注册、登录、导入内容、进行蒸馏、查看报告、发起会话或导出结果时，平台可能收集邮箱、昵称、项目名称、导入来源、文本内容、图片内容、对话记录、操作日志与设备基础信息。", "如用户通过 GitHub、联网搜索或第三方内容源导入资料，平台还可能处理对应的公开链接、仓库名称、文档片段与结构化解析结果。"] },
      { title: "2. 信息的使用目的", paragraphs: ["我们使用这些信息完成身份验证、验证码发送、项目管理、蒸馏分析、报告生成、技能匹配、问题排查、性能优化与安全防护。", "在不识别到特定个人的前提下，平台可以对使用趋势、性能日志与匿名统计进行分析，以改进产品体验。"] },
      { title: "3. 信息共享与公开", paragraphs: ["除为完成服务所必需的第三方邮件、云存储、模型调用或法律要求外，平台不会在未经用户授权的情况下向无关第三方出售或共享用户个人信息。", "当用户主动使用分享、下载、公开卡片或导出报告功能时，平台会按照用户当前选择的可见范围生成相应内容。用户应自行确认分享范围与接收对象。"] },
      { title: "4. 存储与保护", paragraphs: ["平台会采取合理的访问控制、传输加密、日志审计与权限隔离措施来保护用户信息，但无法承诺在任何技术环境下绝对无风险。", "用户应妥善保管自己的登录邮箱、验证码与管理员凭证，避免在公共环境中泄露项目信息或导出内容。"] },
      { title: "5. 用户权利", paragraphs: ["用户可以依法请求访问、更正、删除或导出与本人相关的个人信息，并可撤回部分授权或注销账户，但法律法规另有规定或为履行合同所必需的除外。", "如用户对隐私处理存在疑问、投诉或建议，可通过平台提供的客服邮箱或工单入口联系平台。"] }
    ]
  },
  usage: {
    badge: "使用政策",
    title: "Distill Human 使用政策",
    summary: "本政策补充说明平台内容导入、人物蒸馏、人格卡片生成、报告下载与分享功能的合理边界。",
    note: "请在使用前仔细阅读以下使用政策。",
    updatedAt: "2025 年 1 月 1 日",
    sections: [
      { title: "1. 导入与蒸馏边界", paragraphs: ["用户应仅导入其有权处理、分析或引用的内容，不得上传包含违法信息、恶意脚本、敏感个人信息或明显侵权内容的文件与链接。", "平台保留对超大体积导入、异常频率抓取、可疑仓库地址、批量刷取验证码与明显自动化滥用行为进行限流、阻断或人工审核的权利。"] },
      { title: "2. 生成结果的使用", paragraphs: ["人格画像、推荐技能、候选卡片、总结报告与会话内容均由系统基于导入材料与模型能力生成，可能存在偏差、遗漏或时效限制。", "用户不得将生成内容用于虚假认证、冒名背书、精准操纵、歧视判断、非法画像交易或其他违反法律法规和社会公序良俗的场景。"] },
      { title: "3. 下载与分享", paragraphs: ["平台提供的下载卡片、报告导出与分享入口仅用于用户授权范围内的传播。用户应对分享后的传播对象、传播后果及内容合规性负责。", "如内容涉及第三方肖像、知识产权、隐私或商业秘密，用户在下载或分享前应自行确认取得必要授权。"] },
      { title: "4. 平台治理", paragraphs: ["对于违反本政策的行为，平台可以视风险等级采取提醒、删除内容、限制分享、冻结账户、阻断导入来源或保留追责证据等措施。", "平台可根据法律法规、监管要求与业务发展调整本政策，并通过站内公告、登录页链接或其他适当方式提示用户。"] }
    ]
  }
}

const currentLegalDoc = computed(() => legalDocuments[currentDocKey.value])

function showLegalDoc(type: string) {
  currentDocKey.value = type
  showLegalModal.value = true
}

function closeLegalModal() {
  showLegalModal.value = false
}

async function requestCode(email: string) {
  try {
    loading.value = true
    errorMessage.value = ""
    await auth.requestCode(email)
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || error.message || "发送失败"
  } finally {
    loading.value = false
  }
}

function startCodeCountdown() {
  codeCountdown.value = 60
  const timer = setInterval(() => {
    codeCountdown.value--
    if (codeCountdown.value <= 0) {
      clearInterval(timer)
    }
  }, 1000)
}

async function handleRequestLoginCode() {
  if (!isEmailLogin.value) {
    return
  }
  await requestCode(loginIdentifier.value.trim())
  if (!errorMessage.value) startCodeCountdown()
}

async function handleRequestRegisterCode() {
  if (!registerEmail.value.trim()) {
    errorMessage.value = "请输入邮箱"
    return
  }
  await requestCode(registerEmail.value.trim())
  if (!errorMessage.value) startCodeCountdown()
}

function handleFormSubmit() {
  if (mode.value === 'login') {
    handleLoginSubmit()
  } else {
    handleRegisterSubmit()
  }
}

async function handleLoginSubmit() {
  try {
    loading.value = true
    errorMessage.value = ""

    let session
    if (isEmailLogin.value) {
      session = await auth.verifyCode(
        loginIdentifier.value.trim(),
        loginCode.value.trim(),
        ""
      )
    } else {
      const identifier = loginIdentifier.value.trim()
      session = identifier.includes("@")
        ? await auth.loginWithPassword(identifier, loginPassword.value)
        : await auth.adminLogin(identifier, loginPassword.value)
    }
    await redirectAfterAuth(session.user.role)
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || error.message || "登录失败"
  } finally {
    loading.value = false
  }
}

async function handleRegisterSubmit() {
  try {
    loading.value = true
    errorMessage.value = ""
    const session = registerMethod.value === "code"
      ? await auth.verifyCode(
          registerEmail.value.trim(),
          registerCode.value.trim(),
          registerNickname.value.trim() || registerEmail.value.trim().split("@")[0]
        )
      : await auth.registerWithPassword(
          registerEmail.value.trim(),
          registerPassword.value,
          registerNickname.value.trim() || registerEmail.value.trim().split("@")[0],
        )
    await redirectAfterRegister(session.user.role)
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || error.message || "注册失败"
  } finally {
    loading.value = false
  }
}

// Canvas 背景动画
let animationId: number
let particles: Particle[] = []
let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let width: number = 0
let height: number = 0
let centerX: number = 0
let centerY: number = 0
const particlePalette = [
  "rgba(232, 220, 198, 0.32)",
  "rgba(198, 154, 96, 0.28)",
  "rgba(163, 111, 77, 0.24)",
]

class Particle {
  x: number = 0
  y: number = 0
  radius: number = 0
  color: string = ""
  vx: number = 0
  vy: number = 0
  life: number = 0
  decay: number = 0

  constructor() {
    this.reset()
  }

  reset() {
    const edge = Math.floor(Math.random() * 4)
    if (edge === 0) { this.x = Math.random() * width; this.y = -20 }
    else if (edge === 1) { this.x = width + 20; this.y = Math.random() * height }
    else if (edge === 2) { this.x = Math.random() * width; this.y = height + 20 }
    else { this.x = -20; this.y = Math.random() * height }

    this.radius = Math.random() * 2.8 + 0.8
    this.color = particlePalette[Math.floor(Math.random() * particlePalette.length)]
    const angle = Math.atan2(centerY - this.y, centerX - this.x)
    const speed = Math.random() * 0.65 + 0.25

    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed

    this.life = Math.random() * 0.35 + 0.45
    this.decay = Math.random() * 0.003 + 0.0012
  }

  update() {
    const dx = centerX - this.x
    const dy = centerY - this.y
    const distSq = dx*dx + dy*dy
    const dist = Math.sqrt(distSq)
    
    if (dist > 10) {
      const force = 0.12 / dist
      this.vx += (dx / dist) * force
      this.vy += (dy / dist) * force
    }

    this.x += this.vx
    this.y += this.vy

    if (dist < 100) {
      this.life -= 0.012
      this.radius *= 0.992
    } else {
      this.life -= this.decay
    }

    if (this.life <= 0 || this.radius < 0.35) {
      this.reset()
    }
  }

  draw() {
    if (!ctx) return
    ctx.save()
    ctx.globalAlpha = this.life
    ctx.fillStyle = this.color
    ctx.shadowBlur = 18
    ctx.shadowColor = this.color
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function resize() {
  if (!canvas) return
  width = canvas.width = window.innerWidth
  height = canvas.height = window.innerHeight
  centerX = width / 2
  centerY = height / 2
}

function drawFireGlow() {
  if (!ctx) return
  const gradient = ctx.createRadialGradient(centerX, centerY, 40, centerX, centerY, width * 0.72)
  gradient.addColorStop(0, "rgba(132, 92, 51, 0.18)")
  gradient.addColorStop(0.32, "rgba(75, 49, 30, 0.18)")
  gradient.addColorStop(0.68, "rgba(19, 15, 12, 0.08)")
  gradient.addColorStop(1, "rgba(8, 7, 6, 0)")

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 180)
  coreGradient.addColorStop(0, "rgba(216, 176, 120, 0.12)")
  coreGradient.addColorStop(1, "rgba(216, 176, 120, 0)")
  ctx.fillStyle = coreGradient
  ctx.beginPath()
  ctx.arc(centerX, centerY, 180, 0, Math.PI * 2)
  ctx.fill()
}

function animate() {
  if (!ctx || !canvas) return
  ctx.clearRect(0, 0, width, height)
  
  drawFireGlow()
  
  particles.forEach(p => {
    p.update()
    p.draw()
  })

  animationId = requestAnimationFrame(animate)
}

onMounted(() => {
  auth.fetchPublicAuthSettings()
    .then((data) => {
      publicAuthSettings.value = data
      isEmailLogin.value = data.allow_email_code_auth && !data.allow_email_password_auth
      registerMethod.value = data.require_verification_code_for_signup ? "code" : "password"
    })
    .catch(() => {})
  canvas = document.getElementById('fireCanvas') as HTMLCanvasElement
  if (canvas) {
    ctx = canvas.getContext('2d')
    if (ctx) {
      resize()
      window.addEventListener('resize', resize)
      particles = Array.from({ length: 28 }, () => new Particle())
      animate()
    }
  }

  if (auth.token) {
    void redirectAfterAuth(auth.user?.role)
  }
})

watch(
  () => auth.token,
  (nextToken) => {
    if (nextToken) {
      void redirectAfterAuth(auth.user?.role)
    }
  }
)

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  window.removeEventListener('resize', resize)
})
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap");

.page-wrap.auth-page {
  font-family: "Instrument Sans", "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", sans-serif;
  background:
    radial-gradient(circle at top, rgba(145, 104, 59, 0.12), transparent 34%),
    linear-gradient(180deg, #090806 0%, #11100d 48%, #090806 100%);
  color: #f2eadc;
  overflow: hidden;
}

.page-wrap.auth-page ::-webkit-scrollbar {
  width: 0;
  background: transparent;
}

.auth-shell {
  position: relative;
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  padding: max(22px, env(safe-area-inset-top, 0px)) 18px max(28px, env(safe-area-inset-bottom, 0px));
}

.auth-canvas {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  opacity: 0.2;
}

.auth-window {
  position: relative;
  z-index: 1;
  width: min(100%, 408px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
  padding: clamp(18px, 5vh, 44px) 0;
}

.auth-header {
  display: flex;
  justify-content: center;
}

.auth-brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  flex: 0 0 auto;
  color: rgba(244, 225, 189, 0.92);
}

.auth-brand-svg {
  width: 54px;
  height: 54px;
}

.auth-body {
  position: relative;
  display: grid;
  gap: 18px;
}

.auth-headline {
  display: grid;
  justify-items: center;
}

.auth-headline h1 {
  margin: 0;
  font-family: "Instrument Sans", "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", sans-serif;
  font-size: clamp(1.52rem, 5vw, 1.8rem);
  font-weight: 600;
  line-height: 1.15;
  color: #fffaf2;
  letter-spacing: 0;
}

.auth-form {
  display: grid;
  gap: 16px;
}

.auth-text-switch,
.auth-footer-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: #f0c98f;
  font-size: 0.86rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: color 160ms ease, opacity 160ms ease;
}

.auth-field-group {
  display: grid;
  gap: 10px;
}

.auth-label {
  display: block;
  color: rgba(245, 235, 220, 0.92);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0;
}

.auth-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.auth-label-actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.auth-label-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: #f0c98f;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 160ms ease, opacity 160ms ease;
}

.auth-label-link--muted {
  color: rgba(245, 235, 220, 0.68);
}

.auth-input-shell {
  display: flex;
  align-items: center;
  min-height: 56px;
  gap: 12px;
  padding: 0 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 241, 219, 0.18);
  background: rgba(255, 250, 242, 0.07);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.auth-input-shell--inline {
  flex: 1 1 auto;
}

.input-glow:focus-within {
  border-color: rgba(240, 201, 143, 0.56);
  background: rgba(255, 250, 242, 0.1);
  box-shadow: 0 0 0 3px rgba(240, 201, 143, 0.12);
}

.auth-input-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  color: rgba(245, 235, 220, 0.58);
}

.auth-input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: #fffaf2;
  font-size: 0.97rem;
  letter-spacing: 0.01em;
}

.auth-input::placeholder {
  color: rgba(245, 235, 220, 0.52);
}

.auth-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 0;
  background: transparent;
  color: rgba(245, 235, 220, 0.68);
}

.auth-icon-btn-svg,
.auth-submit-icon {
  width: 16px;
  height: 16px;
}

.auth-inline-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: stretch;
}

.auth-code-btn {
  min-width: 116px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 241, 219, 0.18);
  background: rgba(255, 250, 242, 0.08);
  color: #fff5e7;
  font-size: 0.78rem;
  font-weight: 600;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.auth-code-btn:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.auth-caption {
  margin: -6px 0 0;
  color: rgba(245, 235, 220, 0.72);
  font-size: 0.76rem;
  line-height: 1.6;
}

.auth-agreement {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-top: 2px;
}

.auth-agreement-copy {
  color: rgba(245, 235, 220, 0.82);
  font-size: 0.77rem;
  line-height: 1.65;
  cursor: pointer;
  user-select: none;
}

.auth-agreement-link {
  color: #f0c98f;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.custom-checkbox {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  position: relative;
  border: 1.5px solid rgba(245, 235, 220, 0.56);
  border-radius: 5px;
  background: rgba(255, 250, 242, 0.08);
  cursor: pointer;
  transition: all 0.2s ease;
}

.custom-checkbox:checked {
  border-color: #dfba82;
  background: #dfba82;
}

.custom-checkbox:checked::after {
  content: "";
  position: absolute;
  left: 5px;
  top: 1.5px;
  width: 4.5px;
  height: 9px;
  border: solid #18120a;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.auth-submit-btn {
  width: 100%;
  min-height: 58px;
  margin-top: 8px;
  padding: 0 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 1.02rem;
  font-weight: 700;
  letter-spacing: 0;
  transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease, color 180ms ease, border-color 180ms ease;
}

.auth-submit-btn span,
.auth-submit-btn .auth-submit-icon {
  color: inherit;
  opacity: 1;
}

.btn-active {
  background: linear-gradient(180deg, #fffdf8 0%, #f1e5d0 100%);
  color: #14110c;
  border-color: rgba(255, 250, 242, 0.82);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 18px 40px rgba(0, 0, 0, 0.28);
}

.btn-active:hover {
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.76),
    0 22px 46px rgba(0, 0, 0, 0.32);
}

.btn-active span,
.btn-active .auth-submit-icon {
  color: #14110c;
}

.btn-disabled {
  background: rgba(255, 250, 242, 0.09);
  color: rgba(245, 235, 220, 0.38);
  border-color: rgba(255, 255, 255, 0.06);
  cursor: not-allowed;
  pointer-events: none;
  box-shadow: none;
}

.auth-debug-code {
  margin: 0;
  text-align: center;
  color: rgba(225, 211, 187, 0.56);
  font-size: 0.74rem;
}

.auth-error {
  margin-bottom: 0;
  border-radius: 16px;
  border: 1px solid rgba(186, 106, 88, 0.38);
  background: rgba(98, 34, 26, 0.24);
  color: #ffc2b8;
  padding: 12px 14px;
  font-size: 0.84rem;
  line-height: 1.6;
}

.auth-footer-switch {
  padding-top: 2px;
  display: flex;
  justify-content: center;
}

.auth-footer-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.auth-footer-hint {
  color: rgba(245, 235, 220, 0.62);
  font-size: 0.84rem;
}

.auth-footer-link {
  color: rgba(248, 234, 209, 0.92);
}

.legal-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(6, 6, 5, 0.8);
  backdrop-filter: blur(12px);
}

.legal-modal-content {
  width: 100%;
  max-width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 24px;
  border: 1px solid rgba(204, 177, 137, 0.16);
  background: linear-gradient(180deg, #16120f 0%, #0d0b09 100%);
}

.legal-modal-header,
.legal-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.4rem;
  border-color: rgba(204, 177, 137, 0.12);
}

.legal-modal-header {
  border-bottom: 1px solid rgba(204, 177, 137, 0.12);
}

.legal-modal-footer {
  justify-content: flex-end;
  border-top: 1px solid rgba(204, 177, 137, 0.12);
}

.legal-modal-title {
  margin: 0;
  color: #f5ede2;
  font-family: "Noto Serif SC", serif;
  font-size: 1.06rem;
  font-weight: 600;
}

.legal-modal-close {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(204, 177, 137, 0.16);
  border-radius: 10px;
  background: rgba(255, 248, 236, 0.04);
  color: #f2eadc;
  font-size: 1.2rem;
  cursor: pointer;
}

.legal-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.4rem;
}

.legal-modal-note {
  margin-bottom: 1.25rem;
  padding: 0.8rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(204, 177, 137, 0.12);
  background: rgba(255, 248, 236, 0.03);
  color: rgba(225, 211, 187, 0.62);
  font-size: 0.8rem;
  line-height: 1.6;
}

.legal-modal-section {
  margin-bottom: 1.2rem;
}

.legal-modal-section-title {
  margin-bottom: 0.45rem;
  color: #f3ede1;
  font-size: 0.92rem;
  font-weight: 600;
}

.legal-modal-paragraph {
  margin-bottom: 0.45rem;
  color: rgba(225, 211, 187, 0.66);
  font-size: 0.82rem;
  line-height: 1.75;
}

.legal-modal-btn {
  padding: 0.7rem 1.5rem;
  border: 0;
  border-radius: 999px;
  background: #dfba82;
  color: #17120c;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
}

.auth-label-link:hover {
  filter: brightness(1.06);
}

.auth-text-switch:hover,
.auth-footer-link:hover,
.auth-code-btn:hover,
.legal-modal-close:hover,
.legal-modal-btn:hover {
  filter: brightness(1.06);
}

.auth-text-switch:focus-visible,
.auth-footer-link:focus-visible,
.auth-code-btn:focus-visible,
.auth-submit-btn:focus-visible,
.legal-modal-close:focus-visible,
.legal-modal-btn:focus-visible {
  outline: 2px solid rgba(225, 188, 132, 0.46);
  outline-offset: 2px;
}

@media (max-width: 480px) {
  .auth-shell {
    padding-left: 14px;
    padding-right: 14px;
  }

  .auth-window {
    gap: 16px;
    width: 100%;
    padding-top: 18px;
    padding-bottom: 24px;
  }

  .auth-brand-mark {
    width: 60px;
    height: 60px;
  }

  .auth-brand-svg {
    width: 48px;
    height: 48px;
  }

  .auth-headline h1 {
    font-size: 1.5rem;
  }

  .auth-input-shell {
    min-height: 54px;
  }

  .auth-submit-btn {
    min-height: 54px;
  }

  .auth-inline-field {
    grid-template-columns: 1fr;
  }

  .auth-code-btn {
    width: 100%;
    min-height: 46px;
  }

  .legal-modal-overlay {
    padding: 12px;
    align-items: flex-end;
  }

  .legal-modal-content {
    max-height: 88vh;
    border-radius: 20px;
  }

  .legal-modal-header,
  .legal-modal-body,
  .legal-modal-footer {
    padding-left: 14px;
    padding-right: 14px;
  }
}
</style>
