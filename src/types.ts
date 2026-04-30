export type SubjectType = "self" | "private_person" | "public_figure"
export type ConversationScope = "direct_1v1" | "group_chat"
export type ChatMode = "replica" | "advice" | "compare"
export type DistillIntensity = "gentle" | "intense"
export type ChatCivilizationLevel = "low" | "mid" | "high"
export type DistillOutputMode = "rebirth" | "clone" | "possess"
export type ProjectStatus = "draft" | "ready_for_distill" | "distilling" | "report_ready" | "chat_ready"
export type JobStatus = "queued" | "parsing" | "extracting" | "distilling" | "report_ready" | "chat_ready" | "failed"
export type MaterialParseStatus = "queued" | "parsing" | "ready" | "failed"
export type EmailDeliveryMode = "smtp" | "console"
export type EmailSecurityMode = "ssl" | "starttls" | "none"
export type FactoryCategory = "human_expert" | "tool_agent" | "professional_role"
export type DisplayGroup = "person" | "theme" | "tool_entry"
export type RepoKind = "single_skill" | "multi_skill_catalog"

export interface ProjectSkillRouterConfig {
  configured_names?: string[]
  selected_pack_slugs?: string[]
}

export interface ProjectIntakeProfile {
  conversation_scope?: ConversationScope
  target_focus?: string
  relationship_stage?: string
  distill_goal?: string
  key_concern?: string
  participant_summary?: string
  civilization_level?: ChatCivilizationLevel
  output_mode?: DistillOutputMode
  skill_router_config?: ProjectSkillRouterConfig
}

export interface User {
  user_id: string
  email: string
  nickname: string
  login_name?: string | null
  role: "user" | "admin"
  created_at: string
}

export interface FriendQrResponse {
  user: User
  payload: string
  qr_text: string
}

export interface FriendScanRequest {
  payload: string
}

export interface FriendSummary {
  friendship_id: string
  user: User
  added_by_user_id: string
  status: string
  created_at: string
  updated_at: string
}

export interface FriendListResponse {
  items: FriendSummary[]
}

export interface FriendAddResponse {
  friend: FriendSummary
  already_friend: boolean
}

export interface AuthSession {
  token: string
  user: User
}

export interface EmailCodeResponse {
  email: string
  expires_in_seconds: number
  debug_code?: string | null
  delivery_channel: EmailDeliveryMode
}

export interface PublicAuthSettings {
  require_verification_code_for_signup: boolean
  allow_email_password_auth: boolean
  allow_email_code_auth: boolean
}

export interface AdminAiProvider {
  provider_code: string
  provider_name: string
  is_current: boolean
  is_enabled: boolean
  display_order: number
  config: Record<string, any>
}

export interface AdminAiRouteRule {
  route_rule_id: number
  scene_code?: string
  function_type?: string
  provider_code?: string
  profile_code?: string
  priority: number
  is_enabled: boolean
}

export interface AdminAiSettings {
  current_provider_code: string
  providers: AdminAiProvider[]
  route_rules: AdminAiRouteRule[]
}

export interface AdminEmailSmtpSettings {
  host: string
  port: number
  username: string
  password: string
  from_email: string
  from_name: string
  security_mode: EmailSecurityMode
}

export interface AdminEmailSettings {
  delivery_mode: EmailDeliveryMode
  smtp: AdminEmailSmtpSettings
  require_verification_code_for_signup: boolean
  allow_email_code_auth: boolean
  code_ttl_seconds: number
  resend_cooldown_seconds: number
  max_attempts: number
  smtp_configured: boolean
}

export interface DistillTargetConfig {
  key: string
  label: string
  icon: string
  enabled: boolean
  subject_type: SubjectType
  relation_label: string
  subject_default: string
  subject_placeholder: string
  project_default: string
  project_placeholder: string
  goal_default: string
  goal_placeholder: string
  assistant_title: string
  pack_keywords: string[]
  configured_names: string[]
  starter_prompts: string[]
  default_pack_slug: string
  attached_pack_slugs: string[]
}

export interface DistillTargetSettingsResponse {
  items: DistillTargetConfig[]
}

export type ProductGuidanceSurface = "cyber_onboarding" | "memory_intake" | "profile_action"

export interface ProductGuidanceResponse {
  surface: ProductGuidanceSurface
  skill_ref: string
  payload: Record<string, any>
}

export interface ProjectSummary {
  project_id: string
  name: string
  subject_name: string
  subject_type: SubjectType
  relation_label?: string
  analysis_goal?: string
  intake_profile?: ProjectIntakeProfile
  status: ProjectStatus
  pack_slug?: string
  factory_category?: FactoryCategory | null
  factory_category_label?: string | null
  latest_job_id?: string
  latest_job_status?: JobStatus
  has_report?: boolean
  has_preview_report?: boolean
  report_source_kind?: string | null
  material_count: number
  can_chat_now: boolean
  citizen_level?: number
  citizen_score?: number
  citizen_label?: string
  citizen_next_score?: number | null
  public_skill_slug?: string | null
  public_skill_published?: boolean
  created_at: string
  updated_at: string
}

export interface ProjectSkillPublishResponse {
  project: ProjectSummary
  pack?: PackSummary | null
  public_skill_slug?: string | null
  published: boolean
}

export interface MaterialSummary {
  material_id: string
  project_id: string
  evidence_type: string
  label: string
  parse_status: MaterialParseStatus
  parse_error_message?: string
  content_excerpt?: string
  parser_name?: string
  parser_mode?: string
  file_name?: string
  file_url?: string
  file_size?: number
  consent_confirmed: boolean
  created_at: string
  parsed_at?: string
}

export interface ProjectDetailResponse {
  project: ProjectSummary
  materials: MaterialSummary[]
}

export interface DistillJob {
  job_id: string
  project_id: string
  status: JobStatus
  timeline: JobStatus[]
  storyboard?: {
    skill_ref?: string
    status?: JobStatus
    status_meta?: {
      label?: string
      title?: string
      copy?: string
    }
    destiny_cards?: Array<{
      key: string
      index?: string
      title?: string
      copy?: string
      ready_threshold?: number
    }>
    steps?: Array<{
      key: JobStatus
      title?: string
      copy?: string
    }>
  }
  created_at: string
  updated_at: string
  error_message?: string
}

export type ProjectScene = "tool_test" | "human_distill" | "pack_direct"
export type ReadinessVerdict = "ready" | "almost_ready" | "not_ready"
export type ReadinessSeverity = "info" | "warning" | "blocking"

export interface ReadinessBlockingReason {
  code: string
  title: string
  detail: string
  severity: ReadinessSeverity
}

export interface ReadinessChecklistItem {
  code: string
  label: string
  passed: boolean
  detail: string
}

export interface ToolSceneArtifactPayload {
  tool_code: string
  title: string
  ready: boolean
  confidence_score: number
  summary: string
  matched_code: string
  matched_label: string
  dimensions: string[]
  tags: string[]
}

export interface ProjectReadinessResponse {
  project_id: string
  scene: ProjectScene
  scene_label: string
  report_supported: boolean
  can_generate_report: boolean
  scene_gate_passed: boolean
  hard_gate_passed: boolean
  hermes_verdict: ReadinessVerdict
  hermes_score: number
  readiness_percent: number
  task_stage: string
  task_stage_label: string
  task_stage_percent: number
  summary: string
  material_count: number
  parsed_material_count: number
  pending_material_count: number
  material_text_chars: number
  chat_message_count: number
  effective_chat_turn_count: number
  chat_text_chars: number
  latest_job_status?: JobStatus | null
  blockers: ReadinessBlockingReason[]
  checklist: ReadinessChecklistItem[]
  next_questions: string[]
  tool_artifacts: ToolSceneArtifactPayload[]
  updated_at: string
}

export interface DistillReport {
  project_id: string
  subject_name: string
  memory: {
    summary: string
    key_events: string[]
    recurring_topics: string[]
    relation_facts: string[]
  }
  persona: {
    tone: string
    catchphrases: string[]
    emotional_patterns: string[]
    interaction_preferences: string[]
    boundaries: string[]
  }
  cognition: {
    worldview: string
    decision_heuristics: string[]
    anti_patterns: string[]
    suggested_use_cases: string[]
  }
  source_coverage: {
    total_materials: number
    total_text_fragments: number
    evidence_types: Record<string, number>
    representative_sources: string[]
  }
  confidence: {
    overall_score: number
    notes: string[]
  }
  honest_limits: string[]
  evidence_cards: Array<{ title: string; evidence_type: string; excerpt: string }>
  safety_notice: string
  generated_at: string
}

export interface PublicCardDimensionScore {
  axis: string
  label: string
  score: number
}

export interface RelationshipComparisonPayload {
  title: string
  summary: string
  interaction_rhythm: string
  resonance_points: string[]
  tension_points: string[]
  repair_suggestions: string[]
  shared_language: string
}

export interface PublicCardPayload {
  archetype_code: string
  archetype_label: string
  archetype_alias: string
  headline: string
  summary: string
  image_hint: string
  dimension_scores: PublicCardDimensionScore[]
  card_system: string
  subject_label: string
  subject_role: "subject" | "counterpart"
  persona_code: string
  persona_slug: string
  persona_name: string
  persona_title: string
  opening_line: string
  hero_summary: string
  bridge_description: string
  sbti_lens: string
  mbti_mirrors: string[]
  mbti_highlights: string[]
  collision_notes: string[]
  soul_questions: string[]
  rarity_label: string
  rarity_percent: string
  style_theme: string
  dimension_pattern: string
  image_url: string
}

export interface IncarnationCardPayload {
  mode: DistillOutputMode
  title: string
  codename: string
  summary: string
  recommended_for: string
  aggregation_hint: string
  skill_highlights: string[]
  accent_theme: string
  selected: boolean
  share_title: string
  share_summary: string
}

export interface PrivateReportPayload {
  current_stage: string
  core_patterns: string[]
  relation_style: string[]
  decision_style: string[]
  risk_points: string[]
  adjustment_suggestions: string[]
}

export interface ActionRoutePayload {
  route_type: "expert_consult" | "self_reflection" | "material_upgrade"
  title: string
  description: string
  expert_id?: string | null
  reason?: string | null
}

export interface PersonalitySkillCardPayload {
  skill_id: string
  title: string
  subtitle: string
  match_score: number
  fit_label: string
  persona_hook: string
  reason: string
  tags: string[]
  accent_theme: string
  selected: boolean
}

export interface ExplainabilityPayload {
  confidence_score: number
  confidence_label: string
  confidence_notes: string[]
  evidence_count: number
  evidence_types: Record<string, number>
  honest_limits: string[]
}

export interface VisibilityPolicyPayload {
  shareable_sections: string[]
  private_sections: string[]
}

export interface ResultBundleResponse {
  bundle_id: string
  project_id: string
  report_version_id?: string | null
  public_card: PublicCardPayload
  incarnation_cards: IncarnationCardPayload[]
  counterpart_card?: PublicCardPayload | null
  relationship_comparison?: RelationshipComparisonPayload | null
  private_report: PrivateReportPayload
  personality_skill_cards: PersonalitySkillCardPayload[]
  action_routes: ActionRoutePayload[]
  explainability: ExplainabilityPayload
  visibility_policy: VisibilityPolicyPayload
  generated_at: string
}

export interface ReportVersionSummary {
  version_id: string
  project_id: string
  job_id?: string
  source_kind: "distill_run" | "pack_seed"
  generated_at: string
  confidence_score: number
  evidence_card_count: number
  summary: string
}

export interface ReportHistoryResponse {
  items: ReportVersionSummary[]
}

export interface PackSummary {
  slug: string
  title: string
  subtitle: string
  domain: string
  avatar_label: string
  hero_background: string
  tags: string[]
  skills: string[]
  suitable_for: string[]
  source_count: number
  source_types: Array<"web_crawl" | "user_provided" | "official" | "archive">
  factory_category: FactoryCategory
  factory_category_label: string
  display_group: DisplayGroup
  display_group_label: string
  repo_kind: RepoKind
  repo_entry_count: number
  repo_entry_preview: string[]
  repo_category_counts: Partial<Record<FactoryCategory, number>>
  repo_display_group_counts: Partial<Record<DisplayGroup, number>>
  installed: boolean
  usage_count: number
  like_count: number
  liked_by_me: boolean
  star_trend: number[]
  disclaimer: string
}

export interface PackRecommendationRequest {
  subject_name: string
  relation_label?: string
  analysis_goal?: string
  configured_names?: string[]
  selected_pack_slugs?: string[]
  limit?: number
}

export interface PackRecommendationItem {
  pack: PackSummary
  rank: number
  weight: number
  score: number
  vector_score: number
  lexical_score: number
  exact_name_hit: boolean
  matched_names: string[]
  reasons: string[]
}

export interface PackRecommendationResponse {
  query_text: string
  recommended_pack_slug?: string
  items: PackRecommendationItem[]
}

export interface PackSourceLink {
  title: string
  url: string
  source_type: "web_crawl" | "user_provided" | "official" | "archive"
}

export interface PackDetailResponse {
  pack: PackSummary
  preview_report: DistillReport
  starter_prompts: string[]
  sources: PackSourceLink[]
  related_system_packs: PackSummary[]
  related_tool_packs: PackSummary[]
}

export interface PackCloneResponse {
  project: ProjectSummary
  report: DistillReport
  reused_existing: boolean
  binding_id?: string
  binding_status?: string
  subscription_status?: string
  subscription_amount_cents?: number
  subscription_currency?: string
}

export interface PackLikeToggleResponse {
  pack: PackSummary
  liked: boolean
}

export interface GitHubPackImportResponse {
  pack: PackSummary
  preview_report: DistillReport
  starter_prompts: string[]
  sources: PackSourceLink[]
  imported_new: boolean
}

export interface GitHubPackImportJob {
  job_id: string
  repo_url: string
  import_kind: "github_repo" | "persona_lookup"
  source_label: string
  source_value: string
  status: JobStatus
  timeline: JobStatus[]
  error_message?: string
  pack_slug?: string
  pack_title?: string
  imported_new?: boolean
  imported_pack_count: number
  imported_pack_slugs: string[]
  factory_category?: FactoryCategory | null
  factory_category_label?: string | null
  display_group?: DisplayGroup | null
  display_group_label?: string | null
  repo_kind: RepoKind
  repo_entry_count: number
  repo_entry_preview: string[]
  repo_category_counts: Partial<Record<FactoryCategory, number>>
  repo_display_group_counts: Partial<Record<DisplayGroup, number>>
  created_at: string
  updated_at: string
}

export interface GitHubPackImportJobListResponse {
  items: GitHubPackImportJob[]
}

export interface PlazaPostAuthor {
  user_id: string
  nickname: string
}

export interface PlazaComment {
  comment_id: string
  post_id: string
  user_id: string
  nickname: string
  content: string
  created_at: string
}

export interface PlazaCommentListResponse {
  items: PlazaComment[]
}

export interface PlazaPost {
  post_id: string
  project_id: string
  pack_slug?: string | null
  author: PlazaPostAuthor
  title: string
  summary: string
  content: string
  image_url?: string | null
  tags: string[]
  like_count: number
  comment_count: number
  liked_by_me: boolean
  comments_preview: PlazaComment[]
  created_at: string
  updated_at: string
}

export interface PlazaPostListResponse {
  items: PlazaPost[]
}

export interface PlazaPostLikeToggleResponse {
  post: PlazaPost
  liked: boolean
}

export interface ExpertCandidate {
  expert_id: string
  name: string
  role: string
  tags: string[]
  problem_tags: string[]
  match_score: number
  reasons: string[]
  can_help_with: string[]
  source_origin: string
  trust_score: number
}

export interface ExpertCandidateListResponse {
  project_id: string
  bundle_id: string
  selected_expert_id?: string | null
  items: ExpertCandidate[]
}

export interface ChatExpertRecommendation {
  project_id: string
  session_id: string
  selected_expert_id?: string | null
  recommended_expert_id?: string | null
  recommended_switch: boolean
  reason?: string | null
  items: ExpertCandidate[]
}

export interface ExpertSelectionResponse {
  project_id: string
  bundle_id: string
  selected_expert_id: string
  selected_expert: ExpertCandidate
  updated_at: string
}

export interface ChatCitation {
  title: string
  excerpt: string
}

export interface ChatMessage {
  message_id: string
  session_id: string
  role: "user" | "assistant" | "system"
  mode: ChatMode
  kind?: string
  content: string
  citations: ChatCitation[]
  metadata?: Record<string, unknown>
  created_at: string
}

export interface ChatSessionSummary {
  session_id: string
  project_id: string
  title: string
  mode: ChatMode
  civilization_level: ChatCivilizationLevel
  sandbox_context?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ChatSessionDetailResponse {
  session: ChatSessionSummary
  project: ProjectSummary
  report: DistillReport
  messages: ChatMessage[]
  expert_recommendation?: ChatExpertRecommendation | null
}

export interface ChatSessionBootstrapResponse {
  session_detail: ChatSessionDetailResponse
  pack_detail?: PackDetailResponse | null
}

export interface ChatStreamDonePayload {
  message: ChatMessage
  notice_messages?: ChatMessage[]
  expert_recommendation?: ChatExpertRecommendation | null
}
