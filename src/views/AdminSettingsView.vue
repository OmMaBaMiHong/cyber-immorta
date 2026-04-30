<template>
  <div class="admin-cyber-page">
    <div class="admin-cyber-shell">
      <header class="admin-topbar">
        <div class="admin-topbar-left">
          <button type="button" class="admin-topbar-btn" aria-label="返回" @click="handleBack">
            <span class="admin-topbar-glyph" aria-hidden="true">←</span>
          </button>

          <label class="admin-topbar-picker">
            <select v-if="activeMenu === 'distill-targets'" v-model="activeTargetId" class="admin-topbar-select">
              <option v-for="item in distillTargets" :key="`top-target-${item.__editorId}`" :value="item.__editorId">
                {{ item.label || item.key || "未命名对象" }}
              </option>
            </select>

            <select v-else-if="activeMenu === 'ai'" v-model="activeProviderCode" class="admin-topbar-select">
              <option v-for="provider in settings.providers" :key="`top-provider-${provider.provider_code}`" :value="provider.provider_code">
                {{ provider.provider_name }}
              </option>
            </select>

            <span v-else class="admin-topbar-static">{{ activeMenuMeta.label }}</span>

            <span class="material-symbols-rounded admin-topbar-caret">expand_more</span>
          </label>
        </div>

        <div class="admin-topbar-actions">
          <button
            v-if="activeMenu === 'distill-targets'"
            type="button"
            class="admin-topbar-btn admin-topbar-btn--add"
            aria-label="新增配置项"
            @click="addTargetConfig"
          >
            <span class="admin-topbar-glyph" aria-hidden="true">+</span>
          </button>

          <button
            v-if="activeMenu !== 'hermes'"
            type="button"
            class="admin-topbar-btn admin-topbar-btn--save"
            :disabled="loading || saving"
            :aria-label="saving ? '保存中' : '保存'"
            @click="handleSave"
          >
            <span class="admin-topbar-glyph" aria-hidden="true">{{ saving ? "…" : "✓" }}</span>
          </button>
        </div>
      </header>

      <section class="admin-panel-card">
          <div class="flex flex-col gap-5">
          <div v-if="activeMenu !== 'distill-targets'" class="flex flex-col gap-4 border-b border-[#eceef4] pb-4 xl:flex-row xl:items-start xl:justify-between">
              <div class="max-w-3xl">
                <h2 class="admin-section-title">{{ activeMenuMeta.title }}</h2>
              </div>
            </div>

            <template v-if="activeMenu === 'distill-targets'">
              <div v-if="activeTarget" class="admin-distill-target-content space-y-5">
                <!-- Skill Tab Navigation -->
                <div class="admin-skill-tabs">
                  <button
                    type="button"
                    class="admin-skill-tab"
                    :class="{ 'is-active': skillTab === 'main' }"
                    @click="skillTab = 'main'"
                  >
                    <span class="material-symbols-rounded admin-skill-tab-icon">star</span>
                    <span>主 skill</span>
                  </button>
                  <button
                    v-if="shouldShowAttachedTab(activeTarget)"
                    type="button"
                    class="admin-skill-tab"
                    :class="{ 'is-active': skillTab === 'attached' }"
                    @click="skillTab = 'attached'"
                  >
                    <span class="material-symbols-rounded admin-skill-tab-icon">extension</span>
                    <span>附属 skill</span>
                    <span class="admin-skill-tab-badge">{{ activeTarget?.attached_pack_slugs?.length ?? 0 }}</span>
                  </button>
                  <button
                    type="button"
                    class="admin-skill-tab admin-skill-tab--add"
                    title="新增附属 skill"
                    @click="openAttachedSkillManager(activeTarget)"
                  >
                    <span class="material-symbols-rounded">add</span>
                  </button>
                </div>

                <div class="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <!-- 主 skill 面板 -->
                  <section v-if="skillTab === 'main'" class="soft-line rounded-[28px] bg-white/58 p-4 md:p-5">
                    <div class="admin-skill-panel-head flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p class="text-sm font-semibold text-ink">主 skill</p>
                      </div>
                      <div class="admin-skill-panel-actions flex flex-wrap items-center gap-2">
                        <span v-if="activeTarget.default_pack_slug" class="stat-pill">已绑定 {{ currentMainSkillTitle(activeTarget) }}</span>
                        <span v-else class="text-sm text-dusk/60">未选择主 skill</span>
                        <button class="button-secondary mobile-secondary-action" type="button" @click="openMainSkillPicker(activeTarget)">
                          搜索并勾选
                        </button>
                        <button
                          v-if="activeTarget.default_pack_slug"
                          class="button-secondary mobile-secondary-action"
                          type="button"
                          @click="clearDefaultPackSlug(activeTarget)"
                        >
                          清空
                        </button>
                      </div>
                    </div>
                  </section>

                  <!-- 附属 skill 面板 -->
                  <section v-if="skillTab === 'attached'" class="soft-line rounded-[28px] bg-white/58 p-4 md:p-5">
                    <div class="admin-skill-panel-head flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p class="text-sm font-semibold text-ink">附属 skill</p>
                      </div>
                      <div class="admin-skill-panel-meta flex flex-wrap gap-2">
                        <span class="stat-pill">已选 {{ activeTarget.attached_pack_slugs.length }}</span>
                        <span v-if="displayedAttachedRecommendations(activeTarget).length" class="stat-pill">推荐 {{ displayedAttachedRecommendations(activeTarget).length }}</span>
                      </div>
                    </div>

                    <div class="mt-4 flex flex-wrap gap-2">
                      <span
                        v-for="slug in activeTarget.attached_pack_slugs"
                        :key="`${activeTarget.__editorId}-selected-${slug}`"
                        class="inline-flex items-center gap-2 rounded-full border border-[#dccab8] bg-white px-3 py-2 text-xs font-medium text-ink"
                      >
                        <span>{{ displayPackLabel(slug) }}</span>
                        <button type="button" class="text-dusk/65 transition hover:text-ink" @click="toggleAttachedPackSlug(activeTarget, slug)">移除</button>
                      </span>

                      <span
                        v-if="!activeTarget.attached_pack_slugs.length"
                        class="rounded-full border border-dashed border-[#dccab8] px-3 py-2 text-xs text-dusk/65"
                      >
                        暂未选附属 skill
                      </span>
                    </div>

                    <div class="admin-attached-toolbar mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        class="button-secondary mobile-secondary-action"
                        @click="openMainSkillPicker(activeTarget, 'attached')"
                      >
                        搜索并添加
                      </button>
                      <button
                        type="button"
                        class="button-secondary mobile-secondary-action"
                        :disabled="recommendationLoading[activeTarget.__editorId]"
                        @click="refreshRecommendations(activeTarget)"
                      >
                        {{ recommendationLoading[activeTarget.__editorId] ? "刷新中..." : "重新检索排序" }}
                      </button>
                      <span v-if="recommendationError[activeTarget.__editorId]" class="text-xs text-[#ba4747]">{{ recommendationError[activeTarget.__editorId] }}</span>
                    </div>

                    <div class="mt-4 space-y-3">
                      <div
                        v-if="!hasHighConfidenceRecommendations(activeTarget) && displayedAttachedRecommendations(activeTarget).length"
                        class="rounded-[20px] border border-[#f1dfcf] bg-[#fff7ef] px-4 py-3 text-xs text-dusk/72"
                      >
                        当前没有 80 分以上的附属 skill，已兜底展示真实排序前三。
                      </div>

                      <button
                        v-for="entry in displayedAttachedRecommendations(activeTarget)"
                        :key="`${activeTarget.__editorId}-${entry.pack.slug}`"
                        type="button"
                        class="w-full rounded-[24px] border px-4 py-4 text-left transition"
                        :class="activeTarget.attached_pack_slugs.includes(entry.pack.slug) ? 'border-[#1d1c23] bg-[#1d1c23] text-white shadow-[0_18px_36px_rgba(29,28,35,0.16)]' : 'border-[#eadfd4] bg-white text-ink hover:border-[#d9c2ad] hover:bg-[#fffaf4]'"
                        :disabled="entry.pack.slug === activeTarget.default_pack_slug"
                        @click="toggleAttachedPackSlug(activeTarget, entry.pack.slug)"
                      >
                        <div class="flex flex-wrap items-start justify-between gap-3">
                          <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                              <p class="truncate text-sm font-semibold">{{ entry.pack.title }}</p>
                              <span v-if="entry.pack.slug === activeTarget.default_pack_slug" class="stat-pill">主 skill</span>
                            </div>
                            <p class="mt-1 truncate text-xs opacity-70">{{ entry.pack.slug }}</p>
                          </div>
                          <div class="flex flex-wrap gap-2 text-xs">
                            <span class="stat-pill" :class="activeTarget.attached_pack_slugs.includes(entry.pack.slug) ? '!bg-white/14 !text-white' : ''">#{{ entry.rank }}</span>
                            <span class="stat-pill" :class="activeTarget.attached_pack_slugs.includes(entry.pack.slug) ? '!bg-white/14 !text-white' : ''">权重 {{ formatScore(entry.weight) }}</span>
                            <span class="stat-pill" :class="activeTarget.attached_pack_slugs.includes(entry.pack.slug) ? '!bg-white/14 !text-white' : ''">分数 {{ formatScore(entry.score) }}</span>
                          </div>
                        </div>
                        <p v-if="entry.reasons?.length" class="mt-3 text-xs leading-5 opacity-75">
                          {{ entry.reasons.slice(0, 2).join(" · ") }}
                        </p>
                      </button>

                      <div
                        v-if="!displayedAttachedRecommendations(activeTarget).length"
                        class="rounded-[22px] border border-dashed border-[#e7d9cc] bg-[#fffaf4] px-4 py-5 text-sm text-dusk/70"
                      >
                        当前没有达到 80 分的附属 skill 推荐。
                      </div>
                    </div>
                  </section>
                </div>

                <template v-if="skillTab === 'main'">
                  <!-- 对象信息卡片条 -->
                  <div class="admin-entity-bar">
                    <div class="admin-entity-bar__info">
                      <span class="admin-entity-bar__subject">{{ activeTarget.label || activeTarget.key || "未命名对象" }}</span>
                      <span class="admin-entity-bar__sep">·</span>
                      <span class="stat-pill">key: {{ activeTarget.key || "未填" }}</span>
                      <span class="stat-pill">relation: {{ activeTarget.relation_label || "-" }}</span>
                      <span v-if="activeTarget.default_pack_slug" class="stat-pill">主 skill: {{ currentMainSkillTitle(activeTarget) }}</span>
                    </div>
                    <div class="admin-entity-bar__actions">
                      <button class="button-secondary mobile-secondary-action" type="button" :disabled="activeTargetIndex <= 0" @click="moveTarget(activeTargetIndex, -1)">上移</button>
                      <button class="button-secondary mobile-secondary-action" type="button" :disabled="activeTargetIndex >= distillTargets.length - 1" @click="moveTarget(activeTargetIndex, 1)">下移</button>
                      <button class="button-secondary mobile-secondary-action" type="button" @click="removeTargetConfig(activeTargetIndex)">删除</button>
                    </div>
                  </div>

                  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label class="block text-sm font-medium text-ink">
                      对象 key
                      <input v-model="activeTarget.key" class="field mt-2" placeholder="self / classmate / ex" />
                    </label>
                    <label class="block text-sm font-medium text-ink">
                      显示名
                      <input v-model="activeTarget.label" class="field mt-2" placeholder="自己 / 同学 / 前任" />
                    </label>
                    <label class="block text-sm font-medium text-ink">
                      图标字
                      <input v-model="activeTarget.icon" class="field mt-2" placeholder="我 / 同 / 前" />
                    </label>
                    <label class="block text-sm font-medium text-ink">
                      对象类型
                      <select v-model="activeTarget.subject_type" class="field mt-2">
                        <option value="self">self</option>
                        <option value="private_person">private_person</option>
                        <option value="public_figure">public_figure</option>
                      </select>
                    </label>
                  </div>

                  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label class="block text-sm font-medium text-ink">
                      关系标签
                      <input v-model="activeTarget.relation_label" class="field mt-2" placeholder="myself / classmate / ex_partner" />
                    </label>
                    <label class="block text-sm font-medium text-ink">
                      启用状态
                      <select v-model="activeTarget.enabled" class="field mt-2">
                        <option :value="true">启用</option>
                        <option :value="false">停用</option>
                      </select>
                    </label>
                    <label class="block text-sm font-medium text-ink">
                      助手标题
                      <input v-model="activeTarget.assistant_title" class="field mt-2" placeholder="自我蒸馏模式" />
                    </label>
                  </div>

                  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label class="block text-sm font-medium text-ink">
                      对象默认称呼
                      <input v-model="activeTarget.subject_default" class="field mt-2" placeholder="我自己 / 老板 / 导师" />
                    </label>
                    <label class="block text-sm font-medium text-ink">
                      对象输入占位
                      <input v-model="activeTarget.subject_placeholder" class="field mt-2" placeholder="例如：Wade / 直属老板" />
                    </label>
                    <label class="block text-sm font-medium text-ink">
                      蒸馏名称默认值
                      <input v-model="activeTarget.project_default" class="field mt-2" placeholder="我的人物画像报告" />
                    </label>
                  </div>

                  <div class="grid gap-4 md:grid-cols-2">
                    <label class="block text-sm font-medium text-ink">
                      蒸馏名称占位
                      <input v-model="activeTarget.project_placeholder" class="field mt-2" placeholder="例如：前任关系画像报告" />
                    </label>
                    <label class="block text-sm font-medium text-ink">
                      目标默认值
                      <input v-model="activeTarget.goal_default" class="field mt-2" placeholder="先看清 TA 的思维和关系模式" />
                    </label>
                  </div>

                  <label class="block text-sm font-medium text-ink">
                    目标占位
                    <textarea
                      v-model="activeTarget.goal_placeholder"
                      rows="2"
                      class="field mt-2 min-h-[92px]"
                      placeholder="例如：我想看清 TA 的管理方式、偏好和判断阈值"
                    />
                  </label>

                  <div class="grid gap-4 xl:grid-cols-2">
                    <label class="block text-sm font-medium text-ink">
                      候选池推荐词
                      <textarea
                        :value="toListInput(activeTarget.configured_names)"
                        rows="3"
                        class="field mt-2 min-h-[110px]"
                        placeholder="一行一个，例如：同学&#10;classmate&#10;roommate"
                        @input="updateListField(activeTarget, 'configured_names', $event)"
                      />
                    </label>

                    <label class="block text-sm font-medium text-ink">
                      pack 关键词
                      <textarea
                        :value="toListInput(activeTarget.pack_keywords)"
                        rows="3"
                        class="field mt-2 min-h-[110px]"
                        placeholder="一行一个，例如：情感&#10;人格&#10;关系"
                        @input="updateListField(activeTarget, 'pack_keywords', $event)"
                      />
                    </label>
                  </div>

                  <label class="block text-sm font-medium text-ink">
                    起手提示词
                    <textarea
                      :value="toListInput(activeTarget.starter_prompts)"
                      rows="4"
                      class="field mt-2 min-h-[136px]"
                      placeholder="一行一个 starter prompt"
                      @input="updateListField(activeTarget, 'starter_prompts', $event)"
                    />
                  </label>
                </template>

                <div
                  v-if="mainSkillPickerOpen && pickerTarget?.__editorId === activeTarget.__editorId"
                  class="admin-modal-overlay"
                  @click.self="closeMainSkillPicker"
                >
                  <div class="admin-modal">
                    <div class="admin-modal-head flex flex-wrap items-start justify-between gap-3">
                      <h3 class="text-lg font-semibold">{{ pickerMode === 'attached' ? '搜索并添加附属 skill' : '搜索并勾选主 skill' }}</h3>
                      <button class="button-secondary mobile-secondary-action" type="button" @click="closeMainSkillPicker">
                        关闭
                      </button>
                    </div>

                    <label class="mt-4 block text-sm font-medium">
                      搜索 skill
                      <input
                        v-model="mainSkillPickerQuery"
                        class="field mt-2"
                        placeholder="输入 skill 名称 / slug / tag"
                      />
                    </label>

                    <div class="mt-4 max-h-[480px] space-y-3 overflow-y-auto pr-1">
                      <button
                        v-for="pack in pickerTarget ? mainSkillCandidates(pickerTarget, mainSkillPickerQuery) : []"
                        :key="`picker-${pack.slug}`"
                        type="button"
                        class="admin-recommendation-item"
                        :class="{
                          'is-selected': pickerMode === 'main'
                            ? pickerTarget?.default_pack_slug === pack.slug
                            : activeTarget.attached_pack_slugs.includes(pack.slug)
                        }"
                        @click="selectMainSkillFromPicker(pack.slug)"
                      >
                        <div class="flex flex-wrap items-start justify-between gap-3">
                          <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                              <span
                                class="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold"
                                :class="pickerMode === 'main'
                                  ? (pickerTarget?.default_pack_slug === pack.slug ? 'border-white/22 bg-white/14 text-white' : 'border-white/12 bg-white/6')
                                  : (activeTarget.attached_pack_slugs.includes(pack.slug) ? 'border-white/22 bg-white/14 text-white' : 'border-white/12 bg-white/6')
                                "
                              >
                                {{ pickerMode === 'main'
                                  ? (pickerTarget?.default_pack_slug === pack.slug ? '√' : '')
                                  : (activeTarget.attached_pack_slugs.includes(pack.slug) ? '√' : '')
                                }}
                              </span>
                              <p class="truncate text-sm font-semibold">{{ pack.title }}</p>
                              <span v-if="pack.slug === activeTarget.default_pack_slug" class="stat-pill">主 skill</span>
                            </div>
                            <p class="mt-1 truncate text-xs opacity-70">{{ pack.slug }}</p>
                          </div>
                          <div class="flex flex-wrap gap-2 text-xs">
                            <span
                              v-if="pickerTarget && recommendationItemForSlug(pickerTarget.__editorId, pack.slug)"
                              class="stat-pill"
                            >
                              {{ formatRecommendationBadge(pickerTarget ? recommendationItemForSlug(pickerTarget.__editorId, pack.slug) : null) }}
                            </span>
                            <span class="stat-pill">
                              {{ pickerMode === 'main'
                                ? (pickerTarget?.default_pack_slug === pack.slug ? '当前生效' : '点击生效')
                                : (activeTarget.attached_pack_slugs.includes(pack.slug) ? '已添加' : '点击添加')
                              }}
                            </span>
                          </div>
                        </div>
                      </button>

                      <div
                        v-if="pickerTarget && !mainSkillCandidates(pickerTarget, mainSkillPickerQuery).length"
                        class="admin-recommendation-empty"
                      >
                        没搜到匹配 skill，换个关键词试试。
                      </div>
                    </div>

                    <div class="admin-modal-footer mt-5 flex flex-wrap justify-end gap-3">
                      <button class="button-secondary mobile-secondary-action" type="button" @click="closeMainSkillPicker">
                        继续编辑
                      </button>
                      <button
                        class="admin-modal-save-btn mobile-secondary-action"
                        type="button"
                        :disabled="saving"
                        @click="handlePickerSave"
                      >
                        {{ saving ? "保存中..." : "保存并关闭" }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="activeMenu === 'ai'">
              <div class="flex flex-wrap items-center gap-3 overflow-x-auto pb-1">
                <button
                  v-for="provider in settings.providers"
                  :key="provider.provider_code"
                  type="button"
                  class="min-w-[120px] rounded-[22px] border px-4 py-3 text-sm font-medium transition"
                  :class="activeProvider?.provider_code === provider.provider_code ? 'border-[#1d1c23] bg-[#1d1c23] text-white shadow-[0_18px_36px_rgba(29,28,35,0.16)]' : 'border-[#eadfd4] bg-white/82 text-ink hover:bg-white'"
                  @click="activeProviderCode = provider.provider_code"
                >
                  {{ provider.provider_name }}
                </button>
              </div>

              <div v-if="activeProvider" class="space-y-5">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div class="flex flex-wrap items-center gap-3">
                      <p class="text-[34px] font-semibold tracking-[-0.04em] text-ink">{{ activeProvider.provider_name }}</p>
                      <span class="stat-pill">{{ activeProvider.provider_code }}</span>
                      <span class="stat-pill">{{ settings.current_provider_code === activeProvider.provider_code ? "当前启用" : "候选渠道" }}</span>
                    </div>
                  </div>

                  <button
                    class="button-secondary mobile-secondary-action"
                    type="button"
                    @click="settings.current_provider_code = activeProvider.provider_code"
                  >
                    设为默认渠道
                  </button>
                </div>

                <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label class="block text-sm font-medium text-ink">
                    Endpoint
                    <input v-model="activeProvider.config.endpoint" class="field mt-2" placeholder="https://..." />
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    API Key
                    <input v-model="activeProvider.config.api_key" class="field mt-2" type="password" placeholder="输入真实 API Key" />
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    默认模型
                    <input v-model="activeProvider.config.model" class="field mt-2" placeholder="qwen-plus / gpt-5.4 / glm-4-plus" />
                  </label>
                </div>

                <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label class="block text-sm font-medium text-ink">
                    协议
                    <select v-model="activeProvider.config.api_protocol" class="field mt-2">
                      <option value="responses">responses</option>
                      <option value="chat_completions">chat_completions</option>
                      <option value="lmstudio_rest">lmstudio_rest</option>
                    </select>
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    推理强度
                    <select v-model="activeProvider.config.reasoning_effort" class="field mt-2">
                      <option value="off">off</option>
                      <option value="none">none</option>
                      <option value="minimal">minimal</option>
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                      <option value="on">on</option>
                    </select>
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    Max Output Tokens
                    <input v-model="activeProvider.config.max_output_tokens" class="field mt-2" />
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    Timeout
                    <input v-model="activeProvider.config.timeout" class="field mt-2" />
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    Context Length
                    <input v-model="activeProvider.config.context_length" class="field mt-2" />
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    Temperature
                    <input v-model="activeProvider.config.temperature" class="field mt-2" />
                  </label>
                  <label class="flex items-center gap-3 pt-7 text-sm font-medium text-ink">
                    <input v-model="activeProvider.config.store" type="checkbox" class="h-4 w-4 rounded border-[#d8c9bb]" />
                    Store response
                  </label>
                </div>

                <section class="soft-line rounded-[28px] bg-white/58 p-4 md:p-5">
                  <p class="text-sm font-semibold text-ink">路由快照</p>
                  <div class="mt-4 grid gap-4 md:grid-cols-2">
                    <div v-for="rule in settings.route_rules" :key="rule.route_rule_id" class="rounded-[22px] border border-[#eadfd4] bg-white px-4 py-4">
                      <p class="text-sm font-semibold text-ink">{{ rule.scene_code || "未命名场景" }}</p>
                      <p class="mt-2 text-sm text-dusk/80">function: {{ rule.function_type || "-" }}</p>
                      <p class="mt-1 text-sm text-dusk/80">profile: {{ rule.profile_code || "-" }}</p>
                    </div>
                  </div>
                </section>
              </div>
            </template>

            <template v-else-if="activeMenu === 'email'">
              <div class="space-y-5">
                <div class="flex flex-wrap items-center gap-3">
                  <span class="stat-pill">{{ emailSettings.smtp_configured ? "SMTP 已配置" : "SMTP 未配置" }}</span>
                  <span class="stat-pill">{{ emailSettings.delivery_mode === "smtp" ? "真实邮件发送" : "控制台调试码" }}</span>
                  <span class="stat-pill">{{ emailSettings.allow_email_code_auth ? "验证码入口开启" : "验证码入口关闭" }}</span>
                  <span class="stat-pill">{{ emailSettings.require_verification_code_for_signup ? "注册强制验证码" : "注册可用邮箱密码" }}</span>
                </div>

                <div class="grid gap-4 md:grid-cols-3">
                  <label class="block text-sm font-medium text-ink">
                    邮箱验证码登录/注册
                    <select v-model="emailSettings.allow_email_code_auth" class="field mt-2">
                      <option :value="false">关闭</option>
                      <option :value="true">开启</option>
                    </select>
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    注册验证码通道
                    <select v-model="emailSettings.delivery_mode" class="field mt-2">
                      <option value="console">控制台调试码</option>
                      <option value="smtp">真实 SMTP 邮件</option>
                    </select>
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    验证码有效期（秒）
                    <input v-model.number="emailSettings.code_ttl_seconds" class="field mt-2" type="number" min="60" max="3600" />
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    注册强制邮箱验证码
                    <select
                      v-model="emailSettings.require_verification_code_for_signup"
                      class="field mt-2"
                      :disabled="!emailSettings.allow_email_code_auth"
                    >
                      <option :value="true">开启</option>
                      <option :value="false">关闭</option>
                    </select>
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    重发冷却（秒）
                    <input v-model.number="emailSettings.resend_cooldown_seconds" class="field mt-2" type="number" min="0" max="600" />
                  </label>
                </div>

                <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label class="block text-sm font-medium text-ink">
                    最大错误次数
                    <input v-model.number="emailSettings.max_attempts" class="field mt-2" type="number" min="1" max="10" />
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    SMTP Host
                    <input v-model="emailSettings.smtp.host" class="field mt-2" placeholder="smtp.example.com" />
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    SMTP Port
                    <input v-model.number="emailSettings.smtp.port" class="field mt-2" type="number" min="1" />
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    SMTP Username
                    <input v-model="emailSettings.smtp.username" class="field mt-2" placeholder="mailer@example.com" />
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    SMTP Password
                    <input v-model="emailSettings.smtp.password" class="field mt-2" type="password" placeholder="输入真实 SMTP 密码" />
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    安全模式
                    <select v-model="emailSettings.smtp.security_mode" class="field mt-2">
                      <option value="starttls">starttls</option>
                      <option value="ssl">ssl</option>
                      <option value="none">none</option>
                    </select>
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    发件邮箱
                    <input v-model="emailSettings.smtp.from_email" class="field mt-2" placeholder="no-reply@example.com" />
                  </label>
                  <label class="block text-sm font-medium text-ink">
                    发件名称
                    <input v-model="emailSettings.smtp.from_name" class="field mt-2" placeholder="蒸馏机" />
                  </label>
                </div>
              </div>
            </template>

            <template v-else-if="activeMenu === 'hermes'">
              <section class="admin-hermes-console">
                <div class="admin-hermes-status">
                  <span class="material-symbols-rounded">terminal</span>
                  <div>
                    <strong>项目内 Hermes 蒸馏机</strong>
                    <p>管理员直连入口。本入口不加载业务 skill，不读取用户项目材料，用于调试流程、配置和产品逻辑。</p>
                  </div>
                </div>

                <div ref="hermesThreadRef" class="admin-hermes-thread">
                  <div v-if="!hermesMessages.length" class="admin-hermes-empty">
                    <span class="material-symbols-rounded">psychology_alt</span>
                    <strong>直接问蒸馏机</strong>
                    <p>例如：当前蒸馏流程应该如何拆分？模型渠道配置该检查哪几项？</p>
                  </div>

                  <div
                    v-for="item in hermesMessages"
                    :key="item.id"
                    class="admin-hermes-message"
                    :class="{ 'is-user': item.role === 'user' }"
                  >
                    <span class="admin-hermes-avatar">{{ item.role === 'user' ? '你' : 'H' }}</span>
                    <div>
                      <p class="admin-hermes-role">{{ item.role === 'user' ? '管理员' : 'Hermes' }}</p>
                      <div class="admin-hermes-bubble">{{ item.content }}</div>
                    </div>
                  </div>
                </div>

                <div class="admin-hermes-composer">
                  <textarea
                    v-model="hermesDraft"
                    class="admin-hermes-input"
                    placeholder="输入要问蒸馏机的问题..."
                    :disabled="hermesSending"
                    @keydown="handleHermesKeydown"
                  />
                  <button
                    type="button"
                    class="admin-hermes-send"
                    :disabled="!hermesDraft.trim() || hermesSending"
                    @click="sendHermesMessage"
                  >
                    <span class="material-symbols-rounded">{{ hermesSending ? 'progress_activity' : 'send' }}</span>
                    <span>{{ hermesSending ? "发送中" : "发送" }}</span>
                  </button>
                </div>
              </section>
            </template>
          </div>
      </section>

      <p v-if="message" class="rounded-3xl border border-[#ffd4b8] bg-[#fff1e4] px-4 py-3 text-sm text-[#8e562f]">{{ message }}</p>
      <p v-if="errorMessage" class="rounded-3xl border border-[#f4b2b2] bg-[#fff1f1] px-4 py-3 text-sm text-[#ba4747]">{{ errorMessage }}</p>

      <nav class="admin-bottom-nav" aria-label="管理员设置导航">
        <button
          v-for="item in menuItems"
          :key="`bottom-${item.key}`"
          type="button"
          class="admin-bottom-nav-item"
          :class="{ 'is-active': activeMenu === item.key }"
          @click="activeMenu = item.key"
        >
          <span class="material-symbols-rounded">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue"
import { useRouter } from "vue-router"

import { api } from "@/lib/api"
import type {
  AdminAiSettings,
  AdminEmailSettings,
  DistillTargetConfig,
  DistillTargetSettingsResponse,
  PackRecommendationItem,
  PackRecommendationRequest,
  PackRecommendationResponse,
  PackSummary,
} from "@/types"
type SettingsMenu = "distill-targets" | "ai" | "email" | "hermes"
type EditableDistillTargetConfig = DistillTargetConfig & { __editorId: string }
type AdminHermesMessage = { id: string; role: "user" | "assistant"; content: string }

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const message = ref("")
const errorMessage = ref("")
const activeMenu = ref<SettingsMenu>("distill-targets")
const skillTab = ref<"main" | "attached">("main")
const activeTargetId = ref("")
const activeProviderCode = ref("")
const packOptions = ref<PackSummary[]>([])
const distillTargets = ref<EditableDistillTargetConfig[]>([])
const hermesDraft = ref("")
const hermesSending = ref(false)
const hermesMessages = ref<AdminHermesMessage[]>([])
const hermesThreadRef = ref<HTMLElement | null>(null)

const menuItems: Array<{ key: SettingsMenu; label: string; icon: string; hint: string; title: string; description: string }> = [
  {
    key: "distill-targets",
    label: "蒸馏机配置",
    icon: "deployed_code",
    hint: "配置开始蒸馏里的对象模板、默认主 skill 和候选池范围。",
    title: "蒸馏对象模板",
    description: "这里配置 `/projects/new` 第一步展示的蒸馏对象。右侧顶部 tab 就是对象模板切换，不再把所有对象堆成一页长表单。",
  },
  {
    key: "ai",
    label: "模型渠道",
    icon: "hub",
    hint: "维护 provider、endpoint、API key 和默认模型。",
    title: "模型渠道配置",
    description: "右侧顶部 tab 按渠道切换，例如 ollama、qwen、gpt、智谱。这里维护全局默认渠道与每个渠道的模型参数。",
  },
  {
    key: "email",
    label: "邮箱注册",
    icon: "mail",
    hint: "配置验证码发送方式、SMTP 和风控阈值。",
    title: "邮箱注册配置",
    description: "控制注册验证码的发送通道、SMTP 账号和频率限制，保证真实邮箱注册链路可用。",
  },
  {
    key: "hermes",
    label: "蒸馏机",
    icon: "terminal",
    hint: "直接与项目内 Hermes 管理控制台对话。",
    title: "Hermes 蒸馏机对话",
    description: "管理员直连项目内嵌 Hermes。该入口不加载业务 skill，不写入用户项目，只用于排障、配置和产品逻辑讨论。",
  },
]

const activeMenuMeta = computed(() => menuItems.find((item) => item.key === activeMenu.value) || menuItems[0])
const packLookup = computed(() => new Map(packOptions.value.map((item) => [item.slug, item])))
const activeTarget = computed(() => distillTargets.value.find((item) => item.__editorId === activeTargetId.value) || distillTargets.value[0] || null)
const activeTargetIndex = computed(() => (
  activeTarget.value ? distillTargets.value.findIndex((item) => item.__editorId === activeTarget.value?.__editorId) : -1
))
const activeProvider = computed(() => settings.providers.find((item) => item.provider_code === activeProviderCode.value) || settings.providers[0] || null)

const settings = reactive<AdminAiSettings>({
  current_provider_code: "openai",
  providers: [],
  route_rules: [],
})

const emailSettings = reactive<AdminEmailSettings>({
  delivery_mode: "console",
  smtp: {
    host: "",
    port: 587,
    username: "",
    password: "",
    from_email: "",
    from_name: "",
    security_mode: "starttls",
  },
  require_verification_code_for_signup: false,
  allow_email_code_auth: false,
  code_ttl_seconds: 600,
  resend_cooldown_seconds: 60,
  max_attempts: 5,
  smtp_configured: false,
})

const mainSkillSearch = reactive<Record<string, string>>({})
const mainSkillPickerOpen = ref(false)
const mainSkillPickerTargetId = ref("")
const mainSkillPickerQuery = ref("")
const pickerMode = ref<"main" | "attached">("main")
const recommendationItems = reactive<Record<string, PackRecommendationItem[]>>({})
const recommendationLoading = reactive<Record<string, boolean>>({})
const recommendationError = reactive<Record<string, string>>({})

let editorIdSeed = 0
const recommendationTimers = new Map<string, number>()
const recommendationSignatures = new Map<string, string>()
const pickerTarget = computed(() => distillTargets.value.find((item) => item.__editorId === mainSkillPickerTargetId.value) || null)

function createEditorId() {
  editorIdSeed += 1
  return `distill-target-${editorIdSeed}`
}

function humanizeError(error: any, fallback: string) {
  const detail = error?.response?.data?.detail
  if (Array.isArray(detail)) {
    const first = detail[0]
    if (first?.msg) return first.msg
  }
  return detail || error?.message || fallback
}

function normalizeProviderConfig(provider: AdminAiSettings["providers"][number]) {
  return {
    ...provider,
    config: {
      endpoint: provider.config.endpoint || "",
      api_key: provider.config.api_key || "",
      model: provider.config.model || "",
      api_protocol: provider.config.api_protocol || "responses",
      reasoning_effort: provider.config.reasoning_effort || "medium",
      max_output_tokens: provider.config.max_output_tokens || "1600",
      context_length: provider.config.context_length || "8000",
      temperature: provider.config.temperature ?? "0",
      store: provider.config.store ?? false,
      timeout: provider.config.timeout || "60",
      defaultProfile: provider.config.defaultProfile || "default",
      profiles: provider.config.profiles || [],
    },
  }
}

function defaultTargetConfig(): EditableDistillTargetConfig {
  return {
    key: "",
    label: "",
    icon: "",
    enabled: true,
    subject_type: "private_person",
    relation_label: "",
    subject_default: "",
    subject_placeholder: "",
    project_default: "",
    project_placeholder: "",
    goal_default: "",
    goal_placeholder: "",
    assistant_title: "",
    pack_keywords: [],
    configured_names: [],
    starter_prompts: [],
    default_pack_slug: "",
    attached_pack_slugs: [],
    __editorId: createEditorId(),
  }
}

function toEditableTargetConfig(item: DistillTargetConfig): EditableDistillTargetConfig {
  return {
    ...item,
    pack_keywords: [...(item.pack_keywords || [])],
    configured_names: [...(item.configured_names || [])],
    starter_prompts: [...(item.starter_prompts || [])],
    attached_pack_slugs: [...(item.attached_pack_slugs || [])],
    __editorId: createEditorId(),
  }
}

function toPersistedTargetConfig(item: EditableDistillTargetConfig): DistillTargetConfig {
  const { __editorId: _editorId, ...payload } = item
  return payload
}

function syncTargetUiState(items: EditableDistillTargetConfig[]) {
  const activeIds = new Set(items.map((item) => item.__editorId))

  Object.keys(mainSkillSearch).forEach((key) => {
    if (!activeIds.has(key)) delete mainSkillSearch[key]
  })
  Object.keys(recommendationItems).forEach((key) => {
    if (!activeIds.has(key)) delete recommendationItems[key]
  })
  Object.keys(recommendationLoading).forEach((key) => {
    if (!activeIds.has(key)) delete recommendationLoading[key]
  })
  Object.keys(recommendationError).forEach((key) => {
    if (!activeIds.has(key)) delete recommendationError[key]
  })

  for (const [key, timer] of recommendationTimers.entries()) {
    if (!activeIds.has(key)) {
      window.clearTimeout(timer)
      recommendationTimers.delete(key)
      recommendationSignatures.delete(key)
    }
  }

  items.forEach((item) => {
    if (!(item.__editorId in mainSkillSearch)) mainSkillSearch[item.__editorId] = ""
    if (!(item.__editorId in recommendationItems)) recommendationItems[item.__editorId] = []
    if (!(item.__editorId in recommendationLoading)) recommendationLoading[item.__editorId] = false
    if (!(item.__editorId in recommendationError)) recommendationError[item.__editorId] = ""
  })

  if (!items.some((item) => item.__editorId === activeTargetId.value)) {
    activeTargetId.value = items[0]?.__editorId || ""
  }
}

function applySettings(data: AdminAiSettings) {
  settings.current_provider_code = data.current_provider_code
  settings.providers = data.providers.map(normalizeProviderConfig)
  settings.route_rules = data.route_rules
  if (!settings.providers.some((item) => item.provider_code === activeProviderCode.value)) {
    activeProviderCode.value = data.current_provider_code || settings.providers[0]?.provider_code || ""
  }
}

function applyEmailSettings(data: AdminEmailSettings) {
  emailSettings.delivery_mode = data.delivery_mode
  emailSettings.smtp = {
    host: data.smtp.host || "",
    port: data.smtp.port || 587,
    username: data.smtp.username || "",
    password: data.smtp.password || "",
    from_email: data.smtp.from_email || "",
    from_name: data.smtp.from_name || "",
    security_mode: data.smtp.security_mode || "starttls",
  }
  emailSettings.require_verification_code_for_signup = data.require_verification_code_for_signup === true
  emailSettings.allow_email_code_auth = data.allow_email_code_auth === true
  emailSettings.code_ttl_seconds = data.code_ttl_seconds || 600
  emailSettings.resend_cooldown_seconds = data.resend_cooldown_seconds || 60
  emailSettings.max_attempts = data.max_attempts || 5
  emailSettings.smtp_configured = !!data.smtp_configured
}

function applyDistillTargets(data: DistillTargetSettingsResponse) {
  const items = (data.items || []).map(toEditableTargetConfig)
  distillTargets.value = items
  syncTargetUiState(items)
}

function appendPackOptions(items: PackSummary[]) {
  if (!items.length) return
  const next = new Map(packOptions.value.map((item) => [item.slug, item]))
  items.forEach((item) => next.set(item.slug, item))
  packOptions.value = Array.from(next.values()).sort((a, b) => a.title.localeCompare(b.title, "zh-Hans-CN"))
}

function toListInput(items: string[]) {
  return (items || []).join("\n")
}

function parseListInput(value: string) {
  return Array.from(new Set(value.split("\n").map((item) => item.trim()).filter(Boolean)))
}

function updateListField(target: EditableDistillTargetConfig, field: "configured_names" | "pack_keywords" | "starter_prompts", event: Event) {
  const nextValue = (event.target as HTMLTextAreaElement | null)?.value || ""
  target[field] = parseListInput(nextValue)
}

function setDefaultPackSlug(target: EditableDistillTargetConfig, slug: string) {
  target.default_pack_slug = target.default_pack_slug === slug ? "" : slug
  target.attached_pack_slugs = target.attached_pack_slugs.filter((item) => item !== target.default_pack_slug)
}

function clearDefaultPackSlug(target: EditableDistillTargetConfig) {
  target.default_pack_slug = ""
}

function toggleAttachedPackSlug(target: EditableDistillTargetConfig, slug: string) {
  if (!slug || slug === target.default_pack_slug) return
  if (target.attached_pack_slugs.includes(slug)) {
    target.attached_pack_slugs = target.attached_pack_slugs.filter((item) => item !== slug)
    return
  }
  target.attached_pack_slugs = [...target.attached_pack_slugs, slug]
}

function addTargetConfig() {
  const nextItem = defaultTargetConfig()
  distillTargets.value = [...distillTargets.value, nextItem]
  syncTargetUiState(distillTargets.value)
  activeTargetId.value = nextItem.__editorId
}

function removeTargetConfig(index: number) {
  if (index < 0) return
  const removedId = distillTargets.value[index]?.__editorId || ""
  const nextItems = distillTargets.value.filter((_, itemIndex) => itemIndex !== index)
  distillTargets.value = nextItems
  syncTargetUiState(nextItems)
  if (activeTargetId.value === removedId) {
    activeTargetId.value = nextItems[Math.min(index, nextItems.length - 1)]?.__editorId || ""
  }
}

function moveTarget(index: number, direction: -1 | 1) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= distillTargets.value.length) return
  const nextItems = [...distillTargets.value]
  const [current] = nextItems.splice(index, 1)
  nextItems.splice(nextIndex, 0, current)
  distillTargets.value = nextItems
}

function buildRecommendationSignature(target: EditableDistillTargetConfig) {
  return JSON.stringify({
    subject_default: target.subject_default.trim(),
    label: target.label.trim(),
    relation_label: target.relation_label.trim(),
    goal_default: target.goal_default.trim(),
    configured_names: [...(target.configured_names || [])].map((item) => item.trim()).filter(Boolean),
  })
}

function buildRecommendationPayload(target: EditableDistillTargetConfig): PackRecommendationRequest | null {
  const subjectName = target.subject_default.trim() || target.label.trim() || target.key.trim()
  const configuredNames = (target.configured_names || []).map((item) => item.trim()).filter(Boolean)
  const relationLabel = target.relation_label.trim()
  const analysisGoal = target.goal_default.trim()
  if (!subjectName && !relationLabel && !analysisGoal && !configuredNames.length) return null
  return {
    subject_name: subjectName || "蒸馏对象",
    relation_label: relationLabel || undefined,
    analysis_goal: analysisGoal || undefined,
    configured_names: configuredNames.length ? configuredNames : undefined,
    limit: 12,
  }
}

async function requestRecommendations(target: EditableDistillTargetConfig) {
  const targetId = target.__editorId
  const payload = buildRecommendationPayload(target)
  if (!payload) {
    recommendationItems[targetId] = []
    recommendationError[targetId] = ""
    recommendationLoading[targetId] = false
    return
  }
  try {
    recommendationLoading[targetId] = true
    recommendationError[targetId] = ""
    const { data } = await api.post<PackRecommendationResponse>("/packs/recommend", payload)
    const items = [...(data.items || [])].sort((a, b) => b.score - a.score || b.weight - a.weight || a.rank - b.rank)
    recommendationItems[targetId] = items
    appendPackOptions(items.map((item) => item.pack))
  } catch (error: any) {
    recommendationItems[targetId] = []
    recommendationError[targetId] = humanizeError(error, "推荐排序失败")
  } finally {
    recommendationLoading[targetId] = false
  }
}

function scheduleRecommendationRefresh(target: EditableDistillTargetConfig) {
  if (typeof window === "undefined") return
  const targetId = target.__editorId
  const currentTimer = recommendationTimers.get(targetId)
  if (currentTimer !== undefined) window.clearTimeout(currentTimer)
  const timer = window.setTimeout(() => {
    recommendationTimers.delete(targetId)
    void requestRecommendations(target)
  }, 260)
  recommendationTimers.set(targetId, timer)
}

function refreshRecommendations(target: EditableDistillTargetConfig) {
  const targetId = target.__editorId
  const currentTimer = recommendationTimers.get(targetId)
  if (currentTimer !== undefined) {
    window.clearTimeout(currentTimer)
    recommendationTimers.delete(targetId)
  }
  void requestRecommendations(target)
}

function recommendationItemForSlug(targetId: string, slug: string) {
  return (recommendationItems[targetId] || []).find((item) => item.pack.slug === slug) || null
}

function recommendedPacksAboveThreshold(target: EditableDistillTargetConfig) {
  return (recommendationItems[target.__editorId] || [])
    .filter((item) => item.score >= 80)
    .sort((a, b) => b.score - a.score || b.weight - a.weight || a.rank - b.rank)
}

function displayedAttachedRecommendations(target: EditableDistillTargetConfig) {
  const highConfidence = recommendedPacksAboveThreshold(target)
  if (highConfidence.length) return highConfidence
  return [...(recommendationItems[target.__editorId] || [])]
    .sort((a, b) => b.score - a.score || b.weight - a.weight || a.rank - b.rank)
    .slice(0, 3)
}

function hasHighConfidenceRecommendations(target: EditableDistillTargetConfig) {
  return recommendedPacksAboveThreshold(target).length > 0
}

function shouldShowAttachedTab(target: EditableDistillTargetConfig | null) {
  if (!target) return false
  return skillTab.value === "attached" || (target.attached_pack_slugs?.length || 0) > 0
}

function currentMainSkillTitle(target: EditableDistillTargetConfig) {
  if (!target.default_pack_slug) return "未指定"
  return displayPackLabel(target.default_pack_slug)
}

function displayPackLabel(slug: string) {
  return packLookup.value.get(slug)?.title || slug
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--"
  return Math.round(Number(value)).toString()
}

function formatRecommendationBadge(item: PackRecommendationItem | null) {
  if (!item) return ""
  return `#${item.rank} · ${formatScore(item.score)}`
}

function packMatchesSearch(pack: PackSummary, query: string) {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return true
  const haystack = [
    pack.title,
    pack.slug,
    pack.subtitle,
    ...(pack.tags || []),
    ...(pack.skills || []),
    ...(pack.suitable_for || []),
  ].filter(Boolean).join(" ").toLowerCase()
  return haystack.includes(keyword)
}

function mainSkillCandidates(target: EditableDistillTargetConfig, queryOverride?: string) {
  const query = queryOverride ?? mainSkillSearch[target.__editorId] ?? ""
  const selected = target.default_pack_slug ? packLookup.value.get(target.default_pack_slug) : undefined
  const recommended = (recommendationItems[target.__editorId] || []).map((item) => item.pack)
  const unique = new Map<string, PackSummary>()
  if (selected) unique.set(selected.slug, selected)
  recommended.forEach((item) => unique.set(item.slug, item))
  packOptions.value.forEach((item) => unique.set(item.slug, item))

  return Array.from(unique.values())
    .filter((item) => packMatchesSearch(item, query))
    .sort((left, right) => {
      const leftSelected = left.slug === target.default_pack_slug ? 1 : 0
      const rightSelected = right.slug === target.default_pack_slug ? 1 : 0
      if (leftSelected !== rightSelected) return rightSelected - leftSelected
      const leftScore = recommendationItemForSlug(target.__editorId, left.slug)?.score || 0
      const rightScore = recommendationItemForSlug(target.__editorId, right.slug)?.score || 0
      if (leftScore !== rightScore) return rightScore - leftScore
      return left.title.localeCompare(right.title, "zh-Hans-CN")
    })
    .slice(0, query.trim() ? 18 : 10)
}

function openMainSkillPicker(target: EditableDistillTargetConfig, mode: "main" | "attached" = "main") {
  pickerMode.value = mode
  mainSkillPickerTargetId.value = target.__editorId
  mainSkillPickerQuery.value = mainSkillSearch[target.__editorId] || ""
  mainSkillPickerOpen.value = true
}

function openAttachedSkillManager(target: EditableDistillTargetConfig | null) {
  if (!target) return
  skillTab.value = "attached"
  openMainSkillPicker(target, "attached")
}

function closeMainSkillPicker() {
  mainSkillPickerOpen.value = false
}

async function handlePickerSave() {
  await handleSave()
  if (!errorMessage.value) closeMainSkillPicker()
}

function selectMainSkillFromPicker(slug: string) {
  if (!pickerTarget.value) return
  if (pickerMode.value === "attached") {
    toggleAttachedPackSlug(pickerTarget.value, slug)
  } else {
    setDefaultPackSlug(pickerTarget.value, slug)
  }
  mainSkillSearch[pickerTarget.value.__editorId] = mainSkillPickerQuery.value
  // 附属模式不关闭弹窗，方便连续选择
  if (pickerMode.value === "main") closeMainSkillPicker()
}

function handleBack() {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back()
    return
  }
  router.push("/profile")
}

function scrollHermesThreadToBottom() {
  void nextTick(() => {
    const el = hermesThreadRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function handleHermesKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return
  event.preventDefault()
  void sendHermesMessage()
}

async function sendHermesMessage() {
  const content = hermesDraft.value.trim()
  if (!content || hermesSending.value) return
  const userMessage: AdminHermesMessage = {
    id: `admin-hermes-user-${Date.now()}`,
    role: "user",
    content,
  }
  hermesMessages.value = [...hermesMessages.value, userMessage]
  hermesDraft.value = ""
  hermesSending.value = true
  errorMessage.value = ""
  message.value = ""
  scrollHermesThreadToBottom()
  try {
    const history = hermesMessages.value
      .slice(0, -1)
      .slice(-8)
      .map((item) => ({ role: item.role, content: item.content }))
    const { data } = await api.post<{ answer: string }>("/admin/hermes/chat", {
      message: content,
      history,
    })
    hermesMessages.value = [
      ...hermesMessages.value,
      {
        id: `admin-hermes-assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer || "Hermes 没有返回内容。",
      },
    ]
  } catch (error: any) {
    errorMessage.value = humanizeError(error, "Hermes 对话失败")
    hermesMessages.value = [
      ...hermesMessages.value,
      {
        id: `admin-hermes-error-${Date.now()}`,
        role: "assistant",
        content: errorMessage.value,
      },
    ]
  } finally {
    hermesSending.value = false
    scrollHermesThreadToBottom()
  }
}

async function loadSettings() {
  try {
    loading.value = true
    errorMessage.value = ""
    const [aiResponse, emailResponse, distillResponse, packsResponse] = await Promise.all([
      api.get<AdminAiSettings>("/admin/settings/ai"),
      api.get<AdminEmailSettings>("/admin/settings/email"),
      api.get<DistillTargetSettingsResponse>("/admin/settings/distill-targets"),
      api.get<{ items: PackSummary[] }>("/packs"),
    ])
    applySettings(aiResponse.data)
    applyEmailSettings(emailResponse.data)
    applyDistillTargets(distillResponse.data)
    appendPackOptions(packsResponse.data.items || [])
  } catch (error: any) {
    errorMessage.value = humanizeError(error, "系统设置加载失败")
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  try {
    saving.value = true
    errorMessage.value = ""
    message.value = ""
    const [aiResponse, emailResponse, distillResponse] = await Promise.all([
      api.put<AdminAiSettings>("/admin/settings/ai", {
        current_provider_code: settings.current_provider_code,
        providers: settings.providers,
      }),
      api.put<AdminEmailSettings>("/admin/settings/email", {
        delivery_mode: emailSettings.delivery_mode,
        smtp: emailSettings.smtp,
        require_verification_code_for_signup: emailSettings.allow_email_code_auth && emailSettings.require_verification_code_for_signup,
        allow_email_code_auth: emailSettings.allow_email_code_auth,
        code_ttl_seconds: emailSettings.code_ttl_seconds,
        resend_cooldown_seconds: emailSettings.resend_cooldown_seconds,
        max_attempts: emailSettings.max_attempts,
      }),
      api.put<DistillTargetSettingsResponse>("/admin/settings/distill-targets", {
        items: distillTargets.value.map(toPersistedTargetConfig),
      }),
    ])
    applySettings(aiResponse.data)
    applyEmailSettings(emailResponse.data)
    applyDistillTargets(distillResponse.data)
    message.value = "系统设置已更新"
  } catch (error: any) {
    errorMessage.value = humanizeError(error, "系统设置保存失败")
  } finally {
    saving.value = false
  }
}

watch(
  () => distillTargets.value.map((item) => ({ id: item.__editorId, signature: buildRecommendationSignature(item) })),
  (entries) => {
    const targetById = new Map(distillTargets.value.map((item) => [item.__editorId, item]))
    const activeIds = new Set(entries.map((item) => item.id))

    entries.forEach((entry) => {
      if (recommendationSignatures.get(entry.id) === entry.signature) return
      recommendationSignatures.set(entry.id, entry.signature)
      const target = targetById.get(entry.id)
      if (target) scheduleRecommendationRefresh(target)
    })

    Array.from(recommendationSignatures.keys()).forEach((id) => {
      if (!activeIds.has(id)) recommendationSignatures.delete(id)
    })
  },
  { immediate: true },
)

onMounted(() => {
  void loadSettings()
})

onBeforeUnmount(() => {
  for (const timer of recommendationTimers.values()) {
    window.clearTimeout(timer)
  }
  recommendationTimers.clear()
})
</script>

<style scoped>
/* ========== 暗色主题 — 与全局 v3-design-system 统一 ========== */

.admin-cyber-page {
  min-height: 100vh;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(124px + env(safe-area-inset-bottom, 0px));
  background: #0a0a0f;
}

.admin-cyber-shell {
  position: relative;
  z-index: 1;
  margin: 0 auto;
  display: flex;
  width: 100%;
  max-width: 1120px;
  flex-direction: column;
  gap: 12px;
}

/* ---------- Top Bar ---------- */
.admin-topbar,
.admin-panel-card {
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(18px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  position: sticky;
  top: calc(10px + env(safe-area-inset-top, 0px));
  z-index: 12;
  border-radius: 22px;
  padding: 10px 12px;
}

.admin-topbar-left,
.admin-topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-topbar-left {
  min-width: 0;
  flex: 1;
}

.admin-topbar-actions {
  flex: 0 0 auto;
}

.admin-topbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
}

.admin-topbar-btn .material-symbols-rounded {
  font-size: 1.2rem;
}

.admin-topbar-glyph {
  font-size: 1.3rem;
  font-weight: 800;
  line-height: 1;
  color: inherit;
}

.admin-topbar-btn--add {
  border-color: rgba(0, 245, 212, 0.2);
  background: rgba(0, 245, 212, 0.1);
  color: var(--neon-cyan, #00f5d4);
}

.admin-topbar-btn--save {
  border-color: var(--neon-cyan, #00f5d4);
  background: var(--neon-cyan, #00f5d4);
  color: #030308;
}

.admin-topbar-btn:disabled {
  opacity: 0.4;
  box-shadow: none;
}

.admin-topbar-picker {
  position: relative;
  min-width: 0;
  flex: 1;
}

.admin-topbar-select,
.admin-topbar-static {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 44px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
  padding: 0 42px 0 16px;
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #ffffff;
  box-shadow: none;
}

.admin-topbar-select {
  appearance: none;
}

.admin-topbar-select option {
  background: #1c1c1e;
  color: #ffffff;
}

.admin-topbar-static {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-topbar-caret {
  pointer-events: none;
  position: absolute;
  top: 50%;
  right: 14px;
  transform: translateY(-50%);
  font-size: 1.05rem;
  color: rgba(255, 255, 255, 0.5);
}

/* ---------- Panel Card ---------- */
.admin-panel-card {
  border-radius: 28px;
  padding: 18px 14px 22px;
}

.admin-section-title {
  font-size: 1.2rem;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #ffffff;
}

/* ---------- Hermes Console ---------- */
.admin-hermes-console {
  display: grid;
  gap: 14px;
}

.admin-hermes-status {
  display: grid;
  grid-template-columns: 42px 1fr;
  align-items: start;
  gap: 12px;
  padding: 14px;
  border-radius: 20px;
  border: 1px solid rgba(0, 245, 212, 0.14);
  background: rgba(0, 245, 212, 0.06);
}

.admin-hermes-status > .material-symbols-rounded {
  width: 42px;
  height: 42px;
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(0, 245, 212, 0.12);
  color: var(--neon-cyan, #00f5d4);
  font-size: 22px;
}

.admin-hermes-status strong {
  color: #fff;
  font-size: 0.95rem;
}

.admin-hermes-status p {
  margin: 4px 0 0;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.78rem;
  line-height: 1.6;
}

.admin-hermes-thread {
  min-height: 360px;
  max-height: min(58vh, 620px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.18);
}

.admin-hermes-empty {
  min-height: 280px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  text-align: center;
  color: rgba(255, 255, 255, 0.55);
}

.admin-hermes-empty .material-symbols-rounded {
  color: var(--neon-cyan, #00f5d4);
  font-size: 34px;
  opacity: 0.78;
}

.admin-hermes-empty strong {
  color: #fff;
  font-size: 1rem;
}

.admin-hermes-empty p {
  max-width: 360px;
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.6;
}

.admin-hermes-message {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.admin-hermes-message.is-user {
  grid-template-columns: minmax(0, 1fr) 34px;
}

.admin-hermes-message.is-user .admin-hermes-avatar {
  grid-column: 2;
  grid-row: 1;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.admin-hermes-message.is-user > div {
  grid-column: 1;
  grid-row: 1;
  justify-items: end;
}

.admin-hermes-avatar {
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(0, 245, 212, 0.13);
  color: var(--neon-cyan, #00f5d4);
  font-size: 0.76rem;
  font-weight: 900;
}

.admin-hermes-message > div {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.admin-hermes-role {
  margin: 0;
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.66rem;
  font-weight: 800;
}

.admin-hermes-message.is-user .admin-hermes-role {
  text-align: right;
}

.admin-hermes-bubble {
  width: fit-content;
  max-width: min(680px, 100%);
  padding: 11px 13px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.85rem;
  line-height: 1.7;
  white-space: pre-wrap;
}

.admin-hermes-message.is-user .admin-hermes-bubble {
  margin-left: auto;
  background: var(--neon-cyan, #00f5d4);
  color: #030308;
  font-weight: 700;
}

.admin-hermes-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
}

.admin-hermes-input {
  min-height: 74px;
  max-height: 160px;
  resize: vertical;
  width: 100%;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  padding: 12px 14px;
  font: inherit;
  font-size: 0.86rem;
  line-height: 1.5;
  outline: none;
}

.admin-hermes-input:focus {
  border-color: rgba(0, 245, 212, 0.38);
}

.admin-hermes-input::placeholder {
  color: rgba(255, 255, 255, 0.38);
}

.admin-hermes-send {
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  background: var(--neon-cyan, #00f5d4);
  color: #030308;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 900;
  cursor: pointer;
}

.admin-hermes-send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.admin-hermes-send .material-symbols-rounded {
  font-size: 18px;
}

/* ---------- 对象信息卡片条 ---------- */
.admin-entity-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.admin-entity-bar__info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.admin-entity-bar__subject {
  font-size: 1rem;
  font-weight: 700;
  color: var(--neon-cyan, #00f5d4);
}

.admin-entity-bar__sep {
  color: rgba(255, 255, 255, 0.2);
  font-size: 1.1rem;
}

.admin-entity-bar__skill-empty {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.3);
}

.admin-entity-bar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* ---------- Skill Tab Navigation ---------- */
.admin-skill-link {
  color: var(--neon-cyan, #00f5d4);
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 150ms ease;
}

.admin-skill-link:hover {
  opacity: 0.8;
  text-decoration: underline;
}

.admin-skill-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  overflow-x: auto;
  scrollbar-width: none;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.admin-skill-tabs::-webkit-scrollbar {
  display: none;
}

.admin-skill-tab {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms ease;
  white-space: nowrap;
}

.admin-skill-tab:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
}

.admin-skill-tab.is-active {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.admin-skill-tab-icon {
  font-size: 1.1rem;
}

.admin-skill-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.6);
}

.admin-skill-tab.is-active .admin-skill-tab-badge {
  background: var(--neon-cyan, #00f5d4);
  color: #030308;
}

.admin-skill-tab--add {
  margin-left: auto;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(0, 245, 212, 0.1);
  color: var(--neon-cyan, #00f5d4);
}

.admin-skill-tab--add:hover {
  background: var(--neon-cyan, #00f5d4);
  color: #030308;
}

.admin-skill-tab--add .material-symbols-rounded {
  font-size: 1.2rem;
}

/* ---------- Bottom Nav ---------- */
.admin-bottom-nav {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(20px);
  padding: 10px 10px 12px;
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.4);
}

.admin-bottom-nav-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 58px;
  padding: 8px 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.1;
  box-shadow: none;
  transition: all 180ms ease;
}

.admin-bottom-nav-item.is-active {
  border-color: var(--neon-cyan, #00f5d4);
  background: rgba(0, 245, 212, 0.15);
  color: var(--neon-cyan, #00f5d4);
  box-shadow: 0 0 20px rgba(0, 245, 212, 0.15);
}

.admin-bottom-nav-item .material-symbols-rounded {
  font-size: 1.15rem;
  font-variation-settings: "FILL" 1;
}

.admin-bottom-nav-item .material-symbols-rounded,
.admin-bottom-nav-item span:last-child {
  color: inherit;
  opacity: 1;
}

.admin-bottom-nav-item span:last-child {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- Deep Overrides ---------- */
:deep(.mini-kicker) {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.5);
}

:deep(.stat-pill) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
  padding: 7px 11px;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

:deep(.button-secondary),
:deep(.mobile-secondary-action) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0.72rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  box-shadow: none;
}

:deep(.field) {
  width: 100%;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  padding: 0.88rem 1rem;
  color: #ffffff;
  box-shadow: none;
}

:deep(.field::placeholder) {
  color: rgba(255, 255, 255, 0.35);
}

:deep(.field:focus) {
  outline: none;
  border-color: var(--neon-cyan, #00f5d4);
  box-shadow: 0 0 0 4px rgba(0, 245, 212, 0.12);
}

:deep(.soft-line) {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

/* 覆盖模板中内联的白色背景 Tailwind 类 */
.admin-panel-card :deep([class*="bg-white"]) {
  background: rgba(255, 255, 255, 0.06) !important;
}

.admin-panel-card :deep([class*="bg-[#fff"]) {
  background: rgba(255, 255, 255, 0.06) !important;
}

.admin-panel-card :deep([class*="bg-[#fff7ef"]) {
  background: rgba(255, 180, 100, 0.1) !important;
}

.admin-panel-card :deep([class*="bg-[#fffaf4"]) {
  background: rgba(255, 255, 255, 0.04) !important;
}

.admin-panel-card :deep([class*="bg-[#fff3e6"]) {
  background: rgba(255, 200, 120, 0.1) !important;
}

.admin-panel-card :deep([class*="bg-[#fff1e4"]) {
  background: rgba(255, 180, 100, 0.1) !important;
}

.admin-panel-card :deep([class*="bg-[#fff1f1"]) {
  background: rgba(255, 100, 100, 0.1) !important;
}

.admin-panel-card :deep([class*="border-[#eadfd4"]),
.admin-panel-card :deep([class*="border-[#dccab8"]),
.admin-panel-card :deep([class*="border-[#e7d9cc"]),
.admin-panel-card :deep([class*="border-[#f1dfcf"]),
.admin-panel-card :deep([class*="border-[#d7c1ab"]),
.admin-panel-card :deep([class*="border-[#ffd4b8"]),
.admin-panel-card :deep([class*="border-[#f4b2b2"]) {
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.admin-panel-card :deep([class*="text-[#8e562f"]),
.admin-panel-card :deep([class*="text-[#ba4747"]),
.admin-panel-card :deep([class*="text-[#8f572c"]) {
  color: rgba(255, 255, 255, 0.7) !important;
}

.admin-panel-card :deep([class*="text-dusk"]) {
  color: rgba(255, 255, 255, 0.6) !important;
}

.admin-panel-card :deep([class*="text-ink"]) {
  color: #ffffff !important;
}

/* ---------- 弹窗 ---------- */
.admin-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  padding: 16px 16px 32px;
  backdrop-filter: blur(10px);
}

.admin-modal {
  width: 100%;
  max-width: 780px;
  max-height: min(82vh, 760px);
  overflow-y: auto;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #141418;
  padding: 20px;
  box-shadow: 0 40px 120px rgba(0, 0, 0, 0.5);
}

.admin-modal-save-btn {
  min-width: 132px;
  border: 1px solid var(--neon-cyan, #00f5d4);
  background: var(--neon-cyan, #00f5d4);
  color: #030308;
}

/* ---------- 附属 skill 面板元素 ---------- */
.admin-attached-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.admin-attached-chip__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 150ms ease;
}

.admin-attached-chip__remove:hover {
  background: rgba(255, 80, 80, 0.3);
  color: #ff5050;
}

.admin-attached-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  border-radius: 20px;
  border: 1px dashed rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.85rem;
}

.admin-recommendation-notice {
  border-radius: 16px;
  border: 1px solid rgba(255, 200, 100, 0.15);
  background: rgba(255, 200, 100, 0.06);
  padding: 12px 16px;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.6);
}

.admin-recommendation-item {
  width: 100%;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  padding: 14px 16px;
  text-align: left;
  color: rgba(255, 255, 255, 0.8);
  transition: all 180ms ease;
}

.admin-recommendation-item:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
}

.admin-recommendation-item.is-selected {
  border-color: var(--neon-cyan, #00f5d4);
  background: rgba(0, 245, 212, 0.1);
  color: #ffffff;
}

.admin-recommendation-empty {
  border-radius: 20px;
  border: 1px dashed rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  padding: 20px 16px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.4);
}

/* ---------- Responsive ---------- */
@media (max-width: 767px) {
  .admin-topbar {
    gap: 8px;
    padding: 8px 10px;
  }

  .admin-topbar-left,
  .admin-topbar-actions {
    gap: 8px;
  }

  .admin-topbar-btn {
    width: 40px;
    height: 40px;
  }

  .admin-topbar-select,
  .admin-topbar-static {
    min-height: 40px;
    padding-left: 14px;
    font-size: 0.92rem;
  }

  .admin-panel-card {
    border-radius: 24px;
  }

  .admin-entity-bar {
    align-items: flex-start;
    padding: 12px;
  }

  .admin-entity-bar__info,
  .admin-entity-bar__actions {
    width: 100%;
  }

  .admin-entity-bar__actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .admin-skill-tab {
    padding-inline: 14px;
  }

  .admin-skill-tab--add {
    margin-left: 0;
  }

  .admin-hermes-status {
    grid-template-columns: 1fr;
  }

  .admin-hermes-thread {
    min-height: 320px;
    max-height: 50vh;
  }

  .admin-hermes-composer {
    grid-template-columns: 1fr;
  }

  .admin-hermes-send {
    width: 100%;
  }

  .admin-skill-panel-head,
  .admin-skill-panel-actions,
  .admin-skill-panel-meta,
  .admin-attached-toolbar,
  .admin-modal-head {
    width: 100%;
  }

  .admin-skill-panel-actions,
  .admin-attached-toolbar,
  .admin-modal-head {
    align-items: stretch;
  }

  .admin-skill-panel-actions :deep(.mobile-secondary-action),
  .admin-attached-toolbar :deep(.mobile-secondary-action),
  .admin-modal-head :deep(.mobile-secondary-action) {
    flex: 1 1 0;
  }

  .admin-modal-overlay {
    align-items: center;
    padding: 12px 12px 20px;
  }

  .admin-modal {
    max-width: min(100%, 560px);
    max-height: min(84vh, 720px);
    border-radius: 24px;
    padding: 16px;
  }

  .admin-bottom-nav {
    left: 10px;
    right: 10px;
    padding: 8px;
  }

  .admin-bottom-nav-item {
    min-height: 54px;
    padding: 8px 2px;
    font-size: 0.72rem;
  }
}

@media (min-width: 768px) {
  .admin-cyber-page {
    padding: calc(20px + env(safe-area-inset-top, 0px)) 20px calc(116px + env(safe-area-inset-bottom, 0px));
  }

  .admin-topbar {
    padding: 12px 14px;
  }

  .admin-panel-card {
    padding: 24px;
  }

  .admin-section-title {
    font-size: 1.5rem;
  }

  .admin-bottom-nav {
    left: 50%;
    right: auto;
    width: min(92vw, 440px);
    transform: translateX(-50%);
  }
}

/* ---------- Theme Harmonization ---------- */
.admin-cyber-page {
  color: var(--text-primary);
}

.admin-topbar,
.admin-bottom-nav,
.admin-modal,
.admin-panel-card,
.admin-skill-tabs,
.admin-entity-bar,
.admin-recommendation-item,
.admin-recommendation-empty {
  background: color-mix(in srgb, var(--card-bg) 92%, transparent) !important;
  border-color: var(--ink-mist) !important;
  color: var(--text-primary) !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
}

.admin-topbar-btn,
.admin-topbar-select,
.admin-topbar-static,
.admin-bottom-nav-item,
.admin-attached-chip,
.admin-attached-chip__remove,
:deep(.button-secondary),
:deep(.mobile-secondary-action),
:deep(.field),
:deep(.soft-line),
:deep(.stat-pill) {
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent) !important;
  border-color: var(--ink-mist) !important;
  color: var(--text-primary) !important;
  box-shadow: none !important;
}

.admin-topbar-btn--add,
.admin-skill-tab--add,
.admin-bottom-nav-item.is-active,
.admin-recommendation-item.is-selected {
  background: color-mix(in srgb, var(--accent-primary) 12%, var(--bg-elevated)) !important;
  border-color: color-mix(in srgb, var(--accent-primary) 32%, transparent) !important;
  color: var(--accent-primary) !important;
  box-shadow: none !important;
}

.admin-topbar-btn--save,
.admin-modal-save-btn,
.admin-skill-tab.is-active .admin-skill-tab-badge {
  background: var(--accent-primary) !important;
  border-color: var(--accent-primary) !important;
  color: #ffffff !important;
}

.admin-section-title,
.admin-topbar-select,
.admin-topbar-static,
.admin-entity-bar__subject,
.admin-skill-link,
.admin-skill-tab.is-active,
:deep(.text-ink),
.admin-panel-card :deep([class*="text-ink"]) {
  color: var(--text-primary) !important;
}

.admin-skill-link,
.admin-panel-card :deep([class*="text-[#8e562f]"]),
.admin-panel-card :deep([class*="text-[#ba4747]"]),
.admin-panel-card :deep([class*="text-[#8f572c]"]) {
  color: var(--accent-primary) !important;
}

.admin-topbar-caret,
.admin-entity-bar__sep,
.admin-entity-bar__skill-empty,
.admin-skill-tab,
.admin-skill-tab-badge,
:deep(.mini-kicker),
:deep(.text-dusk),
:deep(.field::placeholder),
.admin-panel-card :deep([class*="text-dusk"]) {
  color: var(--text-secondary) !important;
}

.admin-skill-tab:hover,
.admin-attached-chip__remove:hover {
  background: color-mix(in srgb, var(--bg-elevated) 80%, transparent) !important;
}

.admin-skill-tab--add:hover {
  background: var(--accent-primary) !important;
  color: #ffffff !important;
}

.admin-attached-chip__remove:hover {
  color: var(--accent-danger) !important;
}

.admin-topbar-select option {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

:deep(.field:focus) {
  border-color: var(--accent-primary) !important;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-primary) 14%, transparent) !important;
}

.admin-panel-card :deep([class*="bg-white"]),
.admin-panel-card :deep([class*="bg-[#fff"]),
.admin-panel-card :deep([class*="bg-[#fff7ef"]),
.admin-panel-card :deep([class*="bg-[#fffaf4"]),
.admin-panel-card :deep([class*="bg-[#fff3e6"]),
.admin-panel-card :deep([class*="bg-[#fff1e4"]),
.admin-panel-card :deep([class*="bg-[#fff1f1"]) {
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent) !important;
}

.admin-panel-card :deep([class*="border-[#eadfd4"]),
.admin-panel-card :deep([class*="border-[#dccab8"]),
.admin-panel-card :deep([class*="border-[#e7d9cc"]),
.admin-panel-card :deep([class*="border-[#f1dfcf"]),
.admin-panel-card :deep([class*="border-[#d7c1ab"]),
.admin-panel-card :deep([class*="border-[#ffd4b8"]),
.admin-panel-card :deep([class*="border-[#f4b2b2"]) {
  border-color: var(--ink-mist) !important;
}
</style>
