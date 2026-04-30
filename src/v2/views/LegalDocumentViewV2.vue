<template>
  <section class="legal-page">
    <div class="legal-background" aria-hidden="true">
      <div class="legal-glow legal-glow--left" />
      <div class="legal-glow legal-glow--right" />
    </div>

    <main class="legal-main">
      <header class="legal-header">
        <div class="legal-kicker-row">
          <span class="legal-kicker">{{ document.badge }}</span>
          <span class="legal-updated">更新于 {{ document.updatedAt }}</span>
        </div>
        <h1 class="legal-title">{{ document.title }}</h1>
        <p class="legal-summary">{{ document.summary }}</p>

        <div class="legal-actions">
          <RouterLink to="/auth" class="legal-action legal-action--primary">返回登录</RouterLink>
          <RouterLink to="/" class="legal-action">返回首页</RouterLink>
        </div>
      </header>

      <article class="legal-card">
        <p class="legal-note">{{ document.note }}</p>

        <section v-for="section in document.sections" :key="section.title" class="legal-section">
          <h2 class="legal-section-title">{{ section.title }}</h2>
          <p v-for="paragraph in section.paragraphs" :key="paragraph" class="legal-paragraph">
            {{ paragraph }}
          </p>
        </section>
      </article>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useRoute } from "vue-router"

type DocumentKey = "terms" | "privacy" | "usage"

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

const route = useRoute()

const documents: Record<DocumentKey, LegalDocument> = {
  terms: {
    badge: "服务条款模板",
    title: "Distill Human 服务条款",
    summary: "本模板用于规范用户访问、蒸馏、生成、下载及分享 Distill Human 平台内容时的权利义务关系。",
    note: "模板说明：上线前请将文中的运营主体名称、联系邮箱、争议解决地、客服方式等信息替换为实际信息。",
    updatedAt: "2026 年 4 月 19 日",
    sections: [
      {
        title: "1. 服务范围",
        paragraphs: [
          "本平台向用户提供人物蒸馏、主题整理、报告生成、会话交互、内容导出与分享等数字化服务。平台可以根据产品演进对具体功能、展示方式与入口结构进行调整。",
          "部分能力可能依赖第三方模型、云服务、邮件发送或外部内容源。当第三方能力不可用时，平台有权暂停相关功能并进行维护提示。"
        ]
      },
      {
        title: "2. 账户与访问",
        paragraphs: [
          "用户应以真实、合法、可控制的邮箱或管理员账户信息访问平台，并对其账号下发生的操作承担责任。",
          "若平台发现异常登录、批量滥用、恶意抓取、绕过限制或其他影响系统稳定性的行为，有权中止访问、限制接口调用或要求补充验证。"
        ]
      },
      {
        title: "3. 用户内容与授权",
        paragraphs: [
          "用户上传、输入、导入、蒸馏、编辑与导出的文本、图片、链接、对话及报告内容，原则上归用户或原始权利人所有。",
          "为实现平台功能，用户同意授予平台必要的处理授权，包括存储、解析、向量化、生成摘要、形成结构化卡片、生成报告与在用户明确选择的范围内进行分享或导出。"
        ]
      },
      {
        title: "4. 合理使用",
        paragraphs: [
          "用户不得利用平台制作、传播或诱导生成违法信息、侵权内容、骚扰信息、虚假身份信息，或实施任何破坏系统安全与稳定的行为。",
          "未经许可，用户不得绕过平台的权限控制、限流规则或导出限制，也不得将平台生成结果冒充为官方事实结论、专业建议或平台背书。"
        ]
      },
      {
        title: "5. 知识产权与免责声明",
        paragraphs: [
          "平台软件、界面、交互、数据结构与品牌标识相关权益归平台或其权利人所有。未经许可，不得复制、镜像、反向工程或商业转售。",
          "蒸馏结果、推荐技能、人格画像与自动生成内容仅作为辅助参考，不构成医疗、法律、投资、就业或其他专业意见。用户应自行判断并承担使用后果。"
        ]
      },
      {
        title: "6. 终止与争议处理",
        paragraphs: [
          "如用户违反本条款、法律法规或平台公告，平台有权暂停、限制或终止全部或部分服务，并视情况保留相关操作记录。",
          "本条款的订立、履行与争议解决，建议以上线主体所在地有管辖权的人民法院或仲裁机构为准。"
        ]
      }
    ]
  },
  privacy: {
    badge: "隐私政策模板",
    title: "Distill Human 隐私政策",
    summary: "本模板说明平台如何收集、使用、存储、共享与保护用户在使用蒸馏服务过程中的个人信息与内容数据。",
    note: "模板说明：如涉及跨境传输、第三方 SDK、统计分析工具或生物识别信息，请在正式版本中补充单独条款。",
    updatedAt: "2026 年 4 月 19 日",
    sections: [
      {
        title: "1. 我们收集的信息",
        paragraphs: [
          "当用户注册、登录、导入内容、进行蒸馏、查看报告、发起会话或导出结果时，平台可能收集邮箱、昵称、项目名称、导入来源、文本内容、图片内容、对话记录、操作日志与设备基础信息。",
          "如用户通过 GitHub、联网搜索或第三方内容源导入资料，平台还可能处理对应的公开链接、仓库名称、文档片段与结构化解析结果。"
        ]
      },
      {
        title: "2. 信息的使用目的",
        paragraphs: [
          "我们使用这些信息完成身份验证、验证码发送、项目管理、蒸馏分析、报告生成、技能匹配、问题排查、性能优化与安全防护。",
          "在不识别到特定个人的前提下，平台可以对使用趋势、性能日志与匿名统计进行分析，以改进产品体验。"
        ]
      },
      {
        title: "3. 信息共享与公开",
        paragraphs: [
          "除为完成服务所必需的第三方邮件、云存储、模型调用或法律要求外，平台不会在未经用户授权的情况下向无关第三方出售或共享用户个人信息。",
          "当用户主动使用分享、下载、公开卡片或导出报告功能时，平台会按照用户当前选择的可见范围生成相应内容。用户应自行确认分享范围与接收对象。"
        ]
      },
      {
        title: "4. 存储与保护",
        paragraphs: [
          "平台会采取合理的访问控制、传输加密、日志审计与权限隔离措施来保护用户信息，但无法承诺在任何技术环境下绝对无风险。",
          "用户应妥善保管自己的登录邮箱、验证码与管理员凭证，避免在公共环境中泄露项目信息或导出内容。"
        ]
      },
      {
        title: "5. 用户权利",
        paragraphs: [
          "用户可以依法请求访问、更正、删除或导出与本人相关的个人信息，并可撤回部分授权或注销账户，但法律法规另有规定或为履行合同所必需的除外。",
          "如用户对隐私处理存在疑问、投诉或建议，可通过正式上线主体提供的客服邮箱或工单入口联系平台。"
        ]
      }
    ]
  },
  usage: {
    badge: "使用政策模板",
    title: "Distill Human 使用政策",
    summary: "本模板用于补充说明平台内容导入、人物蒸馏、人格卡片生成、报告下载与分享功能的合理边界。",
    note: "模板说明：如果后续上线会员权限、企业团队空间或 API 能力，可在本政策中追加配额、速率限制与团队管理规则。",
    updatedAt: "2026 年 4 月 19 日",
    sections: [
      {
        title: "1. 导入与蒸馏边界",
        paragraphs: [
          "用户应仅导入其有权处理、分析或引用的内容，不得上传包含违法信息、恶意脚本、敏感个人信息或明显侵权内容的文件与链接。",
          "平台保留对超大体积导入、异常频率抓取、可疑仓库地址、批量刷取验证码与明显自动化滥用行为进行限流、阻断或人工审核的权利。"
        ]
      },
      {
        title: "2. 生成结果的使用",
        paragraphs: [
          "人格画像、推荐技能、候选卡片、总结报告与会话内容均由系统基于导入材料与模型能力生成，可能存在偏差、遗漏或时效限制。",
          "用户不得将生成内容用于虚假认证、冒名背书、精准操纵、歧视判断、非法画像交易或其他违反法律法规和社会公序良俗的场景。"
        ]
      },
      {
        title: "3. 下载与分享",
        paragraphs: [
          "平台提供的下载卡片、报告导出与分享入口仅用于用户授权范围内的传播。用户应对分享后的传播对象、传播后果及内容合规性负责。",
          "如内容涉及第三方肖像、知识产权、隐私或商业秘密，用户在下载或分享前应自行确认取得必要授权。"
        ]
      },
      {
        title: "4. 平台治理",
        paragraphs: [
          "对于违反本政策的行为，平台可以视风险等级采取提醒、删除内容、限制分享、冻结账户、阻断导入来源或保留追责证据等措施。",
          "平台可根据法律法规、监管要求与业务发展调整本政策，并通过站内公告、登录页链接或其他适当方式提示用户。"
        ]
      }
    ]
  }
}

const documentKey = computed<DocumentKey>(() => {
  const key = String(route.meta.documentType || "terms")
  if (key === "privacy" || key === "usage") return key
  return "terms"
})

const document = computed(() => documents[documentKey.value])
</script>

<style scoped>
.legal-page {
  position: relative;
  min-height: 100vh;
  padding: 40px 20px 56px;
  background: linear-gradient(180deg, #080808 0%, #030303 100%);
  color: #fff;
}

.legal-background {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.legal-glow {
  position: absolute;
  width: 42vw;
  height: 42vw;
  min-width: 320px;
  min-height: 320px;
  border-radius: 999px;
  filter: blur(40px);
  background: radial-gradient(circle, rgba(255, 255, 255, 0.14), transparent 72%);
  opacity: 0.42;
}

.legal-glow--left {
  left: -12vw;
  top: -14vw;
}

.legal-glow--right {
  right: -10vw;
  bottom: -16vw;
}

.legal-main {
  position: relative;
  z-index: 1;
  width: min(100%, 920px);
  margin: 0 auto;
  display: grid;
  gap: 24px;
}

.legal-header {
  display: grid;
  gap: 14px;
}

.legal-kicker-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.legal-kicker,
.legal-updated {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.62);
}

.legal-title {
  margin: 0;
  font-size: clamp(34px, 5vw, 54px);
  line-height: 1.05;
  letter-spacing: -0.05em;
}

.legal-summary,
.legal-note,
.legal-paragraph {
  margin: 0;
  color: rgba(255, 255, 255, 0.68);
  font-size: 15px;
  line-height: 1.92;
}

.legal-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.legal-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0 18px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}

.legal-action--primary {
  background: #fff;
  color: #050505;
}

.legal-card {
  padding: 26px;
  border-radius: 30px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 24px 64px rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(24px);
}

.legal-note {
  padding: 16px 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.legal-section {
  display: grid;
  gap: 12px;
  padding-top: 24px;
}

.legal-section + .legal-section {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 24px;
}

.legal-section-title {
  margin: 0;
  font-size: 22px;
  line-height: 1.25;
  letter-spacing: -0.03em;
}

@media (max-width: 640px) {
  .legal-page {
    padding: 24px 14px 36px;
  }

  .legal-card {
    padding: 18px;
    border-radius: 24px;
  }

  .legal-section-title {
    font-size: 20px;
  }
}
</style>
