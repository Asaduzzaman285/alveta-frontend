'use client'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildFeatureRows, sortFeatureRows, computeTokenEquivalent, formatTokenCount,
  PLAN_ORDER, emphasisFor, HIGHLIGHT_PRIORITY, getModelsFor,
} from '@/lib/plan-features'
import { usePublicModels } from '@/hooks/usePublicModels'
import { ModelIcon } from '@/components/chat/ModelIcon'
import { CouponInput, type AppliedCoupon } from '@/components/pricing/CouponInput'
import { CompactPrice } from '@/components/pricing/CompactPrice'
import type { Package, PublicAiModel } from '@/types'

/** The compact plan-picker: a list of collapsible rows (one plan expanded at a
 * time) plus an optional full comparison table — built to match a Claude Design
 * mockup the user provided (a "Choose your plan" slide-over with this exact
 * list+expand+table shape). Real package data throughout (names/prices/model
 * access/features come straight from the API) — only the INTERACTION PATTERN
 * was taken from the mockup, not its placeholder numbers (confirmed with the
 * user: the mockup's $1/$5/$10/$40 and 6/10/11/20+ figures were illustrative).
 *
 * Shared by the Welcome screen's PlanChooserPanel (a slide-over) and Settings →
 * Plans (rendered inline, no panel wrapper) — same list, different container. */
export function PlanChooserList({
  packages,
  isLoading,
  currency,
  currentSlug = null,
  renderCta,
  defaultExpandedSlug = 'play',
  couponsEnabled = true,
}: {
  packages: Package[] | undefined
  isLoading: boolean
  currency: 'USD' | 'BDT'
  /** The account's current package slug, if any — shown as "Current plan". */
  currentSlug?: string | null
  /** Renders the row's CTA button/state — subscribe vs upgrade vs "Current plan"
   * differs by context (Welcome vs Settings), so the caller owns that logic.
   * appliedCoupon is whatever CouponInput above it last validated for THIS
   * package (or null) — the caller reads it to show the discounted price and
   * pass coupon_code through to subscribe(). */
  renderCta: (pkg: Package, isCurrent: boolean, appliedCoupon: AppliedCoupon | null) => ReactNode
  defaultExpandedSlug?: string
  /** Off for Settings → Plans when the account already has a subscription — a
   * coupon only ever applies to a first subscribe() (see CouponService's own
   * scope), never an upgrade, so showing the field there would offer something
   * that silently does nothing. Welcome's caller never has an existing
   * subscription in the first place, so it never needs to pass this. */
  couponsEnabled?: boolean
}) {
  const [expandedSlug, setExpandedSlug] = useState(defaultExpandedSlug)
  // defaultExpandedSlug is only a real value once its own query has resolved —
  // PlansView passes subscription?.package?.slug ?? 'play', which reads as
  // 'play' on the very first render whenever the subscription fetch is still
  // in flight (a real, common race, not just a slow-network edge case). Without
  // this sync, that transient 'play' got baked into useState's initializer
  // forever: once the real subscription loaded a beat later, the accordion
  // stayed stuck open on Play instead of the account's actual current plan,
  // hiding its "Current plan" badge and any other row's upgrade CTA behind the
  // wrong row (confirmed live — reported as "wrong plan selected, no upgrade
  // option"). Only auto-syncs until the user actually clicks a row themselves;
  // untouchedRef stops it from fighting a deliberate manual expand/collapse.
  const untouchedRef = useRef(true)
  useEffect(() => {
    if (untouchedRef.current) setExpandedSlug(defaultExpandedSlug)
  }, [defaultExpandedSlug])
  const [showCompare, setShowCompare] = useState(false)
  const { models } = usePublicModels()

  const orderedPackages = useMemo(
    () => PLAN_ORDER.map((slug) => packages?.find((p) => p.slug.toLowerCase() === slug)).filter((p): p is Package => !!p),
    [packages]
  )

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-2">
        {orderedPackages.map((pkg) => (
          <PlanRow
            key={pkg.id}
            pkg={pkg}
            currency={currency}
            isCurrent={currentSlug !== null && pkg.slug.toLowerCase() === currentSlug.toLowerCase()}
            isExpanded={expandedSlug === pkg.slug.toLowerCase()}
            onToggle={() => {
              untouchedRef.current = false
              setExpandedSlug((prev) => (prev === pkg.slug.toLowerCase() ? '' : pkg.slug.toLowerCase()))
            }}
            allModels={models}
            cta={renderCta}
            couponsEnabled={couponsEnabled}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowCompare((v) => !v)}
        className="mt-4 flex w-full items-center justify-between border-t border-border pt-3 text-sm"
      >
        <span>
          <span className="font-medium text-foreground">Compare all features</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {buildFeatureRows(orderedPackages[0] ?? ({ features: {} } as Package)).length + 1} capabilities across all
            {' '}{orderedPackages.length} plans
          </span>
        </span>
        {showCompare ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {showCompare && orderedPackages.length > 0 && (
        <ComparisonTable packages={orderedPackages} allModels={models} />
      )}
    </div>
  )
}

function PlanRow({
  pkg, currency, isCurrent, isExpanded, onToggle, allModels, cta, couponsEnabled,
}: {
  pkg: Package
  currency: 'USD' | 'BDT'
  isCurrent: boolean
  isExpanded: boolean
  onToggle: () => void
  allModels: PublicAiModel[]
  cta: (pkg: Package, isCurrent: boolean, appliedCoupon: AppliedCoupon | null) => ReactNode
  couponsEnabled: boolean
}) {
  const displayCurrency = currency === 'BDT' && pkg.price.bdt !== null ? 'BDT' : 'USD'
  // Reset whenever this row collapses — same "don't remember stale expanded state"
  // rule as showAllModels below. A coupon validated for THIS package shouldn't
  // silently carry over if the shopper closes this row and opens a different plan.
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)
  const displayPrice = displayCurrency === 'BDT' ? pkg.price.bdt! : pkg.price.usd
  const { visible: visibleModels, all: allPlanModels, total: totalModels, allIncluded } = useMemo(() => getModelsFor(pkg, allModels), [pkg, allModels])
  const hiddenModelCount = totalModels - visibleModels.length
  const emphasis = emphasisFor(pkg.slug)

  // Separate from `isExpanded` (which row is open at all — the accordion state
  // owned by PlanChooserList) — this is "has the OPEN row's own model/feature
  // list been expanded further," a second, independent level. Reset whenever
  // the row itself collapses so re-opening it later starts compact again,
  // rather than remembering a stale "was showing everything" state.
  const [showAllModels, setShowAllModels] = useState(false)
  useEffect(() => {
    if (!isExpanded) {
      setShowAllModels(false)
      setAppliedCoupon(null)
    }
  }, [isExpanded])

  const sortedFeatureRows = useMemo(() => sortFeatureRows(buildFeatureRows(pkg)), [pkg])
  const highlightRows = useMemo(() => {
    const byKey = new Map(sortedFeatureRows.filter((r) => r.available).map((r) => [r.key, r]))
    const picked = HIGHLIGHT_PRIORITY.map((k) => byKey.get(k)).filter((r): r is NonNullable<typeof r> => !!r)
    return picked.slice(0, 2)
  }, [sortedFeatureRows])

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border transition-colors',
        isExpanded ? 'border-primary bg-primary/5' : 'border-border bg-card'
      )}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3.5 text-left">
        <span
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
            isExpanded ? 'border-primary' : 'border-muted-foreground/40'
          )}
        >
          {isExpanded && <span className="h-2 w-2 rounded-full bg-primary" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{pkg.name}</span>
            {emphasis === 'popular' && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Popular
              </span>
            )}
            {isCurrent && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Current plan
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{pkg.description}</p>
        </div>
        <div className="shrink-0 text-right">
          <div>
            <span className="text-base font-bold text-foreground"><CompactPrice amount={displayPrice} currency={displayCurrency} /></span>
            <span className="text-xs text-muted-foreground">/mo</span>
          </div>
          {/* Same admin-editable, stored pkg.token_value as PricingCard — falls back
              to a live calc only if the stored value is somehow missing. */}
          <p className="text-[10px] text-muted-foreground" title="A reference number for how much AI usage this plan covers — your real usage varies by which models you actually use.">
            Up to {formatTokenCount(pkg.token_value ?? computeTokenEquivalent(pkg.price.usd))} tokens
          </p>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border/60 px-3.5 pb-3.5 pt-3">
          {!showAllModels ? (
            <>
              {visibleModels.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {visibleModels.map((m) => (
                    <span key={m.model_id} className="flex items-center gap-1 rounded-full bg-background px-2 py-1 text-xs text-foreground">
                      <ModelIcon provider={m.provider} className="h-3.5 w-3.5" />
                      {m.name}
                    </span>
                  ))}
                  {hiddenModelCount > 0 && (
                    // A real button, not static text — clicking it must only expand
                    // this row's own detail (never select/pay/close), so it stops
                    // the click from bubbling up to the row's own onToggle above.
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowAllModels(true) }}
                      className="rounded-full bg-background px-2 py-1 text-xs font-medium text-primary hover:underline"
                    >
                      {allIncluded ? 'All models' : `+${hiddenModelCount} More`}
                    </button>
                  )}
                </div>
              )}

              {highlightRows.length > 0 && (
                <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {highlightRows.map((row) => (
                    <li key={row.key} className="flex items-center gap-1.5 text-xs text-foreground">
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {row.label}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}

          {/* No coupon field for a plan the account is already on — nothing to
              discount, and the backend's own subscribe() gate rejects a repeat
              subscription outright regardless. Also off entirely when the caller
              passes couponsEnabled={false} (Settings → Plans for an account with
              an existing subscription — an upgrade, which the backend's coupon
              support was never wired into). */}
          {!isCurrent && couponsEnabled && (
            <div className="mt-3">
              <CouponInput packageSlug={pkg.slug} currency={displayCurrency} onApplied={setAppliedCoupon} />
            </div>
          )}

          {/* CTA stays in this one fixed spot regardless of showAllModels — kept
              visually separated from the models/features detail below it, per
              explicit request, rather than interleaved or reshuffled by expansion. */}
          <div className={isCurrent ? 'mt-3' : ''}>{cta(pkg, isCurrent, appliedCoupon)}</div>

          {showAllModels && (
            <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
              {allPlanModels.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">AI Models</p>
                  <ul className="mt-2 space-y-1.5">
                    {allPlanModels.map((m) => (
                      <li key={m.model_id} className="flex items-center gap-1.5 text-xs text-foreground">
                        <ModelIcon provider={m.provider} className="h-3.5 w-3.5" />
                        {m.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Included Features</p>
                <ul className="mt-2 space-y-1.5">
                  {sortedFeatureRows.map((row) => (
                    <li key={row.key} className={cn('flex items-center gap-1.5 text-xs', row.available ? 'text-foreground' : 'text-muted-foreground')}>
                      {row.available ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : (
                        <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                      )}
                      {row.label}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowAllModels(false) }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Show Less
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ComparisonTable({ packages, allModels }: { packages: Package[]; allModels: PublicAiModel[] }) {
  const referenceRows = buildFeatureRows(packages[0])

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Capability</th>
            {packages.map((pkg) => (
              <th key={pkg.id} className="px-2 py-2 text-center font-medium text-foreground">{pkg.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border/60">
            <td className="py-2 pr-3 text-muted-foreground">Models included</td>
            {packages.map((pkg) => {
              const { total } = getModelsFor(pkg, allModels)
              return (
                <td key={pkg.id} className="px-2 py-2 text-center tabular-nums text-foreground">
                  {total}
                </td>
              )
            })}
          </tr>
          {referenceRows.map((refRow) => (
            <tr key={refRow.key} className="border-b border-border/60 last:border-0">
              <td className="py-2 pr-3 text-muted-foreground">{refRow.label}</td>
              {packages.map((pkg) => {
                const available = buildFeatureRows(pkg).find((r) => r.key === refRow.key)?.available ?? false
                return (
                  <td key={pkg.id} className="px-2 py-2 text-center">
                    {available ? <Check className="mx-auto h-3.5 w-3.5 text-primary" /> : <span className="text-muted-foreground/40">—</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
