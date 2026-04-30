<template>
  <div class="cyber-page report-hub-page report-v3-page">
    <div class="report-v3-shell">
      <header class="report-v3-topbar">
        <button type="button" class="report-v3-back" @click="goBackToDistill">
          <span class="material-symbols-rounded">arrow_back</span>
          返回蒸馏
        </button>
      </header>

      <section class="report-v3-hero cyber-animate-in-down">
        <p class="report-v3-kicker">DISTILL REPORT</p>
        <h1>{{ reportHeaderTitle }}</h1>
        <p>{{ reportHeaderSubtitle }}</p>
      </section>

      <div class="v2-proto-page report-hub-page-inner">
      <section v-if="loading" class="report-section v2-proto-empty">
        <p class="v2-proto-kicker">Loading</p>
        <h2 class="serif v2-proto-title">正在读取蒸馏结果。</h2>
      </section>

      <section v-else-if="errorMessage" class="report-section v2-proto-empty">
        <p class="v2-proto-kicker">Report</p>
        <h2 class="serif v2-proto-title">报告暂时不可用。</h2>
        <p class="v2-danger">{{ errorMessage }}</p>
      </section>

      <template v-else-if="project && report">
        <div class="v2-proto-container report-hub-shell">
          <section class="report-hub-grid">
            <div
              v-for="card in reportCards"
              :key="card.id"
              class="report-hub-card-item"
              :class="{ 'is-personality-item': card.id === 'personality' }"
            >
              <article
                class="report-unlock-card"
                :class="[
                  `is-${card.accent}`,
                  {
                    'is-unlocked': isCardUnlocked(card.id),
                    'is-clickable': isCardUnlocked(card.id),
                    'is-personality-card': card.id === 'personality',
                  },
                ]"
                @click="isCardUnlocked(card.id) ? void openDetailModal(card.id) : undefined"
              >
                <div class="report-unlock-card-noise" aria-hidden="true" />

                <div class="report-unlock-card-top">
                  <div>
                    <span v-if="card.id !== 'personality'" class="report-unlock-card-index">{{ card.index }}</span>
                    <h3 v-if="card.id !== 'personality'" class="report-unlock-card-title">{{ card.title }}</h3>
                  </div>
                </div>

                <div
                  class="report-unlock-card-preview"
                  :class="{ 'is-blurred': !isCardUnlocked(card.id) }"
                >
                  <template v-if="card.id === 'personality'">
                    <div
                      class="report-card-persona-hero"
                      :class="{ 'has-template-background': personalityUsesTemplateBackground }"
                      :style="personalityCardTheme"
                    >
                    <div class="report-card-persona-meta">
                      <div class="report-card-persona-meta-main">
                        <strong>{{ personalityCardHeaderLine }}</strong>
                      </div>
                    </div>

                    <span class="report-card-persona-watermark">{{ personalityCardCode }}</span>

                    <img
                      :src="personalityPortraitImage"
                      :alt="`${personalityCardCode} ${personalityCardTitle}`"
                      class="report-card-persona-image"
                      :class="{ 'is-template-background': personalityUsesTemplateBackground }"
                      @error="handlePersonalityPortraitError"
                    />

                    <div class="report-card-persona-copy">
                      <h4 class="report-card-persona-title">{{ personalityTemplateTitle }}</h4>
                      <p class="report-card-persona-summary">{{ personalityTemplateBodyDisplay }}</p>
                      <p class="report-card-persona-motto">“{{ personalityDetailLead }}”</p>
                    </div>
                    <div class="report-card-signature-strip" aria-label="复制人签名">
                      <div class="report-card-signature-panel">
                        <svg
                          class="report-card-signature-art"
                          viewBox="0 0 320 82"
                          preserveAspectRatio="none"
                          role="img"
                          :aria-label="personalitySignatureLine"
                        >
                          <path
                            class="report-card-signature-art-line is-over"
                            :d="personalitySignatureTopLine"
                            pathLength="100"
                          />
                          <text
                            class="report-card-signature-art-glyph"
                            x="14"
                            y="52"
                            textLength="250"
                            lengthAdjust="spacingAndGlyphs"
                          >
                            {{ personalitySignatureGlyphLine }}
                          </text>
                          <path
                            v-for="(stroke, index) in personalitySignatureAccentStrokes"
                            :key="`signature-accent-${index}`"
                            class="report-card-signature-art-line is-accent"
                            :d="stroke"
                            pathLength="100"
                          />
                        </svg>
                      </div>
                      <div class="report-card-signature-tear" aria-hidden="true" />
                      <div class="report-card-signature-qr-wrap">
                        <canvas
                          v-show="signatureFriendQr?.qr_text"
                          ref="signatureQrCanvasRef"
                          class="report-card-signature-qr"
                          aria-label="我的专属二维码"
                        />
                      </div>
                    </div>
                  </div>
                </template>

                <template v-else-if="card.id === 'cognition'">
                  <div class="report-card-radar-shell">
                    <svg viewBox="0 0 200 200" class="report-card-radar">
                      <polygon
                        v-for="scale in [1, 0.76, 0.52]"
                        :key="`grid-${scale}`"
                        :points="polygonPoints(scale)"
                        class="report-card-radar-grid"
                      />
                      <line
                        v-for="(metric, index) in radarMetrics.slice(0, 5)"
                        :key="`${metric.label}-${index}`"
                        x1="100"
                        y1="100"
                        :x2="axisPoint(index).x"
                        :y2="axisPoint(index).y"
                        class="report-card-radar-axis"
                      />
                      <polygon :points="radarValuePoints" class="report-card-radar-value" />
                      <circle
                        v-for="(metric, index) in radarMetrics.slice(0, 5)"
                        :key="`dot-${metric.label}`"
                        :cx="valuePoint(index).x"
                        :cy="valuePoint(index).y"
                        r="4"
                        class="report-card-radar-dot"
                      />
                    </svg>
                  </div>

                  <div class="report-card-layer-list">
                    <div
                      v-for="layer in fiveLayerStructure.slice(0, 3)"
                      :key="layer.key"
                      class="report-card-layer-item"
                    >
                      <span>{{ layer.step }}</span>
                      <strong>{{ layer.title }}</strong>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <div class="report-card-position-hero">
                    <p class="report-card-copy-kicker">{{ adviceCards[0]?.title || "优先动作" }}</p>
                    <h4 class="report-card-position-title">{{ behaviorPrimaryHeadline }}</h4>
                    <p class="report-card-position-score">
                      推荐匹配度
                      <strong>{{ behaviorMatchScore }}</strong>
                    </p>
                  </div>

                  <div class="report-card-route-list">
                    <div
                      v-for="item in behaviorHighlights"
                      :key="`${item.title}-${item.subtitle}`"
                      class="report-card-route-item"
                    >
                      <div class="report-card-route-mark" />
                      <div>
                        <strong>{{ item.title }}</strong>
                        <span>{{ item.subtitle }}</span>
                      </div>
                    </div>
                  </div>
                </template>
              </div>

              <div v-if="!isCardUnlocked(card.id)" class="report-unlock-mask">
                <button type="button" class="report-unlock-lock" @click.stop="openUnlockModal(card.id)">
                  <span class="report-unlock-lock-glyph" aria-hidden="true">
                    <span class="report-unlock-lock-ring" />
                    <span class="report-unlock-lock-body" />
                  </span>
                  <strong>{{ card.lockTitle }}</strong>
                  <span>{{ card.lockCopy }}</span>
                </button>
              </div>

              <p v-if="card.id !== 'personality'" class="report-unlock-card-note">
                {{
                  isCardUnlocked(card.id)
                    ? "已解锁，点击卡片查看详情、分享或导出。"
                    : card.footer
                }}
              </p>

              <div v-if="isCardUnlocked(card.id) && card.id !== 'personality'" class="report-card-unlocked-badge">
                <span>✓</span>
                已解锁
              </div>
              </article>
            </div>
          </section>
        </div>

        <Teleport to="body">
          <transition name="report-fade">
            <div v-if="activeUnlockCard" class="report-modal-overlay" @click.self="closeUnlockModal">
              <div class="report-unlock-modal">
                <div class="report-modal-head">
                  <div>
                    <h3 class="serif report-modal-title">解锁完整报告</h3>
                    <p class="report-modal-copy">
                      选择以下方式之一解锁「{{ activeUnlockCard.title }}」，解锁后将永久保存，并可随时查看详细报告。
                    </p>
                  </div>
                  <button type="button" class="report-modal-close" @click="closeUnlockModal">×</button>
                </div>

                <div class="report-unlock-option-list">
                  <button
                    type="button"
                    class="report-unlock-option is-share"
                    :disabled="unlockingMethod !== null"
                    @click="handleUnlockByShare"
                  >
                    <div class="report-unlock-option-icon">↗</div>
                    <div class="report-unlock-option-copy">
                      <strong>分享解锁</strong>
                      <span>分享到赛博广场，生成一条图文动态后即可免费解锁</span>
                      <small>会同步发布当前卡片的蒸馏摘要</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    class="report-unlock-option is-pay"
                    :disabled="unlockingMethod !== null"
                    @click="handleUnlockByPay"
                  >
                    <div class="report-unlock-option-icon">¥</div>
                    <div class="report-unlock-option-copy">
                      <strong>{{ unlockingMethod === 'pay' ? "处理中..." : "支付解锁" }}</strong>
                      <span>一次性解锁，永久查看完整内容</span>
                      <small>安全支付 · 数据加密存储 · 隐私保护</small>
                    </div>
                    <span class="report-unlock-option-badge">推荐</span>
                  </button>
                </div>
              </div>
            </div>
          </transition>
        </Teleport>

        <Teleport to="body">
          <transition name="report-slide">
            <div v-if="activeDetailCard" class="report-detail-overlay" @click.self="closeDetailModal">
              <div class="report-detail-shell" :class="{ 'is-personality': activeDetailCard.id === 'personality' }">
                <div class="report-detail-topbar" :class="{ 'is-personality': activeDetailCard.id === 'personality' }">
                  <button type="button" class="report-detail-back-btn" aria-label="返回" @click="closeDetailModal">
                    <span class="material-symbols-rounded">arrow_back</span>
                  </button>

                  <div class="report-detail-topbar-copy" :class="{ 'is-personality': activeDetailCard.id === 'personality' }">
                    <p class="report-detail-kicker">{{ activeDetailCard.title }}</p>
                    <h3 class="serif report-detail-title">{{ activeDetailCard.detailTitle }}</h3>
                  </div>

                  <div class="report-detail-menu-wrap" ref="detailMenuRef">
                    <button
                      type="button"
                      class="report-detail-menu-trigger"
                      aria-label="更多操作"
                      @click.stop="toggleDetailActionMenu"
                    >
                      <span class="material-symbols-rounded">more_horiz</span>
                    </button>

                    <div v-if="detailActionMenuOpen" class="report-detail-menu-pop" @click.stop>
                      <button
                        type="button"
                        class="report-detail-menu-item"
                        :disabled="sharingDetail"
                        @click="handleShareDetailReport"
                      >
                        {{ sharingDetail ? "分享中..." : "分享" }}
                      </button>
                      <button
                        type="button"
                        class="report-detail-menu-item"
                        :disabled="downloadingDetailImage"
                        @click="handleDownloadDetailImage"
                      >
                        {{ downloadingDetailImage ? "生成中..." : "下载长图" }}
                      </button>
                      <button
                        type="button"
                        class="report-detail-menu-item"
                        :disabled="printingDetailPdf"
                        @click="handleExportDetailPdf"
                      >
                        {{ printingDetailPdf ? "准备中..." : "导出 PDF" }}
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  ref="detailReportRef"
                  class="report-detail-content"
                  :class="{ 'is-personality': activeDetailCard.id === 'personality' }"
                >
                  <template v-if="activeDetailCard.id === 'personality'">
                    <section class="report-detail-section report-detail-cover report-detail-cover--personality">
                      <div class="report-detail-cover-frame">
                        <div class="report-detail-cover-heading">
                          <p class="report-detail-cover-kicker">{{ personalityReportCardTitle }}</p>
                          <h4 class="serif report-detail-cover-code">{{ personalityTemplateCode }}</h4>
                        </div>

                        <div class="report-detail-cover-poster" :style="personalityCardTheme">
                          <img
                            :src="personalityPortraitImage"
                            :alt="`${personalityCardCode} ${personalityCardTitle}`"
                            class="report-detail-cover-image"
                            :class="{ 'is-template-background': personalityUsesTemplateBackground }"
                            @error="handlePersonalityPortraitError"
                          />
                          <div class="report-detail-cover-image-mask" />
                          <span class="report-detail-cover-badge">{{ personalityTemplateLabel }}</span>
                        </div>

                        <div class="report-detail-cover-copy">
                          <h5 class="serif report-detail-cover-title">{{ personalityCardTitle }}</h5>
                          <p class="report-detail-cover-quote">“{{ personalityDetailLead }}”</p>
                          <div v-if="selectedIncarnationCard" class="report-detail-mode-line">
                            <span>{{ selectedIncarnationCard.title }}</span>
                            <strong>{{ selectedIncarnationCard.codename }}</strong>
                          </div>
                        </div>

                        <div class="report-detail-cover-meta-row">
                          <span>FOR: {{ personalityReportForLabel }}</span>
                          <span>DATE: {{ personalityReportDate }}</span>
                        </div>

                        <div class="report-detail-cover-footer">
                          <div class="report-detail-cover-codeblock">
                            <strong>{{ personalityReportCodeLine }}</strong>
                            <span>PERSONALITY ASSESSMENT</span>
                            <span>VALID FOR ONE LIFE</span>
                          </div>

                          <div class="report-detail-cover-scan">
                            <div class="report-detail-barcode" aria-hidden="true">
                              <span
                                v-for="(bar, index) in personalityBarcodeBars"
                                :key="`barcode-${index}-${bar}`"
                                class="report-detail-barcode-bar"
                                :style="{ height: `${bar}%` }"
                              />
                            </div>
                            <span>SCAN TO TEST</span>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section class="report-detail-section report-detail-personality-brief">
                      <div class="report-detail-section-head">
                        <h4 class="report-detail-section-title">报告解读</h4>
                        <span>{{ personalityTemplateArchetype }}</span>
                      </div>

                      <div class="report-detail-personality-brief-copy">
                        <p class="report-detail-personality-paragraph">{{ personalityDetailBody }}</p>
                        <p class="report-detail-personality-paragraph">{{ personalityDetailLens }}</p>
                      </div>

                      <div v-if="personalityDetailQuestions.length" class="report-detail-personality-question-list">
                        <article
                          v-for="(question, index) in personalityDetailQuestions"
                          :key="`${personalityCardCode}-${index}`"
                          class="report-detail-personality-question"
                        >
                          <span>{{ index + 1 }}</span>
                          <p>{{ question }}</p>
                        </article>
                      </div>
                    </section>

                    <section class="report-detail-section">
                      <div class="report-detail-section-head">
                        <h4 class="report-detail-section-title">人格维度</h4>
                        <span>{{ rarityLine }}</span>
                      </div>

                      <div class="report-detail-stat-list">
                        <div v-for="metric in dimensionBars" :key="metric.label" class="report-detail-stat-row">
                          <div class="report-detail-stat-head">
                            <span>{{ metric.label }}</span>
                            <strong>{{ metric.percent }}</strong>
                          </div>
                          <div class="report-detail-stat-bar">
                            <div class="report-detail-stat-fill" :style="{ width: metric.percent }" />
                          </div>
                        </div>
                      </div>
                    </section>

                    <section class="report-detail-section">
                      <div class="report-detail-section-head">
                        <h4 class="report-detail-section-title">核心描述</h4>
                        <span>{{ reportType }}</span>
                      </div>
                      <div class="report-detail-copy-grid">
                        <article class="report-detail-copy-card">
                          <strong>人格判断</strong>
                          <p>{{ heroSummary }}</p>
                        </article>
                        <article class="report-detail-copy-card">
                          <strong>模式标签</strong>
                          <p>{{ selectedIncarnationCard ? selectedIncarnationCard.summary : personalityCardAssociationSummary }}</p>
                        </article>
                        <article v-if="selectedIncarnationCard" class="report-detail-copy-card">
                          <strong>适用方向</strong>
                          <p>{{ selectedIncarnationCard.recommended_for }}</p>
                        </article>
                      </div>
                    </section>

                    <section class="report-detail-section">
                      <div class="report-detail-section-head">
                        <h4 class="report-detail-section-title">适合场景</h4>
                        <span>{{ suitableUseCases.length }} 条</span>
                      </div>
                      <div class="report-detail-bullet-list">
                        <article
                          v-for="(item, index) in suitableUseCases"
                          :key="item.title + item.copy"
                          class="report-detail-bullet-card"
                        >
                          <span>{{ index + 1 }}</span>
                          <p>{{ item.copy }}</p>
                        </article>
                      </div>
                    </section>
                  </template>

                  <template v-else-if="activeDetailCard.id === 'cognition'">
                    <section class="report-detail-section report-detail-hero report-detail-hero--cognition">
                      <div class="report-detail-radar-hero">
                        <svg viewBox="0 0 200 200" class="report-detail-radar">
                          <polygon
                            v-for="scale in [1, 0.76, 0.52, 0.28]"
                            :key="`detail-grid-${scale}`"
                            :points="polygonPoints(scale)"
                            class="report-card-radar-grid"
                          />
                          <line
                            v-for="(metric, index) in radarMetrics.slice(0, 5)"
                            :key="`detail-axis-${metric.label}`"
                            x1="100"
                            y1="100"
                            :x2="axisPoint(index).x"
                            :y2="axisPoint(index).y"
                            class="report-card-radar-axis"
                          />
                          <polygon :points="radarValuePoints" class="report-card-radar-value" />
                          <circle
                            v-for="(metric, index) in radarMetrics.slice(0, 5)"
                            :key="`detail-dot-${metric.label}`"
                            :cx="valuePoint(index).x"
                            :cy="valuePoint(index).y"
                            r="5"
                            class="report-card-radar-dot"
                          />
                        </svg>
                      </div>

                      <div class="report-detail-cognition-copy">
                        <p class="report-detail-chip">Five-layer Distill</p>
                        <h4 class="serif report-detail-display">认知五层蒸馏报告</h4>
                        <p class="report-detail-quote">{{ reportMotto }}</p>
                      </div>
                    </section>

                    <section class="report-detail-section">
                      <div class="report-detail-section-head">
                        <h4 class="report-detail-section-title">五层结构</h4>
                        <span>{{ fiveLayerStructure.length }} 层</span>
                      </div>

                      <div class="report-detail-tab-row">
                        <button
                          v-for="layer in fiveLayerStructure"
                          :key="layer.key"
                          type="button"
                          class="report-detail-tab"
                          :class="{ 'is-active': activeLayer?.key === layer.key }"
                          @click="activeLayerKey = layer.key"
                        >
                          <span>{{ layer.step }}</span>
                          <strong>{{ layer.title }}</strong>
                        </button>
                      </div>

                      <article v-if="activeLayer" class="report-detail-layer-focus" :class="`tone-${activeLayer.tone}`">
                        <div class="report-detail-layer-top">
                          <div class="report-detail-layer-step">{{ activeLayer.step }}</div>
                          <div>
                            <p class="report-detail-chip">{{ activeLayer.kicker }}</p>
                            <h5>{{ activeLayer.title }}</h5>
                          </div>
                        </div>
                        <p class="report-detail-layer-summary">{{ activeLayer.summary }}</p>
                        <div class="report-detail-pill-wrap">
                          <span
                            v-for="item in activeLayer.items"
                            :key="`${activeLayer.key}-${item}`"
                            class="report-detail-pill"
                          >
                            {{ item }}
                          </span>
                        </div>
                      </article>

                      <div class="report-detail-layer-stack">
                        <article v-for="layer in fiveLayerStructure" :key="`${layer.key}-stack`" class="report-detail-layer-card">
                          <div class="report-detail-layer-mini-head">
                            <span>{{ layer.step }}</span>
                            <strong>{{ layer.title }}</strong>
                          </div>
                          <p>{{ layer.summary }}</p>
                        </article>
                      </div>
                    </section>
                  </template>

                  <template v-else>
                    <section class="report-detail-section report-detail-hero report-detail-hero--behavior">
                      <div class="report-detail-behavior-lead">
                        <p class="report-detail-chip">Decision Playbook</p>
                        <h4 class="serif report-detail-display">行为决策建议报告</h4>
                        <p class="report-detail-quote">{{ behaviorPrimaryHeadline }}</p>
                      </div>
                      <div class="report-detail-meta-card">
                        <p class="report-detail-meta-label">优先路径</p>
                        <h4>{{ recommendedActionRoutes[0]?.title || "行动建议已生成" }}</h4>
                        <p>{{ recommendedActionRoutes[0]?.reason || adviceCards[0]?.copy || reportMotto }}</p>
                      </div>
                    </section>

                    <section class="report-detail-section">
                      <div class="report-detail-section-head">
                        <h4 class="report-detail-section-title">当前最该做的动作</h4>
                        <span>{{ adviceCards.length }} 条</span>
                      </div>
                      <div class="report-detail-copy-grid">
                        <article
                          v-for="item in adviceCards.slice(0, 4)"
                          :key="item.title + item.copy"
                          class="report-detail-copy-card"
                        >
                          <strong>{{ item.title }}</strong>
                          <p>{{ item.copy }}</p>
                        </article>
                      </div>
                    </section>

                    <section v-if="recommendedActionRoutes.length" class="report-detail-section">
                      <div class="report-detail-section-head">
                        <h4 class="report-detail-section-title">推荐完善画像的 skill</h4>
                        <span>{{ recommendedActionRoutes.length }} 个</span>
                      </div>
                      <div class="report-detail-route-grid">
                        <article
                          v-for="item in recommendedActionRoutes"
                          :key="item.key"
                          class="report-detail-route-card"
                          :class="{ 'is-selected': item.selected }"
                        >
                          <div class="report-detail-route-head">
                            <div class="report-detail-route-avatar">{{ item.avatar }}</div>
                            <div>
                              <strong>{{ item.title }}</strong>
                              <p>{{ item.description }}</p>
                            </div>
                          </div>
                          <p class="report-detail-route-reason">{{ item.reason }}</p>
                          <button
                            type="button"
                            class="report-detail-route-action"
                            :disabled="!item.expertId || selectingExpertId === item.expertId"
                            @click="handleOpenRecommendedRoute(item)"
                          >
                            {{
                              item.selected
                                ? "当前已加载"
                                : selectingExpertId === item.expertId
                                  ? "加载中..."
                                  : "加载去聊"
                            }}
                          </button>
                        </article>
                      </div>
                    </section>

                    <section v-if="!isToolPackProject && personalitySkillCards.length" class="report-detail-section">
                      <div class="report-detail-section-head">
                        <h4 class="report-detail-section-title">推荐搭配 skill</h4>
                        <span>{{ personalitySkillCards.length }} 个</span>
                      </div>
                      <div class="report-detail-copy-grid">
                        <article
                          v-for="card in personalitySkillCards.slice(0, 3)"
                          :key="`pairing-${card.skill_id}`"
                          class="report-detail-copy-card"
                        >
                          <strong>{{ card.title }}</strong>
                          <p>{{ card.subtitle }}</p>
                        </article>
                      </div>
                    </section>
                  </template>

                  <section class="report-detail-section">
                    <div class="report-detail-section-head">
                      <h4 class="report-detail-section-title">资料来源</h4>
                      <span>{{ materialRows.length }} 条</span>
                    </div>
                    <div class="report-detail-source-list">
                      <article
                        v-for="item in materialRows.slice(0, 6)"
                        :key="item.title + item.meta"
                        class="report-detail-source-item"
                      >
                        <div class="report-detail-source-icon">{{ item.icon }}</div>
                        <div>
                          <strong>{{ item.title }}</strong>
                          <p>{{ item.meta }}</p>
                        </div>
                      </article>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </transition>
        </Teleport>
      </template>

      <transition name="report-fade">
        <div v-if="cardActionMessage" class="report-toast">
          {{ cardActionMessage }}
        </div>
      </transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import QRCode from "qrcode"

import { api } from "@/lib/api"
import type {
  ActionRoutePayload,
  DistillReport,
  ExpertCandidate,
  ExpertCandidateListResponse,
  ExpertSelectionResponse,
  FriendQrResponse,
  IncarnationCardPayload,
  MaterialSummary,
  PersonalitySkillCardPayload,
  PrivateReportPayload,
  ProjectDetailResponse,
  PublicCardDimensionScore,
  PublicCardPayload,
  ResultBundleResponse,
} from "@/types"
import { findSbtiRebirthCard, sbtiCardAccentStyle, sbtiPortraitUrl, sbtiRebirthBackgroundUrl } from "@/v2/data/sbtiRebirthCatalog"

type UnlockableReportId = "personality" | "cognition" | "behavior"

interface ReportStructureLayer {
  key: string
  step: string
  kicker: string
  title: string
  summary: string
  items: string[]
  tone: "amber" | "cyan" | "violet" | "rose" | "slate"
}

interface RecommendedActionSkillCard {
  key: string
  expertId: string
  title: string
  description: string
  reason: string
  badge: string
  avatar: string
  selected: boolean
}

interface ReportCardDescriptor {
  id: UnlockableReportId
  index: string
  title: string
  detailTitle: string
  accent: "emerald" | "amber" | "violet"
  lockTitle: string
  lockCopy: string
  footer: string
}

const REPORT_CARD_IDS: UnlockableReportId[] = ["personality", "cognition", "behavior"]

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const errorMessage = ref("")
const project = ref<ProjectDetailResponse["project"] | null>(null)
const projectMaterials = ref<MaterialSummary[]>([])
const report = ref<DistillReport | null>(null)
const resultBundle = ref<ResultBundleResponse | null>(null)
const expertCandidates = ref<ExpertCandidate[]>([])
const selectedExpertId = ref("")
const selectingExpertId = ref("")
const activeLayerKey = ref("voice")

const unlockedCardIds = ref<UnlockableReportId[]>([])
const activeUnlockCardId = ref<UnlockableReportId | null>(null)
const activeDetailCardId = ref<UnlockableReportId | null>(null)
const unlockingMethod = ref<"share" | "pay" | null>(null)
const sharingDetail = ref(false)
const downloadingDetailImage = ref(false)
const printingDetailPdf = ref(false)
const detailActionMenuOpen = ref(false)
const cardActionMessage = ref("")
const detailReportRef = ref<HTMLElement | null>(null)
const detailMenuRef = ref<HTMLElement | null>(null)
const personalityPortraitIndex = ref(0)
const signatureQrCanvasRef = ref<HTMLCanvasElement | HTMLCanvasElement[] | null>(null)
const signatureFriendQr = ref<FriendQrResponse | null>(null)
const signatureQrLoading = ref(false)
let cardActionTimer: number | null = null

const reportHeaderTitle = computed(() => project.value?.subject_name || report.value?.subject_name || "蒸馏报告")
const reportHeaderSubtitle = computed(() => {
  const mode = selectedIncarnationCard.value?.title || "人物 Skill 画像"
  return `${mode} · 手机端报告视图`
})

async function goBackToDistill() {
  if (!project.value) {
    await router.push("/projects")
    return
  }
  await router.push({
    name: "projects-cyber",
    query: {
      projectId: project.value.project_id,
      ...(project.value.intake_profile?.output_mode ? { output: project.value.intake_profile.output_mode } : {}),
      ...(project.value.intake_profile?.civilization_level ? { civ: project.value.intake_profile.civilization_level } : {}),
    },
  })
}

async function goToMessages() {
  await router.push("/messages")
}

const isToolPackProject = computed(() => project.value?.factory_category === "tool_agent")

function normalizeReportText(value: string | undefined | null) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function cleanExpertRouteTitle(value: string | undefined | null) {
  return normalizeReportText(value).replace(/^(继续问|可继续问|继续向|可继续向)/, "").trim()
}

function actionRouteAvatarLabel(title: string, candidate?: ExpertCandidate | null) {
  const source = cleanExpertRouteTitle(candidate?.name || title) || "荐"
  return source.slice(0, 1).toUpperCase()
}

function compactReportItems(items: Array<string | undefined | null>, limit = 4, used = new Set<string>()) {
  const output: string[] = []
  for (const raw of items) {
    const item = normalizeReportText(raw)
    const key = item.toLowerCase()
    if (!item || used.has(key)) continue
    used.add(key)
    output.push(item)
    if (output.length >= limit) break
  }
  return output
}

const publicCard = computed<PublicCardPayload>(() => {
  if (resultBundle.value?.public_card) return resultBundle.value.public_card
  return {
    archetype_code: "",
    archetype_label: "",
    archetype_alias: "",
    headline: report.value?.memory.summary || "",
    summary: report.value?.memory.summary || "",
    image_hint: "",
    dimension_scores: [],
    card_system: "",
    subject_label: report.value?.subject_name || "",
    subject_role: "subject",
    persona_code: "",
    persona_slug: "",
    persona_name: report.value?.subject_name || "",
    persona_title: report.value?.persona.tone || "",
    opening_line: "",
    hero_summary: report.value?.memory.summary || "",
    bridge_description: report.value?.cognition.worldview || "",
    sbti_lens: "",
    mbti_mirrors: [],
    mbti_highlights: [],
    collision_notes: [],
    soul_questions: [],
    rarity_label: "",
    rarity_percent: "",
    style_theme: "",
    dimension_pattern: "",
    image_url: "",
  }
})

const privateReport = computed<PrivateReportPayload>(() => {
  if (resultBundle.value?.private_report) return resultBundle.value.private_report
  return {
    current_stage: report.value?.memory.summary || "",
    core_patterns: report.value?.persona.emotional_patterns || [],
    relation_style: report.value?.persona.interaction_preferences || [],
    decision_style: report.value?.cognition.decision_heuristics || [],
    risk_points: report.value?.cognition.anti_patterns || [],
    adjustment_suggestions: report.value?.cognition.suggested_use_cases || [],
  }
})

const heroSummary = computed(() => publicCard.value.hero_summary || publicCard.value.summary || report.value?.memory.summary || "")
const personaCodeDisplay = computed(() => publicCard.value.persona_code || publicCard.value.archetype_alias || "SBTI")
const personaTitle = computed(() => publicCard.value.persona_title || publicCard.value.archetype_label || "人格画像")

function formatReportStamp(value?: string | null) {
  const source = value ? new Date(value) : new Date()
  if (Number.isNaN(source.getTime())) {
    const fallback = new Date()
    return `${fallback.getFullYear()}.${String(fallback.getMonth() + 1).padStart(2, "0")}.${String(fallback.getDate()).padStart(2, "0")}`
  }
  return `${source.getFullYear()}.${String(source.getMonth() + 1).padStart(2, "0")}.${String(source.getDate()).padStart(2, "0")}`
}

function buildBarcodeBars(seed: string, count = 20) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Array.from({ length: count }, (_, index) => {
    hash ^= index + 17
    hash = Math.imul(hash, 16777619)
    return 34 + ((hash >>> 0) % 58)
  })
}

function signatureSeedHash(seed: string) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function signatureNoise(seed: number, index: number, range: number) {
  const value = Math.sin((seed + index * 97) * 0.013) * 10000
  return (value - Math.floor(value) - 0.5) * range
}

function buildSignatureTopLine(seedText: string) {
  const seed = signatureSeedHash(seedText)
  return [
    `M ${(8 + signatureNoise(seed, 2, 5)).toFixed(1)} ${(36 + signatureNoise(seed, 3, 5)).toFixed(1)}`,
    `C ${(78 + signatureNoise(seed, 4, 10)).toFixed(1)} ${(17 + signatureNoise(seed, 5, 6)).toFixed(1)}, ${(190 + signatureNoise(seed, 6, 12)).toFixed(1)} ${(24 + signatureNoise(seed, 7, 6)).toFixed(1)}, ${(306 + signatureNoise(seed, 8, 8)).toFixed(1)} ${(30 + signatureNoise(seed, 9, 5)).toFixed(1)}`,
  ].join(" ")
}

function buildSignatureAccentStrokes(seedText: string) {
  const seed = signatureSeedHash(seedText)
  return [
    `M ${(18 + signatureNoise(seed, 51, 7)).toFixed(1)} ${(62 + signatureNoise(seed, 52, 5)).toFixed(1)} C ${(70 + signatureNoise(seed, 53, 10)).toFixed(1)} ${(77 + signatureNoise(seed, 54, 5)).toFixed(1)}, ${(168 + signatureNoise(seed, 55, 12)).toFixed(1)} ${(63 + signatureNoise(seed, 56, 5)).toFixed(1)}, ${(250 + signatureNoise(seed, 57, 10)).toFixed(1)} ${(60 + signatureNoise(seed, 58, 5)).toFixed(1)} C ${(276 + signatureNoise(seed, 59, 8)).toFixed(1)} ${(58 + signatureNoise(seed, 60, 5)).toFixed(1)}, ${(300 + signatureNoise(seed, 61, 8)).toFixed(1)} ${(50 + signatureNoise(seed, 62, 5)).toFixed(1)}, 314 ${(42 + signatureNoise(seed, 63, 5)).toFixed(1)}`,
  ]
}

const semanticSbtiCard = computed(() => {
  const candidates = [
    publicCard.value.persona_code,
    publicCard.value.persona_slug,
    publicCard.value.archetype_code,
    publicCard.value.archetype_alias,
  ]

  for (const candidate of candidates) {
    const card = findSbtiRebirthCard(candidate)
    if (card) return card
  }

  return null
})
const personalityTemplateBackgroundImage = computed(() => {
  if (!semanticSbtiCard.value) return ""
  const seed = [project.value?.project_id, publicCard.value.persona_code, semanticSbtiCard.value.code].filter(Boolean).join("|")
  return sbtiRebirthBackgroundUrl(semanticSbtiCard.value, seed)
})
const personalityPortraitCandidates = computed(() => {
  const candidates = [
    personalityTemplateBackgroundImage.value,
    semanticSbtiCard.value ? sbtiPortraitUrl(semanticSbtiCard.value) : "",
    publicCard.value.image_url,
    "/images/rebirth-portrait-base.png",
  ]

  return candidates.filter((item, index, source) => Boolean(item) && source.indexOf(item) === index)
})
const personalityPortraitImage = computed(() =>
  personalityPortraitCandidates.value[Math.min(personalityPortraitIndex.value, personalityPortraitCandidates.value.length - 1)]
  || "/images/rebirth-portrait-base.png"
)
const personalityUsesTemplateBackground = computed(() =>
  Boolean(personalityTemplateBackgroundImage.value && personalityPortraitImage.value === personalityTemplateBackgroundImage.value)
)
const personalityCardTheme = computed(() => {
  if (semanticSbtiCard.value) {
    return {
      ...sbtiCardAccentStyle(semanticSbtiCard.value),
      "--report-template-accent": semanticSbtiCard.value.palette.accent,
    }
  }
  return {
    "--rebirth-canvas": "#e8eef8",
    "--rebirth-glow": "#d8d3ff",
    "--rebirth-mist": "rgba(255,255,255,0.72)",
    "--rebirth-line": "rgba(255,255,255,0.9)",
    "--rebirth-ink": "#16131f",
    "--rebirth-accent": "#8f6cdf",
    "--rebirth-chip": "#d7d3ff",
    "--rebirth-chip-ink": "#2d2158",
    "--portrait-scale": "1",
    "--portrait-shift-x": "0px",
    "--portrait-shift-y": "0px",
    "--portrait-flip": "1",
    "--report-template-accent": "#8f6cdf",
  }
})
const personalityCardCode = computed(() => semanticSbtiCard.value?.code || publicCard.value.persona_code || personaCodeDisplay.value)
const personalityCardLabel = computed(() => semanticSbtiCard.value?.label || publicCard.value.persona_name || personaTitle.value)
const personalityCardTitle = computed(() => semanticSbtiCard.value?.cardTitle || publicCard.value.persona_title || personaTitle.value)
const personalityCardSummary = computed(() =>
  semanticSbtiCard.value?.bodyCopy || semanticSbtiCard.value?.heroSummary || publicCard.value.bridge_description || heroSummary.value
)
const personalityTemplateCode = computed(() => semanticSbtiCard.value?.cardCode || personalityCardCode.value)
const personalityTemplateLabel = computed(() => semanticSbtiCard.value?.topTitle || personalityCardLabel.value)
const personalityTemplateTitle = computed(() => semanticSbtiCard.value?.bottomTitle || personalityCardTitle.value)
const personalityTemplateBody = computed(() => semanticSbtiCard.value?.bodyCopy || personalityCardSummary.value)
const personalityTemplateBodyDisplay = computed(() => {
  let text = normalizeReportText(personalityTemplateBody.value)
  const removablePrefixes = [
    personalityTemplateCode.value,
    personalityCardCode.value,
    personalityTemplateLabel.value,
    personalityCardLabel.value,
  ].filter(Boolean)
  for (const prefix of removablePrefixes) {
    text = text.replace(new RegExp(`^${escapeRegExp(prefix)}[\\s,，、:：-]*`, "i"), "")
  }
  return text || personalityTemplateBody.value
})
const personalityTemplateMirror = computed(() =>
  semanticSbtiCard.value?.footerLeft || semanticSbtiCard.value?.mbtiMirrors[0] || publicCard.value.mbti_mirrors[0] || publicCard.value.rarity_label || "SBTI"
)
const personalityTemplateArchetype = computed(() => semanticSbtiCard.value?.footerRight || publicCard.value.rarity_label || "人物卡")
const personalityCardHeaderLine = computed(() =>
  [
    [personalityTemplateCode.value, personalityTemplateLabel.value].filter(Boolean).join(" · "),
    [personalityTemplateMirror.value, personalityTemplateArchetype.value].filter(Boolean).join(" · "),
  ].filter(Boolean).join(" ｜ ")
)
const personalitySignatureLine = computed(() =>
  `复制人 · ${project.value?.subject_name || report.value?.subject_name || project.value?.name || "未命名分身"}`
)
const personalitySignatureGlyphLine = computed(() => personalitySignatureLine.value.replace(/\s+/g, ""))
const personalitySignatureTopLine = computed(() => buildSignatureTopLine(personalitySignatureLine.value))
const personalitySignatureAccentStrokes = computed(() => buildSignatureAccentStrokes(personalitySignatureLine.value))
const personalityReportCardTitle = computed(() => `${reportHeaderTitle.value} 的画像报告`)
const personalityReportCardSubtitle = computed(() =>
  [
    personalityTemplateCode.value,
    personalityTemplateLabel.value,
    selectedIncarnationCard.value?.title,
  ].filter(Boolean).join(" / ")
)
const personalityCardAssociationSummary = computed(() => {
  if (semanticSbtiCard.value) {
    return `${publicCard.value.persona_name || personaTitle.value} 当前直接使用模板图库里的 27 型角色卡 ${semanticSbtiCard.value.code}「${semanticSbtiCard.value.label} · ${semanticSbtiCard.value.cardTitle}」，人物主视觉、卡面排版和详情页说明全部跟这张卡同步。`
  }
  return `${publicCard.value.persona_name || personaTitle.value} 这次没有命中本地 27 型角色卡，所以只保留主卡框架和本地占位图，不再退回旧 MBTI 模板或外部头像来源。`
})
const personalityDetailLead = computed(() =>
  semanticSbtiCard.value?.openingLine || publicCard.value.opening_line || heroSummary.value
)
const personalityDetailBody = computed(() =>
  semanticSbtiCard.value?.description || heroSummary.value || report.value?.memory.summary || ""
)
const personalityDetailLens = computed(() =>
  semanticSbtiCard.value?.sbtiLens || publicCard.value.bridge_description || report.value?.cognition.worldview || ""
)
const personalityDetailQuestions = computed(() =>
  (semanticSbtiCard.value?.soulQuestions?.length ? semanticSbtiCard.value.soulQuestions : publicCard.value.soul_questions).slice(0, 3)
)
const personalityReportForLabel = computed(() =>
  String(project.value?.name || publicCard.value.subject_label || report.value?.subject_name || "rambox").toUpperCase()
)
const personalityReportDate = computed(() => formatReportStamp(resultBundle.value?.generated_at || report.value?.generated_at))
const personalityReportCodeLine = computed(() => {
  const confidenceLine = `C${Math.round((report.value?.confidence.overall_score || 0) * 100)}`
  return [publicCard.value.persona_code || personalityCardCode.value, personalityTemplateCode.value, confidenceLine]
    .filter(Boolean)
    .join(" / ")
})
const personalityBarcodeBars = computed(() =>
  buildBarcodeBars([publicCard.value.persona_code, personalityCardCode.value, project.value?.project_id].filter(Boolean).join("|"))
)

watch(
  () => personalityPortraitCandidates.value.join("|"),
  () => {
    personalityPortraitIndex.value = 0
  },
  { immediate: true },
)

watch(
  () => [loading.value, project.value?.project_id, signatureFriendQr.value?.qr_text] as const,
  async () => {
    if (loading.value || !project.value) return
    if (!signatureFriendQr.value) {
      await loadSignatureQr()
      return
    }
    await renderSignatureQr()
  },
  { flush: "post" },
)

function handlePersonalityPortraitError() {
  if (personalityPortraitIndex.value < personalityPortraitCandidates.value.length - 1) {
    personalityPortraitIndex.value += 1
  }
}

async function loadSignatureQr() {
  if (signatureQrLoading.value || signatureFriendQr.value) {
    await renderSignatureQr()
    return
  }
  signatureQrLoading.value = true
  try {
    const { data } = await api.get<FriendQrResponse>("/friends/qr")
    signatureFriendQr.value = data
    await renderSignatureQr()
  } catch {
    signatureFriendQr.value = null
  } finally {
    signatureQrLoading.value = false
  }
}

async function renderSignatureQr() {
  await nextTick()
  const rawCanvas = signatureQrCanvasRef.value
  const canvas = Array.isArray(rawCanvas) ? rawCanvas.find((item) => item instanceof HTMLCanvasElement) || null : rawCanvas
  const qrText = signatureFriendQr.value?.qr_text
  if (!(canvas instanceof HTMLCanvasElement) || !qrText) return
  try {
    await QRCode.toCanvas(canvas, qrText, {
      width: 48,
      margin: 1,
      color: {
        dark: "#111318",
        light: "#fffffff2",
      },
    })
    canvas.style.width = "2.12rem"
    canvas.style.height = "2.12rem"
  } catch {
    // QR is a visual affordance; the report card should still render if canvas generation fails.
  }
}

const rarityLine = computed(() => {
  const parts = [publicCard.value.rarity_label, publicCard.value.rarity_percent].filter(Boolean)
  return parts.join(" · ") || "当前人格落点"
})

const radarMetrics = computed<PublicCardDimensionScore[]>(() => {
  if (resultBundle.value?.public_card.dimension_scores.length) {
    return resultBundle.value.public_card.dimension_scores.slice(0, 5)
  }

  const confidence = report.value?.confidence.overall_score || 0.5
  const source = Math.min(1, (report.value?.source_coverage.total_materials || 1) / 5)
  const memory = Math.min(1, (report.value?.memory.key_events.length || 1) / 6)
  const persona = Math.min(1, (report.value?.persona.interaction_preferences.length || 1) / 6)
  const cognition = Math.min(1, (report.value?.cognition.decision_heuristics.length || 1) / 6)
  return [
    { axis: "CONF", label: "可信度", score: confidence },
    { axis: "EVID", label: "证据覆盖", score: source },
    { axis: "MEM", label: "记忆层", score: memory },
    { axis: "PERS", label: "人格层", score: persona },
    { axis: "COG", label: "认知层", score: cognition },
  ]
})

const dimensionBars = computed(() =>
  radarMetrics.value.slice(0, 4).map((metric) => ({
    label: metric.label,
    percent: `${Math.round(metric.score * 100)}%`,
  }))
)

const reportType = computed(() => `${project.value?.factory_category_label || "现实建议型"} · 人物画像报告`)
const reportMotto = computed(() => publicCard.value.bridge_description || heroSummary.value || report.value?.cognition.worldview || "")

const fiveLayerStructure = computed<ReportStructureLayer[]>(() => {
  if (!report.value) return []

  const used = new Set<string>()
  const voiceSummary = normalizeReportText(report.value.persona.tone) || "这部分还需要更多材料来稳定还原。"
  used.add(voiceSummary.toLowerCase())

  const voiceItems = compactReportItems([
    ...report.value.persona.catchphrases,
    ...report.value.persona.interaction_preferences,
    ...report.value.persona.emotional_patterns,
  ], 4, used)

  const thinkSummary = normalizeReportText(report.value.cognition.worldview) || "当前还没有足够证据收束成稳定 worldview。"
  used.add(thinkSummary.toLowerCase())

  const thinkItems = compactReportItems([
    ...report.value.memory.recurring_topics,
    ...report.value.memory.relation_facts,
    ...publicCard.value.soul_questions,
  ], 4, used)

  const judgeSummary = normalizeReportText(report.value.cognition.decision_heuristics[0]) || "暂时还没蒸出清晰的判断准绳。"
  used.add(judgeSummary.toLowerCase())

  const judgeItems = compactReportItems([
    ...report.value.cognition.decision_heuristics.slice(1),
    ...privateReport.value.decision_style,
    ...report.value.cognition.suggested_use_cases,
  ], 4, used)

  const boundarySummary = normalizeReportText(report.value.persona.boundaries[0] || report.value.cognition.anti_patterns[0]) || "边界感还不够稳定，需要更多反例材料补齐。"
  used.add(boundarySummary.toLowerCase())

  const boundaryItems = compactReportItems([
    ...report.value.persona.boundaries.slice(1),
    ...report.value.cognition.anti_patterns,
    ...privateReport.value.risk_points,
  ], 4, used)

  const honestSummary = normalizeReportText(report.value.honest_limits[0] || report.value.confidence.notes[0]) || "当前结论建立在有限材料之上，后续还需要持续校准。"
  used.add(honestSummary.toLowerCase())

  const honestItems = compactReportItems([
    ...report.value.honest_limits.slice(1),
    ...report.value.confidence.notes,
    ...publicCard.value.collision_notes,
  ], 4, used)

  return [
    {
      key: "voice",
      step: "01",
      kicker: "表达层",
      title: "怎么说话",
      summary: voiceSummary,
      items: voiceItems,
      tone: "amber",
    },
    {
      key: "thinking",
      step: "02",
      kicker: "认知层",
      title: "怎么想",
      summary: thinkSummary,
      items: thinkItems,
      tone: "cyan",
    },
    {
      key: "decision",
      step: "03",
      kicker: "判断层",
      title: "怎么判断",
      summary: judgeSummary,
      items: judgeItems,
      tone: "violet",
    },
    {
      key: "boundary",
      step: "04",
      kicker: "边界层",
      title: "什么不做",
      summary: boundarySummary,
      items: boundaryItems,
      tone: "rose",
    },
    {
      key: "limits",
      step: "05",
      kicker: "校准层",
      title: "知道局限",
      summary: honestSummary,
      items: honestItems,
      tone: "slate",
    },
  ]
})

const activeLayer = computed(() => fiveLayerStructure.value.find((layer) => layer.key === activeLayerKey.value) || fiveLayerStructure.value[0] || null)

const personalitySkillCards = computed<PersonalitySkillCardPayload[]>(() => {
  if (resultBundle.value?.personality_skill_cards?.length) {
    return resultBundle.value.personality_skill_cards.map((card) => ({
      ...card,
      selected: card.skill_id === selectedExpertId.value,
    }))
  }
  return expertCandidates.value.slice(0, 4).map((candidate, index) => ({
    skill_id: candidate.expert_id,
    title: candidate.name,
    subtitle: candidate.role,
    match_score: candidate.match_score,
    fit_label: index === 0 ? "优先开聊" : "可延伸",
    persona_hook: `${personaCodeDisplay.value} 这类人格，当前更适合先借这个 skill 处理高频卡点。`,
    reason: candidate.reasons[0] || "这个 skill 和你的蒸馏结果有直接重合。",
    tags: [...new Set([...candidate.tags, ...candidate.can_help_with])].slice(0, 4),
    accent_theme: index === 0 ? publicCard.value.style_theme : "ash-mist",
    selected: candidate.expert_id === selectedExpertId.value,
  }))
})

const recommendedActionRoutes = computed<RecommendedActionSkillCard[]>(() => {
  return (resultBundle.value?.action_routes || [])
    .filter((item): item is ActionRoutePayload & { expert_id: string } => item.route_type === "expert_consult" && Boolean(item.expert_id))
    .slice(0, 3)
    .map((item, index) => {
      const matchedCandidate = expertCandidates.value.find((candidate) => candidate.expert_id === item.expert_id) || null
      const title = cleanExpertRouteTitle(item.title) || matchedCandidate?.name || `推荐 skill ${index + 1}`
      const description = normalizeReportText(item.description) || matchedCandidate?.role || "这条补问路线和当前画像缺口最相关。"
      const reason = normalizeReportText(item.reason) || matchedCandidate?.reasons?.[0] || "继续追问这个 skill，能把当前画像补得更完整。"
      return {
        key: `${item.route_type}-${item.expert_id}-${title}`,
        expertId: item.expert_id,
        title,
        description,
        reason,
        badge: matchedCandidate?.role || "后端推荐",
        avatar: actionRouteAvatarLabel(title, matchedCandidate),
        selected: selectedExpertId.value === item.expert_id,
      }
    })
})

const suitableUseCases = computed(() => {
  const useCases = compactReportItems([
    ...report.value?.cognition.suggested_use_cases || [],
    ...privateReport.value.adjustment_suggestions,
  ], 3)
  return useCases.map((item, index) => ({
    title: `咨询方向 ${index + 1}`,
    copy: item,
  }))
})

const adviceCards = computed(() => {
  const pool = compactReportItems([
    ...privateReport.value.adjustment_suggestions,
    ...privateReport.value.decision_style,
    ...privateReport.value.risk_points,
  ], 4)
  return pool.map((copy, index) => ({
    title: ["优先动作", "关系边界", "判断方式", "风险提醒"][index] || `建议 ${index + 1}`,
    copy,
  }))
})

const materialRows = computed(() => {
  if (projectMaterials.value.length) {
    return projectMaterials.value.slice(0, 6).map((item) => ({
      icon: item.file_name ? "文" : "聊",
      title: item.label,
      meta: item.file_name || item.content_excerpt || item.parse_status,
    }))
  }
  return (report.value?.source_coverage.representative_sources || []).slice(0, 6).map((item) => ({
    icon: "源",
    title: item,
    meta: "代表性证据",
  }))
})

const behaviorPrimaryHeadline = computed(() => adviceCards.value[0]?.copy || recommendedActionRoutes.value[0]?.reason || reportMotto.value || "更适合先把当前最紧要的动作落下来。")
const behaviorMatchScore = computed(() => {
  const match = personalitySkillCards.value[0]?.match_score || 0.94
  return `${Math.round(match * 100)}%`
})
const behaviorHighlights = computed(() => {
  if (recommendedActionRoutes.value.length) {
    return recommendedActionRoutes.value.slice(0, 2).map((item) => ({
      title: item.title,
      subtitle: item.badge,
    }))
  }
  return adviceCards.value.slice(0, 2).map((item) => ({
    title: item.title,
    subtitle: item.copy,
  }))
})

function angleFor(index: number) {
  return (-90 + (360 / Math.max(radarMetrics.value.length, 5)) * index) * (Math.PI / 180)
}

function pointFor(index: number, scale: number) {
  const radius = 72 * scale
  const angle = angleFor(index)
  return {
    x: 100 + Math.cos(angle) * radius,
    y: 100 + Math.sin(angle) * radius,
  }
}

function polygonPoints(scale: number) {
  return radarMetrics.value.slice(0, 5).map((_, index) => {
    const point = pointFor(index, scale)
    return `${point.x},${point.y}`
  }).join(" ")
}

function axisPoint(index: number) {
  return pointFor(index, 1)
}

function valuePoint(index: number) {
  const metric = radarMetrics.value[index]
  return pointFor(index, Math.max(0.18, metric?.score || 0.18))
}

const radarValuePoints = computed(() =>
  radarMetrics.value.slice(0, 5).map((_, index) => {
    const point = valuePoint(index)
    return `${point.x},${point.y}`
  }).join(" ")
)

const incarnationCards = computed<IncarnationCardPayload[]>(() => resultBundle.value?.incarnation_cards || [])
const selectedIncarnationCard = computed<IncarnationCardPayload | null>(() => {
  if (!incarnationCards.value.length) return null
  return incarnationCards.value.find((item) => item.selected) || incarnationCards.value[0] || null
})

const reportCards = computed<ReportCardDescriptor[]>(() => [
  {
    id: "personality",
    index: "CARD 01",
    title: personalityReportCardTitle.value,
    detailTitle: publicCard.value.persona_name || personaTitle.value,
    accent: "emerald",
    lockTitle: "解锁",
    lockCopy: "点击中间的锁，进入完整人格画像。",
    footer: "人格维度、核心描述与适合场景会在解锁后展开。",
  },
  {
    id: "cognition",
    index: "CARD 02",
    title: "认知五层蒸馏报告",
    detailTitle: "五层蒸馏图谱",
    accent: "amber",
    lockTitle: "解锁",
    lockCopy: "点击中间的锁，进入五层认知图谱。",
    footer: "表达层、认知层、判断层与边界层会在详情页完整展开。",
  },
  {
    id: "behavior",
    index: "CARD 03",
    title: "行为决策建议报告",
    detailTitle: recommendedActionRoutes.value[0]?.title || "行为决策建议",
    accent: "violet",
    lockTitle: "解锁",
    lockCopy: "点击中间的锁，进入行动建议详情。",
    footer: "优先动作、推荐 skill 与后续路径会在解锁后显示。",
  },
])

const activeUnlockCard = computed(() => reportCards.value.find((card) => card.id === activeUnlockCardId.value) || null)
const activeDetailCard = computed(() => reportCards.value.find((card) => card.id === activeDetailCardId.value) || null)

function storageKey() {
  return project.value ? `distill-human:report-unlocks:${project.value.project_id}` : ""
}

function isCardUnlocked(cardId: UnlockableReportId) {
  return unlockedCardIds.value.includes(cardId)
}

function persistUnlockedCards() {
  const key = storageKey()
  if (!key) return
  window.localStorage.setItem(key, JSON.stringify(unlockedCardIds.value))
}

function loadUnlockedCards() {
  const key = storageKey()
  if (!key) return
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) || "[]")
    unlockedCardIds.value = Array.isArray(saved) ? saved.filter((item): item is UnlockableReportId => REPORT_CARD_IDS.includes(item)) : []
  } catch {
    unlockedCardIds.value = []
  }
}

function lockPageScroll(locked: boolean) {
  document.body.style.overflow = locked ? "hidden" : ""
}

function setCardActionMessage(message: string) {
  cardActionMessage.value = message
  if (cardActionTimer) {
    window.clearTimeout(cardActionTimer)
  }
  cardActionTimer = window.setTimeout(() => {
    cardActionMessage.value = ""
    cardActionTimer = null
  }, 3200)
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const blobUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = blobUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(blobUrl)
}

function inlineComputedStyles(source: HTMLElement, target: HTMLElement) {
  const sourceNodes = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))]
  const targetNodes = [target, ...Array.from(target.querySelectorAll<HTMLElement>("*"))]

  targetNodes.forEach((node, index) => {
    const sourceNode = sourceNodes[index]
    if (!sourceNode) return
    const style = window.getComputedStyle(sourceNode)
    const cssText = Array.from({ length: style.length })
      .map((_, styleIndex) => style.item(styleIndex))
      .filter(Boolean)
      .map((propertyName) => `${propertyName}:${style.getPropertyValue(propertyName)};`)
      .join("")

    node.setAttribute("style", cssText)
    if (node instanceof HTMLImageElement) {
      node.crossOrigin = "anonymous"
    }
  })
}

async function buildStyledSnapshot(source: HTMLElement) {
  await document.fonts?.ready

  const width = Math.max(source.scrollWidth, Math.ceil(source.getBoundingClientRect().width))
  const height = Math.max(source.scrollHeight, Math.ceil(source.getBoundingClientRect().height))
  const clone = source.cloneNode(true) as HTMLElement
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml")
  clone.style.width = `${width}px`
  clone.style.height = `${height}px`
  clone.style.margin = "0"
  clone.style.boxSizing = "border-box"
  inlineComputedStyles(source, clone)

  const serialized = new XMLSerializer().serializeToString(clone)
  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject>
    </svg>
  `.trim()

  return {
    width,
    height,
    html: serialized,
    svgBlob: new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" }),
  }
}

async function svgBlobToPngBlob(svgBlob: Blob, width: number, height: number, scale = 2) {
  return await new Promise<Blob>((resolve, reject) => {
    const url = URL.createObjectURL(svgBlob)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      const context = canvas.getContext("2d")
      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error("浏览器不支持导出画布"))
        return
      }

      context.scale(scale, scale)
      context.fillStyle = "#070809"
      context.fillRect(0, 0, width, height)
      context.drawImage(image, 0, 0, width, height)

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (!blob) {
          reject(new Error("长图导出失败"))
          return
        }
        resolve(blob)
      }, "image/png")
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("长图导出失败"))
    }
    image.src = url
  })
}

function uniqueTags(tags: Array<string | null | undefined>) {
  return tags
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item, index, source) => source.indexOf(item) === index)
    .slice(0, 8)
}

function buildPlazaPostPayload(cardId: UnlockableReportId) {
  const modeTitle = selectedIncarnationCard.value?.title || "赛博画像"
  const modeCode = selectedIncarnationCard.value?.codename || "DISTILL"
  const roleName = project.value?.subject_name || personalityCardTitle.value || "赛博人格"
  const imageUrl = personalityPortraitImage.value || null

  if (cardId === "personality") {
    return {
      title: `${roleName} · ${modeTitle}`,
      content: [
        `${personalityDetailLead.value}`,
        personalityDetailBody.value,
        selectedIncarnationCard.value ? `${selectedIncarnationCard.value.title} ${selectedIncarnationCard.value.summary}` : "",
      ].filter(Boolean).join("\n\n"),
      image_url: imageUrl,
      tags: uniqueTags([
        "人物画像",
        modeTitle,
        modeCode,
        personalityTemplateArchetype.value,
        personalityTemplateMirror.value,
      ]),
    }
  }

  if (cardId === "cognition") {
    const layerLines = fiveLayerStructure.value.slice(0, 3).map((item) => `${item.step} ${item.title}`)
    return {
      title: `${roleName} · 认知五层图谱`,
      content: [
        reportMotto.value,
        layerLines.join(" / "),
        personalityDetailLens.value,
      ].filter(Boolean).join("\n\n"),
      image_url: imageUrl,
      tags: uniqueTags([
        "认知蒸馏",
        modeTitle,
        "五层图谱",
        radarMetrics.value[0]?.label,
        radarMetrics.value[1]?.label,
      ]),
    }
  }

  return {
    title: `${roleName} · 行为决策建议`,
    content: [
      behaviorPrimaryHeadline.value,
      behaviorHighlights.value.map((item) => `${item.title} · ${item.subtitle}`).join("\n"),
      selectedIncarnationCard.value?.recommended_for || "",
    ].filter(Boolean).join("\n\n"),
    image_url: imageUrl,
    tags: uniqueTags([
      "行动建议",
      modeTitle,
      "行为决策",
      recommendedActionRoutes.value[0]?.badge,
      personalitySkillCards.value[0]?.title,
    ]),
  }
}

async function publishCardToPlaza(cardId: UnlockableReportId, navigate = true) {
  if (!project.value) {
    throw new Error("项目还没加载完成，暂时不能分享到广场。")
  }
  const payload = buildPlazaPostPayload(cardId)
  const { data } = await api.post<{ post_id: string }>(`/projects/${project.value.project_id}/plaza-posts`, payload)
  if (navigate) {
    await router.push({
      path: "/plaza",
      query: {
        section: "square",
        postId: data.post_id,
      },
    })
  }
  return data
}

function openUnlockModal(cardId: UnlockableReportId) {
  activeDetailCardId.value = null
  activeUnlockCardId.value = cardId
  lockPageScroll(true)
}

function closeUnlockModal() {
  if (unlockingMethod.value) return
  activeUnlockCardId.value = null
  if (!activeDetailCardId.value) {
    lockPageScroll(false)
  }
}

async function openDetailModal(cardId: UnlockableReportId, syncRoute = true) {
  activeUnlockCardId.value = null
  activeDetailCardId.value = cardId
  detailActionMenuOpen.value = false
  lockPageScroll(true)
  await nextTick()
  if (syncRoute) {
    const nextQuery = { ...route.query, card: cardId }
    await router.replace({ query: nextQuery })
  }
}

async function closeDetailModal() {
  activeDetailCardId.value = null
  detailActionMenuOpen.value = false
  const nextQuery = { ...route.query }
  delete nextQuery.card
  await router.replace({ query: nextQuery })
  lockPageScroll(false)
}

function toggleDetailActionMenu() {
  detailActionMenuOpen.value = !detailActionMenuOpen.value
}

function closeDetailActionMenu() {
  detailActionMenuOpen.value = false
}

function markCardUnlocked(cardId: UnlockableReportId) {
  if (isCardUnlocked(cardId)) return
  unlockedCardIds.value = [...unlockedCardIds.value, cardId]
  persistUnlockedCards()
}

async function handleUnlockByShare() {
  if (!activeUnlockCardId.value) return
  unlockingMethod.value = "share"
  const cardId = activeUnlockCardId.value

  try {
    await publishCardToPlaza(cardId, false)
    markCardUnlocked(cardId)
    setCardActionMessage("已分享到赛博广场，当前卡片已解锁。")
    await openDetailModal(cardId)
  } catch (error: any) {
    setCardActionMessage(error?.response?.data?.detail || error?.message || "分享到广场失败了，请稍后再试。")
  } finally {
    unlockingMethod.value = null
  }
}

async function handleUnlockByPay() {
  if (!activeUnlockCardId.value) return
  unlockingMethod.value = "pay"
  const cardId = activeUnlockCardId.value

  try {
    await new Promise((resolve) => window.setTimeout(resolve, 900))
    markCardUnlocked(cardId)
    setCardActionMessage("支付解锁已完成，正在为你打开详情页。")
    await openDetailModal(cardId)
  } finally {
    unlockingMethod.value = null
  }
}

async function handleShareDetailReport() {
  if (!activeDetailCard.value) return
  closeDetailActionMenu()
  sharingDetail.value = true
  try {
    await publishCardToPlaza(activeDetailCard.value.id, true)
    setCardActionMessage("已分享到赛博广场。")
  } catch (error: any) {
    setCardActionMessage(error?.response?.data?.detail || error?.message || "分享失败了，请稍后再试。")
  } finally {
    sharingDetail.value = false
  }
}

async function handleDownloadDetailImage() {
  if (!activeDetailCard.value || !detailReportRef.value) return
  closeDetailActionMenu()
  downloadingDetailImage.value = true
  try {
    const snapshot = await buildStyledSnapshot(detailReportRef.value)
    const pngBlob = await svgBlobToPngBlob(snapshot.svgBlob, snapshot.width, snapshot.height)
    triggerBlobDownload(pngBlob, `${activeDetailCard.value.id}-report.png`)
    setCardActionMessage("长图已生成并开始下载。")
  } catch (error: any) {
    setCardActionMessage(error?.message || "长图导出失败了。")
  } finally {
    downloadingDetailImage.value = false
  }
}

async function handleExportDetailPdf() {
  if (!activeDetailCard.value || !detailReportRef.value) return
  closeDetailActionMenu()
  printingDetailPdf.value = true
  try {
    const snapshot = await buildStyledSnapshot(detailReportRef.value)
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=960")
    if (!printWindow) {
      throw new Error("浏览器拦截了新窗口，请允许弹窗后重试。")
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <title>${activeDetailCard.value.title}</title>
          <style>
            html, body {
              margin: 0;
              padding: 0;
              background: #070809;
            }
            body {
              display: flex;
              justify-content: center;
              padding: 32px;
            }
            @page {
              size: A4;
              margin: 12mm;
            }
          </style>
        </head>
        <body>${snapshot.html}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => {
      printWindow.print()
    }, 240)
    setCardActionMessage("已打开浏览器打印面板，可保存为 PDF。")
  } catch (error: any) {
    setCardActionMessage(error?.message || "PDF 导出失败了。")
  } finally {
    printingDetailPdf.value = false
  }
}

async function handleOpenRecommendedRoute(item: RecommendedActionSkillCard) {
  if (!project.value || !item.expertId) return
  try {
    if (selectedExpertId.value !== item.expertId) {
      await handleSelectExpert(item.expertId)
    }
    await router.push(`/chat/${project.value.project_id}?mode=advice`)
  } catch (error: any) {
    setCardActionMessage(error?.response?.data?.detail || error?.message || "推荐 skill 加载失败，请稍后再试。")
  }
}

async function loadReport() {
  loading.value = true
  errorMessage.value = ""
  try {
    const projectId = route.params.projectId as string
    const { data: projectData } = await api.get<ProjectDetailResponse>(`/projects/${projectId}`)
    project.value = projectData.project
    projectMaterials.value = projectData.materials

    if (!projectData.project.latest_job_id && (projectData.project.status === "draft" || projectData.project.status === "ready_for_distill")) {
      await router.replace(`/projects/new?projectId=${projectId}`)
      return
    }

    const [bundleResult, expertResult, reportResult] = await Promise.allSettled([
      api.get<ResultBundleResponse>(`/projects/${projectId}/result-bundle`),
      projectData.project.factory_category === "tool_agent"
        ? Promise.resolve(null)
        : api.get<ExpertCandidateListResponse>(`/projects/${projectId}/expert-candidates`),
      api.get<DistillReport>(`/projects/${projectId}/report`),
    ])

    if (reportResult.status === "fulfilled") {
      report.value = reportResult.value.data
    } else if (projectData.project.latest_job_id) {
      await router.replace(`/projects/${projectId}/jobs/${projectData.project.latest_job_id}`)
      return
    }

    resultBundle.value = bundleResult.status === "fulfilled" ? bundleResult.value.data : null
    if (expertResult.status === "fulfilled" && expertResult.value?.data) {
      expertCandidates.value = expertResult.value.data.items
      selectedExpertId.value = expertResult.value.data.selected_expert_id || expertResult.value.data.items[0]?.expert_id || ""
    } else {
      expertCandidates.value = []
      selectedExpertId.value = ""
    }

    loadUnlockedCards()
    const queryCard = route.query.card
    const normalized = Array.isArray(queryCard) ? queryCard[0] : queryCard
    if (normalized && REPORT_CARD_IDS.includes(normalized as UnlockableReportId)) {
      if (isCardUnlocked(normalized as UnlockableReportId)) {
        await openDetailModal(normalized as UnlockableReportId, false)
      } else {
        openUnlockModal(normalized as UnlockableReportId)
      }
    }
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || error.message || "报告加载失败"
  } finally {
    loading.value = false
  }
}

async function handleSelectExpert(expertId: string) {
  if (!project.value) return
  selectingExpertId.value = expertId
  try {
    const { data } = await api.post<ExpertSelectionResponse>(`/projects/${project.value.project_id}/expert-selection`, {
      expert_id: expertId,
    })
    selectedExpertId.value = data.selected_expert_id
  } finally {
    selectingExpertId.value = ""
  }
}

function handleEscape(event: KeyboardEvent) {
  if (event.key !== "Escape") return
  if (detailActionMenuOpen.value) {
    closeDetailActionMenu()
    return
  }
  if (activeUnlockCardId.value) {
    closeUnlockModal()
    return
  }
  if (activeDetailCardId.value) {
    void closeDetailModal()
  }
}

function handleGlobalPointerDown(event: PointerEvent) {
  if (!detailActionMenuOpen.value) return
  const target = event.target
  if (detailMenuRef.value && target instanceof Node && detailMenuRef.value.contains(target)) return
  closeDetailActionMenu()
}

onMounted(() => {
  void loadReport()
  window.addEventListener("keydown", handleEscape)
  window.addEventListener("pointerdown", handleGlobalPointerDown)
})

onBeforeUnmount(() => {
  if (cardActionTimer) {
    window.clearTimeout(cardActionTimer)
  }
  lockPageScroll(false)
  window.removeEventListener("keydown", handleEscape)
  window.removeEventListener("pointerdown", handleGlobalPointerDown)
})
</script>

<style scoped>
.report-hub-page {
  position: relative;
  min-height: 100%;
}

.report-v3-page {
  padding-inline: 0;
}

.report-v3-shell {
  width: 100%;
  padding: calc(env(safe-area-inset-top, 0px) + 10px) 16px 0;
}

.report-v3-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.report-v3-back,
.report-v3-menu {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(232, 230, 227, 0.9);
  font-size: 0.76rem;
  letter-spacing: 0.06em;
}

.report-v3-hero {
  padding: 20px 4px 14px;
  text-align: center;
}

.report-v3-kicker {
  margin: 0 0 8px;
  color: rgba(0, 245, 212, 0.84);
  font-size: 0.72rem;
  letter-spacing: 0.22em;
}

.report-v3-hero h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 7.2vw, 2.4rem);
  font-weight: 900;
  color: #e8e6e3;
  letter-spacing: 0.08em;
}

.report-v3-hero p:last-child {
  margin: 10px 0 0;
  color: rgba(232, 230, 227, 0.62);
  font-size: 0.82rem;
  letter-spacing: 0.08em;
}

.report-hub-page-inner {
  position: relative;
}

.report-hub-shell {
  display: flex;
  justify-content: center;
  padding: 0 0 1.5rem;
}

.report-hub-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 17.5rem));
  gap: 1rem;
  width: min(100%, 56.5rem);
  justify-content: center;
  align-items: start;
}

.report-hub-card-item {
  display: grid;
  gap: 0.8rem;
  min-width: 0;
  animation: card-enter 0.78s ease forwards;
}

.report-hub-card-item.is-personality-item {
  gap: 0;
}

.report-unlock-card {
  --accent: #4fe0ac;
  --accent-rgb: 79, 224, 172;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 27.75rem;
  padding: 1rem;
  border-radius: 1.75rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background:
    radial-gradient(circle at top center, rgba(255, 255, 255, 0.12), transparent 34%),
    radial-gradient(circle at bottom left, rgba(var(--accent-rgb), 0.1), transparent 40%),
    linear-gradient(180deg, rgba(24, 25, 29, 0.96), rgba(14, 15, 18, 0.98));
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(24px);
  transition: transform 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease;
}

.report-unlock-card.is-clickable {
  cursor: pointer;
}

.report-unlock-card.is-clickable:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow:
    0 30px 72px rgba(0, 0, 0, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.report-unlock-card.is-emerald {
  --accent: #4fe0ac;
  --accent-rgb: 79, 224, 172;
}

.report-unlock-card.is-personality-card {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  overflow: visible;
}

.report-unlock-card.is-personality-card.is-clickable:hover {
  border-color: transparent;
  box-shadow: none;
}

.report-unlock-card.is-amber {
  --accent: #f5b545;
  --accent-rgb: 245, 181, 69;
}

.report-unlock-card.is-violet {
  --accent: #ad82ff;
  --accent-rgb: 173, 130, 255;
}

.report-unlock-card-noise {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.012) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.012) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.28;
  pointer-events: none;
}

.report-unlock-card.is-personality-card .report-unlock-card-noise {
  display: none;
}

.report-unlock-card-top {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
}

.report-unlock-card.is-personality-card .report-unlock-card-top {
  position: absolute;
  inset: 0 0 auto;
  z-index: 4;
  padding: 1.05rem 1.1rem 0;
}

.report-unlock-card-index {
  display: inline-block;
  margin-bottom: 0.5rem;
  color: rgba(255, 255, 255, 0.32);
  letter-spacing: 0.12em;
  font-size: 0.72rem;
}

.report-unlock-card-title {
  margin: 0;
  color: #fff;
  font-size: 1.2rem;
  line-height: 1.18;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.report-unlock-card.is-personality-card .report-unlock-card-index {
  color: rgba(255, 255, 255, 0.78);
}

.report-unlock-card-preview {
  position: relative;
  z-index: 2;
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 0.72rem;
  padding: 0.8rem 0 0.45rem;
  transition: filter 0.35s ease, opacity 0.35s ease, transform 0.35s ease;
}

.report-unlock-card.is-personality-card .report-unlock-card-preview {
  padding: 0;
  min-height: inherit;
}

.report-unlock-card-preview.is-blurred {
  filter: blur(14px) saturate(0.7);
  opacity: 0.28;
  transform: scale(0.98);
}

.report-card-persona-hero {
  position: relative;
  isolation: isolate;
  min-height: 100%;
  width: 100%;
  overflow: hidden;
  padding-top: 0;
  border-radius: 1.75rem;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: var(--rebirth-canvas, #e8eef8);
  box-shadow:
    0 28px 64px rgba(0, 0, 0, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.report-card-persona-hero.has-template-background {
  background: transparent;
}

.report-card-persona-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(90deg, rgba(245, 248, 252, 0.9) 0%, rgba(245, 248, 252, 0.62) 42%, rgba(10, 14, 18, 0.12) 70%, rgba(8, 10, 13, 0.42) 100%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), transparent 42%, rgba(0, 0, 0, 0.16));
  pointer-events: none;
}

.report-card-persona-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 2;
  background: linear-gradient(120deg, transparent 18%, rgba(255, 255, 255, 0.34) 48%, transparent 72%);
  transform: translateX(-130%);
  animation: sweep 2.7s ease-in-out infinite;
  mix-blend-mode: screen;
  pointer-events: none;
}

.report-card-persona-meta {
  position: absolute;
  top: 1.08rem;
  left: 1.1rem;
  right: 1.1rem;
  z-index: 3;
}

.report-card-mode-chip {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 3;
  display: grid;
  gap: 0.12rem;
  justify-items: end;
  padding: 0.52rem 0.72rem;
  border-radius: 0.95rem;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 10px 24px rgba(15, 18, 24, 0.14);
}

.report-card-mode-chip span {
  color: rgba(22, 19, 31, 0.64);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.report-card-mode-chip strong {
  color: var(--rebirth-ink, #16131f);
  font-size: 0.92rem;
  font-weight: 900;
  letter-spacing: 0.01em;
}

.report-card-persona-meta-main {
  display: grid;
  gap: 0.28rem;
  min-width: 0;
  max-width: 100%;
  text-align: left;
}

.report-card-persona-meta-main strong {
  position: relative;
  z-index: 3;
  color: rgba(12, 16, 22, 0.86);
  font-size: clamp(0.74rem, 2.35vw, 0.86rem);
  font-weight: 900;
  line-height: 1.12;
  letter-spacing: 0;
  text-shadow: 0 1px 10px rgba(255, 255, 255, 0.72);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.report-card-persona-meta-main small {
  color: rgba(12, 16, 22, 0.62);
  font-size: clamp(0.68rem, 1.9vw, 0.76rem);
  font-weight: 800;
  line-height: 1.2;
  text-shadow: 0 1px 10px rgba(255, 255, 255, 0.68);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.report-card-signature-strip {
  position: absolute;
  right: 0.92rem;
  bottom: 1.03rem;
  z-index: 3;
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
  max-width: min(86%, 18rem);
  width: min(86%, 17.8rem);
  min-height: 3.72rem;
  padding: 0;
  border-radius: 0.16rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(244, 246, 238, 0.9)),
    repeating-linear-gradient(0deg, transparent 0 9px, rgba(12, 20, 16, 0.05) 10px);
  box-shadow:
    0 8px 18px rgba(0, 0, 0, 0.24),
    0 1px 0 rgba(255, 255, 255, 0.74) inset;
  transform: rotate(-1.6deg);
  transform-origin: right bottom;
  pointer-events: none;
}

.report-card-signature-strip::before,
.report-card-signature-strip::after {
  content: "";
  position: absolute;
  top: 50%;
  z-index: 2;
  width: 0.72rem;
  height: 0.72rem;
  border-radius: 999px;
  background: rgba(22, 24, 26, 0.72);
  transform: translate(50%, -50%);
}

.report-card-signature-strip::before {
  right: 3.72rem;
  top: -0.02rem;
}

.report-card-signature-strip::after {
  right: 3.72rem;
  top: 100%;
}

.report-card-signature-panel {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  padding: 0.46rem 0.34rem 0.42rem 0.58rem;
}

.report-card-signature-art {
  display: block;
  width: 100%;
  height: 2.85rem;
  overflow: visible;
  filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.54)) drop-shadow(0 0 4px rgba(206, 10, 30, 0.18));
}

.report-card-signature-art-line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.report-card-signature-art-glyph {
  fill: #d10c1e;
  font-family: "HanziPen SC", "STXingkai", "Xingkai SC", "Kaiti SC", "STKaiti", "Bradley Hand", cursive;
  font-size: 31px;
  font-style: italic;
  font-weight: 900;
  letter-spacing: -1px;
  paint-order: stroke fill;
  stroke: rgba(124, 0, 14, 0.08);
  stroke-width: 0.6px;
  transform: skewX(-7deg) rotate(-1deg);
  transform-origin: 160px 42px;
}

.report-card-signature-art-line.is-over {
  stroke: rgba(23, 24, 26, 0.76);
  stroke-width: 2.6;
}

.report-card-signature-art-line.is-accent {
  stroke: rgba(23, 24, 26, 0.68);
  stroke-width: 2.5;
}

.report-card-signature-tear {
  flex: 0 0 0.7rem;
  align-self: stretch;
  background:
    radial-gradient(circle, rgba(24, 26, 28, 0.34) 1.1px, transparent 1.35px) center / 0.42rem 0.42rem repeat-y;
  opacity: 0.72;
}

.report-card-signature-qr-wrap {
  display: grid;
  flex: 0 0 3.28rem;
  place-items: center;
  padding: 0.36rem 0.34rem 0.34rem 0.18rem;
}

.report-card-signature-qr {
  display: block;
  flex: 0 0 auto;
  width: 2.58rem;
  height: 2.58rem;
  border-radius: 0.12rem;
  opacity: 0.98;
}

.report-card-persona-watermark {
  position: absolute;
  right: -0.3rem;
  bottom: 3.4rem;
  z-index: 0;
  color: rgba(255, 255, 255, 0.36);
  font-size: clamp(4.6rem, 8vw, 6.4rem);
  font-weight: 900;
  letter-spacing: -0.08em;
  transform: none;
  white-space: nowrap;
  pointer-events: none;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.report-card-persona-image {
  display: block;
  position: absolute;
  inset: 0 0 0 auto;
  z-index: 0;
  width: 100%;
  height: 100%;
  max-height: none;
  object-fit: cover;
  object-position: center top;
  transform:
    translateX(calc(16% + var(--portrait-shift-x, 0px)))
    translateY(var(--portrait-shift-y, 0))
    scaleX(var(--portrait-flip, 1))
    scale(calc(var(--portrait-scale, 1) * 1.18));
  transform-origin: center center;
  filter: saturate(0.92) contrast(1.02) drop-shadow(0 22px 26px rgba(37, 28, 48, 0.16));
  opacity: 0.9;
  pointer-events: none;
}

.report-card-persona-image.is-template-background {
  object-position: center center;
  transform: none;
  filter: saturate(0.96) contrast(1.04);
  opacity: 1;
}

.report-card-persona-copy {
  position: absolute;
  left: 1.1rem;
  right: auto;
  bottom: 5.1rem;
  z-index: 3;
  display: grid;
  width: min(56%, 12rem);
  gap: 0.48rem;
}

.report-card-persona-title {
  margin: 0;
  color: rgba(11, 15, 19, 0.94);
  font-size: clamp(1.8rem, 5.8vw, 2.38rem);
  font-weight: 900;
  line-height: 0.9;
  letter-spacing: 0;
  max-width: 6.6ch;
  text-wrap: balance;
}

.report-card-persona-summary {
  margin: 0;
  color: rgba(16, 20, 26, 0.72);
  font-size: clamp(0.78rem, 2.3vw, 0.9rem);
  font-weight: 700;
  line-height: 1.42;
}

.report-card-persona-motto {
  margin: -0.16rem 0 0;
  color: rgba(9, 13, 17, 0.82);
  font-family: "Kaiti SC", "STKaiti", serif;
  font-size: clamp(0.78rem, 2.25vw, 0.92rem);
  font-weight: 900;
  line-height: 1.22;
  text-shadow: 0 1px 10px rgba(255, 255, 255, 0.68);
}

.report-card-mode-summary {
  margin: 0;
  color: rgba(22, 19, 31, 0.64);
  font-size: 0.72rem;
  line-height: 1.55;
}

.report-card-copy-kicker {
  margin: 0 0 0.3rem;
  color: rgba(var(--accent-rgb), 0.74);
  font-size: 0.72rem;
}

.report-card-copy-title {
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.88rem;
}

.report-card-progress-list {
  display: grid;
  gap: 0.68rem;
}

.report-card-progress-item {
  display: grid;
  gap: 0.36rem;
}

.report-card-progress-head,
.report-detail-stat-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.76rem;
}

.report-card-progress-head span,
.report-detail-stat-head span {
  color: rgba(255, 255, 255, 0.52);
}

.report-card-progress-head strong,
.report-detail-stat-head strong {
  color: var(--accent);
  font-weight: 600;
}

.report-card-progress-bar,
.report-detail-stat-bar {
  height: 0.35rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.report-card-progress-fill,
.report-detail-stat-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(var(--accent-rgb), 0.55), rgba(var(--accent-rgb), 0.95));
}

.report-card-radar-shell {
  display: flex;
  justify-content: center;
}

.report-card-radar,
.report-detail-radar {
  width: 9.5rem;
  height: 9.5rem;
}

.report-card-radar-grid {
  fill: none;
  stroke: rgba(255, 255, 255, 0.07);
  stroke-width: 1;
}

.report-card-radar-axis {
  stroke: rgba(255, 255, 255, 0.07);
  stroke-width: 1;
}

.report-card-radar-value {
  fill: rgba(var(--accent-rgb), 0.18);
  stroke: rgba(var(--accent-rgb), 0.95);
  stroke-width: 1.6;
}

.report-card-radar-dot {
  fill: rgba(var(--accent-rgb), 0.94);
}

.report-card-layer-list,
.report-card-route-list {
  display: grid;
  gap: 0.55rem;
}

.report-card-layer-item,
.report-card-route-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.72rem;
  border-radius: 0.95rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.04);
}

.report-card-layer-item span,
.report-card-layer-item strong,
.report-card-route-item strong {
  color: #fff;
}

.report-card-layer-item span {
  min-width: 1.85rem;
  color: rgba(var(--accent-rgb), 0.86);
  font-size: 0.74rem;
}

.report-card-layer-item strong {
  font-size: 0.84rem;
  font-weight: 500;
}

.report-card-position-hero {
  text-align: center;
}

.report-card-position-title {
  margin: 0;
  color: #fff;
  font-size: 1.12rem;
  line-height: 1.35;
  font-weight: 600;
}

.report-card-position-score {
  margin: 0.45rem 0 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.76rem;
}

.report-card-position-score strong {
  color: var(--accent);
}

.report-card-route-mark {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.32);
}

.report-card-route-item span {
  display: block;
  margin-top: 0.12rem;
  color: rgba(255, 255, 255, 0.42);
  font-size: 0.72rem;
}

.report-unlock-mask {
  position: absolute;
  inset: 5rem 0.9rem 3.5rem;
  z-index: 3;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.report-unlock-card-note {
  position: relative;
  z-index: 2;
  margin: auto 0 0;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.42);
  font-size: 0.76rem;
  line-height: 1.55;
}

.report-unlock-card.is-personality-card .report-unlock-card-note {
  position: absolute;
  left: 1.1rem;
  right: 10rem;
  bottom: 1.05rem;
  z-index: 4;
  margin: 0;
  padding: 0;
  border: 0;
  color: rgba(255, 255, 255, 0.82);
  font-size: clamp(0.68rem, 2.05vw, 0.78rem);
  line-height: 1.25;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.74);
}

.report-unlock-lock {
  pointer-events: auto;
  width: min(100%, 9.25rem);
  min-height: 9.25rem;
  padding: 1.05rem 1rem 0.95rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.05)),
    rgba(13, 14, 17, 0.52);
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(18px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  text-align: center;
  color: #fff;
  cursor: pointer;
  transition: transform 0.22s ease, border-color 0.22s ease, background 0.22s ease;
}

.report-unlock-lock:hover {
  transform: scale(1.02);
  border-color: rgba(var(--accent-rgb), 0.42);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.06)),
    rgba(15, 16, 19, 0.58);
}

.report-unlock-lock strong {
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.report-unlock-lock span:last-child {
  max-width: 6.6rem;
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.72rem;
  line-height: 1.45;
}

.report-unlock-lock-glyph {
  position: relative;
  display: inline-grid;
  justify-items: center;
  padding-top: 0.3rem;
}

.report-unlock-lock-ring {
  width: 1.5rem;
  height: 1rem;
  border: 2px solid rgba(var(--accent-rgb), 0.88);
  border-bottom: 0;
  border-radius: 1rem 1rem 0 0;
}

.report-unlock-lock-body {
  width: 1.85rem;
  height: 1.55rem;
  margin-top: -0.12rem;
  border-radius: 0.48rem;
  background: rgba(var(--accent-rgb), 0.88);
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.14);
}

.report-unlock-lock-body::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 0.48rem;
  width: 0.24rem;
  height: 0.42rem;
  border-radius: 999px;
  background: rgba(18, 20, 24, 0.82);
  transform: translateX(-50%);
}

.report-card-unlocked-badge {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  padding: 0.35rem 0.58rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(var(--accent-rgb), 0.92);
  font-size: 0.7rem;
  font-weight: 600;
}

.report-modal-overlay,
.report-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(3, 4, 5, 0.82);
  backdrop-filter: blur(10px);
}

.report-unlock-modal {
  width: min(32rem, calc(100vw - 2rem));
  margin: 12vh auto 0;
  padding: 1.6rem;
  border-radius: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at top left, rgba(80, 232, 177, 0.08), transparent 24%),
    linear-gradient(180deg, rgba(19, 20, 23, 0.98), rgba(13, 14, 16, 0.98));
  box-shadow: 0 32px 88px rgba(0, 0, 0, 0.4);
}

.report-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.report-modal-title {
  margin: 0;
  color: #fff;
  font-size: 2rem;
}

.report-modal-copy {
  margin: 0.85rem 0 0;
  color: rgba(255, 255, 255, 0.58);
  line-height: 1.7;
}

.report-modal-close {
  width: 2.4rem;
  height: 2.4rem;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 1.55rem;
  line-height: 1;
  cursor: pointer;
}

.report-unlock-option-list {
  display: grid;
  gap: 1rem;
  margin-top: 1.5rem;
}

.report-unlock-option {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.95rem;
  padding: 1.2rem;
  border-radius: 1.15rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: #fff;
  text-align: left;
  cursor: pointer;
}

.report-unlock-option:disabled {
  opacity: 0.7;
  cursor: wait;
}

.report-unlock-option.is-share:hover {
  border-color: rgba(98, 160, 255, 0.36);
  background: rgba(98, 160, 255, 0.08);
}

.report-unlock-option.is-pay:hover {
  border-color: rgba(255, 192, 80, 0.36);
  background: rgba(255, 192, 80, 0.08);
}

.report-unlock-option-icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.08);
  font-size: 1.15rem;
  font-weight: 700;
}

.report-unlock-option-copy {
  display: grid;
  gap: 0.3rem;
}

.report-unlock-option-copy strong {
  font-size: 1.05rem;
}

.report-unlock-option-copy span,
.report-unlock-option-copy small {
  color: rgba(255, 255, 255, 0.56);
  line-height: 1.55;
}

.report-unlock-option-badge {
  position: absolute;
  top: 0;
  right: 0;
  padding: 0.35rem 0.7rem;
  border-radius: 0 1.15rem 0 1rem;
  background: #f5b545;
  color: #22170b;
  font-size: 0.78rem;
  font-weight: 700;
}

.report-detail-shell {
  height: 100vh;
  overflow: auto;
  overflow-x: hidden;
  padding: 2rem 1.25rem 3rem;
}

.report-detail-shell.is-personality {
  background:
    radial-gradient(circle at top center, rgba(72, 80, 112, 0.12), transparent 24%),
    #050506;
}

.report-detail-topbar,
.report-detail-content {
  width: min(70rem, 100%);
  margin: 0 auto;
}

.report-detail-topbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0 1.1rem;
  background: linear-gradient(180deg, rgba(4, 5, 7, 0.96), rgba(4, 5, 7, 0.78), transparent);
}

.report-detail-topbar.is-personality,
.report-detail-content.is-personality {
  width: min(56rem, 100%);
}

.report-detail-topbar.is-personality {
  justify-content: space-between;
  padding-bottom: 1.8rem;
  background: linear-gradient(180deg, rgba(5, 5, 6, 0.98), rgba(5, 5, 6, 0.86), transparent);
}

.report-detail-topbar-left {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
}

.report-detail-topbar-copy {
  flex: 1;
  min-width: 0;
  text-align: center;
}

.report-detail-menu-wrap {
  position: relative;
  flex: 0 0 auto;
}

.report-detail-back-btn,
.report-detail-menu-trigger,
.report-detail-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(16px);
}

.report-detail-back-btn .material-symbols-rounded,
.report-detail-menu-trigger .material-symbols-rounded,
.report-detail-close-btn .material-symbols-rounded {
  font-size: 1.25rem;
}

.report-detail-menu-pop {
  position: absolute;
  top: calc(100% + 0.55rem);
  right: 0;
  display: grid;
  min-width: 9.6rem;
  padding: 0.45rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(12, 14, 18, 0.96);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(18px);
}

.report-detail-menu-item {
  padding: 0.78rem 0.9rem;
  border: 0;
  border-radius: 0.8rem;
  background: transparent;
  color: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.report-detail-menu-item:hover,
.report-detail-menu-item:focus-visible {
  background: rgba(255, 255, 255, 0.08);
  outline: none;
}

.report-detail-menu-item:disabled {
  opacity: 0.56;
  cursor: default;
}

.report-detail-topbar-copy.is-personality {
  width: 0;
  min-width: 0;
  height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.report-detail-kicker {
  margin: 0 0 0.3rem;
  color: rgba(255, 255, 255, 0.52);
}

.report-detail-title {
  margin: 0;
  color: #fff;
  font-size: 2rem;
}

.report-detail-content {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at top right, rgba(255, 202, 109, 0.1), transparent 18%),
    rgba(8, 10, 12, 0.96);
  box-shadow: 0 30px 100px rgba(0, 0, 0, 0.42);
}

.report-detail-content.is-personality {
  gap: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.report-detail-section {
  padding: 1.3rem;
  border-radius: 1.35rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
}

.report-detail-content.is-personality .report-detail-section {
  padding: 2rem 0;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0;
  background: transparent;
}

.report-detail-content.is-personality .report-detail-section:first-child {
  padding-top: 0;
  border-top: 0;
}

.report-detail-hero {
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.08), transparent 35%),
    rgba(12, 13, 16, 0.94);
}

.report-detail-personality-intro {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0));
}

.report-detail-cover-frame {
  width: min(100%, 30rem);
  max-width: 30rem;
  margin: 0 auto;
  text-align: center;
}

.report-detail-cover-heading {
  margin-bottom: 0.95rem;
}

.report-detail-cover-kicker {
  margin: 0 0 0.42rem;
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.74rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.report-detail-cover-code {
  margin: 0;
  color: #fff;
  font-size: clamp(3.1rem, 12vw, 4.8rem);
  line-height: 0.96;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.report-detail-cover-poster {
  position: relative;
  width: 100%;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 1.75rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at top center, color-mix(in srgb, var(--report-template-accent) 26%, transparent), transparent 46%),
    #111215;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.34);
}

.report-detail-cover-image {
  display: block;
  width: 100%;
  aspect-ratio: 1.48 / 1;
  object-fit: cover;
  object-position: center top;
  transform:
    translateX(calc(13% + var(--portrait-shift-x, 0px)))
    translateY(var(--portrait-shift-y, 0px))
    scaleX(var(--portrait-flip, 1))
    scale(calc(var(--portrait-scale, 1) * 1.08));
  transform-origin: center center;
  filter: saturate(0.94) contrast(1.02) drop-shadow(0 28px 28px rgba(37, 28, 48, 0.16));
}

.report-detail-cover-image.is-template-background {
  object-position: center center;
  transform: none;
  filter: saturate(0.96) contrast(1.04);
}

.report-detail-cover-image-mask {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0) 38%, rgba(0, 0, 0, 0.82) 100%);
}

.report-detail-cover-badge {
  position: absolute;
  left: 1.15rem;
  bottom: 1.15rem;
  z-index: 1;
  padding: 0.48rem 0.8rem;
  border-radius: 999px;
  background: rgba(6, 7, 9, 0.74);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.74);
  font-size: 0.78rem;
  letter-spacing: 0.06em;
}

.report-detail-cover-copy {
  max-width: 100%;
  margin: 1rem auto 0.85rem;
}

.report-detail-cover-title {
  margin: 0;
  color: #fff;
  font-size: clamp(2rem, 8vw, 3.1rem);
  line-height: 1.08;
  letter-spacing: 0;
  text-wrap: balance;
}

.report-detail-cover-quote {
  margin: 0.7rem 0 0;
  color: rgba(255, 255, 255, 0.62);
  font-size: clamp(0.98rem, 3.5vw, 1.2rem);
  line-height: 1.55;
  font-style: italic;
}

.report-detail-mode-line {
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.85rem;
}

.report-detail-mode-line span {
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.report-detail-mode-line strong {
  color: #fff;
  font-size: 1rem;
}

.report-detail-cover-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.46);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.report-detail-cover-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1rem;
}

.report-detail-cover-codeblock {
  display: grid;
  gap: 0.26rem;
  text-align: left;
}

.report-detail-cover-codeblock strong {
  color: rgba(214, 216, 222, 0.9);
  font-size: 0.94rem;
  letter-spacing: 0.1em;
}

.report-detail-cover-codeblock span {
  color: rgba(255, 255, 255, 0.44);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.report-detail-cover-scan {
  display: grid;
  justify-items: end;
  gap: 0.55rem;
  color: rgba(255, 255, 255, 0.44);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.report-detail-barcode {
  display: flex;
  align-items: flex-end;
  gap: 0.16rem;
  height: 2.25rem;
}

.report-detail-barcode-bar {
  display: block;
  width: 0.16rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
}

.report-detail-personality-line {
  margin: 0;
  color: #fff;
  font-size: clamp(2.1rem, 4vw, 3.1rem);
  font-weight: 900;
  line-height: 1.18;
  letter-spacing: -0.04em;
}

.report-detail-personality-paragraph {
  margin: 0;
  color: rgba(255, 255, 255, 0.74);
  font-size: 1rem;
  line-height: 1.9;
}

.report-detail-personality-brief {
  display: grid;
  gap: 1rem;
}

.report-detail-personality-brief-copy {
  display: grid;
  gap: 0.8rem;
}

.report-detail-personality-question-list {
  display: grid;
  gap: 0.8rem;
}

.report-detail-personality-question {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  gap: 0.9rem;
  padding: 1rem 1rem 1rem 0.95rem;
  border-radius: 1.2rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.report-detail-personality-question span {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.88);
  font-size: 0.82rem;
  font-weight: 900;
}

.report-detail-personality-question p {
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.96rem;
  line-height: 1.72;
}

.report-detail-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 1rem;
}

.report-detail-portrait-card,
.report-detail-meta-card {
  padding: 1.2rem;
  border-radius: 1.2rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.report-detail-portrait-card {
  display: grid;
  gap: 1rem;
}

.report-detail-template-poster {
  position: relative;
  width: min(100%, 18rem);
  padding: 0.8rem;
  border-radius: 1.5rem;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.2), transparent 28%),
    linear-gradient(160deg, color-mix(in srgb, var(--report-template-accent) 74%, #181a1f 26%), #0f1013);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.26);
}

.report-detail-template-image {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1.12;
  object-fit: cover;
  border-radius: 1.15rem;
  background: rgba(255, 255, 255, 0.08);
}

.report-detail-template-type {
  position: absolute;
  top: 1rem;
  left: 1rem;
  padding: 0.42rem 0.66rem;
  border-radius: 999px;
  background: rgba(7, 8, 10, 0.78);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.report-detail-chip {
  display: inline-flex;
  padding: 0.38rem 0.72rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.report-detail-display {
  margin: 0.9rem 0 0.65rem;
  color: #fff;
  font-size: 2rem;
  line-height: 1.16;
}

.report-detail-quote {
  margin: 0;
  color: rgba(255, 255, 255, 0.66);
  line-height: 1.7;
}

.report-detail-meta-label {
  margin: 0;
  color: rgba(255, 255, 255, 0.46);
  font-size: 0.82rem;
}

.report-detail-meta-card h4 {
  margin: 0.55rem 0;
  color: #fff;
  font-size: 1.2rem;
}

.report-detail-meta-card p:last-of-type {
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.65;
}

.report-detail-pill-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 1rem;
}

.report-detail-pill {
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.8rem;
}

.report-detail-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.report-detail-section-head span {
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.84rem;
}

.report-detail-section-title {
  margin: 0;
  color: #fff;
  font-size: 1.2rem;
}

.report-detail-content.is-personality .report-detail-section-head {
  margin-bottom: 1.2rem;
}

.report-detail-content.is-personality .report-detail-section-title {
  font-size: 1.55rem;
}

.report-detail-stat-list,
.report-detail-layer-stack,
.report-detail-source-list {
  display: grid;
  gap: 0.9rem;
}

.report-detail-copy-grid,
.report-detail-route-grid,
.report-detail-bullet-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.report-detail-copy-card,
.report-detail-route-card,
.report-detail-bullet-card,
.report-detail-layer-card,
.report-detail-source-item {
  padding: 1rem 1.05rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.report-detail-copy-card strong,
.report-detail-route-card strong,
.report-detail-layer-card strong,
.report-detail-source-item strong {
  display: block;
  color: #fff;
}

.report-detail-copy-card p,
.report-detail-route-card p,
.report-detail-layer-card p,
.report-detail-source-item p {
  margin: 0.55rem 0 0;
  color: rgba(255, 255, 255, 0.62);
  line-height: 1.65;
}

.report-incarnation-section {
  margin-bottom: 1.25rem;
}

.report-incarnation-card {
  position: relative;
  overflow: hidden;
}

.report-incarnation-card.is-selected {
  border-color: rgba(80, 232, 177, 0.38);
  background:
    radial-gradient(circle at top right, rgba(80, 232, 177, 0.12), transparent 34%),
    rgba(255, 255, 255, 0.04);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
}

.report-incarnation-codename {
  color: rgba(80, 232, 177, 0.86) !important;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.report-incarnation-recommend {
  color: rgba(255, 255, 255, 0.8) !important;
}

.report-detail-bullet-card {
  display: flex;
  gap: 0.8rem;
  align-items: flex-start;
}

.report-detail-bullet-card span {
  display: grid;
  place-items: center;
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 999px;
  background: rgba(255, 181, 69, 0.16);
  color: #f5b545;
  flex-shrink: 0;
  font-size: 0.8rem;
  font-weight: 700;
}

.report-detail-bullet-card p {
  margin: 0.1rem 0 0;
  color: rgba(255, 255, 255, 0.68);
  line-height: 1.65;
}

.report-detail-radar-hero {
  display: flex;
  justify-content: center;
}

.report-detail-cognition-copy {
  margin-top: 1.25rem;
  text-align: center;
}

.report-detail-tab-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.report-detail-tab {
  min-width: 8.5rem;
  padding: 0.85rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.62);
  text-align: left;
  cursor: pointer;
}

.report-detail-tab span {
  display: block;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.34);
}

.report-detail-tab strong {
  display: block;
  margin-top: 0.3rem;
  color: inherit;
}

.report-detail-tab.is-active {
  border-color: rgba(255, 181, 69, 0.4);
  background: rgba(255, 181, 69, 0.12);
  color: #fff;
}

.report-detail-layer-focus {
  padding: 1.2rem;
  margin-bottom: 1rem;
  border-radius: 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.report-detail-layer-top {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.report-detail-layer-step {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 1rem;
  background: rgba(255, 181, 69, 0.14);
  color: #f5b545;
  font-weight: 700;
}

.report-detail-layer-top h5 {
  margin: 0.35rem 0 0;
  color: #fff;
  font-size: 1.15rem;
}

.report-detail-layer-summary {
  margin: 1rem 0 0;
  color: rgba(255, 255, 255, 0.68);
  line-height: 1.7;
}

.report-detail-layer-mini-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.report-detail-layer-mini-head span {
  color: rgba(255, 181, 69, 0.8);
  font-size: 0.82rem;
}

.report-detail-behavior-lead {
  display: grid;
  gap: 0.7rem;
}

.report-detail-route-head {
  display: flex;
  gap: 0.8rem;
  align-items: flex-start;
}

.report-detail-route-avatar {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.85rem;
  background: rgba(173, 130, 255, 0.14);
  color: #ad82ff;
  font-weight: 700;
}

.report-detail-route-reason {
  min-height: 3.4rem;
}

.report-detail-route-action {
  margin-top: 0.9rem;
  width: 100%;
  padding: 0.85rem 0.95rem;
  border: 1px solid rgba(173, 130, 255, 0.22);
  border-radius: 0.95rem;
  background: rgba(173, 130, 255, 0.12);
  color: #fff;
  cursor: pointer;
}

.report-detail-route-card.is-selected {
  border-color: rgba(79, 224, 172, 0.28);
  background: rgba(79, 224, 172, 0.08);
}

.report-detail-source-item {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}

.report-detail-source-icon {
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  flex-shrink: 0;
}

.report-toast {
  position: fixed;
  left: 50%;
  bottom: 1.6rem;
  z-index: 80;
  transform: translateX(-50%);
  padding: 0.85rem 1.1rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(12, 14, 16, 0.94);
  color: #fff;
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.3);
}

.report-fade-enter-active,
.report-fade-leave-active {
  transition: opacity 0.2s ease;
}

.report-fade-enter-from,
.report-fade-leave-to {
  opacity: 0;
}

.report-slide-enter-active,
.report-slide-leave-active {
  transition: opacity 0.24s ease, transform 0.24s ease;
}

.report-slide-enter-from,
.report-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (max-width: 1180px) {
  .report-hub-grid {
    grid-template-columns: repeat(2, minmax(0, 17.5rem));
  }

  .report-unlock-card {
    min-height: 27rem;
  }
}

@media (max-width: 960px) {
  .report-detail-hero-grid,
  .report-detail-copy-grid,
  .report-detail-route-grid,
  .report-detail-bullet-list {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .report-detail-topbar {
    align-items: center;
  }

  .report-detail-menu-pop {
    min-width: min(11rem, calc(100vw - 2rem));
  }

  .report-hub-grid {
    grid-template-columns: minmax(0, 22rem);
  }

  .report-detail-cover-meta-row,
  .report-detail-cover-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .report-detail-cover-scan {
    justify-items: start;
  }
}

@media (max-width: 640px) {
  .report-hub-shell {
    padding-top: 1.2rem;
  }

  .report-hub-grid {
    width: 100%;
    grid-template-columns: minmax(0, 1fr);
  }

  .report-detail-shell {
    padding-inline: 0.75rem;
  }

  .report-detail-topbar {
    gap: 0.75rem;
  }

  .report-detail-back-btn,
  .report-detail-menu-trigger,
  .report-detail-close-btn {
    width: 2.5rem;
    height: 2.5rem;
  }

  .report-detail-menu-pop {
    right: 0;
    left: auto;
  }

  .report-detail-content {
    padding: 0.75rem;
    border-radius: 1.35rem;
  }

  .report-detail-content.is-personality {
    padding: 0;
    border-radius: 0;
  }

  .report-detail-section {
    padding: 1rem;
  }

  .report-detail-content.is-personality .report-detail-section {
    padding: 1.5rem 0;
  }

  .report-detail-toolbar {
    flex-basis: 100%;
  }

  .report-unlock-modal {
    margin-top: 7vh;
  }

  .report-card-persona-hero {
    min-height: 28.8rem;
  }

  .report-card-persona-copy {
    left: 1rem;
    bottom: 5.35rem;
    width: min(58%, 11.25rem);
  }

  .report-card-persona-meta {
    top: 1.05rem;
    left: 1rem;
    right: 1rem;
  }

  .report-card-signature-strip {
    right: 0.85rem;
    bottom: 0.92rem;
    max-width: min(86%, 17rem);
    width: min(86%, 17rem);
    min-height: 3.44rem;
  }

  .report-card-signature-panel {
    padding: 0.4rem 0.28rem 0.36rem 0.5rem;
  }

  .report-card-signature-art {
    height: 2.66rem;
  }

  .report-card-signature-qr-wrap {
    flex-basis: 3rem;
    padding: 0.32rem 0.3rem 0.3rem 0.14rem;
  }

  .report-card-signature-qr {
    width: 2.38rem;
    height: 2.38rem;
  }

  .report-card-persona-image {
    object-position: 56% top;
    transform:
      translateX(calc(16% + var(--portrait-shift-x, 0px)))
      translateY(var(--portrait-shift-y, 0))
      scaleX(var(--portrait-flip, 1))
      scale(calc(var(--portrait-scale, 1) * 1.16));
  }

  .report-card-persona-image.is-template-background {
    object-position: center center;
    transform: none;
  }

  .report-card-persona-watermark {
    bottom: 3.1rem;
  }

  .report-detail-cover-heading {
    margin-bottom: 0.75rem;
  }

  .report-detail-cover-badge {
    left: 0.85rem;
    right: 0.85rem;
    bottom: 0.85rem;
    text-align: center;
  }

  .report-detail-cover-copy {
    margin-top: 0.85rem;
  }

  .report-detail-cover-frame {
    width: 100%;
    max-width: 22.5rem;
  }

  .report-detail-cover-code {
    font-size: clamp(2.9rem, 15vw, 4.15rem);
  }

  .report-detail-cover-poster {
    border-radius: 1.25rem;
  }

  .report-detail-cover-title {
    font-size: clamp(2rem, 10vw, 2.85rem);
  }

  .report-detail-cover-meta-row,
  .report-detail-cover-footer {
    gap: 0.65rem;
  }

  .report-detail-cover-footer {
    padding-top: 0.8rem;
  }
}
</style>
