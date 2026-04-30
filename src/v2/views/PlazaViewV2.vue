<template>
  <V2AppShell>
    <div class="v2-proto-page">
      <div class="v2-proto-container v2-factory-shell">
        <div class="v2-factory-head">
          <h2 class="serif v2-proto-title v2-proto-title--center">蒸馏工厂</h2>
          <p class="v2-proto-subtitle v2-proto-subtitle--center">预制人物包与批量蒸馏</p>
        </div>

        <div class="report-section v2-factory-import-strip">
          <div class="v2-factory-import-tabs v2-factory-import-tabs--top" role="tablist" aria-label="导入方式">
            <button
              type="button"
              class="v2-factory-import-tab"
              :class="{ active: activeImportPanel === 'search' }"
              @click="selectImportPanel('search')"
            >
              搜索模板
            </button>
            <button
              type="button"
              class="v2-factory-import-tab"
              :class="{ active: activeImportPanel === 'github' }"
              @click="selectImportPanel('github')"
            >
              GitHub 导入
            </button>
            <button
              type="button"
              class="v2-factory-import-tab"
              :class="{ active: activeImportPanel === 'persona' }"
              @click="selectImportPanel('persona')"
            >
              联网搜索
            </button>
            <button
              type="button"
              class="v2-factory-import-tab"
              :class="{ active: activeImportPanel === 'history' }"
              @click="selectImportPanel('history')"
            >
              历史导入
              <span v-if="recentImportJobs.length" class="v2-factory-import-tab-count">{{ recentImportJobs.length }}</span>
            </button>
          </div>

          <div v-if="activeImportPanel === 'search'" class="v2-factory-import-tab-panel">
            <div class="v2-factory-import-main">
              <div class="v2-proto-field">
                <label class="v2-proto-label">模板搜索</label>
                <div class="v2-factory-search-row">
                  <input
                    v-model="searchText"
                    class="v2-proto-input v2-factory-search"
                    placeholder="搜索名字、标签、技能，比如 SBTI / 张雪峰 / 志愿填报"
                    @keyup.enter="runSearch"
                  />
                  <button type="button" class="btn-primary v2-factory-search-btn" @click="runSearch">搜索模板</button>
                </div>
              </div>

              <div class="v2-factory-search-meta">
                <p class="v2-report-meta-note">
                  {{ searchText.trim() ? `当前命中 ${filteredPacks.length} 个模板，可继续按分类缩小范围。` : "先搜人物、人格标签或技能关键词，默认从这里开始挑模板。" }}
                </p>
                <button v-if="searchText.trim()" type="button" class="btn-ghost" @click="searchText = ''">清空搜索</button>
              </div>
            </div>
          </div>

          <div v-else-if="activeImportPanel === 'github'" class="v2-factory-import-tab-panel">
            <div class="v2-factory-import-main">
              <div class="v2-proto-field">
                <label class="v2-proto-label">GitHub skill 仓库</label>
                <input
                  v-model="importRepoUrl"
                  class="v2-proto-input"
                  :disabled="!isAuthenticated"
                  placeholder="https://github.com/your-org/your-skill"
                />
              </div>

              <div class="v2-proto-button-row">
                <button v-if="isAuthenticated" type="button" class="btn-primary" :disabled="importing" @click="importGithubPack">
                  {{ importing ? "导入中..." : "导入 GitHub skill" }}
                </button>
                <RouterLink v-else :to="authRedirectLink" class="btn-ghost">登录后导入</RouterLink>
              </div>
            </div>
          </div>

          <div v-else-if="activeImportPanel === 'persona'" class="v2-factory-import-tab-panel">
            <div class="v2-factory-import-main">
              <div class="v2-proto-field">
                <label class="v2-proto-label">公开人物检索</label>
                <input
                  v-model="importPersonaName"
                  class="v2-proto-input"
                  :disabled="!isAuthenticated"
                  placeholder="输入人物名，例如：张雪峰"
                />
              </div>

              <div class="v2-proto-button-row">
                <button v-if="isAuthenticated" type="button" class="btn-primary" :disabled="importing" @click="importPersonaPack">
                  {{ importing ? "检索中..." : "联网整理人物包" }}
                </button>
                <RouterLink v-else :to="authRedirectLink" class="btn-ghost">登录后导入</RouterLink>
              </div>
            </div>
          </div>

          <div v-else class="v2-factory-import-tab-panel">
            <div v-if="recentImportJobs.length" class="v2-factory-import-job-list">
              <div v-for="job in recentImportJobs" :key="job.job_id" class="v2-proto-list-item v2-factory-import-item">
                <div>
                  <p class="v2-proto-list-title">{{ importJobDisplayTitle(job) }}</p>
                  <p class="v2-proto-list-copy">{{ job.source_label }}：{{ job.source_value || job.repo_url }}</p>
                  <p v-if="job.imported_pack_count > 1" class="v2-report-meta-note">已解析出 {{ job.imported_pack_count }} 个子模板，不止女娲主入口。</p>
                </div>
                <div class="v2-proto-list-actions">
                  <span class="v2-proto-status">{{ importJobStatusText(job.status, job.import_kind) }}</span>
                  <button
                    v-if="job.status === 'failed'"
                    type="button"
                    class="btn-ghost v2-proto-list-btn"
                    :disabled="retryingImportJobId === job.job_id"
                    @click="retryImportJob(job.job_id)"
                  >
                    重试
                  </button>
                  <button
                    v-else-if="job.pack_slug"
                    type="button"
                    class="btn-ghost v2-proto-list-btn"
                    @click="focusImportedPack(job.pack_slug)"
                  >
                    定位模板
                  </button>
                </div>
              </div>
            </div>

            <div v-else class="v2-factory-import-empty">
              <p class="v2-proto-list-title">还没有历史导入记录</p>
              <p class="v2-proto-list-copy">默认先展示模板搜索，导入过的记录会统一收在这里，不会再把下面主内容往下顶。</p>
            </div>
          </div>
        </div>

        <div v-if="searchText.trim()" id="factorySearchResults" class="report-section v2-factory-search-result-strip">
          <div class="v2-factory-filter-bar-head">
            <div>
              <p class="v2-proto-section-label">搜索结果</p>
              <p class="v2-report-meta-note">
                关键词「{{ searchText.trim() }}」共命中 {{ filteredPacks.length }} 个模板，先展示最相关的 {{ searchResultPacks.length }} 个。
              </p>
            </div>
            <div class="v2-proto-button-row">
              <button type="button" class="btn-ghost" @click="scrollToFactoryGrid">看完整列表</button>
              <button type="button" class="btn-ghost" @click="searchText = ''">清空搜索</button>
            </div>
          </div>

          <div v-if="searchResultPacks.length" class="v2-factory-demand-grid">
            <button
              v-for="pack in searchResultPacks"
              :key="`search-${pack.slug}`"
              type="button"
              class="v2-factory-demand-card v2-factory-demand-card--search"
              @click="openPackModal(pack.slug)"
            >
              <div class="v2-factory-card-head">
                <div class="v2-factory-avatar" :style="packAvatarStyle(pack)">{{ pack.avatar_label || pack.title.slice(0, 1) }}</div>
                <div class="v2-factory-card-copy">
                  <div class="v2-factory-card-title-row">
                    <h3 class="v2-factory-card-title">{{ pack.title }}</h3>
                    <span class="v2-report-badge">{{ displayGroupLabel(pack.display_group) }}</span>
                  </div>
                  <p class="v2-factory-card-subtitle">{{ cleanPreviewText(pack.subtitle) }}</p>
                </div>
              </div>
              <div class="v2-factory-chip-row">
                <span
                  v-for="tag in packPreviewTags(pack, 4)"
                  :key="`${pack.slug}-search-${tag}`"
                  class="v2-minimal-chip v2-minimal-chip--soft"
                >
                  {{ tag }}
                </span>
              </div>
            </button>
          </div>

          <div v-else class="v2-factory-import-empty">
            <p class="v2-proto-list-title">暂时没有找到匹配模板</p>
            <p class="v2-proto-list-copy">可以换个名字、问题标签或 skill 关键词试试，也可以切换上面的分类继续缩小范围。</p>
          </div>
        </div>



        <div class="report-section v2-factory-demand-strip">
          <div class="v2-factory-filter-bar-head">
            <div>
              <p class="v2-proto-section-label">我该蒸馏谁</p>
              <p class="v2-report-meta-note">按你当前问题找视角。先切一个场景，我把更相关的模板顶上来。</p>
            </div>
            <button
              v-if="activeDemandLensId !== 'personality'"
              type="button"
              class="btn-ghost"
              @click="activeDemandLensId = 'personality'"
            >
              回到人格入口
            </button>
          </div>

          <div class="v2-factory-demand-chip-row">
            <button
              v-for="lens in demandLenses"
              :key="lens.id"
              type="button"
              class="person-chip"
              :class="{ selected: activeDemandLensId === lens.id }"
              @click="activeDemandLensId = lens.id"
            >
              {{ lens.label }}
            </button>
          </div>

          <div class="v2-factory-demand-summary">
            <div>
              <p class="v2-proto-list-title">{{ activeDemandLens.title }}</p>
              <p class="v2-proto-list-copy">{{ activeDemandLens.hint }}</p>
            </div>
            <span class="v2-report-meta-note">Top {{ recommendedPacks.length }}</span>
          </div>

          <div v-if="recommendedPacks.length" class="v2-factory-demand-grid">
            <button
              v-for="pack in recommendedPacks"
              :key="`demand-${activeDemandLensId}-${pack.slug}`"
              type="button"
              class="v2-factory-demand-card"
              @click="openPackModal(pack.slug)"
            >
              <div class="v2-factory-card-head">
                <div class="v2-factory-avatar" :style="packAvatarStyle(pack)">{{ pack.avatar_label || pack.title.slice(0, 1) }}</div>
                <div class="v2-factory-card-copy">
                  <div class="v2-factory-card-title-row">
                    <h3 class="v2-factory-card-title">{{ pack.title }}</h3>
                    <span class="v2-report-badge">{{ demandBadgeLabel(pack) }}</span>
                  </div>
                  <p class="v2-factory-card-subtitle">{{ cleanPreviewText(pack.subtitle) }}</p>
                </div>
              </div>
              <div class="v2-factory-chip-row">
                <span
                  v-for="tag in packPreviewTags(pack, 4)"
                  :key="`${pack.slug}-demand-${tag}`"
                  class="v2-minimal-chip v2-minimal-chip--soft"
                >
                  {{ tag }}
                </span>
              </div>
              <p class="v2-factory-card-desc">{{ demandReason(pack) }}</p>
            </button>
          </div>

          <div v-else class="v2-factory-import-empty">
            <p class="v2-proto-list-title">这一类暂时还没有明显命中</p>
            <p class="v2-proto-list-copy">可以先切回“人格入口”，或者直接用上面的搜索框搜名字、问题类型和 skill 关键词。</p>
          </div>
        </div>

        <div class="v2-factory-filter-bar">
          <div class="v2-factory-filter-bar-head">
            <div>
              <p class="v2-proto-section-label">模板分类</p>
              <p class="v2-report-meta-note">
                {{ searchText.trim() ? `关键词：${searchText.trim()} · ${filteredPacks.length} 个结果` : activeDemandLensId === 'all' ? `当前共 ${packs.length} 个模板` : `${activeDemandLens.label} · ${filteredPacks.length} 个结果` }}
              </p>
            </div>
            <button
              v-if="activeImportPanel !== 'search'"
              type="button"
              class="btn-ghost"
              @click="activeImportPanel = 'search'"
            >
              去搜索
            </button>
          </div>
          <div class="v2-proto-chip-row v2-proto-chip-row--center">
            <button
              v-for="section in displayGroupSections"
              :key="section.key"
              type="button"
              class="person-chip v2-factory-filter-chip"
              :class="{ selected: selectedDisplayGroup === section.key }"
              @click="selectedDisplayGroup = section.key"
            >
              <span class="v2-factory-filter-chip-copy">
                <span>{{ section.label }}</span>
                <span class="v2-factory-filter-count">{{ section.count }}</span>
              </span>
              <span class="v2-factory-filter-help" :aria-label="section.help">?</span>
              <span class="v2-factory-filter-tooltip" role="tooltip">{{ section.help }}</span>
            </button>
          </div>
        </div>

        <div class="v2-factory-grid" id="factoryGrid">
          <button
            v-for="pack in filteredPacks"
            :key="pack.slug"
            type="button"
            class="distill-card v2-factory-card"
            :class="{ 'is-demand-match': demandScore(pack) > 0 && activeDemandLensId !== 'all' }"
            @click="openPackModal(pack.slug)"
          >
            <div class="v2-factory-card-head">
              <div class="v2-factory-avatar" :style="packAvatarStyle(pack)">{{ pack.avatar_label || pack.title.slice(0, 1) }}</div>
              <div class="v2-factory-card-copy">
                <div class="v2-factory-card-title-row">
                  <h3 class="v2-factory-card-title">{{ pack.title }}</h3>
                  <div class="v2-factory-status-row">
                    <span class="v2-report-badge">{{ displayGroupLabel(pack.display_group) }}</span>
                    <span v-if="pack.installed" class="v2-minimal-chip v2-minimal-chip--solid">已安装</span>
                  </div>
                </div>
                <p class="v2-factory-card-subtitle">{{ cleanPreviewText(pack.subtitle) }}</p>
              </div>
            </div>

            <div class="v2-factory-chip-row">
              <span
                v-for="tag in packPreviewTags(pack)"
                :key="`${pack.slug}-${tag}`"
                class="v2-minimal-chip v2-minimal-chip--soft"
              >
                {{ tag }}
              </span>
            </div>

            <p class="v2-factory-card-desc">{{ cleanPreviewText(pack.suitable_for[0] || pack.subtitle) }}</p>

            <div class="v2-factory-card-meta">
              <span>{{ pack.source_count }} 条资料</span>
              <span>使用 {{ pack.usage_count }}</span>
              <span>点赞 {{ pack.like_count }}</span>
              <span>Star {{ packTrendCurrent(pack) }}</span>
            </div>
          </button>
        </div>
      </div>

      <div class="modal-overlay" :class="{ show: Boolean(selectedDetail) }" @click.self="closePackModal">
        <div v-if="selectedDetail" class="modal-content v2-factory-modal">
          <div class="v2-factory-modal-head">
            <div class="v2-factory-card-head">
              <div class="v2-factory-avatar v2-factory-avatar--lg" :style="packAvatarStyle(selectedDetail.pack)">
                {{ selectedDetail.pack.avatar_label || selectedDetail.pack.title.slice(0, 1) }}
              </div>
              <div class="v2-factory-card-copy">
                <div class="v2-factory-card-title-row">
                  <h3 class="v2-factory-card-title">{{ selectedDetail.pack.title }}</h3>
                  <div class="v2-factory-status-row">
                    <span class="v2-report-badge">{{ displayGroupLabel(selectedDetail.pack.display_group) }}</span>
                    <span v-if="selectedDetail.pack.installed" class="v2-minimal-chip v2-minimal-chip--solid">已在我的项目</span>
                  </div>
                </div>
                <p class="v2-factory-card-subtitle">{{ cleanPreviewText(selectedDetail.pack.subtitle) }}</p>
              </div>
            </div>
            <button type="button" class="btn-ghost v2-factory-close" @click="closePackModal">关闭</button>
          </div>

          <p class="v2-report-summary">{{ cleanPreviewText(selectedDetail.preview_report.memory.summary) }}</p>

          <div class="report-section v2-factory-trend-panel">
            <div class="v2-factory-section-head">
              <div>
                <h4 class="v2-proto-section-label">Skill 热度</h4>
                <p class="v2-report-meta-note">记录使用次数、点赞数，并展示 star 上升 K 线。</p>
              </div>
            </div>
            <div class="v2-factory-trend-stats">
              <div class="v2-factory-trend-stat">
                <strong>{{ selectedDetail.pack.usage_count }}</strong>
                <span>使用次数</span>
              </div>
              <div class="v2-factory-trend-stat">
                <strong>{{ selectedDetail.pack.like_count }}</strong>
                <span>点赞数</span>
              </div>
              <div class="v2-factory-trend-stat">
                <strong>{{ packTrendCurrent(selectedDetail.pack) }}</strong>
                <span>当前 Star</span>
              </div>
            </div>
            <div class="v2-factory-kline-wrap">
              <svg viewBox="0 0 220 74" class="v2-factory-kline" role="img" aria-label="Skill star 上升趋势">
                <polyline points="0,70 220,70" class="v2-factory-kline-axis" />
                <polyline :points="packTrendPath(selectedDetail.pack, 220, 70)" class="v2-factory-kline-line" />
              </svg>
            </div>
            <div class="v2-proto-button-row">
              <button
                v-if="isAuthenticated"
                type="button"
                class="btn-ghost"
                :disabled="togglingPackLike"
                @click="togglePackLike"
              >
                {{ togglingPackLike ? "处理中..." : selectedDetail.pack.liked_by_me ? "取消点赞" : "点赞这个 skill" }}
              </button>
              <RouterLink v-else :to="authRedirectLink" class="btn-ghost">登录后点赞</RouterLink>
            </div>
          </div>

          <div class="report-section v2-factory-hero-cta">
            <div class="v2-factory-hero-cta-copy">
              <p class="v2-proto-kicker">现在就能做什么</p>
              <h4 class="v2-proto-section-label">{{ packActionHeadline(selectedDetail.pack) }}</h4>
              <p class="v2-report-meta-note">{{ packActionHint(selectedDetail.pack) }}</p>
            </div>
            <button
              v-if="isAuthenticated"
              type="button"
              class="btn-primary v2-factory-hero-cta-btn"
              :disabled="cloning"
              @click="enterDistillFlow"
            >
              {{ cloning ? "加载中..." : cloneActionLabel() }}
            </button>
            <RouterLink v-else :to="authRedirectLink" class="btn-primary v2-factory-hero-cta-btn">登录后开始</RouterLink>
          </div>

          <div class="report-section v2-factory-detail-group">
            <div class="v2-factory-section-head">
              <h4 class="v2-proto-section-label">标签</h4>
              <span class="v2-report-meta-note">{{ selectedPackTags.length }} 个</span>
            </div>
            <div class="v2-factory-chip-row">
              <span v-for="tag in selectedPackTags" :key="tag" class="v2-minimal-chip">{{ tag }}</span>
            </div>
          </div>

          <div class="report-section v2-factory-detail-group">
            <div class="v2-factory-section-head">
              <h4 class="v2-proto-section-label">核心能力</h4>
              <span class="v2-report-meta-note">{{ selectedPackSkills.length }} 项</span>
            </div>
            <div class="v2-factory-chip-row">
              <span
                v-for="tag in selectedPackSkills"
                :key="tag"
                class="v2-minimal-chip v2-minimal-chip--emphasis"
              >
                {{ cleanPreviewText(tag) }}
              </span>
            </div>
          </div>

          <div v-if="selectedRelatedSystemPacks.length" class="report-section v2-factory-detail-group">
            <div class="v2-factory-section-head">
              <div>
                <h4 class="v2-proto-section-label">系统</h4>
                <p class="v2-report-meta-note">挂在这个人物主体下的方法框架、主题视角和职业脑回路。</p>
              </div>
              <span class="v2-report-meta-note">{{ selectedRelatedSystemPacks.length }} 个</span>
            </div>
            <div class="v2-factory-related-grid">
              <article
                v-for="pack in selectedRelatedSystemPacks"
                :key="pack.slug"
                class="v2-factory-related-card"
              >
                <div class="v2-factory-related-card-head">
                  <div class="v2-factory-related-avatar" :style="packAvatarStyle(pack)">{{ pack.avatar_label || pack.title.slice(0, 1) }}</div>
                  <div class="v2-factory-related-copy">
                    <div class="v2-factory-related-title-row">
                      <h5>{{ pack.title }}</h5>
                      <span class="v2-minimal-chip">{{ displayGroupLabel(pack.display_group) }}</span>
                    </div>
                    <p>{{ cleanPreviewText(pack.subtitle) }}</p>
                  </div>
                </div>
                <div class="v2-factory-chip-row v2-factory-chip-row--dense">
                  <span
                    v-for="tag in packPreviewTags(pack, 4)"
                    :key="`${pack.slug}-system-${tag}`"
                    class="v2-minimal-chip v2-minimal-chip--soft"
                  >
                    {{ tag }}
                  </span>
                </div>
                <div class="v2-proto-button-row">
                  <button type="button" class="btn-ghost" @click="openPackModal(pack.slug)">查看详情</button>
                </div>
              </article>
            </div>
          </div>

          <div v-if="selectedRelatedToolPacks.length" class="report-section v2-factory-detail-group">
            <div class="v2-factory-section-head">
              <div>
                <h4 class="v2-proto-section-label">外挂</h4>
                <p class="v2-report-meta-note">挂在这个人物主体下、可直接装载和调用的外挂技能。</p>
              </div>
              <span class="v2-report-meta-note">{{ selectedRelatedToolPacks.length }} 个</span>
            </div>
            <div class="v2-factory-related-grid">
              <article
                v-for="pack in selectedRelatedToolPacks"
                :key="pack.slug"
                class="v2-factory-related-card v2-factory-related-card--tool"
              >
                <div class="v2-factory-related-card-head">
                  <div class="v2-factory-related-avatar" :style="packAvatarStyle(pack)">{{ pack.avatar_label || pack.title.slice(0, 1) }}</div>
                  <div class="v2-factory-related-copy">
                    <div class="v2-factory-related-title-row">
                      <h5>{{ pack.title }}</h5>
                      <span class="v2-minimal-chip v2-minimal-chip--emphasis">{{ displayGroupLabel(pack.display_group) }}</span>
                    </div>
                    <p>{{ cleanPreviewText(pack.subtitle) }}</p>
                  </div>
                </div>
                <div class="v2-factory-chip-row v2-factory-chip-row--dense">
                  <span
                    v-for="tag in packPreviewTags(pack, 4)"
                    :key="`${pack.slug}-tool-${tag}`"
                    class="v2-minimal-chip v2-minimal-chip--soft"
                  >
                    {{ tag }}
                  </span>
                </div>
                <div class="v2-proto-button-row">
                  <button type="button" class="btn-ghost" @click="openPackModal(pack.slug)">查看详情</button>
                </div>
              </article>
            </div>
          </div>

          <div class="report-section v2-factory-detail-group">
            <div class="v2-factory-section-head">
              <div>
                <h4 class="v2-proto-section-label">推荐玩法</h4>
                <p class="v2-report-meta-note">这里不再重复标签和 skill 名，只保留真正能拿来开蒸馏或开对话的入口。</p>
              </div>
              <span class="v2-report-meta-note">{{ selectedUseCaseTags.length }} 个</span>
            </div>
            <div class="v2-factory-chip-row v2-factory-chip-row--dense">
              <span
                v-for="item in selectedUseCaseTags"
                :key="item"
                class="v2-minimal-chip v2-minimal-chip--interactive"
              >
                {{ item }}
              </span>
            </div>
          </div>

          <div class="report-section">
            <div class="v2-report-section-head">
              <h4 class="v2-proto-section-label">资料来源</h4>
              <span class="v2-report-meta-note">{{ selectedDetail.sources.length }} 条</span>
            </div>
            <div class="v2-report-source-list">
              <a
                v-for="source in selectedDetail.sources.slice(0, 6)"
                :key="source.url"
                :href="source.url"
                target="_blank"
                rel="noreferrer"
                class="v2-report-source-item v2-report-source-item--link"
              >
                <div class="v2-report-source-icon">{{ sourceTypeLabel(source.source_type).slice(0, 1) }}</div>
                <div class="v2-report-source-copy">
                  <span>{{ cleanPreviewText(source.title) }}</span>
                  <span>{{ source.url }}</span>
                </div>
              </a>
            </div>
          </div>

          <div class="v2-factory-modal-footer">
            <div class="v2-factory-modal-footer-copy">
              <p class="v2-proto-kicker">下一步</p>
              <p class="v2-report-meta-note">主入口已经统一回蒸馏主链路，这里不再重复放“进入我的蒸馏 / 进入对话”两组按钮。</p>
            </div>
            <div class="v2-proto-button-row v2-factory-modal-footer-actions">
              <RouterLink v-if="clonedProjectId" :to="`/projects/${clonedProjectId}/report`" class="btn-ghost">查看结果</RouterLink>
              <button type="button" class="btn-ghost" @click="closePackModal">关闭</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </V2AppShell>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"

import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import type {
  DisplayGroup,
  FactoryCategory,
  GitHubPackImportJob,
  GitHubPackImportJobListResponse,
  PackCloneResponse,
  PackDetailResponse,
  PackLikeToggleResponse,
  PackSummary,
} from "@/types"
import { packPreviewTags } from "@/v2/app"
import V2AppShell from "@/v2/components/V2AppShell.vue"

interface DemandLens {
  id: "all" | "personality" | "relationship" | "work" | "execution"
  label: string
  title: string
  hint: string
  category?: FactoryCategory
  keywords: string[]
}

interface DisplayGroupSectionItem {
  key: DisplayGroup | "all"
  label: string
  help: string
  count: number
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const searchText = ref("")
const packs = ref<PackSummary[]>([])
const selectedPack = ref<PackSummary | null>(null)
const selectedDetail = ref<PackDetailResponse | null>(null)
const selectedDisplayGroup = ref<DisplayGroup | "all">("all")
const cloning = ref(false)
const clonedProjectId = ref("")
const clonedExisting = ref(false)
const importing = ref(false)
const importRepoUrl = ref("")
const importPersonaName = ref("")
const recentImportJobs = ref<GitHubPackImportJob[]>([])
const retryingImportJobId = ref("")
const togglingPackLike = ref(false)
const activeImportPanel = ref<"search" | "github" | "persona" | "history">("search")
const activeDemandLensId = ref<DemandLens["id"]>("personality")
const autoFocusedImportJobId = ref("")
const isAuthenticated = computed(() => Boolean(auth.token))
const authRedirectLink = computed(() => ({ name: "auth", query: { redirect: route.fullPath } }))

const displayGroupSections = computed<DisplayGroupSectionItem[]>(() => {
  const countByGroup: Record<DisplayGroup, number> = {
    person: 0,
    theme: 0,
    tool_entry: 0,
  }
  for (const pack of packs.value) {
    countByGroup[pack.display_group] += 1
  }
  return [
    {
      key: "all",
      label: "全部",
      help: "不设偏好，直接浏览蒸馏工厂里当前公开的全部模板。",
      count: packs.value.length,
    },
    {
      key: "person",
      label: "重生者",
      help: "偏人物原型、关系镜像和角色视角，适合先找一个可代入的人。",
      count: countByGroup.person,
    },
    {
      key: "theme",
      label: "系统",
      help: "偏主题框架、知识结构和方法系统，适合按问题域来找模板。",
      count: countByGroup.theme,
    },
    {
      key: "tool_entry",
      label: "外挂",
      help: "偏可直接调用的 skill 和工作流，适合测试、分析、执行类任务。",
      count: countByGroup.tool_entry,
    },
  ]
})

const demandLenses: DemandLens[] = [
  {
    id: "personality",
    label: "人格入口",
    title: "想先判断一个人是什么路数",
    hint: "优先把 SBTI / MBTI / 人格测试型模板顶上来，适合先定性格，再聊关系或协作。",
    keywords: ["sbti", "mbti", "人格", "性格", "测评", "测试", "personality", "assessment"],
  },
  {
    id: "relationship",
    label: "关系互动",
    title: "想看清关系模式、边界和情绪风格",
    hint: "更偏关系、亲密、沟通修复这类人物或模板，会优先出现情感和互动向 pack。",
    category: "human_expert",
    keywords: ["关系", "情感", "亲密", "恋爱", "边界", "沟通", "relationship", "emotion", "attachment", "love"],
  },
  {
    id: "work",
    label: "工作决策",
    title: "想借一个职业脑回路处理工作问题",
    hint: "优先职业角色、管理、协作、战略判断相关的 pack，适合老板、同事、职业路径这类问题。",
    category: "professional_role",
    keywords: ["工作", "职业", "老板", "同事", "管理", "决策", "strategy", "career", "manager", "team", "product"],
  },
  {
    id: "execution",
    label: "直接上手",
    title: "我不要画像，先给我一个能直接跑的 skill",
    hint: "优先工具型模板，适合测试、分析、执行和固定工作流。",
    category: "tool_agent",
    keywords: ["工具", "skill", "workflow", "qa", "review", "benchmark", "测试", "分析", "执行", "自动化"],
  },
  {
    id: "all",
    label: "看全部",
    title: "先把全量模板摊开看",
    hint: "不做场景偏置，直接按搜索词和分类浏览全部模板。",
    keywords: [],
  },
]

const activeDemandLens = computed(() => demandLenses.find((item) => item.id === activeDemandLensId.value) || demandLenses[0])

const baseFilteredPacks = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  return packs.value.filter((pack) => {
    if (selectedDisplayGroup.value !== "all" && pack.display_group !== selectedDisplayGroup.value) return false
    if (!keyword) return true
    const haystack = [
      pack.title,
      pack.subtitle,
      pack.domain,
      pack.display_group_label,
      pack.factory_category_label,
      ...pack.tags,
      ...pack.skills,
      ...pack.suitable_for,
      ...pack.repo_entry_preview,
    ].join(" ").toLowerCase()
    return haystack.includes(keyword)
  })
})

const filteredPacks = computed(() => {
  const items = [...baseFilteredPacks.value]
  if (activeDemandLens.value.id === "all") return items
  return items.sort((left, right) => {
    const scoreDelta = demandScore(right) - demandScore(left)
    if (scoreDelta !== 0) return scoreDelta
    return left.title.localeCompare(right.title, "zh-CN")
  })
})

const activeImportStatuses = new Set(["queued", "parsing", "extracting", "distilling", "report_ready"])
let importPollTimer: number | undefined

function cleanPreviewText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function displayGroupLabel(group: DisplayGroup | "all") {
  if (group === "person") return "重生者"
  if (group === "theme") return "系统"
  if (group === "tool_entry") return "外挂"
  return "全部"
}

function sourceTypeLabel(type: PackSummary["source_types"][number]) {
  if (type === "official") return "官方"
  if (type === "user_provided") return "用户"
  if (type === "archive") return "资料"
  return "全网"
}

function packAvatarStyle(pack: PackSummary) {
  return {
    background: pack.hero_background || "linear-gradient(135deg, rgba(212,148,58,0.15), rgba(34,211,238,0.08))",
  }
}

function packStarTrend(pack: PackSummary) {
  const raw = (pack.star_trend || []).map((value) => Number(value)).filter((value) => Number.isFinite(value))
  if (raw.length >= 2) return raw
  const seed = Math.max(8, Math.round(pack.usage_count * 1.4 + pack.like_count * 2.2 + 10))
  return [seed - 3, seed - 1, seed]
}

function packTrendPath(pack: PackSummary, width = 220, height = 70) {
  const trend = packStarTrend(pack)
  const min = Math.min(...trend)
  const max = Math.max(...trend)
  const yRange = Math.max(1, max - min)
  const xStep = trend.length > 1 ? width / (trend.length - 1) : width
  return trend
    .map((value, index) => {
      const x = Math.round(index * xStep * 100) / 100
      const normalized = (value - min) / yRange
      const y = Math.round((height - normalized * (height - 6) - 3) * 100) / 100
      return `${x},${y}`
    })
    .join(" ")
}

function packTrendCurrent(pack: PackSummary) {
  const trend = packStarTrend(pack)
  return trend[trend.length - 1] || 0
}

function packHaystack(pack: PackSummary) {
  return [
      pack.title,
      pack.subtitle,
      pack.domain,
      pack.display_group_label,
      displayGroupLabel(pack.display_group),
      pack.factory_category_label,
    ...pack.tags,
    ...pack.skills,
    ...pack.suitable_for,
    ...pack.repo_entry_preview,
  ].join(" ").toLowerCase()
}

function compactUnique(items: Array<string | undefined | null>, limit = 4) {
  const seen = new Set<string>()
  return items
    .map((item) => cleanPreviewText(String(item || "")))
    .filter((item) => {
      if (!item || seen.has(item)) return false
      seen.add(item)
      return true
    })
    .slice(0, limit)
}

const selectedPackTags = computed(() => compactUnique(selectedDetail.value?.pack.tags || [], 12))
const selectedPackSkills = computed(() => {
  const blocked = new Set(selectedPackTags.value.map((item) => item.toLowerCase()))
  return compactUnique(selectedDetail.value?.pack.skills || [], 12).filter((item) => !blocked.has(item.toLowerCase()))
})
const selectedRelatedSystemPacks = computed(() => selectedDetail.value?.related_system_packs || [])
const selectedRelatedToolPacks = computed(() => selectedDetail.value?.related_tool_packs || [])

const selectedUseCaseTags = computed(() => {
  if (!selectedDetail.value) return []
  const blocked = new Set([...selectedPackTags.value, ...selectedPackSkills.value].map((item) => item.toLowerCase()))
  const tags = compactUnique([
    ...selectedDetail.value.preview_report.cognition.suggested_use_cases,
    ...selectedDetail.value.pack.suitable_for,
  ], 4).filter((item) => !blocked.has(item.toLowerCase()))
  return tags.length ? tags : ["方案建议", "多视角对比", "直接开聊"]
})

function demandScore(pack: PackSummary) {
  const lens = activeDemandLens.value
  if (lens.id === "all") return 0

  const haystack = packHaystack(pack)
  let score = 0

  if (lens.category && pack.factory_category === lens.category) score += 28
  if (pack.installed) score += 4

  for (const keyword of lens.keywords) {
    if (haystack.includes(keyword.toLowerCase())) score += 12
  }

  if (lens.id === "personality" && /sbti|mbti|人格|性格|test|assessment/.test(haystack)) score += 32
  if (lens.id === "relationship" && /关系|情感|亲密|恋爱|沟通|emotion|relationship|attachment/.test(haystack)) score += 18
  if (lens.id === "work" && /老板|同事|管理|职业|协作|strategy|manager|career|team/.test(haystack)) score += 18
  if (lens.id === "execution" && /tool|skill|qa|review|benchmark|测试|分析|执行|workflow/.test(haystack)) score += 18

  return score
}

const recommendedPacks = computed(() =>
  [...filteredPacks.value]
    .filter((pack) => activeDemandLens.value.id === "all" || demandScore(pack) > 0)
    .slice(0, 4)
)

const searchResultPacks = computed(() => filteredPacks.value.slice(0, 8))

function demandBadgeLabel(pack: PackSummary) {
  if (activeDemandLens.value.id === "all") return displayGroupLabel(pack.display_group)
  return demandScore(pack) >= 40 ? "强相关" : "可试试"
}

function demandReason(pack: PackSummary) {
  if (activeDemandLens.value.id === "all") {
    return cleanPreviewText(pack.suitable_for[0] || pack.subtitle)
  }
  const matchTag = packPreviewTags(pack, 6).find((tag) =>
    activeDemandLens.value.keywords.some((keyword) => tag.toLowerCase().includes(keyword.toLowerCase())),
  )
  if (matchTag) {
    return `因为它直接命中了「${matchTag}」这类关键词，适合从这个视角先切进去。`
  }
  if (activeDemandLens.value.category && pack.factory_category === activeDemandLens.value.category) {
    return `它归在${displayGroupLabel(pack.display_group)}入口下，同时更贴近你现在选的「${activeDemandLens.value.label}」问题。`
  }
  return cleanPreviewText(pack.suitable_for[0] || pack.subtitle)
}

function upsertPackSummary(summary: PackSummary) {
  const nextItems = [...packs.value]
  const index = nextItems.findIndex((item) => item.slug === summary.slug)
  if (index >= 0) nextItems[index] = summary
  else nextItems.unshift(summary)
  packs.value = nextItems
  if (selectedPack.value?.slug === summary.slug) selectedPack.value = summary
}

async function loadPacks() {
  const { data } = await api.get<{ items: PackSummary[] }>("/packs")
  packs.value = data.items
  if (selectedDetail.value) {
    const refreshedSelected = data.items.find((item) => item.slug === selectedDetail.value?.pack.slug)
    if (refreshedSelected) {
      selectedPack.value = refreshedSelected
      selectedDetail.value = {
        ...selectedDetail.value,
        pack: refreshedSelected,
      }
    }
  }
}

async function choosePack(slug: string) {
  let pack = packs.value.find((item) => item.slug === slug) || null
  if (!pack) {
    await loadPacks()
    pack = packs.value.find((item) => item.slug === slug) || null
  }
  if (!pack) return
  selectedPack.value = pack
  const { data } = await api.get<PackDetailResponse>(`/packs/${slug}`)
  upsertPackSummary(data.pack)
  selectedDetail.value = data
}

async function openPackModal(slug: string) {
  clonedProjectId.value = ""
  clonedExisting.value = false
  await choosePack(slug)
}

function closePackModal() {
  selectedDetail.value = null
  clonedProjectId.value = ""
  clonedExisting.value = false
}

async function clonePack() {
  if (!selectedDetail.value) return
  cloning.value = true
  try {
    const { data } = await api.post<PackCloneResponse>(`/packs/${selectedDetail.value.pack.slug}/clone`)
    clonedProjectId.value = data.project.project_id
    clonedExisting.value = data.reused_existing
    const { data: refreshedDetail } = await api.get<PackDetailResponse>(`/packs/${selectedDetail.value.pack.slug}`)
    upsertPackSummary(refreshedDetail.pack)
    selectedDetail.value = refreshedDetail
  } finally {
    cloning.value = false
  }
}

async function togglePackLike() {
  if (!selectedDetail.value || !isAuthenticated.value) return
  togglingPackLike.value = true
  try {
    const { data } = await api.post<PackLikeToggleResponse>(`/packs/${selectedDetail.value.pack.slug}/like`)
    upsertPackSummary(data.pack)
    selectedDetail.value = {
      ...selectedDetail.value,
      pack: data.pack,
    }
  } finally {
    togglingPackLike.value = false
  }
}

async function enterDistillFlow() {
  if (!selectedDetail.value) return
  if (!auth.token) {
    await router.push(authRedirectLink.value)
    return
  }
  await clonePack()
  if (!clonedProjectId.value) return
  await router.push({
    name: "new-project",
    query: {
      projectId: clonedProjectId.value,
      packSlug: selectedDetail.value.pack.slug,
      step: "1",
    },
  })
}

async function selectImportPanel(panel: "search" | "github" | "persona" | "history") {
  if (!isAuthenticated.value && panel !== "search") {
    await router.push(authRedirectLink.value)
    return
  }
  activeImportPanel.value = panel
}

function clearImportPolling() {
  if (importPollTimer) window.clearTimeout(importPollTimer)
}

function scheduleImportPolling() {
  clearImportPolling()
  if (!recentImportJobs.value.some((job) => activeImportStatuses.has(job.status))) return
  importPollTimer = window.setTimeout(() => void loadRecentImportJobs(), 2200)
}

async function loadRecentImportJobs() {
  try {
    const { data } = await api.get<GitHubPackImportJobListResponse>("/import-jobs", { params: { limit: 8 } })
    recentImportJobs.value = data.items
    const hasFreshImportedPack = data.items.some(
      (job) =>
        Boolean(job.pack_slug) &&
        !activeImportStatuses.has(job.status) &&
        !packs.value.some((pack) => pack.slug === job.pack_slug),
    )
    if (hasFreshImportedPack) {
      await loadPacks()
    }
  } finally {
    scheduleImportPolling()
  }
}

function importJobDisplayTitle(job: GitHubPackImportJob) {
  return job.pack_title || job.pack_slug || (job.import_kind === "persona_lookup" ? "人物包检索任务" : "GitHub skill 导入任务")
}

function importJobStatusText(status: GitHubPackImportJob["status"], kind: GitHubPackImportJob["import_kind"]) {
  const prefix = kind === "persona_lookup" ? "人物包" : "GitHub"
  const labels: Record<string, string> = {
    queued: "排队中",
    parsing: "解析中",
    extracting: "提取中",
    distilling: "蒸馏中",
    report_ready: "已生成",
    chat_ready: "已可用",
    failed: "失败",
  }
  return `${prefix} · ${labels[status] || status}`
}

async function importGithubPack() {
  if (!importRepoUrl.value.trim()) {
    return
  }
  importing.value = true
  try {
    await api.post<GitHubPackImportJob>("/packs/import/github", { repo_url: importRepoUrl.value.trim() })
    await loadRecentImportJobs()
  } finally {
    importing.value = false
  }
}

async function importPersonaPack() {
  if (!importPersonaName.value.trim()) {
    return
  }
  importing.value = true
  try {
    await api.post<GitHubPackImportJob>("/packs/import/persona", { name: importPersonaName.value.trim() })
    await loadRecentImportJobs()
  } finally {
    importing.value = false
  }
}

async function retryImportJob(jobId: string) {
  retryingImportJobId.value = jobId
  try {
    await api.post(`/import-jobs/${jobId}/retry`)
    await loadRecentImportJobs()
  } finally {
    retryingImportJobId.value = ""
  }
}

async function focusImportedPack(slug: string) {
  await openPackModal(slug)
}

function scrollToFactoryGrid() {
  document.getElementById("factoryGrid")?.scrollIntoView({ behavior: "smooth", block: "start" })
}

function runSearch() {
  if (!searchText.value.trim()) return
  activeImportPanel.value = "search"
  window.setTimeout(() => {
    document.getElementById("factorySearchResults")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, 60)
}

function packActionHeadline(pack: PackSummary) {
  const action = packActionLabel(pack)
  if (action === "去蒸馏一下") return "先跑一轮人格蒸馏，看看你是不是这一路人"
  if (action === "超时空对话") return "直接载入这个真人视角，立刻开聊"
  if (action === "神经链接") return "接入这个职业脑回路，开始联机"
  if (action === "灵魂交流") return "带着关系问题上车，马上进入互动"
  if (action === "开始加载神技") return "先把神技装进你的蒸馏机，再开始使用"
  return "先装载这个蒸馏机，然后直接开始蒸馏"
}

function packActionHint(pack: PackSummary) {
  const action = packActionLabel(pack)
  if (action === "去蒸馏一下") return "适合先快速对照人格画像，跑完就能看报告，也能继续追问你和这个类型到底像不像。"
  if (action === "超时空对话") return "会把这个人物包装进你的项目，随后进入可对话状态。"
  if (action === "神经链接") return "适合职业角色型 skill，装载后直接用它的工作流思考问题。"
  if (action === "灵魂交流") return "更适合情感、关系、亲密互动这类问题，进入后就能直接追问。"
  if (action === "开始加载神技") return "更像工具 skill，进入后通常会直接带你走测试、分析或执行流程。"
  return "装载完成后会进入你的蒸馏项目，可以继续看结果，也可以直接开聊。"
}

function packActionLabel(pack?: PackSummary | null) {
  if (!pack) return "开始蒸馏"
  const text = packHaystack(pack)
  if (/sbti|mbti|人格|性格|测试|assessment|personality/.test(text)) return "去蒸馏一下"
  if (/情感|关系|恋爱|依恋|emotion|emotional|relationship|attachment|love/.test(text)) return "灵魂交流"
  if (pack.factory_category === "human_expert") return "超时空对话"
  if (pack.factory_category === "professional_role") return "神经链接"
  return "开始加载神技"
}

function cloneActionLabel() {
  if (clonedExisting.value) return "进入我的蒸馏"
  if (selectedDetail.value?.pack.installed) return "进入已加载蒸馏"
  return packActionLabel(selectedDetail.value?.pack)
}

onMounted(() => {
  void loadPacks()
  if (isAuthenticated.value) {
    void loadRecentImportJobs()
  }
})

onBeforeUnmount(() => {
  clearImportPolling()
})
</script>
