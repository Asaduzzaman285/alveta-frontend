import type { Package, PublicAiModel } from '@/types'

// Re-enabled: the funding-mechanism mismatches that motivated hiding this (team
// purchases not scaling wallet credit by seat count, invite-accept/top-up
// approval manufacturing money instead of transferring it, no protection for
// seats paid for but not yet filled) are fixed as of the wallet-service
// protected_floor/transfer() work and subscription-service's computeWalletCredit()
// seat-count scaling. Flip back to false to hide everything again in one place if
// a new mismatch turns up: the Welcome/Settings plan choosers' Individual/Team
// toggle, TeamPlanChooser, and SettingsModal's Team tab all key off this one flag.
export const TEAM_FEATURE_ENABLED = true

export interface FeatureRow {
  key: string
  label: string
  available: boolean
}

/** Fixed comparison order — every card/row/table renders from this same master
 * list, showing available (✓) rows first and unavailable (✗) rows after (see
 * sortFeatureRows), both in this relative order. This is what makes a
 * differently-shaped ordering per plan (e.g. Basic showing IDE Integration
 * before Image Generation, Standard showing the reverse) come out correctly
 * without hand-tuning each card: it's the same list, just partitioned by
 * availability. The first three rows are universal platform behavior (every
 * subscriber gets AI chat, instant top-up, and pay-as-you-go usage beyond
 * their plan credit) rather than a `Package['features']` flag, so they're
 * always available and never sourced from `pkg`.
 *
 * Shared by PricingCard (landing/Welcome/Settings cards) and PlanChooserList
 * (the compact plan-picker list + its comparison table) — one master list so
 * a feature added/renamed here shows up identically everywhere. */
export function buildFeatureRows(pkg: Package): FeatureRow[] {
  return [
    { key: 'ai_chat', label: 'AI Chat Module', available: true },
    { key: 'topup', label: 'Top-up Instantly', available: true },
    { key: 'unlimited_usage', label: 'Unlimited Usage (Pay as you go)', available: true },
    { key: 'ide_integration', label: 'IDE Integration', available: pkg.features.ide_integration },
    { key: 'prompt_library', label: 'Prompt Library', available: pkg.features.prompt_library },
    { key: 'support', label: pkg.features.support_tier === 'priority' ? 'Priority Support' : 'Standard Support', available: true },
    { key: 'image_gen', label: 'Image Generation', available: pkg.features.image_gen },
    { key: 'video_gen', label: 'Video Generation', available: pkg.features.video_gen },
    { key: 'voice_gen', label: 'Voice Generation', available: pkg.features.voice_gen },
    { key: 'api_access', label: 'API Access', available: pkg.features.api_access },
  ]
}

export function sortFeatureRows(rows: FeatureRow[]): FeatureRow[] {
  return [...rows.filter((r) => r.available), ...rows.filter((r) => !r.available)]
}

// Fixed display order + which slug gets the "Popular" emphasis — same convention
// established everywhere plans render (landing PricingSection, WelcomePricingSection,
// Settings > Plans, PlanChooserList, TeamPlanChooser): Play is "Most Popular",
// case-insensitive since it's the one slug that isn't lowercase in the real data.
export const PLAN_ORDER = ['basic', 'play', 'standard', 'pro']
export function emphasisFor(slug: string): 'popular' | 'subtle' | 'none' {
  const s = slug.toLowerCase()
  return s === 'play' ? 'popular' : s === 'pro' ? 'subtle' : 'none'
}

// Which 2 differentiating capabilities to surface inline on an expanded row —
// the universal ones (AI chat/top-up/unlimited usage/support) are the same on
// every plan, so they don't help someone choosing between plans here (the full
// breakdown is still one click away via "Compare all features"/"Show all").
export const HIGHLIGHT_PRIORITY = ['image_gen', 'api_access', 'video_gen', 'voice_gen', 'ide_integration', 'prompt_library']

// Plain function, not a hook — called from inside a .map() in a row list, where a
// variable number of per-row hook calls would violate the Rules of Hooks.
export function getModelsFor(pkg: Package | undefined, allModels: PublicAiModel[]) {
  if (!pkg) return { visible: [] as PublicAiModel[], all: [] as PublicAiModel[], total: 0, allIncluded: false }
  const byId = new Map(allModels.map((m) => [m.model_id, m]))
  const infos = pkg.model_access.map((id) => byId.get(id)).filter((m): m is PublicAiModel => !!m)
  return { visible: infos.slice(0, 2), all: infos, total: infos.length, allIncluded: allModels.length > 0 && infos.length >= allModels.length }
}

// Compact price display (৳499 / $19) rather than formatCurrency()'s wallet-balance
// style (BDT 499.00) — a whole sticker price never needs trailing ".00" here, but
// a fractional one (e.g. a promo price) still shows its cents.
export function formatCompactPrice(amount: number, currency: 'USD' | 'BDT'): string {
  const symbol = currency === 'BDT' ? '৳' : '$'
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `${symbol}${formatted}`
}

// GPT-4o-mini's real published rates ($0.15/1M input, $0.60/1M output) blended at a
// 2:1 input:output mix — a realistic real-world chat pattern (more prompt/context
// than reply) — confirmed with the user as the internal reference basis for a
// per-package "how much AI usage is this" number, computed the same way for every
// package regardless of which real models that package actually grants (an
// apples-to-apples baseline, not a claim about any specific model the user will
// actually use). This model is an internal calibration detail only — by explicit
// request, the customer-facing UI never names it, just shows the resulting token
// count as "Up to N tokens" (see computeTokenEquivalent below and every component
// that reads pkg.token_value). REFERENCE_MODEL_LABEL exists for code comments/admin
// tooling only; do not render it in customer-facing copy.
//   blended_rate = (2/3 × $0.15) + (1/3 × $0.60) = $0.30 per 1M tokens
export const REFERENCE_MODEL_BLENDED_RATE_PER_MILLION = (2 / 3) * 0.15 + (1 / 3) * 0.6
export const REFERENCE_MODEL_LABEL = 'GPT-4o-mini'

// Always computed from the package's currency-agnostic `price.usd` — not whichever
// currency is currently displayed — so the number doesn't change depending on the
// viewer's own currency preference; the underlying value proposition is the same
// regardless of which currency someone happens to be quoted in.
export function computeTokenEquivalent(priceUsd: number): number {
  return Math.round((priceUsd / REFERENCE_MODEL_BLENDED_RATE_PER_MILLION) * 1_000_000)
}

/**
 * Same 2:1 input:output blend as REFERENCE_MODEL_BLENDED_RATE_PER_MILLION
 * above, parameterized by a REAL model's own rates instead of the fixed
 * GPT-4o-mini reference — used by the Wallet tab's token-purchase estimate,
 * which (unlike a package's advertised "Up to N tokens" figure) is about one
 * specific model the user actually picked, not a generic calibration point.
 */
export function blendedRatePerMillion(inputRatePerMillion: number, outputRatePerMillion: number): number {
  return (2 / 3) * inputRatePerMillion + (1 / 3) * outputRatePerMillion
}

export function computeTokensForAmount(amountUsd: number, inputRatePerMillion: number, outputRatePerMillion: number): number {
  const blended = blendedRatePerMillion(inputRatePerMillion, outputRatePerMillion)
  return blended > 0 ? Math.round((amountUsd / blended) * 1_000_000) : 0
}

const tokenCountFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export function formatTokenCount(n: number): string {
  return tokenCountFormatter.format(n)
}
