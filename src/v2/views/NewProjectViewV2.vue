<template>
  <V2AppShell>
    <div class="v2-proto-page">
      <div class="v2-proto-container v2-create-shell">
        <div class="v2-create-topbar">
          <div class="v2-stage-copy v2-stage-copy--top">
            <div>
              <p class="v2-proto-kicker">{{ currentStageHeading.kicker }}</p>
              <h1 class="serif v2-proto-title">{{ currentStageHeading.title }}</h1>
            </div>
            <p class="v2-proto-subtitle v2-stage-copy-text">
              {{ currentStageHeading.subtitle }}
            </p>
          </div>

          <div class="v2-journey-shell">
            <div class="v2-journey-progress" aria-hidden="true">
              <div class="v2-journey-progress-fill" :style="{ width: `${journeyProgressPercent}%` }" />
            </div>
            <div class="v2-journey-rail">
              <button
                v-for="item in wizardSteps"
                :key="item.step"
                type="button"
                class="v2-journey-step"
                :class="journeyStepClass(item.step)"
                @click="openStep(item.step)"
              >
                <span class="v2-journey-index">{{ journeyStepMark(item.step, item.code) }}</span>
                <span class="v2-journey-label">{{ item.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <section v-if="currentStep === 1" class="v2-create-section v2-stage-section">
          <div class="v2-create-stage-grid v2-create-stage-grid--entry">
            <div class="v2-create-stage-main v2-create-stage-main--entry">
              <div class="v2-stage-card v2-stage-card--entry">
                <div class="v2-proto-field">
                  <label class="v2-proto-label">蒸馏对象</label>
                  <div class="v2-target-track-container">
                    <div class="v2-target-track" ref="targetTrackRef" @mousedown="startDrag" @mousemove="drag" @mouseup="endDrag" @mouseleave="endDrag">
                      <button
                        v-for="chip in targetChips"
                        :key="chip.key"
                        type="button"
                        class="v2-target-avatar"
                        :class="{ selected: selectedTargetKey === chip.key }"
                        @click="selectTargetChip(chip.key)"
                      >
                        <span class="v2-target-avatar-icon">{{ chip.icon }}</span>
                        <span class="v2-target-avatar-label">{{ chip.label }}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div class="v2-entry-field-grid">
                  <div class="v2-proto-field">
                    <label class="v2-proto-label">{{ isSelfTarget ? "你的称呼" : "对象称呼" }}</label>
                    <input
                      v-model="form.subject_name"
                      type="text"
                      class="v2-proto-input"
                      :placeholder="selectedTargetMeta.subjectPlaceholder"
                    />
                  </div>

                  <div class="v2-proto-field">
                    <label class="v2-proto-label">蒸馏名称</label>
                    <input
                      v-model="form.name"
                      type="text"
                      class="v2-proto-input"
                      :placeholder="selectedTargetMeta.projectPlaceholder"
                    />
                  </div>
                </div>

                <div class="v2-proto-field">
                  <label class="v2-proto-label">补充一句目标</label>
                  <textarea
                    v-model="form.analysis_goal"
                    rows="4"
                    class="v2-proto-textarea v2-proto-textarea--compact"
                    :placeholder="activeGoalPlaceholder"
                  />
                </div>
              </div>
            </div>

            <div class="v2-entry-link-bridge" aria-hidden="true">
              <span class="v2-entry-link-node v2-entry-link-node--source">{{ selectedTargetMeta.icon }}</span>
              <span class="v2-entry-link-beam" />
              <span class="v2-entry-link-pulse" />
              <span class="v2-entry-link-node v2-entry-link-node--target">{{ activeAssistantAvatarLabel }}</span>
            </div>

            <aside class="v2-stage-preview v2-stage-preview--entry">
              <section class="report-section v2-stage-preview-section v2-stage-preview-section--entry-shell">
                <div class="v2-stage-preview-head v2-stage-preview-head--entry">
                  <div>
                    <p class="v2-proto-kicker">候选路径</p>
                    <div class="v2-proto-advice-title">蒸馏入口</div>
                  </div>
                  <span class="v2-proto-status">{{ selectedSkillMode === "custom" ? "手动" : "自动" }}</span>
                </div>

                <div class="v2-skill-pool-stack v2-skill-pool-stack--entry" role="tablist" aria-label="主蒸馏机候选池">
                  <article
                    v-for="candidate in entrySkillPreviewCandidates"
                    :key="candidate.pack.slug"
                    class="v2-skill-pool-card"
                    :class="{
                      'is-selected': isCandidateExpanded(candidate.pack.slug),
                      'is-linked': candidate.pack.slug === activePackSlug,
                    }"
                    @click="selectSkillCandidate(candidate.pack.slug)"
                  >
                    <div class="v2-skill-pool-card-head">
                      <div class="v2-skill-pool-card-main">
                        <span class="v2-skill-pool-avatar" :style="packAvatarStyle(candidate.pack)">
                          {{ candidate.pack.avatar_label || candidate.pack.title.slice(0, 1) }}
                        </span>
                        <span class="v2-skill-pool-copy">
                          <strong>{{ candidate.pack.title }}</strong>
                          <span class="v2-skill-pool-copy-meta">
                            <small>{{ candidate.pack.factory_category_label }}</small>
                            <small v-if="candidate.exactNameHit">名字直达</small>
                            <small v-else-if="isSkillPackLoaded(candidate.pack.slug)">已加载</small>
                            <small v-else>候选</small>
                          </span>
                        </span>
                      </div>
                      <span class="v2-skill-pool-actions">
                        <button
                          type="button"
                          class="v2-skill-card-action"
                          @click.stop="openSkillDetailModal(candidate.pack.slug)"
                        >
                          详情
                        </button>
                        <button
                          type="button"
                          class="v2-skill-check"
                          :class="{ 'is-checked': isSkillPackLoaded(candidate.pack.slug) }"
                          :disabled="isSelfTarget && candidate.pack.slug !== FIXED_SELF_PACK_SLUG"
                          @click.stop="toggleSkillRouterPack(candidate.pack.slug)"
                        >
                          {{ isSkillPackLoaded(candidate.pack.slug) ? "已加载" : "加载" }}
                        </button>
                      </span>
                    </div>
                  </article>
                </div>

                <div class="v2-skill-pool-search-row">
                  <input
                    v-model="skillPoolSearch"
                    type="text"
                    class="v2-proto-input"
                    placeholder="搜索候选路径 / skill"
                  />
                  <button v-if="skillPoolSearch.trim()" type="button" class="btn-ghost" @click="skillPoolSearch = ''">
                    清空
                  </button>
                </div>
                <p v-if="skillPoolSearch.trim() && !searchedSkillCandidatePool.length" class="v2-report-meta-note">
                  没有匹配结果，换个词试试。
                </p>

                <div class="v2-skill-pool-head">
                  <div>
                    <p class="v2-proto-kicker">辅助线</p>
                    <div class="v2-proto-advice-title">分析视角</div>
                  </div>
                  <span class="v2-proto-status">{{ analysisTrackCards.length }} 条</span>
                </div>
                <div class="v2-analysis-track-grid v2-analysis-track-grid--entry">
                  <div v-for="track in analysisTrackCards" :key="track.key" class="v2-analysis-track-card">
                    <div class="v2-analysis-track-head">
                      <span class="v2-proto-status">{{ track.label }}</span>
                      <span class="v2-analysis-track-pack">{{ track.packTitle }}</span>
                    </div>
                    <p class="v2-proto-advice-copy">{{ track.summary }}</p>
                  </div>
                </div>
              </section>
            </aside>
          </div>

          <div class="v2-entry-floating-cta">
            <button class="btn-primary v2-entry-floating-cta-btn" :disabled="creating" @click="openDistillModeModal">
              {{ creating ? "准备中..." : "进入蒸馏机" }}
            </button>
          </div>
        </section>

        <section v-else-if="currentStep === 2" class="v2-create-section v2-stage-section">
          <div class="v2-upload-shell">
            <div class="v2-proto-field">
              <label class="v2-proto-label">材料类型</label>
              <div class="v2-proto-chip-row">
                <button
                  v-for="preset in materialTypePresets"
                  :key="preset.value"
                  type="button"
                  class="person-chip"
                  :class="{ selected: upload.evidence_type === preset.value }"
                  @click="upload.evidence_type = preset.value"
                >
                  <span>{{ preset.icon }}</span>
                  {{ preset.label }}
                </button>
              </div>
              <p class="v2-upload-copy v2-upload-copy--inline">{{ activeMaterialTypeHint }}</p>
            </div>

            <label
              class="upload-zone v2-upload-zone--hero"
              :class="{ 'drag-over': isDragOver }"
              @dragover.prevent="isDragOver = true"
              @dragleave="isDragOver = false"
              @drop.prevent="handleDrop"
            >
              <input :key="fileInputKey" type="file" hidden @change="handleFileChange" />
              <div class="v2-upload-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 3.5 8.5 7H11v6h2V7h2.5L12 3.5Zm-6 10.5h2v4h8v-4h2v5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-5Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <p class="v2-upload-title">拖拽文件到此处，或点击上传</p>
              <p class="v2-upload-copy">{{ activeUploadHint }}</p>
              <p v-if="fileRef" class="v2-upload-file">{{ fileRef.name }}</p>
            </label>

            <div class="v2-proto-field">
              <label class="v2-proto-label">{{ activeTextareaLabel }}</label>
              <textarea
                v-model="upload.text_content"
                rows="8"
                class="v2-proto-textarea"
                :placeholder="activeTextareaPlaceholder"
              />
            </div>

            <label class="v2-proto-check">
              <input v-model="upload.consent_confirmed" type="checkbox" />
              我确认这些素材可用于当前蒸馏分析
            </label>

            <div v-if="projectMaterials.length" class="v2-proto-list">
              <div v-for="material in projectMaterials" :key="material.material_id" class="v2-proto-list-item">
                <div>
                  <p class="v2-proto-list-title">{{ material.label }}</p>
                  <p class="v2-proto-list-copy">{{ material.content_excerpt || material.file_name || "等待解析摘要" }}</p>
                </div>
                <div class="v2-proto-list-actions">
                  <span class="v2-proto-status">{{ material.parse_status }}</span>
                  <button
                    type="button"
                    class="btn-ghost v2-proto-list-btn"
                    :disabled="deletingMaterialId === material.material_id"
                    @click="handleDeleteMaterial(material.material_id)"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>

            <div class="v2-proto-button-row v2-proto-button-row--between">
              <button class="btn-ghost" @click="currentStep = 1">返回调整蒸馏</button>
              <button class="btn-primary" :disabled="uploading" @click="handleUploadAndDistill">
                {{ uploading ? "加柴中..." : `提交材料并进入${distillStageLabel}` }}
              </button>
            </div>
          </div>
        </section>

        <section v-else-if="currentStep === 3" class="v2-create-section v2-stage-section">
          <div class="v2-deep-chat-shell v2-deep-chat-shell--chat-first">
            <aside class="v2-deep-side v2-deep-side--clean v2-deep-side--metrics">
              <div class="report-section v2-deep-data-panel">
                <div class="v2-deep-data-head">
                  <div>
                    <p class="v2-proto-kicker">数据展示</p>
                    <div class="v2-self-chat-title">画像状态</div>
                  </div>
                  <span class="v2-proto-status">{{ latestJob?.status || "蒸馏中" }}</span>
                </div>

                <div class="v2-deep-portrait-card">
                  <div class="v2-deep-portrait-aura" aria-hidden="true" />
                  <div class="v2-deep-portrait-scan" aria-hidden="true" />
                  <div class="v2-deep-portrait-silhouette" aria-hidden="true">
                    <span class="v2-deep-portrait-head-shape" />
                    <span class="v2-deep-portrait-body-shape" />
                  </div>
                  <div class="v2-deep-portrait-copy">
                    <strong>{{ form.subject_name || "未知对象" }}</strong>
                    <p>{{ form.name || "人物画像蒸馏中" }}</p>
                  </div>
                </div>

                <p class="v2-assistant-copy">{{ distillStatusText }}</p>

                <div class="v2-deep-summary-list">
                  <div class="v2-deep-summary-row">
                    <span>当前主 skill</span>
                    <strong>{{ activeAssistantName }}</strong>
                  </div>
                  <div class="v2-deep-summary-row">
                    <span>材料</span>
                    <strong>{{ projectMaterials.length }} 份</strong>
                  </div>
                  <div class="v2-deep-summary-row">
                    <span>任务阶段</span>
                    <strong>{{ progressPercent }}%</strong>
                  </div>
                  <div class="v2-deep-summary-row">
                    <span>报告就绪度</span>
                    <strong>{{ readinessPercent }}%</strong>
                  </div>
                </div>

                <div class="v2-deep-progress-bar">
                  <div class="v2-deep-progress-bar-fill" :style="{ width: `${progressPercent}%` }" />
                </div>
                <div class="v2-deep-progress-bar v2-deep-progress-bar--soft">
                  <div class="v2-deep-progress-bar-fill" :style="{ width: `${readinessPercent}%` }" />
                </div>

                <div v-if="projectReadiness" class="v2-readiness-panel">
                  <div class="v2-readiness-head">
                    <span class="v2-proto-status">{{ projectReadiness.scene_label }}</span>
                    <span class="v2-proto-status">{{ projectReadiness.hermes_verdict }}</span>
                  </div>
                  <p class="v2-assistant-copy">{{ readinessSummary }}</p>

                  <div v-if="readinessToolArtifacts.length" class="v2-results-track-row">
                    <span v-for="artifact in readinessToolArtifacts" :key="artifact.tool_code" class="v2-chip">
                      {{ artifact.title }} · {{ Math.round(artifact.confidence_score * 100) }}%
                    </span>
                  </div>

                  <div v-if="readinessBlockers.length" class="v2-readiness-list">
                    <p class="v2-proto-advice-title">还差一点什么</p>
                    <p v-for="item in readinessBlockers.slice(0, 3)" :key="item.code + item.detail" class="v2-proto-advice-copy">
                      {{ item.detail }}
                    </p>
                  </div>

                  <div v-else-if="readinessQuestions.length" class="v2-readiness-list">
                    <p class="v2-proto-advice-title">建议继续追问</p>
                    <p v-for="item in readinessQuestions.slice(0, 3)" :key="item" class="v2-proto-advice-copy">
                      {{ item }}
                    </p>
                  </div>
                </div>

                <div class="v2-deep-data-block">
                  <div class="v2-deep-data-block-head">
                    <p class="v2-proto-kicker">分析线</p>
                    <span class="v2-proto-status">{{ analysisTrackCards.length }} 条</span>
                  </div>
                  <div class="v2-analysis-track-grid v2-analysis-track-grid--entry">
                    <div v-for="track in analysisTrackCards" :key="`${track.key}-sidebar`" class="v2-analysis-track-card">
                      <div class="v2-analysis-track-head">
                        <span class="v2-proto-status">{{ track.label }}</span>
                        <span class="v2-analysis-track-pack">{{ track.packTitle }}</span>
                      </div>
                      <p class="v2-proto-advice-copy">{{ track.summary }}</p>
                    </div>
                  </div>
                </div>

                <p v-if="latestJob?.error_message || errorMessage" class="v2-danger">{{ latestJob?.error_message || errorMessage }}</p>
                <div v-if="latestJob?.status === 'failed'" class="v2-proto-button-row v2-proto-button-row--end">
                  <button
                    type="button"
                    class="btn-ghost"
                    :disabled="retryingLatestJob"
                    @click="handleRetryLatestJob"
                  >
                    {{ retryingLatestJob ? "重试中..." : "重新蒸馏" }}
                  </button>
                </div>
              </div>
            </aside>

            <section class="report-section v2-deep-workspace v2-deep-workspace--chat">
              <div class="v2-chat-window-head">
                <div class="v2-chat-window-head-main">
                  <div class="v2-chat-window-title">{{ activeSessionDisplayTitle }}</div>
                  <p class="v2-chat-window-meta">
                    {{ activeAssistantName }} · {{ activeSessionStatus }} · {{ activeRecentSessionLabel }}
                  </p>
                </div>
                <div class="v2-chat-window-actions">
                  <div class="v2-chip-row">
                    <button
                      v-for="option in distillIntensityOptions"
                      :key="option.value"
                      type="button"
                      class="v2-btn v2-btn--compact"
                      :class="distillIntensity === option.value ? 'v2-btn--primary' : 'v2-btn--ghost'"
                      @click="distillIntensity = option.value"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                  <button
                    v-if="canGenerateReport && !hasActiveDistillJob"
                    type="button"
                    class="btn-primary"
                    :disabled="distilling"
                    @click="handleDistill"
                  >
                    {{ distilling ? "生成中..." : "生成蒸馏结果" }}
                  </button>
                  <button v-if="showReportState" type="button" class="btn-ghost" @click="currentStep = 4">
                    查看蒸馏结果
                  </button>
                </div>
              </div>

              <div class="v2-chat-skill-strip" role="tablist" aria-label="聊天顶部 skill 切换">
                <button
                  v-for="item in compactSkillConversationItems"
                  :key="item.key"
                  type="button"
                  class="v2-chat-skill-pill"
                  :class="{ 'is-active': item.active }"
                  @click="item.slug && activateSkillConversation(item.slug)"
                >
                  <span class="v2-chat-skill-pill-mark" :style="item.avatars[0]?.style">
                    {{ item.avatars[0]?.label || item.title.slice(0, 1) }}
                  </span>
                  <span class="v2-chat-skill-pill-copy">
                    <strong>{{ item.title }}</strong>
                    <small>{{ item.updatedLabel }}</small>
                  </span>
                </button>
              </div>

              <p v-if="activeChatError" class="v2-danger v2-chat-window-error">{{ activeChatError }}</p>

              <div ref="activeThreadRef" class="v2-chat-thread v2-deep-chat-thread">
                <section v-if="activeSkillSwitchSuggestion" class="v2-chat-inline-switch-card v2-chat-inline-switch-card--deep">
                  <div class="v2-chat-inline-switch-head">
                    <div>
                      <p class="v2-section-kicker">Skill Suggestion</p>
                      <h3 class="v2-chat-inline-switch-title">检测到可加入的支援 skill：{{ activeSkillSwitchSuggestion.name }}</h3>
                    </div>
                    <span class="v2-status-pill">不自动切换</span>
                  </div>
                  <p class="v2-chat-inline-switch-copy">{{ activeSkillSwitchSuggestion.reason }}</p>
                  <div class="v2-chat-inline-switch-actions">
                    <button
                      type="button"
                      class="v2-btn v2-btn--primary"
                      :disabled="activeChatSending || activeChatBootstrapping"
                      @click="applyActiveSkillSwitchSuggestion"
                    >
                      加入并继续
                    </button>
                    <button
                      type="button"
                      class="v2-btn v2-btn--ghost"
                      :disabled="activeChatSending"
                      @click="dismissActiveSkillSwitchSuggestion"
                    >
                      先继续当前
                    </button>
                  </div>
                </section>

                <div v-if="activeChatBootstrapping && !activeChatMessages.length" class="v2-chat-row">
                  <div class="v2-chat-avatar v2-chat-avatar--assistant" :style="activeAssistantAvatarStyle">
                    {{ activeAssistantAvatarLabel }}
                  </div>
                  <div class="v2-chat-bubble-stack">
                    <p class="v2-chat-speaker">{{ activeAssistantName }}</p>
                    <div class="v2-chat-bubble v2-chat-bubble--assistant">
                      <p>正在恢复最近会话并连接 {{ activeAssistantName }}...</p>
                    </div>
                  </div>
                </div>

                <div v-else-if="!activeChatMessages.length" class="v2-chat-row">
                  <div class="v2-chat-avatar v2-chat-avatar--assistant" :style="activeAssistantAvatarStyle">
                    {{ activeAssistantAvatarLabel }}
                  </div>
                  <div class="v2-chat-bubble-stack">
                    <p class="v2-chat-speaker">{{ activeAssistantName }}</p>
                    <div class="v2-chat-bubble v2-chat-bubble--assistant">
                      <p>{{ activeWelcomeMessage }}</p>
                    </div>
                  </div>
                </div>

                <div
                  v-for="message in activeChatMessages"
                  :key="message.message_id"
                >
                  <div
                    v-if="isSystemNotice(message)"
                    class="mx-auto flex max-w-[32rem] items-center justify-center px-4 py-2 text-center text-[12px] leading-5 text-[#9aa3af]"
                  >
                    <span>{{ message.content }}</span>
                  </div>
                  <div
                    v-else
                    class="v2-chat-row"
                    :class="{ 'is-user': message.role === 'user' }"
                  >
                    <div
                      class="v2-chat-avatar"
                      :class="message.role === 'assistant' ? 'v2-chat-avatar--assistant' : 'v2-chat-avatar--user'"
                      :style="message.role === 'assistant' ? activeAssistantAvatarStyle : undefined"
                    >
                      {{ message.role === "assistant" ? activeAssistantAvatarLabel : activeUserAvatarLabel }}
                    </div>
                    <div class="v2-chat-bubble-stack">
                      <p class="v2-chat-speaker">{{ message.role === "assistant" ? activeAssistantName : "你" }}</p>
                      <div
                        class="v2-chat-bubble"
                        :class="message.role === 'assistant' ? 'v2-chat-bubble--assistant' : 'v2-chat-bubble--user'"
                      >
                        <p>{{ message.content }}</p>
                        <img
                          v-if="activeMessageImageUrl(message)"
                          class="v2-chat-upload-image"
                          :src="activeMessageImageUrl(message)"
                          :alt="activeMessageImageAlt(message)"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div class="v2-chat-row v2-chat-row--system">
                  <div class="v2-chat-bubble-stack v2-chat-bubble-stack--system">
                    <p class="v2-chat-speaker">系统</p>
                    <div class="v2-chat-bubble v2-chat-bubble--system">
                      <p>{{ activeDistillModeSystemMessage }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="v2-chat-composer v2-deep-chat-composer">
                <input
                  :key="activeChatImageInputKey"
                  ref="activeChatImagePickerRef"
                  type="file"
                  accept="image/*"
                  class="v2-deep-chat-file-input"
                  @change="handleActiveChatImageFileChange"
                />
                <input
                  :key="activeChatFileInputKey"
                  ref="activeChatFilePickerRef"
                  type="file"
                  class="v2-deep-chat-file-input"
                  @change="handleActiveChatMaterialFileChange"
                />
                <textarea
                  ref="activeComposerRef"
                  v-model="activeChatDraft"
                  class="v2-textarea"
                  rows="4"
                  :placeholder="activeChatComposerPlaceholder"
                  :disabled="!activeSession || activeChatSending || activeChatBootstrapping || activeChatMaterialUploading"
                  @blur="normalizeActiveDraft"
                  @keydown="handleActiveChatKeydown"
                  @paste="handleActiveComposerPaste"
                />
                <div class="v2-page-actions v2-page-actions--end">
                  <button
                    type="button"
                    class="v2-deep-chat-composer-tool"
                    :disabled="activeChatMaterialUploading || activeChatSending || activeChatBootstrapping"
                    title="上传图片"
                    @click="triggerActiveChatImagePicker"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5.5 6.5h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
                      <path d="M8 14.5l2.3-2.6a1 1 0 0 1 1.5 0l1.6 1.8 1.5-1.6a1 1 0 0 1 1.5 0l2.1 2.4" />
                      <circle cx="9" cy="10" r="1.1" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="v2-deep-chat-composer-tool"
                    :disabled="activeChatMaterialUploading || activeChatSending || activeChatBootstrapping"
                    title="上传文件"
                    @click="triggerActiveChatFilePicker"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4.5 7.5a2 2 0 0 1 2-2h3.1a2 2 0 0 1 1.4.57l1.03 1.03A2 2 0 0 0 13.44 7.7H17.5a2 2 0 0 1 2 2v6.8a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V7.5Z" />
                    </svg>
                  </button>
                  <button
                    class="v2-btn v2-btn--primary"
                    :disabled="activeChatSending || activeChatMaterialUploading || !normalizedActiveChatDraft || !activeSession"
                    @click="sendActiveAssistantMessage"
                  >
                    {{ activeChatMaterialUploading ? "上传中..." : activeChatSendLabel }}
                  </button>
                </div>
                <p v-if="activeChatComposerNotice" class="v2-report-meta-note">{{ activeChatComposerNotice }}</p>
              </div>
            </section>
          </div>
        </section>

        <section v-else class="v2-create-section v2-stage-section">
          <div v-if="!showReportState" class="report-section v2-results-loading-shell">
            <div class="v2-results-loading-top">
              <div class="v2-results-loading-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path
                    d="M9 3h6v2l-1.75 4.95A5.5 5.5 0 0 1 17 15v1a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3v-1a5.5 5.5 0 0 1 3.75-5.05L9 5V3Zm2 2v.58l-2.08 5.9A3.5 3.5 0 0 0 10 18h4a3.5 3.5 0 0 0 1.08-6.52L13 5.58V5h-2Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div class="v2-results-loading-copy">
                <div class="serif v2-results-loading-title">正在蒸馏中...</div>
                <p class="v2-proto-advice-copy">{{ distillLoadingSummary }}</p>
              </div>
            </div>

            <div class="v2-results-loading-meter">
              <div class="v2-results-loading-bar">
                <div class="v2-results-loading-bar-fill" :style="{ width: `${hasActiveDistillJob ? progressPercent : readinessPercent}%` }" />
              </div>
              <div class="v2-results-loading-stage">{{ distillLoadingStage }}</div>
            </div>

            <div v-if="projectReadiness" class="v2-readiness-list">
              <p class="v2-proto-advice-title">报告就绪度 {{ readinessPercent }}%</p>
              <p class="v2-proto-advice-copy">{{ readinessSummary }}</p>
              <p v-for="item in readinessBlockers.slice(0, 3)" :key="item.code + item.detail" class="v2-proto-advice-copy">
                {{ item.detail }}
              </p>
            </div>

            <div class="v2-analysis-track-grid">
              <div v-for="track in analysisTrackCards" :key="`${track.key}-loading`" class="v2-analysis-track-card">
                <div class="v2-analysis-track-head">
                  <span class="v2-proto-status">{{ track.label }}</span>
                  <span class="v2-analysis-track-pack">{{ track.packTitle }}</span>
                </div>
                <p class="v2-proto-advice-copy">{{ track.summary }}</p>
              </div>
            </div>

            <div class="v2-proto-button-row v2-proto-button-row--between">
              <button type="button" class="btn-ghost" @click="currentStep = 3">返回{{ distillStageLabel }}</button>
              <button
                v-if="canGenerateReport && !hasActiveDistillJob"
                type="button"
                class="btn-primary"
                :disabled="distilling"
                @click="handleDistill"
              >
                {{ distilling ? "生成中..." : "生成蒸馏结果" }}
              </button>
              <button
                v-if="latestJob?.status === 'failed'"
                type="button"
                class="btn-primary"
                :disabled="retryingLatestJob"
                @click="handleRetryLatestJob"
              >
                {{ retryingLatestJob ? "重试中..." : "重新蒸馏" }}
              </button>
            </div>
          </div>

          <div v-else-if="reportPreview" id="reportState" class="v2-results-shell v2-results-shell--locked">
            <div class="v2-results-hero v2-results-hero--locked">
              <div class="v2-results-badge">蒸馏完成</div>
              <h3 class="serif v2-results-title">{{ form.name || "人物画像报告" }}</h3>
              <p class="v2-proto-advice-copy">三张核心卡片默认加密展示。点击卡片可通过分享邀请或支付解锁，解锁后可查看独立详情并下载长图。</p>
            </div>

            <div class="v2-result-lock-grid">
              <article
                v-for="card in resultLockCards"
                :key="card.key"
                class="v2-result-lock-card"
                :class="{
                  'is-center': card.key === 'distill_graph',
                  'is-unlocked': isResultCardUnlocked(card.key),
                }"
                @click="handleResultCardClick(card.key)"
              >
                <div class="v2-result-lock-head">
                  <div>
                    <p class="v2-result-lock-code">{{ card.cardCode }}</p>
                    <h4 class="v2-result-lock-title">{{ card.title }}</h4>
                  </div>
                  <span class="v2-result-lock-dot" :class="`is-${card.accent}`" />
                </div>

                <div class="v2-result-lock-body" :class="{ 'is-blurred': !isResultCardUnlocked(card.key) }">
                  <div v-if="card.key === 'distill_graph'" class="v2-result-lock-graph">
                    <span class="v2-result-lock-graph-polygon" />
                    <span class="v2-result-lock-graph-core" />
                    <span class="v2-result-lock-graph-node is-n1" />
                    <span class="v2-result-lock-graph-node is-n2" />
                    <span class="v2-result-lock-graph-node is-n3" />
                    <span class="v2-result-lock-graph-node is-n4" />
                    <span class="v2-result-lock-graph-node is-n5" />
                  </div>

                  <p class="v2-result-lock-subtitle">{{ card.subtitle }}</p>
                  <p class="v2-result-lock-summary">{{ card.summary }}</p>

                  <div class="v2-result-lock-metrics">
                    <div v-for="metric in card.metrics" :key="`${card.key}-${metric.label}`" class="v2-result-lock-metric">
                      <span>{{ metric.label }}</span>
                      <strong>{{ isResultCardUnlocked(card.key) ? metric.value : "??" }}</strong>
                    </div>
                  </div>
                </div>

                <div v-if="!isResultCardUnlocked(card.key)" class="v2-result-lock-mask">
                  <span>点击查看解锁方式</span>
                </div>
                <div v-else class="v2-result-lock-foot">
                  <span>已解锁</span>
                  <span>点击查看详情</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section v-if="errorMessage && currentStep !== 3 && currentStep !== 4" class="v2-proto-error-card">
          <p class="v2-danger">{{ errorMessage }}</p>
        </section>
      </div>
    </div>

    <div class="modal-overlay" :class="{ show: distillModeModalOpen }" @click.self="closeDistillModeModal">
      <div v-if="distillModeModalOpen" class="modal-content">
        <div class="v2-factory-modal v2-skill-modal">
          <div class="v2-factory-modal-head">
            <div>
              <p class="v2-proto-kicker">蒸馏机入口</p>
              <div class="v2-self-chat-title">确认蒸馏逻辑</div>
            </div>
            <button type="button" class="btn-ghost" @click="closeDistillModeModal">关闭</button>
          </div>

          <div class="v2-distill-modal-group">
            <div class="v2-distill-modal-group-head">
              <p class="v2-proto-kicker">蒸馏策略</p>
              <span class="v2-proto-status">{{ activeFocusChip.label }}</span>
            </div>
            <div class="v2-distill-strategy-grid">
              <button
                v-for="chip in focusChips"
                :key="chip.value"
                type="button"
                class="v2-distill-strategy-card"
                :class="{ 'is-active': intake.key_concern === chip.value }"
                @click="selectFocusChip(chip.value)"
              >
                <span class="v2-distill-strategy-mark">{{ chip.icon }}</span>
                <span class="v2-distill-strategy-copy">
                  <strong>{{ chip.label }}</strong>
                  <small>{{ chip.tagline }}</small>
                </span>
              </button>
            </div>
          </div>

          <div class="v2-distill-modal-group">
            <div class="v2-distill-modal-group-head">
              <p class="v2-proto-kicker">蒸馏强度</p>
            </div>
          <div class="v2-result-unlock-actions">
            <button
              type="button"
              class="v2-result-unlock-action"
              :disabled="creating"
              @click="selectDistillMode('gentle')"
            >
              <div class="v2-result-unlock-action-icon">小</div>
              <div>
                <strong>小火蒸馏</strong>
                <p>此模式不强制约束 skill 规范，可先依据假设性问题和选择题答案生成初版报告。</p>
                <p>通常完成 {{ gentleQuestionTarget }} 道选择题即可生成首版画像，答题可直接回复 1/2/3/4 或 A/B/C/D。</p>
              </div>
            </button>

            <button
              type="button"
              class="v2-result-unlock-action"
              :disabled="creating"
              @click="selectDistillMode('intense')"
            >
              <div class="v2-result-unlock-action-icon">猛</div>
              <div>
                <strong>猛火蒸馏</strong>
                <p>继续按当前 skill 的强约束深挖，优先少量高价值追问，不轻易切成泛问卷。</p>
                <p>适合你已经有明确材料、想更快进入深入判断的时候。</p>
              </div>
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" :class="{ show: resultUnlockModalOpen }" @click.self="closeResultUnlockModal">
      <div v-if="pendingUnlockCardDetail" class="modal-content v2-result-unlock-modal">
        <div class="v2-result-unlock-head">
          <div>
            <p class="v2-proto-kicker">解锁卡片</p>
            <h3 class="v2-self-chat-title">解锁 {{ pendingUnlockCardDetail.title }}</h3>
          </div>
          <button type="button" class="btn-ghost" @click="closeResultUnlockModal">关闭</button>
        </div>

        <p class="v2-proto-advice-copy">你可以分享邀请免费解锁，也可以直接支付解锁。解锁后可打开独立详情页并下载长图。</p>

        <div class="v2-result-unlock-actions">
          <button type="button" class="v2-result-unlock-action" @click="unlockResultCard('share')">
            <div class="v2-result-unlock-action-icon">分</div>
            <div>
              <strong>分享邀请链接</strong>
              <p>分享给好友注册即可免费解锁</p>
            </div>
          </button>

          <button type="button" class="v2-result-unlock-action v2-result-unlock-action--pay" @click="unlockResultCard('pay')">
            <div class="v2-result-unlock-action-icon">付</div>
            <div>
              <strong>立即解锁 ¥9.9</strong>
              <p>一次性付费，永久查看并支持长图下载</p>
            </div>
          </button>
        </div>
      </div>
    </div>

    <div class="modal-overlay v2-result-detail-overlay" :class="{ show: Boolean(activeResultCardDetail) }" @click.self="closeResultCardDetail">
      <div v-if="activeResultCardDetail" class="modal-content v2-result-detail-modal">
        <div class="v2-result-detail-topbar">
          <button type="button" class="btn-ghost" @click="downloadActiveResultCardPoster">下载长图</button>
          <button type="button" class="btn-ghost" @click="closeResultCardDetail">关闭</button>
        </div>

        <section class="v2-result-detail-poster" ref="resultDetailPosterRef">
          <p class="v2-result-detail-code">{{ activeResultCardDetail.cardCode }}</p>
          <h3 class="serif v2-result-detail-title">{{ activeResultCardDetail.detailTitle }}</h3>
          <p class="v2-result-detail-subtitle">{{ activeResultCardDetail.detailSubtitle }}</p>

          <div class="v2-result-detail-metrics">
            <div
              v-for="metric in activeResultCardDetail.metrics"
              :key="`${activeResultCardDetail.key}-${metric.label}`"
              class="v2-result-detail-metric"
            >
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </div>

          <blockquote class="v2-result-detail-quote">“{{ activeResultCardDetail.detailQuote }}”</blockquote>
          <div class="v2-result-detail-meta">
            <span>FOR: {{ form.subject_name || "Distill User" }}</span>
            <span>DATE: {{ resultCardDetailDate }}</span>
          </div>
        </section>
      </div>
    </div>

    <div class="modal-overlay" :class="{ show: skillDetailModalOpen }" @click.self="closeSkillDetailModal">
      <div v-if="modalSkillDetail" class="modal-content">
        <div class="v2-factory-modal v2-skill-modal">
          <div class="v2-factory-modal-head">
            <div>
              <p class="v2-proto-kicker">Skill 详情</p>
              <div class="v2-self-chat-title">{{ modalSkillDetail.pack.title }}</div>
              <p class="v2-proto-advice-copy">{{ modalSkillDetail.summary }}</p>
            </div>
            <button type="button" class="btn-ghost" @click="closeSkillDetailModal">关闭</button>
          </div>

          <div class="v2-chip-row">
            <span class="v2-chip">{{ modalSkillDetail.pack.factory_category_label }}</span>
            <span class="v2-chip">{{ modalSkillDetail.pack.display_group_label }}</span>
            <span v-if="modalSkillDetail.candidate" class="v2-chip">#{{ modalSkillDetail.candidate.rank }}</span>
            <span v-if="modalSkillDetail.candidate" class="v2-chip">权重 {{ modalSkillDetail.candidate.weight }}%</span>
            <span class="v2-chip">{{ isSkillRouterPackSelected(modalSkillDetail.pack.slug) ? "已加载" : "未加载" }}</span>
          </div>

          <div class="v2-skill-modal-grid">
            <section class="v2-skill-modal-section">
              <div class="v2-proto-advice-title">推荐理由</div>
              <div class="v2-skill-reason-list">
                <p v-for="reason in modalSkillDetail.reasons" :key="reason" class="v2-report-meta-note">{{ reason }}</p>
              </div>
            </section>

            <section v-if="modalSkillDetail.tags.length" class="v2-skill-modal-section">
              <div class="v2-proto-advice-title">标签 / 能力</div>
              <div class="v2-chip-row">
                <span v-for="tag in modalSkillDetail.tags" :key="`${modalSkillDetail.pack.slug}-${tag}`" class="v2-chip">{{ tag }}</span>
              </div>
            </section>

            <section v-if="modalSkillDetail.matchedNames.length" class="v2-skill-modal-section">
              <div class="v2-proto-advice-title">命中名字</div>
              <div class="v2-chip-row">
                <span v-for="matchedName in modalSkillDetail.matchedNames" :key="matchedName" class="v2-chip">{{ matchedName }}</span>
              </div>
            </section>

            <section v-if="modalSkillDetail.useCases.length" class="v2-skill-modal-section">
              <div class="v2-proto-advice-title">适合拿来整理什么</div>
              <div class="v2-chip-row">
                <span v-for="useCase in modalSkillDetail.useCases" :key="useCase" class="v2-chip">{{ useCase }}</span>
              </div>
            </section>

            <section v-if="modalSkillDetail.starterPrompts.length" class="v2-skill-modal-section">
              <div class="v2-proto-advice-title">可直接开聊的问题</div>
              <div class="v2-skill-reason-list">
                <p v-for="prompt in modalSkillDetail.starterPrompts" :key="prompt" class="v2-report-meta-note">{{ prompt }}</p>
              </div>
            </section>

            <section v-if="modalSkillDetail.sourceTitles.length" class="v2-skill-modal-section">
              <div class="v2-proto-advice-title">来源摘要</div>
              <div class="v2-skill-reason-list">
                <p v-for="source in modalSkillDetail.sourceTitles" :key="source" class="v2-report-meta-note">{{ source }}</p>
              </div>
            </section>
          </div>

          <div class="v2-factory-modal-footer">
            <div class="v2-factory-modal-footer-copy">
              <strong>去蒸馏一下，看看你是不是这样的人</strong>
              <span class="v2-report-meta-note">把它加入加载范围后，第三步会带着这个 skill 进入整理。</span>
            </div>
            <div class="v2-factory-modal-footer-actions">
              <button type="button" class="btn-ghost" @click="closeSkillDetailModal">关闭</button>
              <button
                type="button"
                class="btn-primary"
                :disabled="isSelfTarget && modalSkillDetail.pack.slug !== FIXED_SELF_PACK_SLUG"
                @click="toggleSkillRouterPack(modalSkillDetail.pack.slug)"
              >
                {{ isSkillRouterPackSelected(modalSkillDetail.pack.slug) ? "取消加载" : "加载这个 skill" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </V2AppShell>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"

import { api } from "@/lib/api"
import { ChatSocketClient } from "@/lib/chatSocket"
import { useAuthStore } from "@/stores/auth"
import type {
  ChatExpertRecommendation,
  ChatMessage,
  ChatSessionBootstrapResponse,
  ChatSessionSummary,
  ChatStreamDonePayload,
  DistillIntensity,
  DistillTargetConfig as ApiDistillTargetConfig,
  DistillTargetSettingsResponse,
  DistillJob,
  DistillReport,
  MaterialSummary,
  PackCloneResponse,
  PackDetailResponse,
  PackRecommendationItem,
  PackRecommendationRequest,
  PackRecommendationResponse,
  PackSummary,
  ProjectDetailResponse,
  ProjectReadinessResponse,
  ProjectSummary,
  SubjectType,
} from "@/types"
import V2AppShell from "@/v2/components/V2AppShell.vue"

type WizardStep = 1 | 2 | 3 | 4
type TargetKey = string
type SkillMode = "auto" | "custom"
type EvidenceType = "chat_export" | "screenshot" | "text_note" | "public_reference"
type ResultCardKey = "mbti_profile" | "distill_graph" | "recommendation"
type ResultUnlockAction = "share" | "pay"
type FocusChipValue = "portrait_report" | "expression_clone" | "decision_mirror"
type StageHeading = {
  kicker: string
  title: string
  subtitle: string
}

interface TargetConfig {
  key: string
  label: string
  icon: string
  enabled: boolean
  subjectType: SubjectType
  subjectDefault: string
  subjectPlaceholder: string
  projectPlaceholder: string
  projectDefault: string
  goalDefault: string
  goalPlaceholder: string
  relationLabel: string
  assistantTitle: string
  packKeywords: string[]
  configuredNames: string[]
  starterPrompts: string[]
  fallbackPackSlug: string
  attachedPackSlugs: string[]
}

interface TargetChipOption {
  key: TargetKey
  label: string
  icon: string
  matchedPackSlug?: string
  matchedPackTitle?: string
}

interface SessionAvatar {
  label: string
  style: Record<string, string>
}

interface DeepConversationItem {
  key: string
  kind: "precision" | "skill"
  title: string
  subtitle: string
  hint: string
  updatedLabel: string
  active: boolean
  avatars: SessionAvatar[]
  slug?: string
}

interface RankedSkillCandidateView {
  pack: PackSummary
  score: number
  rank: number
  weight: number
  exactNameHit: boolean
  reasons: string[]
  matchedNames: string[]
}

interface FocusChipOption {
  value: FocusChipValue
  label: string
  icon: string
  legacyLabel: string
  tagline: string
  summary: string
  detail: string
}

interface FocusGoalCopy {
  default: string
  placeholder: string
}

interface ResultCardMetric {
  label: string
  value: string
}

interface ResultLockCard {
  key: ResultCardKey
  cardCode: string
  title: string
  subtitle: string
  summary: string
  accent: "mint" | "amber" | "violet"
  metrics: ResultCardMetric[]
  detailTitle: string
  detailSubtitle: string
  detailQuote: string
}

const FIXED_SELF_PACK_SLUG = "github-notdog1998-yourself-skill"
const DEFAULT_PERSONALITY_PACK_SLUG = ""
const PERSONALITY_SKILL_PATTERN = /sbti|mbti|人格测试|赛博人格|personality test|性格测试|性格分析/i
const EMOTION_SKILL_PATTERN = /emotion|emotional|relationship|attachment|love|恋爱|亲密|前任|暧昧|关系|情绪|情感|边界/i
const GENTLE_QUESTION_TARGET = 12
const GENTLE_OPTION_LINE_PATTERN = /(?:^|\n)\s*(?:[A-Da-d]|[1-4])(?:[.、:：)\]])\s*.+/gm
const GENTLE_OPTION_PROMPT_PATTERN = /(选择题|假设|如果只能|更接近|更像|哪一个|哪一种|四个选项|1\/2\/3\/4|a\/b\/c\/d)/i

const fallbackTargetConfigs: Record<string, TargetConfig> = {
  self: {
    key: "self",
    label: "自己",
    icon: "我",
    enabled: true,
    subjectType: "self",
    subjectDefault: "我自己",
    subjectPlaceholder: "例如：我自己 / Wade / 当前的我",
    projectPlaceholder: "例如：我的人物画像报告",
    projectDefault: "我的人物画像报告",
    goalDefault: "我想先看清自己的表达习惯和性格画像",
    goalPlaceholder: "例如：我想看清自己的表达习惯、性格画像和决策方式",
    relationLabel: "myself",
    assistantTitle: "自我蒸馏模式",
    packKeywords: ["self", "自己", "自我", "identity"],
    configuredNames: ["自己", "自我", "identity"],
    starterPrompts: [
      "先别急着下结论，问我 3 个问题，帮我把这次自我蒸馏目标问清楚。",
      "如果我要蒸馏自己，最值得先补的 3 类素材是什么？",
      "按自我蒸馏路径，先帮我判断我现在最该看清的是性格、表达还是决策习惯。",
    ],
    fallbackPackSlug: FIXED_SELF_PACK_SLUG,
    attachedPackSlugs: [],
  },
  ex: {
    key: "ex",
    label: "前任",
    icon: "旧",
    enabled: true,
    subjectType: "private_person",
    subjectDefault: "前任",
    subjectPlaceholder: "例如：前任 / 前任 A",
    projectPlaceholder: "例如：前任人物画像报告",
    projectDefault: "前任人物画像报告",
    goalDefault: "先看清 TA 的关系模式、情绪风格和决策习惯",
    goalPlaceholder: "例如：我想看清 TA 的关系模式、情绪触发点和表达风格",
    relationLabel: "ex_partner",
    assistantTitle: "关系蒸馏模式",
    packKeywords: ["relationship", "emotion", "亲密", "恋爱", "情绪", "关系"],
    configuredNames: ["前任", "关系", "情感", "亲密"],
    starterPrompts: [
      "按前任画像模式，先问我 3 个问题，帮我确认我到底想看清 TA 的哪一面。",
      "如果我要判断前任的关系模式，最值得先补什么材料？",
      "先按人格测试路径，帮我区分 TA 更像情绪驱动还是决策驱动。",
    ],
    fallbackPackSlug: DEFAULT_PERSONALITY_PACK_SLUG,
    attachedPackSlugs: [],
  },
  classmate: {
    key: "classmate",
    label: "同学",
    icon: "同",
    enabled: true,
    subjectType: "private_person",
    subjectDefault: "同学",
    subjectPlaceholder: "例如：同学 / 同学 A",
    projectPlaceholder: "例如：同学人物画像报告",
    projectDefault: "同学人物画像报告",
    goalDefault: "先看清 TA 的表达风格、相处节奏和成长倾向",
    goalPlaceholder: "例如：我想看清 TA 的表达风格、相处节奏和边界感",
    relationLabel: "classmate_peer",
    assistantTitle: "同学蒸馏模式",
    packKeywords: ["classmate", "schoolmate", "peer", "同学", "校园", "同龄", "成长"],
    configuredNames: ["同学", "校园", "classmate", "peer"],
    starterPrompts: [
      "按同学画像模式，先问我 3 个问题，帮我确认更想看清相处方式还是人格倾向。",
      "如果我要判断这个同学的沟通方式，最适合先补哪类材料？",
      "直接进入 SBTI 测试路径，帮我判断这个同学更像哪种人格倾向。",
    ],
    fallbackPackSlug: DEFAULT_PERSONALITY_PACK_SLUG,
    attachedPackSlugs: [],
  },
  boss: {
    key: "boss",
    label: "老板",
    icon: "冠",
    enabled: true,
    subjectType: "private_person",
    subjectDefault: "老板",
    subjectPlaceholder: "例如：老板 / 直属老板",
    projectPlaceholder: "例如：老板人物画像报告",
    projectDefault: "老板人物画像报告",
    goalDefault: "先看清 TA 的管理方式、偏好和判断阈值",
    goalPlaceholder: "例如：我想看清 TA 的管理方式、偏好和判断阈值",
    relationLabel: "boss_manager",
    assistantTitle: "管理蒸馏模式",
    packKeywords: ["manager", "boss", "leader", "管理", "决策", "组织"],
    configuredNames: ["老板", "管理", "leader", "manager"],
    starterPrompts: [
      "按老板画像模式，先问我 3 个问题，帮我确认我最该看清 TA 的管理风格还是决策方式。",
      "如果我要判断这个老板的用人偏好，最值得先补的材料是什么？",
      "先按人格测试路径，帮我判断这个老板是更重结果还是更重控制。",
    ],
    fallbackPackSlug: DEFAULT_PERSONALITY_PACK_SLUG,
    attachedPackSlugs: [],
  },
  mentor: {
    key: "mentor",
    label: "导师",
    icon: "师",
    enabled: true,
    subjectType: "private_person",
    subjectDefault: "导师",
    subjectPlaceholder: "例如：导师 / 教练 / 带教老师",
    projectPlaceholder: "例如：导师人物画像报告",
    projectDefault: "导师人物画像报告",
    goalDefault: "先看清 TA 的指导方式、反馈风格和成长偏好",
    goalPlaceholder: "例如：我想看清 TA 的指导方式、反馈风格和成长偏好",
    relationLabel: "friend_family",
    assistantTitle: "指导蒸馏模式",
    packKeywords: ["mentor", "coach", "teacher", "导师", "指导", "成长"],
    configuredNames: ["导师", "指导", "mentor", "coach"],
    starterPrompts: [
      "按导师画像模式，先问我 3 个问题，帮我确认我更想看清 TA 的反馈方式还是培养方式。",
      "如果我要判断这个导师的指导风格，最适合先补什么材料？",
      "先按人格测试路径，帮我判断这个导师更偏结构化还是启发式带人。",
    ],
    fallbackPackSlug: DEFAULT_PERSONALITY_PACK_SLUG,
    attachedPackSlugs: [],
  },
  nuwa: {
    key: "nuwa",
    label: "女娲",
    icon: "娲",
    enabled: true,
    subjectType: "public_figure",
    subjectDefault: "全人类",
    subjectPlaceholder: "例如：全人类 / 某一类人群 / 互联网众生相",
    projectPlaceholder: "例如：女娲全人类蒸馏报告",
    projectDefault: "女娲全人类蒸馏报告",
    goalDefault: "先看清这一类人的共性、分层和行为图谱",
    goalPlaceholder: "例如：我想看清某一类人群的共性、分层和行为图谱",
    relationLabel: "all_humanity",
    assistantTitle: "女娲蒸馏模式",
    packKeywords: ["nuwa", "女娲", "全人类", "人类", "群体", "population", "archetype"],
    configuredNames: ["女娲", "全人类", "群体画像", "population"],
    starterPrompts: [
      "按女娲模式，先问我 3 个问题，帮我确认我要蒸馏的是哪一类人。",
      "如果要蒸馏一个群体画像，我最该先补哪几类材料？",
      "先帮我把这个群体拆成几种典型子类型，再决定从哪条 skill 线切入。",
    ],
    fallbackPackSlug: DEFAULT_PERSONALITY_PACK_SLUG,
    attachedPackSlugs: [],
  },
}

const wizardSteps = computed(() => [
  { step: 1 as WizardStep, code: "1", label: "开始蒸馏" },
  { step: 3 as WizardStep, code: "2", label: "进入蒸馏机" },
  { step: 4 as WizardStep, code: "3", label: "蒸馏结果" },
])

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const currentStep = ref<WizardStep>(1)
const distillIntensity = ref<DistillIntensity>("intense")
const creating = ref(false)
const uploading = ref(false)
const distilling = ref(false)
const retryingLatestJob = ref(false)
const deletingMaterialId = ref("")
const errorMessage = ref("")
const isDragOver = ref(false)
const reportBridgeEntered = ref(false)

const projectId = ref("")
const latestJob = ref<DistillJob | null>(null)
const projectReadiness = ref<ProjectReadinessResponse | null>(null)
const reportPreview = ref<DistillReport | null>(null)
const projectMaterials = ref<MaterialSummary[]>([])
const fileRef = ref<File | null>(null)
const fileInputKey = ref(0)
const packs = ref<PackSummary[]>([])
const packsLoading = ref(false)
const distillTargetConfigs = ref<TargetConfig[]>([])
const backendPackRecommendation = ref<PackRecommendationResponse | null>(null)
const backendPackRecommendationLoading = ref(false)
const selectedSkillMode = ref<SkillMode>("auto")
const manualPackSlug = ref("")
const expandedSkillSlug = ref("")
const skillDetailModalSlug = ref("")
const activeFocusHint = ref<FocusChipValue | "">("")
const skillRouterSelectedPackSlugs = ref<string[]>([])
const skillPoolSearch = ref("")
const activeDeepView = ref<"chat" | "precision">("chat")
const activeChatDraft = ref("")
const activeChatSending = ref(false)
const activeChatStatusText = ref("")
const activeChatBootstrapping = ref(false)
const activeChatError = ref("")
const activeThreadRef = ref<HTMLElement | null>(null)
const activeComposerRef = ref<HTMLTextAreaElement | null>(null)
const activeChatImagePickerRef = ref<HTMLInputElement | null>(null)
const activeChatFilePickerRef = ref<HTMLInputElement | null>(null)
const activeChatImageInputKey = ref(0)
const activeChatFileInputKey = ref(0)
const activeChatMaterialUploading = ref(false)
const activeChatComposerNotice = ref("")
const activeSkillProject = ref<ProjectSummary | null>(null)
const activeSession = ref<ChatSessionSummary | null>(null)
const activeChatMessages = ref<ChatMessage[]>([])
const activeChatRecommendation = ref<ChatExpertRecommendation | null>(null)
const dismissedActiveSkillSuggestionId = ref("")
const distillModeModalOpen = ref(false)
const resultUnlockModalOpen = ref(false)
const pendingUnlockCardKey = ref<ResultCardKey | "">("")
const unlockedResultCardKeys = ref<ResultCardKey[]>([])
const activeResultCardDetailKey = ref<ResultCardKey | "">("")
const resultDetailPosterRef = ref<HTMLElement | null>(null)
let packRecommendationTimer: number | undefined

const packDetailsBySlug = reactive<Record<string, PackDetailResponse>>({})
const expertDetailsById = reactive<Record<string, PackDetailResponse>>({})
const skillProjectsBySlug = reactive<Record<string, ProjectSummary>>({})
const skillSessionsBySlug = reactive<Record<string, ChatSessionSummary>>({})
const skillMessagesBySlug = reactive<Record<string, ChatMessage[]>>({})

let materialPollTimer: number | null = null
let jobPollTimer: number | null = null
let skillBootstrapNonce = 0
let activeChatSocket: ChatSocketClient | null = null
const activeChatPreviewObjectUrls = new Set<string>()

const form = reactive({
  name: "",
  subject_name: "",
  subject_type: "self" as SubjectType,
  relation_label: "myself",
  analysis_goal: "",
})

const intake = reactive({
  relationship_stage: "current_observation",
  distill_goal: "understand_persona",
  key_concern: "portrait_report",
})

const upload = reactive({
  evidence_type: "chat_export" as EvidenceType,
  label: "",
  text_content: "",
  consent_confirmed: false,
})

function normalizeTargetConfigPayload(config: ApiDistillTargetConfig): TargetConfig {
  const fallback = fallbackTargetConfigs[config.key] || fallbackTargetConfigs.mentor
  return {
    key: config.key,
    label: config.label || fallback.label,
    icon: config.icon || fallback.icon,
    enabled: config.enabled ?? true,
    subjectType: config.subject_type || fallback.subjectType,
    subjectDefault: config.subject_default || fallback.subjectDefault,
    subjectPlaceholder: config.subject_placeholder || fallback.subjectPlaceholder,
    projectPlaceholder: config.project_placeholder || fallback.projectPlaceholder,
    projectDefault: config.project_default || fallback.projectDefault,
    goalDefault: config.goal_default || fallback.goalDefault,
    goalPlaceholder: config.goal_placeholder || fallback.goalPlaceholder,
    relationLabel: config.relation_label || fallback.relationLabel,
    assistantTitle: config.assistant_title || fallback.assistantTitle,
    packKeywords: config.pack_keywords?.length ? config.pack_keywords : fallback.packKeywords,
    configuredNames: config.configured_names?.length ? config.configured_names : fallback.configuredNames,
    starterPrompts: config.starter_prompts?.length ? config.starter_prompts : fallback.starterPrompts,
    fallbackPackSlug: config.default_pack_slug || fallback.fallbackPackSlug,
    attachedPackSlugs: config.attached_pack_slugs?.length ? config.attached_pack_slugs : fallback.attachedPackSlugs,
  }
}

function isSelfConfig(config?: TargetConfig | null) {
  return !!config && (config.subjectType === "self" || config.relationLabel === "myself")
}

function isNuwaConfig(config?: TargetConfig | null) {
  return !!config && (config.relationLabel === "all_humanity" || config.subjectType === "public_figure")
}

const allTargetConfigs = computed<TargetConfig[]>(() => {
  if (distillTargetConfigs.value.length) return distillTargetConfigs.value
  return Object.values(fallbackTargetConfigs)
})

const enabledTargetConfigs = computed(() => allTargetConfigs.value.filter((item) => item.enabled))
const targetConfigMap = computed<Record<string, TargetConfig>>(() => (
  Object.fromEntries(allTargetConfigs.value.map((item) => [item.key, item]))
))

const focusChips: FocusChipOption[] = [
  {
    value: "portrait_report",
    label: "重生",
    icon: "重",
    legacyLabel: "人物画像报告",
    tagline: "先看清这个人",
    summary: "先看清“这个人是谁”",
    detail: "偏人格、风格、边界、稳定模式、MBTI/画像这类结果。",
  },
  {
    value: "expression_clone",
    label: "复制",
    icon: "复",
    legacyLabel: "表达复刻",
    tagline: "先抓说话方式",
    summary: "先抓“这个人怎么说话”",
    detail: "偏语气、措辞、回应方式、聊天风格，适合后续做更像 TA 的对话/回复。",
  },
  {
    value: "decision_mirror",
    label: "夺舍",
    icon: "夺",
    legacyLabel: "决策镜像",
    tagline: "先摸判断逻辑",
    summary: "先摸“这个人怎么判断”",
    detail: "偏价值排序、取舍逻辑、做决定时最看重什么，适合推演 TA 会怎么选、怎么给建议。",
  },
]

function resolveFocusGoalCopy(config?: TargetConfig | null, focus?: FocusChipValue): FocusGoalCopy {
  const mode = focus || "portrait_report"
  if (isSelfConfig(config)) {
    if (mode === "expression_clone") {
      return {
        default: "我想复刻自己的表达方式，让系统更像我地说话",
        placeholder: "例如：我想让系统更像我一样说话，保留我的语气、措辞和回应节奏",
      }
    }
    if (mode === "decision_mirror") {
      return {
        default: "我想摸清自己的判断逻辑和决策习惯",
        placeholder: "例如：我想看清自己做决定时最在意什么，会如何取舍和判断",
      }
    }
    return {
      default: "我想先看清自己到底是什么样的人",
      placeholder: "例如：我想先看清自己的性格、边界、稳定模式和人格画像",
    }
  }

  if (isNuwaConfig(config)) {
    if (mode === "expression_clone") {
      return {
        default: "我想提炼这一类人的典型表达方式和话语风格",
        placeholder: "例如：我想提炼这一类人的常见措辞、表达套路和说话风格",
      }
    }
    if (mode === "decision_mirror") {
      return {
        default: "我想抽出这一类人的共性判断规则和行为取舍",
        placeholder: "例如：我想看清这一类人通常怎么判断、取舍和做决定",
      }
    }
    return {
      default: "我想先看清这一类人的共性、分层和画像",
      placeholder: "例如：我想看清某一类人群的共性、分层、边界和典型画像",
    }
  }

  if (mode === "expression_clone") {
    return {
      default: "我想抓住 TA 的语气、措辞和回应方式",
      placeholder: "例如：我想抓住 TA 说话时的语气、常用词和回应节奏",
    }
  }
  if (mode === "decision_mirror") {
    return {
      default: "我想摸清 TA 做判断时最在意的信号和取舍逻辑",
      placeholder: "例如：我想看清 TA 做决定时最看重什么，会怎样取舍和判断",
    }
  }
  return {
    default: "我想先看清 TA 的人格、边界和稳定模式",
    placeholder: "例如：我想先看清 TA 的人格倾向、边界感和稳定行为模式",
  }
}

function focusGoalDefaultPool(configs: TargetConfig[]) {
  const values = new Set<string>()
  for (const config of configs) {
    for (const chip of focusChips) {
      values.add(resolveFocusGoalCopy(config, chip.value).default)
    }
  }
  return Array.from(values)
}

const activeGoalCopy = computed(() => resolveFocusGoalCopy(selectedTargetMeta.value, intake.key_concern as FocusChipValue))
const activeGoalPlaceholder = computed(() => activeGoalCopy.value.placeholder)
const activeFocusChip = computed(() => (
  focusChips.find((chip) => chip.value === intake.key_concern) || focusChips[0]
))

function selectFocusChip(value: FocusChipValue) {
  const goalDefaults = focusGoalDefaultPool(allTargetConfigs.value)
  intake.key_concern = value
  form.analysis_goal = defaultValueFallback(
    form.analysis_goal,
    resolveFocusGoalCopy(selectedTargetMeta.value, value).default,
    goalDefaults,
  )
  activeFocusHint.value = ""
}

function toggleFocusHint(value: FocusChipValue) {
  activeFocusHint.value = activeFocusHint.value === value ? "" : value
}

const materialTypePresets: Array<{ value: EvidenceType; label: string; icon: string; hint: string }> = [
  {
    value: "chat_export",
    label: "聊天记录",
    icon: "聊",
    hint: "适合导出的微信、QQ、Slack、飞书、钉钉聊天记录，也可直接粘贴长对话文本。",
  },
  {
    value: "screenshot",
    label: "截图",
    icon: "图",
    hint: "适合上传对话截图、朋友圈截图、界面截图，系统会先做 OCR 和结构化解析。",
  },
  {
    value: "text_note",
    label: "文字笔记",
    icon: "文",
    hint: "适合自述、观察笔记、采访摘要、复盘记录，尤其适合蒸馏自己。",
  },
  {
    value: "public_reference",
    label: "公开材料",
    icon: "链",
    hint: "适合 PDF、简历、文章、公开介绍等参考材料，用来补足背景信息。",
  },
]

const selectedTargetKey = computed<TargetKey>(() => {
  const exact = allTargetConfigs.value.find((item) => (
    item.subjectType === form.subject_type && item.relationLabel === form.relation_label
  ))
  if (exact) return exact.key
  if (form.subject_type === "self") return allTargetConfigs.value.find((item) => isSelfConfig(item))?.key || "self"
  if (form.relation_label === "all_humanity" || form.subject_type === "public_figure") {
    return allTargetConfigs.value.find((item) => isNuwaConfig(item))?.key || "nuwa"
  }
  if (form.relation_label === "boss_manager") return allTargetConfigs.value.find((item) => item.relationLabel === "boss_manager")?.key || "boss"
  if (form.relation_label === "ex_partner") return allTargetConfigs.value.find((item) => item.relationLabel === "ex_partner")?.key || "ex"
  return enabledTargetConfigs.value[0]?.key || allTargetConfigs.value[0]?.key || "self"
})

const selectedTargetMeta = computed(() => (
  targetConfigMap.value[selectedTargetKey.value]
  || allTargetConfigs.value[0]
  || fallbackTargetConfigs.self
))
const selectedTargetChip = computed(() => targetChips.value.find((item) => item.key === selectedTargetKey.value) || null)
const isSelfTarget = computed(() => isSelfConfig(selectedTargetMeta.value))
const hasStoredMaterials = computed(() => projectMaterials.value.length > 0)
const isReadyJob = computed(() => latestJob.value?.status === "report_ready" || latestJob.value?.status === "chat_ready")
const hasActiveDistillJob = computed(() => Boolean(latestJob.value?.job_id) && !isReadyJob.value && latestJob.value?.status !== "failed")
const showReportState = computed(() => Boolean(reportPreview.value))
const cameFromChat = computed(() => route.query.fromChat === "1")
const canGenerateReport = computed(() => Boolean(projectReadiness.value?.can_generate_report) && !distilling.value)
const isGentleDistill = computed(() => distillIntensity.value === "gentle")
const gentleQuestionTarget = computed(() => GENTLE_QUESTION_TARGET)
const readinessPercent = computed(() => projectReadiness.value?.readiness_percent || 0)
const taskStagePercent = computed(() => projectReadiness.value?.task_stage_percent || 6)
const readinessSummary = computed(() => projectReadiness.value?.summary || "继续补充材料和蒸馏对话，系统会自动判断何时达到正式生成门槛。")
const readinessBlockers = computed(() => (projectReadiness.value?.blockers || []).filter((item) => item.severity !== "info"))
const readinessQuestions = computed(() => projectReadiness.value?.next_questions || [])
const readinessChecklist = computed(() => projectReadiness.value?.checklist || [])
const readinessToolArtifacts = computed(() => projectReadiness.value?.tool_artifacts || [])

const previewCode = computed(() => {
  const raw = [
    reportPreview.value?.memory.summary,
    reportPreview.value?.persona.tone,
    ...(reportPreview.value?.persona.catchphrases || []),
  ].join(" ")
  return raw.match(/\b[A-Z]{4}\b/)?.[0] || "MBTI"
})

const previewTitle = computed(() => reportPreview.value?.persona.tone || "画像已生成")
const previewSkillCount = computed(() => {
  if (!reportPreview.value) return 0
  return new Set([
    ...reportPreview.value.persona.catchphrases,
    ...reportPreview.value.cognition.decision_heuristics,
    ...reportPreview.value.memory.recurring_topics,
  ]).size
})
const previewConfidence = computed(() => `${Math.round((reportPreview.value?.confidence.overall_score || 0) * 100)}%`)
const previewAdvice = computed(() => {
  if (!reportPreview.value) return []
  const pool = [
    ...reportPreview.value.cognition.suggested_use_cases,
    ...reportPreview.value.cognition.decision_heuristics,
    ...reportPreview.value.persona.interaction_preferences,
  ].filter(Boolean)
  return pool.slice(0, 3).map((copy, index) => ({
    title: ["优先建议", "沟通提醒", "下一步动作"][index] || `建议 ${index + 1}`,
    copy,
  }))
})

const resultCardDetailDate = computed(() => {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
})

const resultLockCards = computed<ResultLockCard[]>(() => {
  const traitTop = traitGraphItems.value.slice(0, 3)
  const recommendationMetrics = previewAdvice.value.slice(0, 3).map((item, index) => ({
    label: item.title || `建议 ${index + 1}`,
    value: item.copy || "待补充",
  }))
  return [
    {
      key: "mbti_profile",
      cardCode: "CARD 01",
      title: "MBTI 性格画像",
      subtitle: `${previewCode.value} · ${previewTitle.value}`,
      summary: "点击解锁查看 MBTI 深度解读与关键人格倾向。",
      accent: "mint",
      metrics: traitTop.map((trait) => ({ label: trait.label.split(" ")[0], value: `${trait.score}%` })),
      detailTitle: previewCode.value,
      detailSubtitle: previewTitle.value,
      detailQuote: reportPreview.value?.memory.summary || "保持独立思考，用结构化方式把复杂问题拆清楚。",
    },
    {
      key: "distill_graph",
      cardCode: "CARD 02",
      title: "五层蒸馏图谱",
      subtitle: "能力雷达图谱",
      summary: "中心卡片展示五维图谱，解锁后可查看完整维度明细。",
      accent: "amber",
      metrics: traitGraphItems.value.slice(0, 5).map((trait) => ({ label: trait.label.split(" ")[0], value: `${trait.score}%` })),
      detailTitle: "五层蒸馏图谱",
      detailSubtitle: "基于当前蒸馏材料生成的能力雷达",
      detailQuote: "把认知、执行、关系和情绪放在同一张图里，才能看清真正的杠杆点。",
    },
    {
      key: "recommendation",
      cardCode: "CARD 03",
      title: "推荐定位",
      subtitle: previewAdvice.value[0]?.title || "战略定位建议",
      summary: previewAdvice.value[0]?.copy || "点击解锁查看推荐岗位与行动路线。",
      accent: "violet",
      metrics: recommendationMetrics.length
        ? recommendationMetrics
        : [
          { label: "推荐方向", value: "战略架构师" },
          { label: "匹配度", value: previewConfidence.value },
          { label: "下一步", value: "聚焦高杠杆场景" },
        ],
      detailTitle: "战略定位建议",
      detailSubtitle: `推荐匹配度 ${previewConfidence.value}`,
      detailQuote: previewAdvice.value[0]?.copy || "优先做高杠杆动作，用最少投入换最大增长。",
    },
  ]
})

const pendingUnlockCardDetail = computed(() => (
  resultLockCards.value.find((item) => item.key === pendingUnlockCardKey.value) || null
))

const activeResultCardDetail = computed(() => (
  resultLockCards.value.find((item) => item.key === activeResultCardDetailKey.value) || null
))

const distillStageLabel = computed(() => (isGentleDistill.value ? "小火蒸馏" : "猛火蒸馏"))

const currentStageHeading = computed<StageHeading>(() => {
  if (currentStep.value === 1) {
    return {
      kicker: "蒸馏机 · 第 1 步",
      title: "开始蒸馏",
      subtitle: "设置对象与目标。",
    }
  }
  if (currentStep.value === 3) {
    return {
      kicker: "蒸馏机 · 第 2 步",
      title: "进入蒸馏机",
      subtitle: "右侧继续对话，左侧看准备度与分析线。",
    }
  }
  return {
    kicker: "蒸馏机 · 第 3 步",
    title: "蒸馏结果",
    subtitle: "这里承接蒸馏结果的等待态和完成态。性格测试与情感测试两条分析线会在这里汇总成最终画像。",
  }
})

function clampPercent(value: number) {
  return Math.max(12, Math.min(96, Math.round(value)))
}

function keywordScore(text: string, positives: string[], negatives: string[], base: number, step = 7) {
  let score = base
  for (const token of positives) {
    if (text.includes(token)) score += step
  }
  for (const token of negatives) {
    if (text.includes(token)) score -= Math.max(4, Math.round(step * 0.7))
  }
  return clampPercent(score)
}

const traitGraphItems = computed(() => {
  const text = [
    reportPreview.value?.memory.summary || "",
    reportPreview.value?.cognition.worldview || "",
    ...(reportPreview.value?.persona.emotional_patterns || []),
    ...(reportPreview.value?.persona.interaction_preferences || []),
    ...(reportPreview.value?.cognition.decision_heuristics || []),
    ...(reportPreview.value?.memory.recurring_topics || []),
    ...(reportPreview.value?.persona.boundaries || []),
  ].join(" ").toLowerCase()

  return [
    {
      key: "openness",
      label: "开放性 (Openness)",
      score: keywordScore(text, ["探索", "创意", "变化", "好奇", "抽象", "可能性"], ["保守", "稳定"], 72),
      tone: "tone-blue",
    },
    {
      key: "conscientiousness",
      label: "尽责性 (Conscientiousness)",
      score: keywordScore(text, ["效率", "系统", "计划", "结构", "秩序", "责任"], ["拖延", "散漫"], 76),
      tone: "tone-green",
    },
    {
      key: "extraversion",
      label: "外向性 (Extraversion)",
      score: keywordScore(text, ["主动", "表达", "推进", "社交", "外放"], ["克制", "观察", "慢热", "内收"], 48),
      tone: "tone-orange",
    },
    {
      key: "agreeableness",
      label: "宜人性 (Agreeableness)",
      score: keywordScore(text, ["共情", "体谅", "合作", "照顾", "回应"], ["强硬", "边界", "防御", "直接"], 58),
      tone: "tone-pink",
    },
    {
      key: "neuroticism",
      label: "情绪敏感度 (Affect)",
      score: keywordScore(text, ["焦虑", "敏感", "拉扯", "情绪", "压力", "波动"], ["镇定", "稳定", "冷静"], 44),
      tone: "tone-red",
    },
    {
      key: "complexity",
      label: "复杂度 (Complexity)",
      score: keywordScore(text, ["复杂", "多线", "矛盾", "框架", "系统", "抽离"], ["单一", "直接"], 70),
      tone: "tone-purple",
    },
  ]
})

const progressPercent = computed(() => taskStagePercent.value || 6)

function looksLikeGentleQuestion(content: string) {
  const normalized = String(content || "").trim()
  if (!normalized) return false
  const optionMatches = normalized.match(GENTLE_OPTION_LINE_PATTERN) || []
  if (optionMatches.length >= 3) return true
  return optionMatches.length >= 2 && GENTLE_OPTION_PROMPT_PATTERN.test(normalized)
}

const gentleQuestionProgress = computed(() => {
  const questionCount = activeChatMessages.value.reduce((count, message) => {
    if (message.role !== "assistant" || isSystemNotice(message)) return count
    return looksLikeGentleQuestion(message.content) ? count + 1 : count
  }, 0)
  return Math.min(questionCount, GENTLE_QUESTION_TARGET)
})

const gentleQuestionProgressDisplay = computed(() => `${gentleQuestionProgress.value}/${GENTLE_QUESTION_TARGET}`)
const gentleQuestionProgressCopy = computed(() => {
  if (gentleQuestionProgress.value >= GENTLE_QUESTION_TARGET) {
    return "建议题量已经够了，现在可以直接生成报告，也可以继续补几题把画像收得更稳。"
  }
  if (!gentleQuestionProgress.value) {
    return `此模式不强制约束 skill 规范，可先依据假设性问题推进。系统会按选择题轮次累计，答到 ${GENTLE_QUESTION_TARGET} 题左右即可生成首版。`
  }
  return `当前已累计 ${gentleQuestionProgress.value} 道选择题，继续按 1/2/3/4 或 A/B/C/D 回答，接近 ${GENTLE_QUESTION_TARGET} 题时即可生成首版。`
})

const distillStatusText = computed(() => {
  if (!projectReadiness.value) return "正在读取当前蒸馏准备度..."
  const status = latestJob.value?.status
  if (!status) return readinessSummary.value
  if (status === "queued") return "蒸馏任务已经入队，正在准备读取材料。"
  if (status === "parsing") return "正在解析上传材料，提取文本、截图和聊天记录里的关键信息。"
  if (status === "extracting") return "正在抽取表达模式、关系线索和可向量化证据。"
  if (status === "distilling") return "正在生成首版人物画像和推理结果。"
  if (status === "failed") return "这次蒸馏中断了，材料没有丢，可以直接重试。"
  return "人物画像报告已生成，你现在可以直接查看结果。"
})

const distillLoadingSummary = computed(() => {
  if (latestJob.value?.status === "failed") return latestJob.value.error_message || "蒸馏任务异常中断，可以直接在这里重试。"
  return readinessSummary.value
})

const distillLoadingStage = computed(() => {
  if (!latestJob.value?.status && projectReadiness.value && !projectReadiness.value.can_generate_report) {
    return "继续补材料或深聊，等待达到生成门槛..."
  }
  const status = latestJob.value?.status
  if (!status || status === "queued") return "准备解析材料..."
  if (status === "parsing") return "解析原始材料..."
  if (status === "extracting") return "提取表达与情感特征..."
  if (status === "distilling") return "生成画像与关系图谱..."
  if (status === "failed") return "蒸馏失败，请重试..."
  return "蒸馏完成，正在整理结果..."
})

const journeyProgressPercent = computed(() => {
  const currentVisibleStep = normalizeVisibleWizardStep(currentStep.value)
  const currentIndex = wizardSteps.value.findIndex((item) => item.step === currentVisibleStep)
  const denominator = Math.max(1, wizardSteps.value.length - 1)
  return (Math.max(0, currentIndex) / denominator) * 100
})

function packHaystack(pack: PackSummary) {
  return [
    pack.slug,
    pack.title,
    pack.subtitle,
    pack.domain,
    pack.display_group,
    pack.display_group_label,
    pack.factory_category,
    pack.factory_category_label,
    ...pack.tags,
    ...pack.skills,
    ...pack.suitable_for,
    ...pack.repo_entry_preview,
  ].join(" ").toLowerCase()
}

function normalizeMatchText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s_\-.·/]+/g, "")
    .trim()
}

function subjectNameMatchBonus(pack: PackSummary) {
  const subjectName = normalizeMatchText(form.subject_name)
  if (!subjectName) return { bonus: 0, exact: false }
  const title = normalizeMatchText(pack.title)
  const slug = normalizeMatchText(pack.slug)
  const haystack = normalizeMatchText(packHaystack(pack))
  if (title && title === subjectName) return { bonus: 420, exact: true }
  if (slug && slug.includes(subjectName)) return { bonus: 260, exact: false }
  if (title && (title.includes(subjectName) || subjectName.includes(title))) return { bonus: 220, exact: false }
  if (haystack && haystack.includes(subjectName)) return { bonus: 120, exact: false }
  return { bonus: 0, exact: false }
}

function hasNuwaSemanticFit(pack: PackSummary) {
  const haystack = packHaystack(pack)
  if (/nuwa|女娲|全人类|人类群像|群体画像|population|archetype|all humanity/.test(haystack)) return true
  const groupCount = Number(pack.repo_display_group_counts?.person || 0) + Number(pack.repo_display_group_counts?.theme || 0)
  return pack.repo_kind === "multi_skill_catalog" && groupCount >= 3 && /人类|群体|人群|画像|theme|person/.test(haystack)
}

function normalizeCandidateWeight(score: number, items: Array<{ score: number }>) {
  if (!items.length) return 0
  const scores = items.map((item) => item.score)
  const maxScore = Math.max(...scores)
  const minScore = Math.min(...scores)
  if (maxScore <= minScore) return 100
  return Math.round(58 + ((score - minScore) / (maxScore - minScore)) * 41)
}

const relationSemanticProfiles: Record<string, {
  strong: string[]
  weak: string[]
  cross: string[]
  business: string[]
}> = {
  ex_partner: {
    strong: ["前任", "ex_partner", "前男友", "前女友", "旧情人", "复合"],
    weak: ["恋爱", "关系", "情感", "情绪", "亲密", "relationship", "emotion", "attachment", "love"],
    cross: ["老板", "导师", "同学", "manager", "mentor", "classmate"],
    business: ["客户", "客户关系", "销售", "拓客", "拓展", "获客", "商务", "crm", "customer", "sales", "lead", "pipeline", "business", "strategy", "career", "team"],
  },
  classmate_peer: {
    strong: ["同学", "classmate", "schoolmate", "校友", "同窗"],
    weak: ["校园", "peer", "同龄", "成长", "school"],
    cross: ["前任", "老板", "导师", "ex_partner", "manager", "mentor"],
    business: ["客户", "销售", "商务", "business", "sales", "crm", "career", "strategy"],
  },
  colleague: {
    strong: ["同事", "协作", "工作", "colleague", "team"],
    weak: ["团队", "配合", "项目", "协作"],
    cross: ["前任", "老板", "导师", "ex_partner", "manager", "mentor"],
    business: ["客户", "销售", "crm", "pipeline", "business", "sales"],
  },
  boss_manager: {
    strong: ["老板", "上司", "直属领导", "boss", "manager", "leader"],
    weak: ["管理", "决策", "组织", "带队", "leadership"],
    cross: ["前任", "同学", "导师", "ex_partner", "classmate", "mentor"],
    business: ["客户", "销售", "商务", "获客", "crm", "customer", "sales", "pipeline"],
  },
  friend_family: {
    strong: ["导师", "mentor", "coach", "teacher", "带教", "教练"],
    weak: ["指导", "成长", "反馈", "训练", "培养"],
    cross: ["前任", "同学", "老板", "ex_partner", "classmate", "manager"],
    business: ["客户", "销售", "商务", "crm", "customer", "sales", "business", "pipeline"],
  },
}

function countKeywordHits(haystack: string, keywords: string[]) {
  let hits = 0
  for (const keyword of keywords) {
    if (haystack.includes(keyword.toLowerCase())) hits += 1
  }
  return hits
}

function targetConfigTerms(config: TargetConfig) {
  return Array.from(new Set([
    ...config.packKeywords,
    ...config.configuredNames,
  ].filter(Boolean)))
}

function relationPackProfile(pack: PackSummary, config: TargetConfig) {
  const haystack = packHaystack(pack)
  const profile = relationSemanticProfiles[config.relationLabel] || {
    strong: config.configuredNames,
    weak: config.packKeywords,
    cross: [],
    business: [],
  }
  return {
    haystack,
    strongHits: countKeywordHits(haystack, profile.strong),
    weakHits: countKeywordHits(haystack, profile.weak),
    crossHits: countKeywordHits(haystack, profile.cross),
    businessHits: countKeywordHits(haystack, profile.business),
    configuredHits: countKeywordHits(haystack, targetConfigTerms(config)),
    hasPersonality: PERSONALITY_SKILL_PATTERN.test(haystack),
    hasEmotion: EMOTION_SKILL_PATTERN.test(haystack),
  }
}

function hasDirectTargetSemanticFit(pack: PackSummary, config: TargetConfig) {
  const profile = relationPackProfile(pack, config)
  if (profile.strongHits > 0) return true
  if (config.relationLabel === "ex_partner") return profile.weakHits >= 2 && (profile.hasEmotion || profile.hasPersonality) && profile.businessHits === 0
  return profile.weakHits >= 2 && profile.businessHits === 0
}

function fallbackTargetPack(config: TargetConfig) {
  if (isSelfConfig(config)) return packs.value.find((pack) => pack.slug === config.fallbackPackSlug) || null
  if (isNuwaConfig(config)) return packs.value.find((pack) => hasNuwaSemanticFit(pack)) || null
  return packs.value.find((pack) => pack.slug === config.fallbackPackSlug) || null
}

function targetChipPackScore(pack: PackSummary, config: TargetConfig) {
  if (isSelfConfig(config)) return pack.slug === config.fallbackPackSlug ? 10000 : -10000
  if (isNuwaConfig(config)) {
    let score = 0
    if (hasNuwaSemanticFit(pack)) score += 520
    if (pack.repo_kind === "multi_skill_catalog") score += 220
    if (pack.display_group === "tool_entry") score += 80
    if (pack.factory_category === "professional_role") score -= 220
    if (!hasNuwaSemanticFit(pack)) score -= 420
    return score
  }

  const relationProfile = relationPackProfile(pack, config)
  const nameMatch = subjectNameMatchBonus(pack)
  let score = 0
  score += relationProfile.strongHits * 240
  score += relationProfile.weakHits * 68
  score += relationProfile.configuredHits * 56
  score -= relationProfile.crossHits * 90
  score -= relationProfile.businessHits * (config.relationLabel === "boss_manager" ? 70 : 150)
  score += nameMatch.bonus
  if (relationProfile.hasPersonality) score += 36
  if (relationProfile.hasEmotion) score += config.relationLabel === "ex_partner" ? 70 : 24
  if (pack.display_group === "person") score += relationProfile.strongHits > 0 ? 64 : 18
  if (pack.display_group === "theme") score += 20
  if (pack.display_group === "tool_entry") score += relationProfile.hasEmotion || relationProfile.hasPersonality ? 36 : -72
  if (pack.factory_category === "professional_role") score -= config.relationLabel === "boss_manager" && relationProfile.strongHits > 0 ? 48 : 220
  if (pack.factory_category === "human_expert" && relationProfile.strongHits > 0) score += 24
  return score
}

const chipMatchedPackByKey = computed<Record<TargetKey, PackSummary | null>>(() => {
  const entries = enabledTargetConfigs.value.map((chip) => {
    const ranked = packs.value
      .map((pack) => ({ pack, score: targetChipPackScore(pack, chip) }))
      .sort((left, right) => right.score - left.score || left.pack.title.localeCompare(right.pack.title))
    const top = ranked[0]
    const threshold = isSelfConfig(chip) ? 1 : isNuwaConfig(chip) ? 120 : 140
    const direct = top && top.score >= threshold ? top.pack : null
    if (isSelfConfig(chip) || isNuwaConfig(chip)) return [chip.key, direct] as const
    const matched = direct && hasDirectTargetSemanticFit(direct, chip) ? direct : fallbackTargetPack(chip)
    return [chip.key, matched] as const
  })
  return Object.fromEntries(entries) as Record<TargetKey, PackSummary | null>
})

const targetChips = computed<TargetChipOption[]>(() =>
  enabledTargetConfigs.value
    .map((chip) => ({
      key: chip.key,
      label: chip.label,
      icon: chip.icon,
      matchedPackSlug: chipMatchedPackByKey.value[chip.key]?.slug,
      matchedPackTitle: chipMatchedPackByKey.value[chip.key]?.title,
    }))
)

function packTargetScore(pack: PackSummary, target: TargetConfig) {
  const haystack = packHaystack(pack)
  if (isSelfConfig(target)) return pack.slug === target.fallbackPackSlug ? 10000 : -10000
  if (isNuwaConfig(target)) {
    let score = 0
    if (pack.repo_kind === "multi_skill_catalog") score += 260
    if (hasNuwaSemanticFit(pack)) score += 420
    if (PERSONALITY_SKILL_PATTERN.test(haystack)) score += 90
    if (EMOTION_SKILL_PATTERN.test(haystack)) score += 90
    if (pack.display_group === "tool_entry") score += 40
    if (pack.factory_category === "professional_role") score -= 240
    if (!hasNuwaSemanticFit(pack)) score -= 420
    return score
  }

  const relationProfile = relationPackProfile(pack, target)
  const nameMatch = subjectNameMatchBonus(pack)
  let score = 0
  if (pack.slug === FIXED_SELF_PACK_SLUG) score -= 2000
  if (pack.slug === target.fallbackPackSlug) score += 420
  score += relationProfile.strongHits * 170
  score += relationProfile.weakHits * 54
  score += relationProfile.configuredHits * 38
  score -= relationProfile.crossHits * 80
  score -= relationProfile.businessHits * (target.relationLabel === "boss_manager" ? 56 : 126)
  score += nameMatch.bonus
  if (relationProfile.hasPersonality) score += 220
  if (relationProfile.hasEmotion) score += target.relationLabel === "ex_partner" ? 140 : 54
  if (pack.display_group === "person") score += relationProfile.strongHits > 0 ? 60 : 16
  if (pack.display_group === "theme") score += 18
  if (pack.display_group === "tool_entry") score += relationProfile.hasPersonality || relationProfile.hasEmotion ? 48 : 8
  if (pack.factory_category === "tool_agent") score += relationProfile.hasPersonality || relationProfile.hasEmotion ? 80 : 24
  if (pack.factory_category === "human_expert") score += relationProfile.strongHits > 0 ? 36 : -60
  if (pack.factory_category === "professional_role") score -= target.relationLabel === "boss_manager" && relationProfile.strongHits > 0 ? 40 : 220
  if (/test|assessment|question|测评|测试|人格/.test(haystack)) score += 60
  for (const keyword of targetConfigTerms(target)) {
    if (haystack.includes(keyword.toLowerCase())) score += 32
  }
  if (`${form.analysis_goal} ${form.subject_name}`.trim() && relationProfile.hasPersonality) score += 40
  return score
}

function emotionPackScore(pack: PackSummary, target: TargetConfig) {
  const haystack = packHaystack(pack)
  let score = 0
  if (pack.slug === FIXED_SELF_PACK_SLUG) score -= 180
  if (pack.factory_category === "tool_agent") score += 140
  if (pack.factory_category === "human_expert") score -= 120
  if (pack.factory_category === "professional_role" && target.relationLabel !== "boss_manager") score -= 220
  if (EMOTION_SKILL_PATTERN.test(haystack)) score += 260
  if (/emotion|emotional|relationship|attachment|恋爱|亲密|关系|情绪|情感|边界/.test(haystack)) score += 140
  if (PERSONALITY_SKILL_PATTERN.test(haystack)) score += 45
  if (!isSelfConfig(target) && !isNuwaConfig(target)) {
    const relationProfile = relationPackProfile(pack, target)
    score += relationProfile.strongHits * 110
    score += relationProfile.weakHits * 40
    score -= relationProfile.crossHits * 72
    score -= relationProfile.businessHits * (target.relationLabel === "boss_manager" ? 44 : 110)
  }
  for (const keyword of targetConfigTerms(target)) {
    if (haystack.includes(keyword.toLowerCase())) score += 24
  }
  if (isSelfConfig(target) && /self|自己|自我/.test(haystack)) score += 36
  return score
}

const localRankedMainSkillCandidates = computed(() => {
  if (!packs.value.length) return [] as RankedSkillCandidateView[]
  const target = selectedTargetMeta.value
  if (isSelfConfig(target)) {
    const selfPack = packs.value.find((pack) => pack.slug === target.fallbackPackSlug)
    if (!selfPack) return [] as RankedSkillCandidateView[]
    return [{
      pack: selfPack,
      score: 10000,
      rank: 1,
      weight: 100,
      exactNameHit: false,
      reasons: [],
      matchedNames: [],
    }]
  }

  const candidateSource = isNuwaConfig(target)
    ? (() => {
        const explicitNuwa = packs.value.filter((pack) => pack.slug !== FIXED_SELF_PACK_SLUG && hasNuwaSemanticFit(pack))
        if (explicitNuwa.length) return explicitNuwa
        return packs.value.filter((pack) => pack.slug === target.fallbackPackSlug)
      })()
    : packs.value.filter((pack) => pack.slug !== FIXED_SELF_PACK_SLUG)

  const ranked = candidateSource
    .map((pack) => ({
      pack,
      score: packTargetScore(pack, target),
      exactNameHit: subjectNameMatchBonus(pack).exact,
    }))
    .sort((left, right) => right.score - left.score || left.pack.title.localeCompare(right.pack.title))
    .slice(0, 6)

  return ranked.map((item, index, items) => ({
    ...item,
    rank: index + 1,
    weight: normalizeCandidateWeight(item.score, items),
    reasons: [],
    matchedNames: [],
  }))
})

const rankedMainSkillCandidates = computed(() => {
  if (backendPackRecommendation.value?.items?.length) {
    return backendPackRecommendation.value.items.map(mapRecommendationItemToCandidateView)
  }
  return localRankedMainSkillCandidates.value
})

const rankedSkillCandidates = computed(() => rankedMainSkillCandidates.value.map((item) => item.pack))

const preferredTargetPackSlug = computed(() => chipMatchedPackByKey.value[selectedTargetKey.value]?.slug || "")

const recommendedPackSlug = computed(() => {
  if (backendPackRecommendation.value?.recommended_pack_slug) return backendPackRecommendation.value.recommended_pack_slug
  if (preferredTargetPackSlug.value) return preferredTargetPackSlug.value
  const topCandidate = rankedMainSkillCandidates.value[0]
  if (isNuwaConfig(selectedTargetMeta.value) && topCandidate && !hasNuwaSemanticFit(topCandidate.pack)) {
    return selectedTargetMeta.value.fallbackPackSlug
  }
  return topCandidate?.pack.slug || selectedTargetMeta.value.fallbackPackSlug
})

const rankedPersonalityCandidates = computed(() => packs.value
  .filter((pack) => PERSONALITY_SKILL_PATTERN.test(packHaystack(pack)))
  .map((pack) => ({ pack, score: packTargetScore(pack, selectedTargetMeta.value) + 200 }))
  .sort((left, right) => right.score - left.score || left.pack.title.localeCompare(right.pack.title)))

const recommendedPersonalityPackSlug = computed(() => {
  return rankedPersonalityCandidates.value[0]?.pack.slug || DEFAULT_PERSONALITY_PACK_SLUG
})

const rankedEmotionCandidates = computed(() => packs.value
  .filter((pack) => EMOTION_SKILL_PATTERN.test(packHaystack(pack)) || PERSONALITY_SKILL_PATTERN.test(packHaystack(pack)))
  .map((pack) => ({ pack, score: emotionPackScore(pack, selectedTargetMeta.value) }))
  .sort((left, right) => right.score - left.score || left.pack.title.localeCompare(right.pack.title)))

const recommendedEmotionPackSlug = computed(() => {
  const direct = rankedEmotionCandidates.value[0]
  if (direct && direct.score >= 180) return direct.pack.slug
  return DEFAULT_PERSONALITY_PACK_SLUG
})

const configuredSkillPoolSlugs = computed(() => {
  const current = selectedTargetMeta.value
  return Array.from(new Set([
    current.fallbackPackSlug,
    ...(current.attachedPackSlugs || []),
  ].filter(Boolean)))
})

const autoLoadedSkillPoolSlugs = computed(() => (
  Array.from(new Set([
    preferredTargetPackSlug.value,
    recommendedPackSlug.value,
    ...configuredSkillPoolSlugs.value,
  ].filter(Boolean))).slice(0, 8)
))

const effectiveSkillPoolSlugs = computed(() => {
  if (selectedSkillMode.value === "custom") {
    return Array.from(new Set([
      ...configuredSkillPoolSlugs.value,
      ...skillRouterSelectedPackSlugs.value,
      manualPackSlug.value,
    ].filter(Boolean))).slice(0, 8)
  }
  return autoLoadedSkillPoolSlugs.value
})

const activePackSlug = computed(() => {
  if (selectedSkillMode.value === "custom" && manualPackSlug.value) return manualPackSlug.value
  if (backendPackRecommendation.value?.recommended_pack_slug) return backendPackRecommendation.value.recommended_pack_slug
  return recommendedPackSlug.value
})

const activePackDetail = computed(() => (
  activePackSlug.value ? packDetailsBySlug[activePackSlug.value] || null : null
))

const mainSkillCandidatePool = computed(() => {
  const candidates = [...rankedMainSkillCandidates.value]
  const activeSlug = activePackSlug.value
  if (!activeSlug) return candidates
  const activeCandidate = candidates.find((item) => item.pack.slug === activeSlug)
  if (activeCandidate) return candidates
  const activePack = packs.value.find((item) => item.slug === activeSlug)
  if (!activePack) return candidates
  const inserted = {
    pack: activePack,
    score: packTargetScore(activePack, selectedTargetMeta.value),
    rank: candidates.length + 1,
    weight: candidates.length ? Math.max(54, candidates[candidates.length - 1]?.weight || 54) : 100,
    exactNameHit: subjectNameMatchBonus(activePack).exact,
    reasons: [],
    matchedNames: [],
  }
  return [inserted, ...candidates].slice(0, 6)
})

const activeMainSkillCandidate = computed(() =>
  visibleSkillCandidatePool.value.find((item) => item.pack.slug === (expandedSkillSlug.value || activePackSlug.value))
  || mainSkillCandidatePool.value.find((item) => item.pack.slug === (expandedSkillSlug.value || activePackSlug.value))
  || visibleSkillCandidatePool.value.find((item) => item.pack.slug === activePackSlug.value)
  || mainSkillCandidatePool.value.find((item) => item.pack.slug === activePackSlug.value)
  || visibleSkillCandidatePool.value[0]
  || mainSkillCandidatePool.value[0]
  || null
)

const analysisTrackCards = computed(() => {
  const tracks = [
    {
      key: "personality",
      label: "性格测试",
      slug: recommendedPersonalityPackSlug.value,
      fallbackPackTitle: "SBTI / MBTI",
      fallbackSummary: "负责性格倾向、表达结构和决策风格的主分析线。",
      candidateCount: rankedPersonalityCandidates.value.length,
    },
    {
      key: "emotion",
      label: "情感测试",
      slug: recommendedEmotionPackSlug.value,
      fallbackPackTitle: "情感关系引擎",
      fallbackSummary: "负责情绪模式、关系边界和互动节奏的辅分析线。",
      candidateCount: rankedEmotionCandidates.value.length,
    },
  ] as const

  return tracks.map((track) => {
    const detail = track.slug ? packDetailsBySlug[track.slug] || null : null
    return {
      key: track.key,
      label: track.label,
      packTitle: detail?.pack.title || track.fallbackPackTitle,
      summary: detail?.preview_report.memory.summary || track.fallbackSummary,
      slug: track.slug,
      candidateCount: track.candidateCount,
    }
  })
})

const uniquePrecisionSkillSlugs = computed(() =>
  Array.from(new Set(analysisTrackCards.value.map((item) => item.slug).filter(Boolean))) as string[]
)

const precisionTrackItems = computed(() => analysisTrackCards.value.map((track) => {
  const detail = track.slug ? packDetailsBySlug[track.slug] || null : null
  const session = track.slug ? skillSessionsBySlug[track.slug] || null : null
  const loaded = Boolean(track.slug && session)
  return {
    ...track,
    loaded,
    active: Boolean(track.slug && activePackSlug.value === track.slug && activeDeepView.value === "chat"),
    statusLabel: loaded ? "已连接" : "待连接",
    updatedAt: session?.updated_at || "",
    packTitle: detail?.pack.title || track.packTitle,
  }
}))

const precisionLoadedCount = computed(() =>
  precisionTrackItems.value.filter((item) => item.loaded).length
)

const loadedSkillPoolSlugSet = computed(() => (
  new Set(
    Array.from(new Set([
      ...effectiveSkillPoolSlugs.value,
      activePackSlug.value,
    ].filter(Boolean)))
  )
))

function isSkillPackLoaded(slug: string) {
  return loadedSkillPoolSlugSet.value.has(slug)
}

const activePackTags = computed(() => {
  const pack = activePackDetail.value?.pack
  if (!pack) return []
  return [...new Set([...pack.tags, ...pack.skills])].filter(Boolean).slice(0, 6)
})

const displaySkillCandidates = computed(() => {
  return mainSkillCandidatePool.value.map((item) => item.pack)
})

const normalizedSkillPoolSearch = computed(() => normalizeMatchText(skillPoolSearch.value))

function searchSkillCandidateBoost(pack: PackSummary, query: string) {
  if (!query) return -1
  const title = normalizeMatchText(pack.title)
  const slug = normalizeMatchText(pack.slug)
  const tags = normalizeMatchText([
    ...pack.tags,
    ...pack.skills,
    ...pack.suitable_for,
    pack.display_group_label,
    pack.factory_category_label,
  ].join(" "))
  const haystack = normalizeMatchText(packHaystack(pack))
  if (title === query || slug === query) return 1400
  if (title.includes(query)) return 920
  if (slug.includes(query)) return 760
  if (tags.includes(query)) return 620
  if (haystack.includes(query)) return 420
  return -1
}

const searchedSkillCandidatePool = computed<RankedSkillCandidateView[]>(() => {
  const query = normalizedSkillPoolSearch.value
  if (!query || !packs.value.length) return []
  const target = selectedTargetMeta.value
  const candidateSource = isSelfConfig(target)
    ? packs.value.filter((pack) => pack.slug === FIXED_SELF_PACK_SLUG)
    : packs.value.filter((pack) => pack.slug !== FIXED_SELF_PACK_SLUG)
  const ranked = candidateSource
    .map((pack) => {
      const boost = searchSkillCandidateBoost(pack, query)
      if (boost < 0) return null
      return {
        pack,
        score: packTargetScore(pack, target) + boost,
        exactNameHit: subjectNameMatchBonus(pack).exact,
      }
    })
    .filter((item): item is { pack: PackSummary; score: number; exactNameHit: boolean } => Boolean(item))
    .sort((left, right) => right.score - left.score || left.pack.title.localeCompare(right.pack.title))
    .slice(0, 12)

  return ranked.map((item, index, items) => ({
    ...item,
    rank: index + 1,
    weight: normalizeCandidateWeight(item.score, items),
    reasons: [`搜索命中「${skillPoolSearch.value.trim()}」，已加入当前对象的候选排序。`],
    matchedNames: [],
  }))
})

const pinnedLoadedSkillCandidatePool = computed<RankedSkillCandidateView[]>(() => (
  mainSkillCandidatePool.value.filter((item) => loadedSkillPoolSlugSet.value.has(item.pack.slug))
))

const visibleSkillCandidatePool = computed(() => {
  if (!normalizedSkillPoolSearch.value) return mainSkillCandidatePool.value
  const merged = [...pinnedLoadedSkillCandidatePool.value, ...searchedSkillCandidatePool.value]
  const seen = new Set<string>()
  return merged.filter((item) => {
    if (seen.has(item.pack.slug)) return false
    seen.add(item.pack.slug)
    return true
  })
})

const entrySkillPreviewCandidates = computed(() => visibleSkillCandidatePool.value.slice(0, 4))

const activeAssistantName = computed(() => (
  activeSelectedExpert.value?.name ||
  activeSelectedExpertDetail.value?.pack.title ||
  activePackDetail.value?.pack.title ||
  (isSelfTarget.value ? "自己" : "SBTI 赛博人格测试")
))

const targetTrackRef = ref<HTMLElement | null>(null)
let isDragging = ref(false)
let startX = ref(0)
let scrollLeft = ref(0)

function startDrag(e: MouseEvent) {
  if (targetTrackRef.value) {
    isDragging.value = true
    startX.value = e.pageX - targetTrackRef.value.offsetLeft
    scrollLeft.value = targetTrackRef.value.scrollLeft
    targetTrackRef.value.style.cursor = 'grabbing'
  }
}

function drag(e: MouseEvent) {
  if (!isDragging.value || !targetTrackRef.value) return
  e.preventDefault()
  const x = e.pageX - targetTrackRef.value.offsetLeft
  const walk = (x - startX.value) * 2
  targetTrackRef.value.scrollLeft = scrollLeft.value - walk
}

function endDrag() {
  isDragging.value = false
  if (targetTrackRef.value) {
    targetTrackRef.value.style.cursor = 'grab'
  }
}

const activeUserAvatarLabel = computed(() => (form.subject_name || "我").slice(0, 1) || "我")

const activeSelectedExpert = computed(() => {
  const recommendation = activeChatRecommendation.value
  if (!recommendation?.items?.length) return null
  const selectedId = recommendation.selected_expert_id || recommendation.recommended_expert_id
  if (!selectedId) return null
  return recommendation.items.find((item) => item.expert_id === selectedId) || null
})

const activeSelectedExpertDetail = computed(() => {
  const selectedId = activeSelectedExpert.value?.expert_id
  if (!selectedId) return null
  return expertDetailsById[selectedId] || null
})

const activeAssistantAvatarLabel = computed(() => {
  const explicit = activeSelectedExpertDetail.value?.pack.avatar_label?.trim()
  if (explicit) return explicit
  const selectedName = activeSelectedExpert.value?.name?.trim()
  if (selectedName) return selectedName.slice(0, 2)
  return activeAssistantName.value.slice(0, 1) || "蒸"
})

const activeAssistantAvatarStyle = computed(() => {
  const seed = activeSelectedExpert.value?.expert_id || activeAssistantName.value
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const hueA = hash % 360
  const hueB = (hash + 52) % 360
  return {
    background: `linear-gradient(135deg, hsl(${hueA} 72% 48%), hsl(${hueB} 82% 58%))`,
  }
})

function makeSessionAvatar(label: string, seed: string, hueOffset = 0): SessionAvatar {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const hueA = (hash + hueOffset) % 360
  const hueB = (hueA + 44) % 360
  return {
    label,
    style: {
      background: `linear-gradient(135deg, hsl(${hueA} 72% 48%), hsl(${hueB} 82% 58%))`,
    },
  }
}

function sessionActivityLabel(value?: string) {
  if (!value) return "刚刚"
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return "最近"
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(time)
}

const activeAssistantRecommendationReason = computed(() => {
  const recommendation = activeChatRecommendation.value
  const selected = activeSelectedExpert.value
  return (
    recommendation?.reason?.trim() ||
    selected?.reasons?.find((item) => item.trim()) ||
    selected?.can_help_with?.[0] ||
    ""
  )
})

const activeAssistantSubtitle = computed(() => {
  if (activeSelectedExpert.value) {
    const role = activeSelectedExpert.value.role?.trim()
    return role
      ? activeSession.value
        ? `当前回答已切到 ${activeAssistantName.value}，会优先按 ${role} 的方式继续。`
        : `当前优先参考 ${activeAssistantName.value}，发送后会按 ${role} 的方式继续。`
      : activeSession.value
        ? `当前回答已切到 ${activeAssistantName.value}，会按这位专家的判断方式继续。`
        : `当前优先参考 ${activeAssistantName.value}，发送后会按这位专家的判断方式继续。`
  }
  return activeSession.value
    ? `${activeAssistantName.value} 已连接当前蒸馏模式，会边聊边喂给 agent。`
    : `${activeAssistantName.value} 已选为当前蒸馏机，发送第一条消息后开始连接。`
})

const activeSessionDisplayTitle = computed(() => {
  const rawTitle = activeSession.value?.title?.trim()
  if (activeSelectedExpert.value) return activeAssistantName.value
  if (!rawTitle) return activeAssistantName.value
  if (/distill deep chat/i.test(rawTitle)) return activeAssistantName.value
  return rawTitle
})

const activePackSubtitle = computed(() => {
  if (activePackDetail.value?.pack.subtitle) return activePackDetail.value.pack.subtitle
  if (isSelfTarget.value) return "固定加载 imported yourself-skill，进入第三步后恢复最近会话并接管蒸馏。"
  return "根据当前蒸馏对象匹配蒸馏机，第三步通过当前 skill 进入蒸馏模式。"
})

function mainSkillCandidateReason(candidate: RankedSkillCandidateView | null) {
  if (!candidate) return "当前没有可用候选，先回退到默认蒸馏机。"
  if (candidate.reasons.length) return candidate.reasons[0]
  const pack = candidate.pack
  if (candidate.exactNameHit) return "名字直达命中，当前对象名和模板名完全对上。"
  if (isNuwaConfig(selectedTargetMeta.value) && hasNuwaSemanticFit(pack)) {
    return "它带有女娲 / 全人类语义，并且更像群体画像入口，而不是单个人物 skill。"
  }
  if (!isSelfConfig(selectedTargetMeta.value) && !isNuwaConfig(selectedTargetMeta.value) && hasDirectTargetSemanticFit(pack, selectedTargetMeta.value)) {
    return "它先命中了当前关系语义，再结合名字、标签和人格/情感信号排到前面。"
  }
  if (PERSONALITY_SKILL_PATTERN.test(packHaystack(pack))) return "它作为人格分析主线更稳，先兜底保证蒸馏入口不跑偏。"
  return "它在当前候选池里综合分最高，适合作为这轮主蒸馏机入口。"
}

function packAvatarStyle(pack: PackSummary) {
  return {
    background: pack.hero_background || "linear-gradient(135deg, rgba(212,148,58,0.15), rgba(34,211,238,0.08))",
  }
}

function mapRecommendationItemToCandidateView(item: PackRecommendationItem): RankedSkillCandidateView {
  return {
    pack: item.pack,
    score: item.score,
    rank: item.rank,
    weight: item.weight,
    exactNameHit: item.exact_name_hit,
    reasons: item.reasons || [],
    matchedNames: item.matched_names || [],
  }
}

const activeStarterPrompts = computed(() => {
  if (isSelfConfig(selectedTargetMeta.value)) {
    return activePackDetail.value?.starter_prompts?.slice(0, 3) || selectedTargetMeta.value.starterPrompts
  }
  if (PERSONALITY_SKILL_PATTERN.test(activeAssistantName.value.toLowerCase())) {
    return selectedTargetMeta.value.starterPrompts
  }
  return activePackDetail.value?.starter_prompts?.slice(0, 3) || selectedTargetMeta.value.starterPrompts
})

const activeWelcomeMessage = computed(() => {
  const name = activeAssistantName.value
  const reason = activeAssistantRecommendationReason.value
  if (activeSession.value) {
    if (reason) {
      return `${name} 已连接。\n推荐原因：${reason}\n最近会话已经恢复，直接继续追问就行。`
    }
    return `${name} 已连接。\n最近会话已经恢复，直接把你现在最想看清的问题丢过来。`
  }
  if (reason) {
    return `${name} 当前被推荐为主蒸馏机。\n推荐原因：${reason}\n发送第一条消息后，我会立刻进入这条蒸馏线。`
  }
  return `${name} 已选为当前蒸馏机。\n发送第一条消息后，我会按这条 skill 线开始深挖。`
})

const normalizedActiveChatDraft = computed(() => normalizeComposerMessage(activeChatDraft.value))

const activeRecentSessionLabel = computed(() => {
  if (!activeSession.value?.updated_at) return "待连接"
  const time = new Date(activeSession.value.updated_at)
  if (Number.isNaN(time.getTime())) return "最近活跃"
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(time)
})

const activeSkillSwitchSuggestion = computed(() => {
  const recommendation = activeChatRecommendation.value
  if (!recommendation?.recommended_switch) return null
  const candidate = recommendation.items.find((item) => item.expert_id === recommendation.recommended_expert_id)
  if (!candidate) return null
  if (dismissedActiveSkillSuggestionId.value === candidate.expert_id) return null
  const detail = expertDetailsById[candidate.expert_id]
  return {
    expertId: candidate.expert_id,
    packSlug: detail?.pack.slug || candidate.expert_id,
    name: detail?.pack.title || candidate.name,
    reason: recommendation.reason?.trim() || candidate.reasons?.[0] || "这一轮问题更贴近另一条 skill 的能力范围。",
  }
})

const precisionConversationItem = computed<DeepConversationItem>(() => ({
  key: "precision",
  kind: "precision",
  title: "精准蒸馏",
  subtitle: "多 skill 调度台",
  hint: `已连接 ${precisionLoadedCount.value}/${precisionTrackItems.value.length} 条分析线，按问题切换谁接这轮。`,
  updatedLabel: "群聊模式",
  active: activeDeepView.value === "precision",
  avatars: [
    makeSessionAvatar("性", `${projectId.value || "precision"}-personality`, 24),
    makeSessionAvatar("情", `${projectId.value || "precision"}-emotion`, 168),
    makeSessionAvatar((form.subject_name || "蒸").slice(0, 1), `${projectId.value || "precision"}-subject`, 288),
  ],
}))

const deepConversationItems = computed<DeepConversationItem[]>(() => {
  const items: DeepConversationItem[] = [precisionConversationItem.value]
  const seen = new Set<string>()
  const pushSkillItem = (
    slug: string | undefined,
    title: string,
    subtitle: string,
    hint: string,
    avatars?: SessionAvatar[],
  ) => {
    if (!slug || seen.has(slug)) return
    seen.add(slug)
    const session = skillSessionsBySlug[slug] || null
    items.push({
      key: slug,
      kind: "skill",
      title,
      subtitle,
      hint,
      updatedLabel: sessionActivityLabel(session?.updated_at || skillProjectsBySlug[slug]?.updated_at),
      active: activeDeepView.value === "chat" && activePackSlug.value === slug,
      avatars: avatars || [
        makeSessionAvatar(
          packDetailsBySlug[slug]?.pack.avatar_label?.trim() || (title.slice(0, 1) || "蒸"),
          slug,
          56,
        ),
      ],
      slug,
    })
  }

  pushSkillItem(
    activePackSlug.value,
    activeAssistantName.value,
    "当前蒸馏机",
    activeSession.value
      ? `${activeChatMessages.value.length} 条消息，继续当前会话。`
      : "点进后会恢复最近会话并接管蒸馏。",
    [
      makeSessionAvatar(activeAssistantAvatarLabel.value, activePackSlug.value || activeAssistantName.value, 56),
    ],
  )

  precisionTrackItems.value.forEach((track) => {
    pushSkillItem(
      track.slug,
      track.packTitle,
      `${track.label} · ${track.loaded ? "已连接" : "待连接"}`,
      track.summary,
      [makeSessionAvatar(track.label.slice(0, 1), `${track.slug}-${track.label}`, track.label === "情感测试" ? 182 : 28)],
    )
  })

  Object.keys(skillSessionsBySlug).forEach((slug) => {
    const detail = packDetailsBySlug[slug] || null
    pushSkillItem(
      slug,
      detail?.pack.title || slug,
      "历史会话",
      `${skillMessagesBySlug[slug]?.length || 0} 条消息，已进入项目会话池。`,
    )
  })

  return items
})

const skillConversationItems = computed(() => deepConversationItems.value.filter((item) => item.kind === "skill"))
const compactSkillConversationItems = computed(() => skillConversationItems.value)

const activeComposerPlaceholder = computed(() => {
  if (activeChatBootstrapping.value) return `正在连接 ${activeAssistantName.value}...`
  if (isSelfConfig(selectedTargetMeta.value)) return "输入你想补充的自我信息，或者直接告诉 agent 你最想看清自己哪一面..."
  return "输入你对这个对象最关心的问题，或者让 agent 直接进入当前 skill 的蒸馏路径..."
})

const activeChatComposerPlaceholder = computed(() => {
  if (activeChatBootstrapping.value) return `正在连接 ${activeAssistantName.value}...`
  if (distillIntensity.value === "gentle") {
    return `继续和 ${activeAssistantName.value} 对话，也可以直接说“用 ${GENTLE_QUESTION_TARGET} 道选择题测我 / 测 TA”...`
  }
  return `继续和 ${activeAssistantName.value} 对话，直接把你现在最想追问的问题丢进来...`
})

const activeMaterialPreset = computed(() => (
  materialTypePresets.find((item) => item.value === upload.evidence_type) || materialTypePresets[0]
))

const activeMaterialTypeHint = computed(() => activeMaterialPreset.value.hint)

const activeUploadHint = computed(() => {
  if (upload.evidence_type === "screenshot") return "支持 .png .jpg .jpeg .webp，单文件最大 10MB"
  if (upload.evidence_type === "public_reference") return "支持 .pdf .doc .docx .md .txt，单文件最大 10MB"
  return "支持 .txt .csv .json .png .jpg .pdf，单文件最大 10MB"
})

const activeTextareaLabel = computed(() => {
  if (upload.evidence_type === "screenshot") return "补充这批截图的上下文说明"
  if (upload.evidence_type === "public_reference") return "或者直接粘贴公开资料 / 文档摘要"
  if (upload.evidence_type === "text_note") return isSelfTarget.value ? "或者直接粘贴你的自述 / 笔记" : "或者直接粘贴观察笔记 / 采访摘要"
  return isSelfTarget.value ? "或者直接粘贴你的聊天记录 / 自述" : "或者直接粘贴聊天记录"
})

const activeTextareaPlaceholder = computed(() => {
  if (upload.evidence_type === "screenshot") {
    return "例如：这批截图来自哪段关系/时间线、谁先发起、你想重点分析哪几张。"
  }
  if (upload.evidence_type === "public_reference") {
    return "粘贴文章摘录、公开主页简介、简历片段或外部资料摘要，帮助系统补足背景。"
  }
  if (upload.evidence_type === "text_note") {
    return isSelfTarget.value
      ? "粘贴复盘、自我介绍、工作总结、观察笔记，任何能代表你表达风格与思考方式的文字..."
      : "粘贴对 TA 的观察记录、访谈纪要、复盘笔记，帮助系统建立更稳定的人物画像..."
  }
  return isSelfTarget.value
    ? "粘贴微信 / QQ / 钉钉聊天记录、复盘、自我介绍、工作总结，任何能代表你表达风格的文字..."
    : "粘贴聊天记录、对话纪要、观察笔记，任何能代表 TA 表达风格的文字..."
})

const activeSessionStatus = computed(() => {
  if (activeChatBootstrapping.value) return "加载中"
  if (activeSession.value) return "已连接"
  return "待启动"
})

const activeChatSendLabel = computed(() => {
  if (!activeChatSending.value) return "发送"
  return activeChatStatusText.value || "发送中..."
})

const distillIntensityOptions: Array<{ value: DistillIntensity; label: string; copy: string }> = [
  {
    value: "gentle",
    label: "小火蒸馏",
    copy: `允许问卷式、假设式提问，可用 1/2/3/4 或 A/B/C/D 逐轮做题，通常 ${GENTLE_QUESTION_TARGET} 道即可生成首版报告。`,
  },
  {
    value: "intense",
    label: "猛火蒸馏",
    copy: "继续按当前 skill 的强约束深挖，优先少量高价值追问，不轻易改成泛问卷。",
  },
]

const activeDistillModeSystemMessage = computed(() => {
  if (distillIntensity.value === "gentle") {
    return `当前为小火蒸馏。通常完成 ${GENTLE_QUESTION_TARGET} 道选择题即可生成首版报告，系统会按 1/2/3/4 或 A/B/C/D 的形式发题，当前进度 ${gentleQuestionProgressDisplay.value}。`
  }
  return "当前为猛火蒸馏。系统会优先遵循主 skill 约束直接深挖，只保留少量高价值追问。"
})

function normalizeVisibleWizardStep(step: WizardStep) {
  return step === 2 ? 3 : step
}

function stepComplete(step: WizardStep) {
  const normalizedStep = normalizeVisibleWizardStep(step)
  if (normalizedStep === 1) return Boolean(projectId.value)
  if (normalizedStep === 3) return Boolean(latestJob.value) || activeChatMessages.value.length > 0 || hasStoredMaterials.value
  return showReportState.value
}

function canOpenStep(step: WizardStep) {
  const normalizedStep = normalizeVisibleWizardStep(step)
  if (normalizedStep === 1) return true
  if (normalizedStep === 3) return Boolean(projectId.value)
  return Boolean(latestJob.value)
}

function openStep(step: WizardStep) {
  const normalizedStep = normalizeVisibleWizardStep(step)
  if (!canOpenStep(normalizedStep)) return
  currentStep.value = normalizedStep
}

function journeyStepMark(step: WizardStep, code: string) {
  const normalizedStep = normalizeVisibleWizardStep(step)
  if (normalizeVisibleWizardStep(currentStep.value) !== normalizedStep && stepComplete(normalizedStep)) return "✓"
  return code
}

function journeyStepClass(step: WizardStep) {
  const normalizedStep = normalizeVisibleWizardStep(step)
  if (normalizeVisibleWizardStep(currentStep.value) === normalizedStep) return "is-active"
  if (stepComplete(normalizedStep)) return "is-done"
  if (canOpenStep(normalizedStep)) return "is-open"
  return "is-locked"
}

function clearMaterialPolling() {
  if (materialPollTimer !== null) {
    window.clearTimeout(materialPollTimer)
    materialPollTimer = null
  }
}

function clearJobPolling() {
  if (jobPollTimer !== null) {
    window.clearTimeout(jobPollTimer)
    jobPollTimer = null
  }
}

function enterReportBridge() {
  currentStep.value = 4
  reportBridgeEntered.value = true
}

function normalizeComposerMessage(value: string) {
  const lines = value.replace(/\r\n/g, "\n").split("\n")
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  if (!lines.length) return ""
  const normalized = lines.map((line) => line.replace(/[ \t]+$/g, ""))
  normalized[0] = normalized[0].trimStart()
  normalized[normalized.length - 1] = normalized[normalized.length - 1].trimEnd()
  return normalized.join("\n")
}

function normalizeActiveDraft() {
  activeChatDraft.value = normalizeComposerMessage(activeChatDraft.value)
}

function scheduleMaterialPolling() {
  clearMaterialPolling()
  if (!projectId.value || !projectMaterials.value.some((item) => item.parse_status === "queued" || item.parse_status === "parsing")) return
  materialPollTimer = window.setTimeout(() => {
    void refreshProjectMaterials()
  }, 1600)
}

function scheduleJobPolling() {
  clearJobPolling()
  if (!latestJob.value?.job_id || isReadyJob.value || latestJob.value.status === "failed") return
  jobPollTimer = window.setTimeout(() => {
    void refreshLatestJob()
  }, 1800)
}

function scrollActiveThreadToBottom() {
  const node = activeThreadRef.value
  if (!node) return
  node.scrollTop = node.scrollHeight
}

function defaultValueFallback(current: string, next: string, pool: string[]) {
  return !current.trim() || pool.includes(current.trim()) ? next : current
}

function selectTargetChip(key: TargetKey) {
  const subjectDefaults = allTargetConfigs.value.map((item) => item.subjectDefault)
  const projectDefaults = allTargetConfigs.value.map((item) => item.projectDefault)
  const goalDefaults = focusGoalDefaultPool(allTargetConfigs.value)
  const config = targetConfigMap.value[key] || fallbackTargetConfigs.self

  form.subject_type = config.subjectType
  form.relation_label = config.relationLabel
  form.subject_name = defaultValueFallback(form.subject_name, config.subjectDefault, subjectDefaults)
  form.name = defaultValueFallback(form.name, config.projectDefault, projectDefaults)
  form.analysis_goal = defaultValueFallback(
    form.analysis_goal,
    resolveFocusGoalCopy(config, intake.key_concern as FocusChipValue).default,
    goalDefaults,
  )
  skillPoolSearch.value = ""
  selectedSkillMode.value = "auto"
  manualPackSlug.value = ""
  skillRouterSelectedPackSlugs.value = []
  backendPackRecommendation.value = null
  expandedSkillSlug.value = preferredTargetPackSlug.value || config.fallbackPackSlug || ""
}

function selectSkillCandidate(slug: string) {
  if (!slug) return
  toggleExpandedSkillCandidate(slug)
}

async function openSkillDetailModal(slug: string) {
  if (!slug) return
  selectSkillCandidate(slug)
  skillDetailModalSlug.value = slug
  try {
    await ensurePackDetailLoaded(slug)
  } catch {}
}

function closeSkillDetailModal() {
  skillDetailModalSlug.value = ""
}

function resetResultLockState() {
  resultUnlockModalOpen.value = false
  pendingUnlockCardKey.value = ""
  unlockedResultCardKeys.value = []
  activeResultCardDetailKey.value = ""
}

function isResultCardUnlocked(key: ResultCardKey) {
  return unlockedResultCardKeys.value.includes(key)
}

function handleResultCardClick(key: ResultCardKey) {
  if (isResultCardUnlocked(key)) {
    activeResultCardDetailKey.value = key
    return
  }
  pendingUnlockCardKey.value = key
  resultUnlockModalOpen.value = true
}

function closeResultUnlockModal() {
  resultUnlockModalOpen.value = false
  pendingUnlockCardKey.value = ""
}

async function unlockResultCard(action: ResultUnlockAction) {
  const key = pendingUnlockCardKey.value
  if (!key) return

  if (action === "share" && typeof window !== "undefined") {
    const shareLink = `${window.location.origin}/projects/new?projectId=${encodeURIComponent(projectId.value)}&unlockCard=${encodeURIComponent(key)}`
    try {
      await navigator.clipboard.writeText(shareLink)
    } catch {}
  }

  if (!unlockedResultCardKeys.value.includes(key)) {
    unlockedResultCardKeys.value = [...unlockedResultCardKeys.value, key]
  }
  resultUnlockModalOpen.value = false
  pendingUnlockCardKey.value = ""
  activeResultCardDetailKey.value = key
}

function closeResultCardDetail() {
  activeResultCardDetailKey.value = ""
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  if (!text.trim()) return y
  const chars = text.split("")
  let line = ""
  let lineCount = 0
  for (const char of chars) {
    const nextLine = line + char
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      lineCount += 1
      const isLastLine = lineCount >= maxLines
      ctx.fillText(isLastLine ? `${line.trimEnd()}…` : line, x, y)
      y += lineHeight
      line = char
      if (isLastLine) return y
      continue
    }
    line = nextLine
  }
  if (line && lineCount < maxLines) {
    ctx.fillText(line, x, y)
    y += lineHeight
  }
  return y
}

function downloadActiveResultCardPoster() {
  const detail = activeResultCardDetail.value
  if (!detail || typeof document === "undefined") return

  const width = 1242
  const height = 2208
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const accentMap: Record<ResultCardKey, string> = {
    mbti_profile: "#50c79d",
    distill_graph: "#f5b35a",
    recommendation: "#8e83ff",
  }
  const accent = accentMap[detail.key]

  ctx.fillStyle = "#07090f"
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = "rgba(255,255,255,0.05)"
  ctx.lineWidth = 1
  for (let i = 0; i <= width; i += 78) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, height)
    ctx.stroke()
  }
  for (let i = 0; i <= height; i += 78) {
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(width, i)
    ctx.stroke()
  }

  ctx.fillStyle = "rgba(255,255,255,0.06)"
  drawRoundedRect(ctx, 84, 84, width - 168, height - 168, 42)
  ctx.fill()

  ctx.fillStyle = "rgba(255,255,255,0.04)"
  drawRoundedRect(ctx, 132, 268, width - 264, height - 430, 34)
  ctx.fill()

  ctx.fillStyle = accent
  drawRoundedRect(ctx, 132, 132, 210, 56, 28)
  ctx.fill()
  ctx.fillStyle = "#081018"
  ctx.font = "700 24px 'Noto Sans SC', sans-serif"
  ctx.textBaseline = "middle"
  ctx.fillText(detail.cardCode, 160, 160)

  let cursorY = 390
  ctx.fillStyle = "#f8f9fb"
  ctx.font = "700 90px 'Noto Serif SC', serif"
  cursorY = drawWrappedText(ctx, detail.detailTitle, 182, cursorY, width - 364, 106, 2)

  ctx.fillStyle = "rgba(248,249,251,0.8)"
  ctx.font = "500 36px 'Noto Sans SC', sans-serif"
  cursorY = drawWrappedText(ctx, detail.detailSubtitle, 182, cursorY + 30, width - 364, 54, 2)

  const metricStartY = cursorY + 70
  const metricWidth = (width - 404) / 2
  const metricHeight = 122
  detail.metrics.slice(0, 6).forEach((metric, index) => {
    const row = Math.floor(index / 2)
    const col = index % 2
    const x = 182 + col * (metricWidth + 40)
    const y = metricStartY + row * (metricHeight + 24)
    ctx.fillStyle = "rgba(255,255,255,0.06)"
    drawRoundedRect(ctx, x, y, metricWidth, metricHeight, 24)
    ctx.fill()
    ctx.fillStyle = "rgba(255,255,255,0.76)"
    ctx.font = "500 27px 'Noto Sans SC', sans-serif"
    ctx.textBaseline = "alphabetic"
    ctx.fillText(metric.label, x + 26, y + 48)
    ctx.fillStyle = accent
    ctx.font = "700 40px 'Noto Serif SC', serif"
    ctx.fillText(metric.value, x + 26, y + 94)
  })

  ctx.fillStyle = "rgba(255,255,255,0.92)"
  ctx.font = "500 38px 'Noto Serif SC', serif"
  const quoteY = metricStartY + Math.ceil(detail.metrics.slice(0, 6).length / 2) * (metricHeight + 24) + 86
  drawWrappedText(ctx, `“${detail.detailQuote}”`, 182, quoteY, width - 364, 58, 4)

  const subjectLabel = form.subject_name || "Distill User"
  const dateLabel = resultCardDetailDate.value
  ctx.fillStyle = "rgba(255,255,255,0.62)"
  ctx.font = "500 24px 'Noto Sans SC', sans-serif"
  ctx.fillText(`FOR: ${subjectLabel}`, 182, height - 192)
  ctx.fillText(`DATE: ${dateLabel}`, width - 430, height - 192)

  canvas.toBlob((blob) => {
    if (!blob) return
    const fileBase = (subjectLabel || "distill")
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      || "distill"
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `${fileBase}-${detail.key}-poster.png`
    link.click()
    URL.revokeObjectURL(link.href)
  }, "image/png")
}

function validateStepOne() {
  if (!form.name.trim()) return "请先填写蒸馏名称"
  if (!form.subject_name.trim()) return "请先填写蒸馏对象"
  if (!form.analysis_goal.trim()) return "请先写清你最想解决的问题"
  return ""
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  fileRef.value = input.files?.[0] || null
  syncUploadEvidenceType()
}

function handleDrop(event: DragEvent) {
  isDragOver.value = false
  const dropped = event.dataTransfer?.files?.[0]
  if (dropped) {
    fileRef.value = dropped
    syncUploadEvidenceType()
  }
}

function inferEvidenceTypeFromFile(file: File): EvidenceType {
  const fileName = file.name.toLowerCase()
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(fileName)) return "screenshot"
  if (/\.(txt|csv|json|md)$/i.test(fileName)) return "chat_export"
  return "public_reference"
}

function syncUploadEvidenceType() {
  if (fileRef.value) {
    upload.evidence_type = inferEvidenceTypeFromFile(fileRef.value)
    return
  }
  if (upload.text_content.trim() && upload.evidence_type === "public_reference") {
    upload.evidence_type = "text_note"
  }
}

function isSkillRouterPackSelected(slug: string) {
  return skillRouterSelectedPackSlugs.value.includes(slug)
}

function toggleSkillRouterPack(slug: string) {
  if (!slug || (isSelfTarget.value && slug !== FIXED_SELF_PACK_SLUG)) return
  const alreadySelected = isSkillRouterPackSelected(slug)
  if (alreadySelected) {
    skillRouterSelectedPackSlugs.value = skillRouterSelectedPackSlugs.value.filter((item) => item !== slug)
  } else {
    skillRouterSelectedPackSlugs.value = [...skillRouterSelectedPackSlugs.value, slug].slice(0, 8)
  }
  selectedSkillMode.value = skillRouterSelectedPackSlugs.value.length ? "custom" : "auto"
  if (alreadySelected) {
    manualPackSlug.value = manualPackSlug.value === slug ? (skillRouterSelectedPackSlugs.value[0] || "") : manualPackSlug.value
  } else {
    manualPackSlug.value = slug
  }
  expandedSkillSlug.value = slug
}

function toggleExpandedSkillCandidate(slug: string) {
  if (!slug) return
  expandedSkillSlug.value = slug
  void ensurePackDetailLoaded(slug)
}

function candidateSummary(candidate: RankedSkillCandidateView) {
  const detail = packDetailsBySlug[candidate.pack.slug]
  return detail?.preview_report.memory.summary || mainSkillCandidateReason(candidate)
}

function candidateTags(candidate: RankedSkillCandidateView) {
  const detail = packDetailsBySlug[candidate.pack.slug]?.pack
  const pack = detail || candidate.pack
  return [...new Set([...(pack.tags || []), ...(pack.skills || [])])].filter(Boolean).slice(0, 5)
}

function isCandidateExpanded(slug: string) {
  const current = expandedSkillSlug.value || activePackSlug.value
  return current === slug
}

const skillDetailModalOpen = computed(() => Boolean(skillDetailModalSlug.value))
const resultDetailModalOpen = computed(() => Boolean(activeResultCardDetail.value))
const hasBlockingModalOpen = computed(() => (
  distillModeModalOpen.value || skillDetailModalOpen.value || resultUnlockModalOpen.value || resultDetailModalOpen.value
))

const modalSkillDetail = computed(() => {
  const slug = skillDetailModalSlug.value
  if (!slug) return null
  const candidate = visibleSkillCandidatePool.value.find((item) => item.pack.slug === slug)
    || mainSkillCandidatePool.value.find((item) => item.pack.slug === slug)
    || null
  const detail = packDetailsBySlug[slug] || null
  const pack = detail?.pack || candidate?.pack || packs.value.find((item) => item.slug === slug) || null
  if (!pack) return null
  const reasons = candidate?.reasons?.length
    ? candidate.reasons.slice(0, 4)
    : [candidate ? mainSkillCandidateReason(candidate) : pack.subtitle || "这个 skill 适合作为当前对象的整理入口。"]
  return {
    pack,
    candidate,
    summary: detail?.preview_report.memory.summary || (candidate ? candidateSummary(candidate) : pack.subtitle || ""),
    reasons,
    tags: [...new Set([...(pack.tags || []), ...(pack.skills || [])])].filter(Boolean).slice(0, 8),
    matchedNames: candidate?.matchedNames || [],
    useCases: detail?.preview_report.cognition.suggested_use_cases?.slice(0, 6) || pack.suitable_for?.slice(0, 6) || [],
    starterPrompts: detail?.starter_prompts?.slice(0, 4) || [],
    sourceTitles: detail?.sources?.map((item) => item.title).filter(Boolean).slice(0, 4) || [],
  }
})

async function loadDistillTargetConfigs() {
  if (!auth.token) return
  try {
    const { data } = await api.get<DistillTargetSettingsResponse>("/settings/distill-targets")
    distillTargetConfigs.value = (data.items || []).map(normalizeTargetConfigPayload)
  } catch {
    distillTargetConfigs.value = []
  }
}

async function ensurePacksLoaded() {
  if (!auth.token || packs.value.length || packsLoading.value) return
  try {
    packsLoading.value = true
    const { data } = await api.get<{ items: PackSummary[] }>("/packs")
    packs.value = data.items
  } catch {} finally {
    packsLoading.value = false
  }
}

function buildPackRecommendationPayload(): PackRecommendationRequest {
  return {
    subject_name: form.subject_name.trim(),
    relation_label: form.relation_label || undefined,
    analysis_goal: form.analysis_goal.trim(),
    configured_names: selectedTargetMeta.value.configuredNames,
    selected_pack_slugs: effectiveSkillPoolSlugs.value,
    limit: 6,
  }
}

async function requestBackendPackRecommendation() {
  if (!auth.token || isSelfConfig(selectedTargetMeta.value)) {
    backendPackRecommendation.value = null
    return
  }
  try {
    backendPackRecommendationLoading.value = true
    const payload = buildPackRecommendationPayload()
    const { data } = await api.post<PackRecommendationResponse>("/packs/recommend", payload)
    backendPackRecommendation.value = data
    if (data.items?.length) {
      const known = new Set(packs.value.map((item) => item.slug))
      const appended = data.items.map((item) => item.pack).filter((item) => !known.has(item.slug))
      if (appended.length) packs.value = [...packs.value, ...appended]
    }
  } catch {
    backendPackRecommendation.value = null
  } finally {
    backendPackRecommendationLoading.value = false
  }
}

function scheduleBackendPackRecommendation() {
  if (typeof window === "undefined") return
  if (packRecommendationTimer !== undefined) {
    window.clearTimeout(packRecommendationTimer)
  }
  packRecommendationTimer = window.setTimeout(() => {
    void requestBackendPackRecommendation()
  }, 180)
}

async function ensurePackDetailLoaded(slug: string) {
  if (!slug || packDetailsBySlug[slug]) return packDetailsBySlug[slug] || null
  const { data } = await api.get<PackDetailResponse>(`/packs/${slug}`)
  packDetailsBySlug[slug] = data
  if (!packs.value.some((item) => item.slug === slug)) {
    packs.value = [...packs.value, data.pack]
  }
  return data
}

async function ensureAnalysisTrackDetailsLoaded() {
  const slugs = Array.from(new Set(analysisTrackCards.value.map((item) => item.slug).filter(Boolean))) as string[]
  await Promise.all(slugs.map(async (slug) => {
    try {
      await ensurePackDetailLoaded(slug)
    } catch {}
  }))
}

function hydrateActiveSkillState(slug: string) {
  hydrateCachedSkillState(slug)
  activeSkillProject.value = skillProjectsBySlug[slug] || null
  activeSession.value = skillSessionsBySlug[slug] || null
  activeChatMessages.value = skillMessagesBySlug[slug] ? [...skillMessagesBySlug[slug]] : []
  resetActiveChatSocket()
}

function resetActiveChatSocket() {
  activeChatSocket?.close()
  activeChatSocket = null
}

function ensureActiveChatSocket() {
  if (!activeSession.value) throw new Error("聊天会话未初始化")
  const token = localStorage.getItem("distill-human-token") || ""
  if (!token) throw new Error("登录态已失效，请重新登录")
  if (!activeChatSocket) {
    activeChatSocket = new ChatSocketClient(activeSession.value.session_id, token)
  }
  return activeChatSocket
}

async function ensureExpertDetailLoaded(expertId: string) {
  if (!expertId || expertDetailsById[expertId]) return expertDetailsById[expertId] || null
  try {
    const { data } = await api.get<PackDetailResponse>(`/experts/${expertId}`)
    expertDetailsById[expertId] = data
    return data
  } catch {
    return null
  }
}

async function syncActiveChatRecommendation(recommendation: ChatExpertRecommendation | null | undefined) {
  activeChatRecommendation.value = recommendation || null
  const selectedId = recommendation?.selected_expert_id || recommendation?.recommended_expert_id
  if (recommendation?.recommended_expert_id && recommendation.recommended_expert_id !== dismissedActiveSkillSuggestionId.value) {
    dismissedActiveSkillSuggestionId.value = ""
  }
  if (selectedId) {
    await ensureExpertDetailLoaded(selectedId)
  }
}

function cacheActiveMessages(slug: string) {
  skillMessagesBySlug[slug] = [...activeChatMessages.value]
  persistSkillStateCache(slug)
}

function skillStateStorageKey(slug: string) {
  return `distill-human:v2:skill-state:${slug}`
}

function hydrateCachedSkillState(slug: string) {
  if (typeof window === "undefined") return
  if (skillProjectsBySlug[slug] && skillSessionsBySlug[slug] && skillMessagesBySlug[slug]?.length) return
  try {
    const raw = window.localStorage.getItem(skillStateStorageKey(slug))
    if (!raw) return
    const cached = JSON.parse(raw) as {
      project?: ProjectSummary
      session?: ChatSessionSummary
      messages?: ChatMessage[]
    }
    if (cached.project && !skillProjectsBySlug[slug]) {
      skillProjectsBySlug[slug] = cached.project
    }
    if (cached.session && !skillSessionsBySlug[slug]) {
      skillSessionsBySlug[slug] = cached.session
    }
    if (cached.messages?.length && !skillMessagesBySlug[slug]?.length) {
      skillMessagesBySlug[slug] = cached.messages
    }
  } catch {}
}

function persistSkillStateCache(slug: string) {
  if (typeof window === "undefined") return
  const project = skillProjectsBySlug[slug]
  const session = skillSessionsBySlug[slug]
  if (!project || !session) return
  window.localStorage.setItem(
    skillStateStorageKey(slug),
    JSON.stringify({
      project,
      session,
      messages: (skillMessagesBySlug[slug] || []).slice(-40),
    }),
  )
}

function buildSkillSessionTitle(slug: string) {
  const title = packDetailsBySlug[slug]?.pack.title || activeAssistantName.value
  return `${title} · Distill Deep Chat`
}

async function ensureActiveSkillReady(slug = activePackSlug.value) {
  if (!auth.token || !slug || currentStep.value !== 3) return
  const nonce = ++skillBootstrapNonce
  activeChatBootstrapping.value = true
  activeChatError.value = ""
  hydrateActiveSkillState(slug)
  try {
    await ensurePacksLoaded()
    await ensurePackDetailLoaded(slug)
    if (nonce !== skillBootstrapNonce) return

    if (!skillProjectsBySlug[slug]) {
      const { data } = await api.post<PackCloneResponse>(`/packs/${slug}/clone`, {})
      skillProjectsBySlug[slug] = data.project
      persistSkillStateCache(slug)
    }
    if (nonce !== skillBootstrapNonce) return

    const { data: bootstrap } = await api.post<ChatSessionBootstrapResponse>(`/projects/${skillProjectsBySlug[slug].project_id}/chat/bootstrap`, {
      mode: "advice",
      title: buildSkillSessionTitle(slug),
    })
    const cachedMessages = skillMessagesBySlug[slug] ? [...skillMessagesBySlug[slug]] : []
    const sessionDetail = bootstrap.session_detail
    skillSessionsBySlug[slug] = sessionDetail.session
    skillProjectsBySlug[slug] = sessionDetail.project
    skillMessagesBySlug[slug] = sessionDetail.messages.length ? sessionDetail.messages : cachedMessages
    if (bootstrap.pack_detail) {
      packDetailsBySlug[slug] = bootstrap.pack_detail
    }
    persistSkillStateCache(slug)
    if (nonce !== skillBootstrapNonce) return
    await syncActiveChatRecommendation(sessionDetail.expert_recommendation)
    if (nonce !== skillBootstrapNonce) return

    hydrateActiveSkillState(slug)
    await nextTick()
    scrollActiveThreadToBottom()
  } catch (error: any) {
    if (nonce !== skillBootstrapNonce) return
    activeChatError.value = error.response?.data?.detail || error.message || "当前 skill 加载失败"
  } finally {
    if (nonce === skillBootstrapNonce) {
      activeChatBootstrapping.value = false
    }
  }
}

function handleDeepConversationSelect(item: DeepConversationItem) {
  if (item.kind === "precision") {
    openPrecisionPanel()
    return
  }
  if (item.slug) {
    activateSkillConversation(item.slug)
  }
}

function openPrecisionPanel() {
  activeDeepView.value = "precision"
  void prewarmPrecisionSessions()
}

async function prewarmSingleSkill(slug: string) {
  if (!slug) return
  try {
    await ensurePackDetailLoaded(slug)
    if (currentStep.value === 3) {
      await ensureActiveSkillReady(slug)
    }
  } catch {}
}

async function prewarmPrecisionSessions() {
  await Promise.all(uniquePrecisionSkillSlugs.value.map((slug) => prewarmSingleSkill(slug)))
}

function activateSkillConversation(slug: string) {
  if (!slug) return
  activeDeepView.value = "chat"
  selectSkillCandidate(slug)
  void prewarmSingleSkill(slug)
}

function applyActiveAssistantPrompt(prompt: string) {
  activeChatDraft.value = prompt
  nextTick(() => activeComposerRef.value?.focus())
}

function dismissActiveSkillSwitchSuggestion() {
  dismissedActiveSkillSuggestionId.value = activeSkillSwitchSuggestion.value?.expertId || ""
}

function applyActiveSkillSwitchSuggestion() {
  const suggestion = activeSkillSwitchSuggestion.value
  if (!suggestion) return
  dismissedActiveSkillSuggestionId.value = suggestion.expertId
  activateSkillConversation(suggestion.packSlug)
}

function prefillActiveAssistantQuestion() {
  applyActiveAssistantPrompt(activeStarterPrompts.value[0] || "")
}

function appendActiveComposerDraft(lines: string[]) {
  const cleanLines = lines.map((line) => line.trim()).filter(Boolean)
  if (!cleanLines.length) return
  const current = normalizeComposerMessage(activeChatDraft.value)
  activeChatDraft.value = current ? `${current}\n${cleanLines.join("\n")}` : cleanLines.join("\n")
  void nextTick().then(() => {
    activeComposerRef.value?.focus()
  })
}

function buildMaterialAssetUrl(material: MaterialSummary) {
  const raw = String(material.file_url || "").trim()
  if (!raw) return ""
  const base = import.meta.env.VITE_API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "")
  try {
    return new URL(raw, base).toString()
  } catch {
    return raw
  }
}

function buildLocalImagePreviewUrl(file: File) {
  if (!file.type.startsWith("image/")) return ""
  const previewUrl = URL.createObjectURL(file)
  activeChatPreviewObjectUrls.add(previewUrl)
  return previewUrl
}

function appendActiveUploadEchoMessage(material: MaterialSummary, file: File) {
  const previewUrl = buildLocalImagePreviewUrl(file)
  const remoteUrl = inferEvidenceTypeFromFile(file) === "screenshot" ? buildMaterialAssetUrl(material) : ""
  const label = material.label || file.name || "未命名素材"
  const content = inferEvidenceTypeFromFile(file) === "screenshot"
    ? `已补充图片素材：${label}`
    : `已补充文件素材：${label}`
  activeChatMessages.value.push({
    message_id: `skill-upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    session_id: activeSession.value?.session_id || `skill-local-${activePackSlug.value || "chat"}`,
    role: "user",
    mode: "advice",
    kind: "material_upload",
    content,
    citations: [],
    metadata: {
      material_label: label,
      material_image_url: remoteUrl || undefined,
      material_preview_url: previewUrl || undefined,
    },
    created_at: new Date().toISOString(),
  })
  const slug = activePackSlug.value
  if (slug) cacheActiveMessages(slug)
  void nextTick().then(scrollActiveThreadToBottom)
}

function triggerActiveChatImagePicker() {
  activeChatImagePickerRef.value?.click()
}

function triggerActiveChatFilePicker() {
  activeChatFilePickerRef.value?.click()
}

async function uploadActiveChatMaterial(file: File, options?: { quiet?: boolean }) {
  if (!projectId.value) {
    if (!options?.quiet) {
      activeChatComposerNotice.value = "请先完成第一步，创建蒸馏项目后再上传。"
    }
    return null
  }
  try {
    activeChatMaterialUploading.value = true
    if (!options?.quiet) activeChatComposerNotice.value = ""
    const formData = new FormData()
    formData.append("evidence_type", inferEvidenceTypeFromFile(file))
    formData.append("label", file.name || "聊天窗口素材")
    formData.append("text_content", "")
    formData.append("consent_confirmed", "true")
    formData.append("file", file)
    const { data } = await api.post<{ material: MaterialSummary }>(`/projects/${projectId.value}/materials/upload`, formData)
    projectMaterials.value = [data.material, ...projectMaterials.value]
    if (!options?.quiet) {
      activeChatComposerNotice.value = `已上传素材：${file.name || "未命名文件"}`
    }
    void refreshProjectReadiness()
    return data.material
  } catch (error: any) {
    if (!options?.quiet) {
      activeChatComposerNotice.value = error.response?.data?.detail || error.message || "素材上传失败"
    }
    return null
  } finally {
    activeChatMaterialUploading.value = false
    activeChatImageInputKey.value += 1
    activeChatFileInputKey.value += 1
  }
}

async function handleActiveChatImageFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const material = await uploadActiveChatMaterial(file)
  if (!material) return
  appendActiveUploadEchoMessage(material, file)
  appendActiveComposerDraft([`我刚补充了图片素材《${material.label || file.name || "未命名图片"}》，请结合这份素材继续分析。`])
}

async function handleActiveChatMaterialFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const material = await uploadActiveChatMaterial(file)
  if (!material) return
  appendActiveUploadEchoMessage(material, file)
  appendActiveComposerDraft([`我刚补充了文件素材《${material.label || file.name || "未命名文件"}》，请结合这份素材继续分析。`])
}

async function handleActiveComposerPaste(event: ClipboardEvent) {
  const clipboard = event.clipboardData
  if (!clipboard) return
  const pastedText = clipboard.getData("text/plain").trim()
  const files = Array.from(clipboard.items || [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((item): item is File => Boolean(item))

  if (!files.length) return
  event.preventDefault()

  const uploadedMaterialNames: string[] = []
  for (const file of files.slice(0, 4)) {
    const material = await uploadActiveChatMaterial(file, { quiet: true })
    if (material) {
      uploadedMaterialNames.push(material.label || file.name || "未命名素材")
      appendActiveUploadEchoMessage(material, file)
    }
  }

  if (!uploadedMaterialNames.length) {
    activeChatComposerNotice.value = "粘贴的文件未上传成功，请重试。"
    if (pastedText) appendActiveComposerDraft([pastedText])
    return
  }

  const draftLines = [
    pastedText,
    ...uploadedMaterialNames.map((name) => `我刚补充了素材《${name}》，请结合这份素材继续分析。`),
  ]
  appendActiveComposerDraft(draftLines)
  activeChatComposerNotice.value = `已上传 ${uploadedMaterialNames.length} 份粘贴素材，可直接发送。`
}

function handleActiveChatKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey) return
  event.preventDefault()
  void sendActiveAssistantMessage()
}

function isSystemNotice(message: ChatMessage) {
  return message.role === "system" || message.kind === "skill_switch"
}

function insertNoticeMessages(target: ChatMessage[], placeholder: ChatMessage, notices: ChatMessage[] | undefined) {
  if (!notices?.length) return
  const insertIndex = Math.max(0, target.indexOf(placeholder))
  target.splice(insertIndex, 0, ...notices)
}

function activeMessageImageUrl(message: ChatMessage) {
  const preview = message.metadata?.material_preview_url
  if (typeof preview === "string" && preview.trim()) return preview
  const remote = message.metadata?.material_image_url
  if (typeof remote === "string" && remote.trim()) return remote
  return ""
}

function activeMessageImageAlt(message: ChatMessage) {
  const label = message.metadata?.material_label
  if (typeof label === "string" && label.trim()) return label
  return "上传图片"
}

async function sendActiveAssistantMessage() {
  const slug = activePackSlug.value
  const userContent = normalizeComposerMessage(activeChatDraft.value)
  if (!slug || activeChatSending.value || activeChatMaterialUploading.value || !activeSession.value || !userContent) return
  activeChatSending.value = true
  activeChatStatusText.value = "消息已发送..."
  activeChatError.value = ""
  activeChatComposerNotice.value = ""
  activeChatDraft.value = ""
  activeChatMessages.value.push({
    message_id: `skill-local-${Date.now()}`,
    session_id: activeSession.value.session_id,
    role: "user",
    mode: "advice",
    content: userContent,
    citations: [],
    metadata: { distill_intensity: distillIntensity.value },
    created_at: new Date().toISOString(),
  })
  const placeholder: ChatMessage = {
    message_id: `skill-stream-${Date.now()}`,
    session_id: activeSession.value.session_id,
    role: "assistant",
    mode: "advice",
    content: "",
    citations: [],
    created_at: new Date().toISOString(),
  }
  activeChatMessages.value.push(placeholder)
  cacheActiveMessages(slug)
  await nextTick()
  scrollActiveThreadToBottom()

  let streamedText = ""
  try {
    const socket = ensureActiveChatSocket()
    const result = await socket.sendMessage({
      content: userContent,
      mode: "advice",
      distillIntensity: distillIntensity.value,
      onStatus: (status) => {
        activeChatStatusText.value = status.text || "处理中..."
      },
      onChunk: (chunk) => {
        streamedText += chunk
        placeholder.content = streamedText
        if (streamedText.trim()) {
          activeChatStatusText.value = "生成中..."
        }
        cacheActiveMessages(slug)
        void nextTick().then(scrollActiveThreadToBottom)
      },
    })
    const donePayload = result.donePayload as ChatStreamDonePayload | ChatMessage | null
    if (donePayload) {
      const finalPayload = donePayload as ChatStreamDonePayload
      const finalMessage = finalPayload.message || (donePayload as ChatMessage)
      insertNoticeMessages(activeChatMessages.value, placeholder, finalPayload.notice_messages)
      placeholder.message_id = finalMessage.message_id
      placeholder.content = finalMessage.content
      placeholder.citations = finalMessage.citations || []
      placeholder.kind = finalMessage.kind
      placeholder.metadata = finalMessage.metadata
      await syncActiveChatRecommendation(finalPayload.expert_recommendation)
    } else if (!streamedText.trim()) {
      throw new Error("对话流没有返回正文")
    }
  } catch (error: any) {
    resetActiveChatSocket()
    placeholder.content = `生成失败：${error?.message || "对话服务暂时不可用"}`
    activeChatDraft.value = userContent
    activeChatError.value = error?.message || "对话服务暂时不可用"
  } finally {
    activeChatStatusText.value = ""
    cacheActiveMessages(slug)
    activeChatSending.value = false
    await nextTick()
    scrollActiveThreadToBottom()
    void refreshProjectSnapshot()
  }
}

async function refreshProjectReadiness() {
  if (!projectId.value) {
    projectReadiness.value = null
    return
  }
  try {
    const { data } = await api.get<ProjectReadinessResponse>(`/projects/${projectId.value}/readiness`)
    projectReadiness.value = data
  } catch (error: any) {
    const detail = error.response?.data?.detail || error.message || "蒸馏准备度获取失败"
    if (!latestJob.value || latestJob.value.status !== "distilling") {
      errorMessage.value = detail
    }
  }
}

async function refreshProjectSnapshot() {
  if (!projectId.value) return
  try {
    const previousJobId = latestJob.value?.job_id || ""
    const { data } = await api.get<ProjectDetailResponse>(`/projects/${projectId.value}`)
    projectMaterials.value = data.materials
    if (data.project.latest_job_id) {
      if (data.project.latest_job_id !== previousJobId || !latestJob.value) {
        await loadLatestJob(data.project.latest_job_id)
      } else {
        await refreshLatestJob()
      }
    } else {
      await refreshProjectReadiness()
    }
  } catch (error: any) {
    const detail = error.response?.data?.detail || error.message || "项目状态刷新失败"
    if (!latestJob.value || latestJob.value.status !== "distilling") {
      errorMessage.value = detail
    }
  }
}

async function refreshProjectMaterials() {
  if (!projectId.value) return
  try {
    const { data } = await api.get<{ items: MaterialSummary[] }>(`/projects/${projectId.value}/materials`)
    projectMaterials.value = data.items
    await refreshProjectReadiness()
  } finally {
    scheduleMaterialPolling()
  }
}

async function loadReportPreview() {
  if (!projectId.value) return
  try {
    const { data } = await api.get<DistillReport>(`/projects/${projectId.value}/report`)
    reportPreview.value = data
  } catch {
    reportPreview.value = null
  }
}

async function loadLatestJob(jobId?: string) {
  if (!jobId) {
    latestJob.value = null
    reportPreview.value = null
    await refreshProjectReadiness()
    return
  }
  const { data } = await api.get<DistillJob>(`/jobs/${jobId}`)
  latestJob.value = data
  await refreshProjectReadiness()
  if (data.status === "report_ready" || data.status === "chat_ready") {
    await loadReportPreview()
  }
}

async function refreshLatestJob() {
  if (!latestJob.value?.job_id) return
  await loadLatestJob(latestJob.value.job_id)
  scheduleJobPolling()
}

function applyProjectSnapshot(payload: ProjectDetailResponse) {
  const project = payload.project
  resetResultLockState()
  projectId.value = project.project_id
  form.name = project.name
  form.subject_name = project.subject_name
  form.subject_type = project.subject_type
  form.relation_label = project.relation_label || "myself"
  form.analysis_goal = project.analysis_goal || ""
  intake.relationship_stage = project.intake_profile?.relationship_stage || "current_observation"
  intake.distill_goal = project.intake_profile?.distill_goal || "understand_persona"
  intake.key_concern = project.intake_profile?.key_concern || "portrait_report"
  skillRouterSelectedPackSlugs.value = [...(project.intake_profile?.skill_router_config?.selected_pack_slugs || [])]
  selectedSkillMode.value = skillRouterSelectedPackSlugs.value.length ? "custom" : "auto"
  manualPackSlug.value = skillRouterSelectedPackSlugs.value[0] || ""
  projectMaterials.value = payload.materials
  currentStep.value = 3
  scheduleMaterialPolling()
}

async function loadExistingProject(projectIdFromRoute: string) {
  try {
    const { data } = await api.get<ProjectDetailResponse>(`/projects/${projectIdFromRoute}`)
    reportBridgeEntered.value = false
    applyProjectSnapshot(data)
    await loadLatestJob(data.project.latest_job_id)
    if (!data.project.latest_job_id) {
      await refreshProjectReadiness()
    }
    const requestedStep = normalizeVisibleWizardStep(Number(typeof route.query.step === "string" ? route.query.step : "") as WizardStep)
    if (cameFromChat.value && data.project.latest_job_id) {
      enterReportBridge()
    } else if (requestedStep >= 1 && requestedStep <= 4) {
      currentStep.value = requestedStep as WizardStep
    } else if (data.project.latest_job_id) {
      currentStep.value = isReadyJob.value ? 4 : 3
    }
    scheduleJobPolling()
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || error.message || "项目加载失败"
  }
}

async function applyRoutePreferredPack() {
  const requestedPackSlug = typeof route.query.packSlug === "string" ? route.query.packSlug.trim() : ""
  if (!requestedPackSlug) return
  await ensurePackDetailLoaded(requestedPackSlug)
  selectedSkillMode.value = "custom"
  skillRouterSelectedPackSlugs.value = [
    requestedPackSlug,
    ...skillRouterSelectedPackSlugs.value.filter((item) => item !== requestedPackSlug),
  ].slice(0, 8)
  manualPackSlug.value = requestedPackSlug
  expandedSkillSlug.value = requestedPackSlug
}

async function handleCreateProject(autoAdvance = false) {
  if (!auth.token) {
    await router.push({ name: "auth", query: { redirect: route.fullPath || "/projects/new" } })
    return
  }
  const validation = validateStepOne()
  if (validation) {
    errorMessage.value = validation
    return
  }
  if (projectId.value) {
    if (autoAdvance) currentStep.value = 3
    return
  }
  try {
    creating.value = true
    errorMessage.value = ""
    const payload = {
      ...form,
      subject_name: form.subject_type === "self" ? "我自己" : form.subject_name.trim(),
      intake_profile: {
        conversation_scope: "direct_1v1",
        relationship_stage: intake.relationship_stage,
        distill_goal: intake.distill_goal,
        key_concern: intake.key_concern,
        skill_router_config: {
          configured_names: selectedTargetMeta.value.configuredNames,
          selected_pack_slugs: effectiveSkillPoolSlugs.value,
        },
      },
    }
    const { data } = await api.post<ProjectSummary>("/projects", payload)
    await loadExistingProject(data.project_id)
    if (autoAdvance) currentStep.value = 3
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || error.message || "项目创建失败"
  } finally {
    creating.value = false
  }
}

function closeDistillModeModal() {
  distillModeModalOpen.value = false
}

function openDistillModeModal() {
  if (creating.value) return
  const validation = validateStepOne()
  if (validation) {
    errorMessage.value = validation
    return
  }
  errorMessage.value = ""
  distillModeModalOpen.value = true
}

async function selectDistillMode(intensity: DistillIntensity) {
  distillIntensity.value = intensity
  closeDistillModeModal()
  await handleCreateProject(true)
}

async function handleUpload(autoAdvance = false) {
  if (!projectId.value) {
    errorMessage.value = "请先开始蒸馏"
    return false
  }
  if (!upload.consent_confirmed) {
    errorMessage.value = "请先确认素材处理授权"
    return false
  }
  if (!upload.text_content.trim() && !fileRef.value) {
    errorMessage.value = "请至少上传文件或粘贴一段文本"
    return false
  }
  try {
    uploading.value = true
    errorMessage.value = ""
    const formData = new FormData()
    const resolvedEvidenceType = fileRef.value ? inferEvidenceTypeFromFile(fileRef.value) : upload.evidence_type
    formData.append("evidence_type", resolvedEvidenceType)
    formData.append("label", upload.label || fileRef.value?.name || "未命名素材")
    formData.append("text_content", upload.text_content)
    formData.append("consent_confirmed", String(upload.consent_confirmed))
    if (fileRef.value) formData.append("file", fileRef.value)
    const { data } = await api.post<{ material: MaterialSummary }>(`/projects/${projectId.value}/materials/upload`, formData)
    projectMaterials.value = [data.material, ...projectMaterials.value]
    upload.label = ""
    upload.text_content = ""
    upload.consent_confirmed = false
    fileRef.value = null
    fileInputKey.value += 1
    await refreshProjectMaterials()
    if (autoAdvance) currentStep.value = 3
    return true
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || error.message || "素材上传失败"
    return false
  } finally {
    uploading.value = false
  }
}

async function handleDeleteMaterial(materialId: string) {
  try {
    deletingMaterialId.value = materialId
    await api.delete(`/materials/${materialId}`)
    projectMaterials.value = projectMaterials.value.filter((item) => item.material_id !== materialId)
    await refreshProjectReadiness()
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || error.message || "素材删除失败"
  } finally {
    deletingMaterialId.value = ""
  }
}

async function handleDistill() {
  if (!projectId.value) {
    errorMessage.value = "请先开始蒸馏"
    return
  }
  try {
    distilling.value = true
    errorMessage.value = ""
    reportBridgeEntered.value = false
    resetResultLockState()
    currentStep.value = 3
    await refreshProjectReadiness()
    if (!projectReadiness.value?.report_supported) {
      errorMessage.value = projectReadiness.value?.summary || "当前项目不支持正式蒸馏报告"
      return
    }
    if (!projectReadiness.value?.can_generate_report) {
      errorMessage.value = readinessBlockers.value[0]?.detail || projectReadiness.value?.summary || "当前蒸馏进度还没达到正式生成门槛"
      return
    }
    const { data } = await api.post<DistillJob>(`/projects/${projectId.value}/distill`, {})
    latestJob.value = data
    reportPreview.value = null
    enterReportBridge()
    scheduleJobPolling()
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || error.message || "蒸馏失败"
  } finally {
    distilling.value = false
  }
}

async function handleRetryLatestJob() {
  if (!projectId.value) {
    errorMessage.value = "请先开始蒸馏"
    return
  }
  try {
    retryingLatestJob.value = true
    errorMessage.value = ""
    reportBridgeEntered.value = false
    resetResultLockState()
    await refreshProjectReadiness()
    const request = latestJob.value?.job_id
      ? api.post<DistillJob>(`/jobs/${latestJob.value.job_id}/retry`, {})
      : api.post<DistillJob>(`/projects/${projectId.value}/distill`, {})
    const { data } = await request
    latestJob.value = data
    reportPreview.value = null
    enterReportBridge()
    scheduleJobPolling()
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || error.message || "任务重试失败"
  } finally {
    retryingLatestJob.value = false
  }
}

async function handleUploadAndDistill() {
  const uploaded = await handleUpload(true)
  if (uploaded) {
    await handleDistill()
  }
}

watch(
  () => [
    auth.token,
    selectedTargetKey.value,
    form.subject_name,
    form.analysis_goal,
    form.relation_label,
    skillRouterSelectedPackSlugs.value.join(","),
    selectedSkillMode.value,
  ].join("|"),
  () => {
    if (!auth.token) {
      backendPackRecommendation.value = null
      return
    }
    scheduleBackendPackRecommendation()
  },
  { immediate: true },
)

watch(
  () => activePackSlug.value,
  (slug) => {
    if (!slug) return
    activeChatError.value = ""
    activeChatDraft.value = ""
    hydrateActiveSkillState(slug)
    void ensurePackDetailLoaded(slug)
    if (auth.token && currentStep.value === 3) {
      void ensureActiveSkillReady(slug)
    }
  },
  { immediate: false },
)

watch(
  () => analysisTrackCards.value.map((item) => item.slug).join("|"),
  () => {
    if (auth.token) {
      void ensureAnalysisTrackDetailsLoaded()
    }
  },
)

watch(
  () => currentStep.value,
  (step) => {
    if (step === 3 && auth.token && activePackSlug.value) {
      void ensureActiveSkillReady(activePackSlug.value)
    }
  },
)

watch(
  () => [cameFromChat.value, latestJob.value?.status || "", showReportState.value].join("|"),
  () => {
    const shouldEnter = cameFromChat.value && !reportBridgeEntered.value && (
      hasActiveDistillJob.value
      || isReadyJob.value
      || showReportState.value
    )
    if (shouldEnter) {
      enterReportBridge()
    }
  },
  { immediate: true },
)

watch(
  () => upload.text_content,
  (value) => {
    if (!fileRef.value && value.trim() && upload.evidence_type === "public_reference") {
      upload.evidence_type = "text_note"
    }
  },
)

watch(
  () => hasBlockingModalOpen.value,
  (open) => {
    if (typeof document === "undefined") return
    document.body.style.overflow = open ? "hidden" : ""
  },
)

watch(
  () => projectId.value,
  (next, prev) => {
    if (next && next !== prev) {
      resetResultLockState()
    }
  },
)

watch(
  () => reportPreview.value,
  (next, prev) => {
    if (next && next !== prev) {
      resetResultLockState()
    }
  },
)

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape") return
  if (activeFocusHint.value) {
    activeFocusHint.value = ""
    return
  }
  if (activeResultCardDetail.value) {
    closeResultCardDetail()
    return
  }
  if (resultUnlockModalOpen.value) {
    closeResultUnlockModal()
    return
  }
  if (distillModeModalOpen.value) {
    closeDistillModeModal()
    return
  }
  if (skillDetailModalOpen.value) {
    closeSkillDetailModal()
  }
}

watch(
  () => rankedSkillCandidates.value.map((item) => item.slug).join("|"),
  () => {
    if (selectedSkillMode.value === "custom" && manualPackSlug.value && !displaySkillCandidates.value.some((pack) => pack.slug === manualPackSlug.value)) {
      selectedSkillMode.value = "auto"
      manualPackSlug.value = ""
    }
  },
)

watch(
  () => activeChatMessages.value.length,
  () => {
    void nextTick().then(scrollActiveThreadToBottom)
  },
)

watch(
  () => auth.token,
  (token) => {
    if (!token) return
    void loadDistillTargetConfigs()
    void ensurePacksLoaded()
    if (activePackSlug.value) {
      void ensurePackDetailLoaded(activePackSlug.value)
    }
    void ensureAnalysisTrackDetailsLoaded()
    if (currentStep.value === 3 && activePackSlug.value) {
      void ensureActiveSkillReady(activePackSlug.value)
    }
  },
)

onMounted(() => {
  window.addEventListener("keydown", handleWindowKeydown)
  void (async () => {
    if (auth.token) {
      await loadDistillTargetConfigs()
    }

    const existingProjectId = typeof route.query.projectId === "string" ? route.query.projectId.trim() : ""
    if (existingProjectId) {
      await loadExistingProject(existingProjectId)
    } else {
      const rawTargetKey = typeof route.query.targetKey === "string" ? route.query.targetKey.trim() : "self"
      const normalizedTargetKey = rawTargetKey === "colleague" ? "classmate" : rawTargetKey
      if (targetConfigMap.value[normalizedTargetKey]) {
        selectTargetChip(normalizedTargetKey as TargetKey)
      } else {
        const subjectType = typeof route.query.subjectType === "string" ? (route.query.subjectType as SubjectType) : "self"
        const fallbackKey = subjectType === "self"
          ? (allTargetConfigs.value.find((item) => isSelfConfig(item))?.key || "self")
          : (allTargetConfigs.value.find((item) => !isSelfConfig(item))?.key || "ex")
        selectTargetChip(fallbackKey)
      }
    }

    if (typeof route.query.projectName === "string") form.name = route.query.projectName
    if (typeof route.query.subjectName === "string") form.subject_name = route.query.subjectName
    if (!existingProjectId) {
      const requestedStep = Number(typeof route.query.step === "string" ? route.query.step : "")
      if (requestedStep >= 1 && requestedStep <= 4) {
        currentStep.value = requestedStep as WizardStep
      }
    }

    if (auth.token) {
      await ensurePacksLoaded()
      await applyRoutePreferredPack()
      if (activePackSlug.value) {
        await ensurePackDetailLoaded(activePackSlug.value)
      }
      await ensureAnalysisTrackDetailsLoaded()
    }
  })()
})

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleWindowKeydown)
  if (typeof document !== "undefined") {
    document.body.style.overflow = ""
  }
  for (const previewUrl of activeChatPreviewObjectUrls) {
    URL.revokeObjectURL(previewUrl)
  }
  activeChatPreviewObjectUrls.clear()
  resetActiveChatSocket()
  clearMaterialPolling()
  clearJobPolling()
  if (packRecommendationTimer !== undefined) {
    window.clearTimeout(packRecommendationTimer)
    packRecommendationTimer = undefined
  }
})
</script>
