// ─── Auth ──────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  avatar_url: string | null
  preferred_currency: 'USD' | 'BDT'
  // model_id string, or null to use the current plan's own admin-set default —
  // see ai-gateway's ModelController for where the two get resolved into one.
  default_model_id: string | null
  email_verified_at: string | null
  has_password: boolean
  google_connected: boolean
  is_admin: boolean
  admin_role: string | null
  admin_permissions: string[]
  welcome_seen_at: string | null
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  expires_in: number
}

// ─── Subscription ──────────────────────────────────────────────────────────
// Shapes below match services/subscription-service/app/Http/Controllers/V1/*
// exactly (PackageController + SubscriptionController::formatSubscription()).

export interface PackageFeatures {
  file_upload: boolean
  api_access: boolean
  comparison: boolean
  image_gen: boolean
  audio: boolean
  vision: boolean
  // Added for the marketing team's proposed package table (2026-09) — video_gen
  // and voice_gen are real capability flags (no generation backend exists for
  // either yet; the checkbox exists so packages are already correctly
  // configured the moment one ships). ide_integration and prompt_library are
  // pure entitlement flags with no backing feature to gate today, same as
  // api_access was originally. support_tier isn't boolean — every package
  // needs exactly one of the two tiers, not an on/off toggle.
  video_gen: boolean
  voice_gen: boolean
  ide_integration: boolean
  prompt_library: boolean
  support_tier: 'standard' | 'priority'
}

export interface Package {
  id: string
  name: string
  slug: 'basic' | 'standard' | 'pro'
  description: string
  price: { usd: number; bdt: number | null }
  wallet_credit_usd: number
  // Independent of wallet_credit_usd, same relationship as price.bdt has to
  // price.usd — an admin-typed BDT credit granted on a bKash purchase, not
  // derived from any formula. Null when unset, same fallback rule as
  // price.bdt: PricingCard/PackageActivationService fall back to the USD
  // figure whenever this is null.
  wallet_credit_bdt: number | null
  features: PackageFeatures
  model_access: string[]
  // Which of model_access's image-generation-type models this package's
  // subscribers get automatically inside plain chat, with no picker shown there.
  // Null when the package grants no image model at all (image generation is
  // disabled for it). The dedicated Images workspace's model dropdown also
  // defaults to this, letting the user explicitly switch to any other granted
  // image model for one specific generation.
  default_image_model_id: string | null
  // Same purpose as default_image_model_id, for the Designs workspace's
  // conversational/tool-calling model — an admin-set, cost-aware choice instead
  // of pickGenerationModel()'s "first available model" fallback. Null falls back
  // to that generic pick.
  default_design_model_id: string | null
  // Admin-editable, pre-filled at creation from an internal blended-rate formula
  // (see computeTokenEquivalent in plan-features.ts) but stored/real from then on —
  // the display components read this, not a live calculation. Shown to customers
  // only as "Up to N tokens", never with a model name attached.
  token_value: number | null
  // Team/Organization seat-based pricing — independent of price.usd/bdt above
  // (see Package::perSeatPrice()), only meaningful when is_team_enabled is true.
  is_team_enabled: boolean
  per_seat_price: { usd: number | null; bdt: number | null }
  min_team_seats: number
}

/** Package shape as embedded inside a Subscription — a narrower projection than the standalone Package. */
export interface SubscriptionPackage {
  id: string
  name: string
  slug: 'basic' | 'standard' | 'pro'
  monthly_price_usd: number
  model_access: string[]
  features: PackageFeatures
}

export interface Subscription {
  id: string
  status: 'active' | 'past_due' | 'cancelled' | 'expired'
  auto_renew: boolean
  currency: string
  activated_at: string
  renews_at: string
  cancelled_at: string | null
  package: SubscriptionPackage | null
  // Set only when a downgrade is scheduled — takes effect at renews_at.
  scheduled_package: { id: string; name: string; slug: string } | null
  // Set only on a TEAM subscription — this row belongs to the purchasing
  // admin and IS the org's billing record (see OrganizationController).
  organization_id: string | null
  seat_count: number | null
  pending_seat_count: number | null
}

// ─── Organizations (Team plans) ────────────────────────────────────────────

export interface OrganizationMember {
  id: string
  user_id: string
  role: 'admin' | 'member'
  status: 'invited' | 'active' | 'removed'
  invited_email: string | null
  invited_at: string
  joined_at: string | null
  removed_at: string | null
  name: string | null
  email: string | null
}

export interface OrganizationDetail {
  organization: { id: string; name: string | null; default_member_credit_usd: number | null }
  seat_count: number | null
  pending_seat_count: number | null
  occupied_seats: number
  members: OrganizationMember[]
  // Which gateway/currency this org's subscription actually bills in — null only
  // when there's no subscription at all. See ManageTeamView's increaseSeats use.
  currency: string | null
}

export interface InviteInfo {
  valid: boolean
  email?: string
  has_password?: boolean
}

export interface TopupRequest {
  id: string
  user_id: string
  amount: string
  note: string | null
  status: 'pending' | 'approved' | 'denied'
  approved_by: string | null
  approved_at: string | null
  created_at: string
  name: string | null
  email: string | null
}

// ─── Wallet ────────────────────────────────────────────────────────────────
// GET /wallet and GET /wallet/credit are two separate endpoints — combine
// client-side if a page needs both balance and credit-buffer info at once.

export interface WalletBalance {
  balance: number
  reserved_balance: number
  available_balance: number
  currency: string
}

export interface AutoDebitSettings {
  enabled: boolean
  threshold_usd: number
  topup_amount_usd: number
  payment_method_id: string | null
}

export interface WalletCreditStatus {
  credit_balance: number
  credit_limit: number
  remaining_credit: number
  in_credit: boolean
}

export interface LedgerEntry {
  id: string
  wallet_id: string
  user_id: string
  type: 'credit' | 'debit' | 'refund' | 'credit_recovered' | 'credit_used' | 'admin_adjustment'
  amount: string
  balance_before: string
  balance_after: string
  description: string
  reference_type: string | null
  reference_id: string | null
  currency: string
  exchange_rate: string
  created_at: string
}

// ─── Usage ─────────────────────────────────────────────────────────────────
// Aggregates come back from Postgres SUM()/decimal columns as strings via the
// pgsql PDO driver, same reason LedgerEntry's amount/balance fields are strings.

export interface UsageSummaryModel {
  model_id: string
  name: string
  provider: string
  prompt_tokens: string
  completion_tokens: string
  total_tokens: string
  cost: string
}

export interface UsageSummary {
  period: '7d' | '30d' | 'all'
  models: UsageSummaryModel[]
  totals: { total_tokens: string; cost: string }
}

export interface UsageLogEntry {
  id: string
  model: { id: string; provider: string; name: string; model_id: string } | null
  operation_type: string
  status: string
  total_tokens: number
  actual_cost: string
  created_at: string
}

// ─── Payment ───────────────────────────────────────────────────────────────

export interface Transaction {
  id: string
  user_id: string
  type: 'subscription_purchase' | 'wallet_topup' | 'refund'
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'refund_pending'
  // 'amount'/'currency' are always the internal USD bookkeeping value, even
  // for a bKash purchase (payment-service's own Transaction convention) — the
  // real amount actually charged, for a bKash row, is metadata.amount_bdt.
  // Never live-reconvert these for display (see BillingView.tsx) — a
  // transaction is a frozen historical fact, not an ongoing balance.
  amount: string
  currency: string
  gateway: string
  gateway_reference: string | null
  description: string | null
  error_message: string | null
  metadata: { amount_bdt?: number; is_sandbox?: boolean; package_slug?: string } | null
  completed_at: string | null
  failed_at: string | null
  created_at: string
  // Admin listings only — payment-service resolves this from auth-service in one
  // bulk call per page. Absent on the customer-facing /transactions listing, where
  // every row belongs to the caller anyway.
  user?: { name: string | null; email: string | null } | null
}

export interface PaymentMethod {
  id: string
  gateway: string
  type: string
  last_four: string | null
  card_brand: string | null
  expires_at: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
}

// ─── Billing ───────────────────────────────────────────────────────────────

export interface Invoice {
  id: string
  invoice_number: string
  type: string
  amount: string
  currency: string
  total_amount: string
  status: string
  issued_at: string
}

export interface Receipt {
  id: string
  receipt_number: string
  type: string
  amount: string
  currency: string
  issued_at: string
}

// ─── AI Models ─────────────────────────────────────────────────────────────

export interface AiModel {
  id: string
  provider: 'openai' | 'anthropic' | 'gemini' | 'xai' | 'elevenlabs' | 'deepseek' | 'perplexity' | 'qwen' | 'moonshot'
  name: string
  model_id: string
  type: 'text' | 'image_generation' | 'audio_tts' | 'audio_stt' | 'embedding'
  description: string | null
  context_window: number | null
  max_output_tokens: number | null
  capabilities: {
    streaming: boolean
    function_calling: boolean
    vision: boolean
    file_upload: boolean
    // Both optional — most models have neither. Composer toggles (Deep Think, Web
    // Search) only render when the active model's capabilities say true; see
    // ChatController::stream()'s own re-derivation of these server-side, which is the
    // real enforcement boundary, not this flag alone.
    web_search?: boolean
    reasoning?: boolean
    // Admin-controlled grouping for the Models popup ("Flagship Models" vs "More
    // Models") — a real, settable field (admin/ai-models form), not a hardcoded
    // frontend list. Everything renders under "More Models" until an admin sets this.
    flagship?: boolean
  }
  available: boolean  // Based on the caller's current subscription package
  // Resolved server-side by ModelCapabilityResolver — the same rule ChatController
  // enforces, so a toggle shown as available here can't be refused by the server.
  // `reason` is populated only when unsupported, and is written for the user to read
  // in a tooltip on the disabled control.
  features?: {
    deep_think: { supported: boolean; reason: string | null }
    web_search: { supported: boolean; reason: string | null }
  }
  pricing: {
    input_rate_per_million: string
    output_rate_per_million: string
    currency: string
  } | null
}

// GET /models/public's shape — deliberately smaller than AiModel above: no
// `available`/package data (meaningless without a logged-in user's plan), used only
// by the landing page's unauthenticated navbar Models popup.
export interface PublicAiModel {
  id: string
  model_id: string
  provider: AiModel['provider']
  name: string
  capabilities: AiModel['capabilities']
  pricing: {
    input_rate_per_million: string
    output_rate_per_million: string
    currency: string
  } | null
}

// ─── Chat ──────────────────────────────────────────────────────────────────

export interface ChatSession {
  id: string
  model_id: string
  // Free to move between projects (or out, via null) after creation — unlike
  // is_private below, which is locked at creation and enforced server-side.
  project_id: string | null
  title: string
  status: 'active' | 'archived'
  message_count: number
  total_cost: number
  // Set once at creation, never changed afterward — enforced server-side, not just
  // an unused field on the client. expires_at is null for non-private chats.
  is_private: boolean
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  color: string | null
  sessions_count: number
  // Added alongside the Images/Designs grouping extension — 0 for a project
  // created before that, never missing from a real API response.
  images_count: number
  designs_count: number
  created_at: string
  updated_at: string
}

// ─── Images & Designs workspaces ────────────────────────────────────────────
// See aichathub/plans/images-designs-workspaces.md.

export interface GeneratedImage {
  id: string
  session_id: string | null
  message_id: string | null
  // Which Project (see above) this image is grouped under, if any — assigned
  // after generation via FileAttachmentController::assignProject(), never at
  // generation time. Do not confuse with DesignProject below, an unrelated
  // "project" concept.
  project_id: string | null
  original_name: string
  mime_type: string
  file_size: number
  storage_url: string
  provider: string | null
  model: string | null
  original_prompt: string | null
  parent_asset_id: string | null
  root_asset_id: string | null
  generation_metadata: Record<string, unknown> | null
  created_at: string
}

export interface DesignVersion {
  id: string
  design_project_id: string
  parent_version_id: string | null
  prompt: string
  model: string | null
  attachment_id: string
  attachment?: { id: string; storage_url: string; original_name: string }
  created_at: string
}

export interface DesignProject {
  id: string
  user_id: string
  // The grouping Project (see above) this design belongs to, if any — an
  // unrelated concept to this type's own name; DesignProject is one design's
  // version history, not a grouping folder.
  project_id: string | null
  title: string
  current_version_id: string | null
  current_version?: DesignVersion
  versions?: DesignVersion[]
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  model_id: string | null
  content: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  // Laravel's `decimal:6` cast serializes to a JSON string ("0.016709"), not a
  // number — confirmed live (a real crash: calling .toFixed() on it throws, since
  // strings don't have that method). Always run this through Number(...) before
  // any arithmetic or formatting.
  cost: string
  created_at: string
  // is_chosen — set via "Choose the best" (PATCH /sessions/{id}/messages/{id}/choose)
  // on exactly one message within a compare_group_id group; see
  // lib/tokenEstimate.ts's collapseCompareGroups() for how this is used to decide
  // what a compare turn contributes to future context.
  // error — set when a compare turn's model failed (see ChatController::compare()'s
  // catch block); content is a placeholder single space in that case, never real
  // text — always check this field first, never render content directly for a
  // compare-group message without checking it.
  metadata: { compare_group_id?: string; type?: 'compaction_summary'; is_chosen?: boolean; error?: string } | null
  // Populated server-side once a message with attachment_ids is persisted — previously
  // always empty/absent since nothing wrote file_attachments.message_id at all, so an
  // uploaded image reached the model fine but never showed up again in the history.
  attachments?: FileAttachment[]
}

export interface FileAttachment {
  id: string
  session_id: string | null
  original_name: string
  mime_type: string
  file_size: number
  storage_url: string
  created_at: string
  // 'chat_generation' for an AI-generated image/file, null/undefined for a plain
  // user upload — already returned as-is by chat-service (FileAttachment model's
  // own $fillable, nothing hidden), just not previously read on the frontend.
  source?: string | null
}

// ─── Admin ─────────────────────────────────────────────────────────────────
// Shapes match the real admin endpoints exactly (verified live) — note these
// do NOT use PaginatedResponse<T> below; every admin list endpoint returns
// { <resource_key>: T[], meta: AdminMeta }, no `per_page` in meta.

export interface AdminMeta {
  current_page: number
  last_page: number
  total: number
}

/** One row of GET /transactions/admin/topups/summary — a user, not a transaction. */
export interface TopupSummary {
  user_id: string
  user: { name: string | null; email: string | null } | null
  total_amount: number
  topup_count: number
  last_topup_at: string
}

export interface Coupon {
  id: string
  code: string
  description: string | null
  discount_type: 'percentage' | 'flat'
  discount_percentage: string | null
  discount_amount_usd: string | null
  discount_amount_bdt: string | null
  max_redemptions: number | null
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  created_at: string
  packages: { id: string; name: string; slug: string }[]
  redemptions_count?: number
}

export interface AdminUserSummary {
  id: string
  name: string
  email: string
  phone: string | null
  status: string
  email_verified_at: string | null
  last_login_at: string | null
  created_at: string
}

export interface AdminUser {
  id: string
  user_id: string
  role: string
  permissions: string[]
  is_active: boolean
  created_at: string
  user: { id: string; name: string; email: string }
}

/**
 * Raw Eloquent shape returned by the admin package endpoints (store/update/
 * adminIndex) — deliberately NOT the same shape as the public Package type
 * above (index()/show() hand-map to `price: {usd,bdt}`/`wallet_credit_usd`;
 * the admin endpoints return the model's real column names untouched).
 */
export interface AdminPackage {
  id: string
  name: string
  slug: string
  description: string | null
  monthly_price_usd: string
  monthly_price_bdt: string | null
  monthly_wallet_credit_usd: string
  monthly_wallet_credit_bdt: string | null
  credit_buffer_percentage: string
  model_access: string[]
  default_image_model_id: string | null
  default_design_model_id: string | null
  token_value: number | null
  features: PackageFeatures
  is_active: boolean
  sort_order: number
  created_at: string
  is_team_enabled: boolean
  per_seat_price_usd: string | null
  per_seat_price_bdt: string | null
  min_team_seats: number
}

export interface Role {
  id: string
  name: string
  permissions: string[]
  admin_count: number
  created_at: string
}

export interface AdminSubscription extends Subscription {
  user_id: string
  // Resolved by subscription-service from auth-service in one bulk call per page;
  // null when that lookup failed, in which case the table shows user_id instead.
  user: { name: string | null; email: string | null } | null
}

export interface AuditLogEntry {
  id: string
  admin_user_id: string | null
  actor_type: string
  action: string
  resource_type: string
  resource_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  admin_user: (AdminUser & { user: { id: string; name: string; email: string } }) | null
}

export interface AdminUsageLog {
  id: string
  user_id: string
  session_id: string | null
  model_id: string
  operation_type: string
  status: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost: string
  actual_cost: string
  currency: string
  duration_ms: number | null
  created_at: string
  model: { id: string; provider: string; name: string; model_id: string } | null
  // Cross-referenced server-side from auth-service — null if that lookup failed
  // or the user no longer exists, in which case the raw user_id is the fallback.
  user: { name: string | null; email: string | null } | null
}

export interface AdminModelPricing {
  pricing_type: 'token_based' | 'flat_per_image' | 'character_based' | 'per_minute'
  input_rate_per_million: string | null
  output_rate_per_million: string | null
  flat_rate_per_unit: string | null
  provider_input_rate_per_million: string | null
  provider_output_rate_per_million: string | null
  provider_flat_rate_per_unit: string | null
  markup_percentage: string | null
  currency: string
}

export interface AdminAiModel {
  id: string
  provider: string
  name: string
  model_id: string
  type: 'text' | 'image_generation' | 'audio_tts' | 'audio_stt' | 'embedding'
  description: string | null
  context_window: number | null
  max_output_tokens: number | null
  capabilities: Record<string, boolean>
  is_active: boolean
  quality: string | null
  created_at: string
  pricing: AdminModelPricing | null
}

export interface AdminCurrencyRate {
  exchange_rate: string
  margin_percentage: string
  tax_percentage: string
  vat_percentage: string
  withholding_tax_percentage: string
  effective_rate: string
  effective_from: string
}

export interface AdminCurrency {
  id: string
  code: string
  name: string
  symbol: string
  decimal_places: number
  is_active: boolean
  created_at: string
  rate: AdminCurrencyRate | null
}

export interface AuthAdminDashboard {
  total_users: number
  active_users: number
  suspended_users: number
  pending_verification: number
  new_registrations_7d: number
  new_registrations_30d: number
}

export interface SubscriptionAdminDashboard {
  active_subscriptions: number
  past_due_subscriptions: number
  scheduled_downgrades: number
  plan_breakdown: Record<string, number>
}

export interface PaymentAdminDashboard {
  total_revenue: number
  completed_count: number
  failed_count: number
  pending_count: number
  refunded_count: number
  gateway_breakdown: { gateway: string; count: number; total: string }[]
}

export interface WalletAdminDashboard {
  total_balance: number
  total_credit_owed: number
  deposits_30d: number
  withdrawals_30d: number
  admin_adjustments_30d: number
}

export interface AiAdminDashboard {
  total_tokens_7d: number
  total_cost_7d: number
  failed_requests_7d: number
  provider_breakdown: Record<string, { requests: number; tokens: number; cost: number }>
  provider_health: { model: string | null; provider: string | null; state: string }[]
}

// ─── API Responses ─────────────────────────────────────────────────────────

export interface ApiError {
  message: string
  error?: string
  errors?: Record<string, string[]>
  reason?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}
