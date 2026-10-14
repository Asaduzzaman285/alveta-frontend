'use client'

import { type ReactNode, useMemo, useState } from 'react'
import { Check, X, ChevronDown, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePublicModels } from '@/hooks/usePublicModels'
import { buildFeatureRows, sortFeatureRows, computeTokenEquivalent, formatTokenCount } from '@/lib/plan-features'
import { ModelIcon } from '@/components/chat/ModelIcon'
import { CompactPrice } from '@/components/pricing/CompactPrice'
import type { Package, PublicAiModel } from '@/types'

/** Shared by the public landing page's PricingSection (CTA links to /register), the
 * post-registration Welcome screen, and Settings → Plans (CTA routes into the real
 * subscribe/upgrade flow instead) — same card, different call-to-action wired in by
 * the caller. */
export function PricingCard({
  pkg,
  emphasis = 'none',
  cta,
  currency = 'USD',
  teamPricing,
}: {
  pkg: Package
  // 'popular' — Play's card: purple "Most Popular" header strip, white body, a
  //   stronger purple border, purple-filled CTA (the caller supplies that CTA's
  //   own color; this component only controls the header strip + border).
  // 'subtle' — Pro's card: a soft lavender body, no header strip, same neutral
  //   CTA treatment as an unemphasized card. Kept visually distinct from
  //   'popular' on purpose — two cards using the same strong treatment reads as
  //   meaningless (confirmed live in an earlier pass at this component).
  // 'none' — Basic/Standard: plain white card, neutral border.
  emphasis?: 'popular' | 'subtle' | 'none'
  cta: ReactNode
  // Informational display only — a BD visitor/user sees the package's own fixed
  // BDT sticker price here, but the currency actually charged at checkout is
  // decided by which payment method they pick (bKash -> BDT, card -> USD), not
  // by this prop. Falls back to USD whenever a package has no BDT sticker price
  // set (monthly_price_bdt is nullable).
  currency?: 'USD' | 'BDT'
  // When set, replaces the flat "Starts from $X/mo" block with a per-seat price
  // + seat stepper (browsing/estimating only — the landing page can't actually
  // check out a team purchase pre-registration, so this never needs to report
  // the chosen seat count back to the caller; the real purchase flow re-asks for
  // seat count in TeamPlanChooser after sign-up). Everything else about the card
  // (models, features, badges) is identical to the individual card on purpose —
  // team and individual plans are the same product, just billed differently.
  teamPricing?: { perSeat: number; minSeats: number }
}) {
  const displayCurrency = currency === 'BDT' && pkg.price.bdt !== null ? 'BDT' : 'USD'
  const displayPrice = displayCurrency === 'BDT' ? pkg.price.bdt! : pkg.price.usd
  const [teamSeats, setTeamSeats] = useState(teamPricing?.minSeats ?? 1)

  // Real model names (with provider, for the small icon), not just a count — a
  // visitor comparing plans previously had no way to see WHICH models a plan
  // actually includes. usePublicModels() is the same unauthenticated endpoint the
  // landing navbar's model showcase already uses, so this works pre-signup too.
  const { models } = usePublicModels()
  const modelInfos = useMemo(() => {
    const byId = new Map(models.map((m) => [m.model_id, m]))
    return pkg.model_access.map((id) => byId.get(id)).filter((m): m is PublicAiModel => !!m)
  }, [models, pkg.model_access])
  const allModelsIncluded = models.length > 0 && modelInfos.length >= models.length
  const visibleModels = modelInfos.slice(0, 3)
  const remainingModels = modelInfos.length - visibleModels.length
  // Overlay, not natural push-down expansion — these cards render side by side
  // in a row and are meant to stay equal height (confirmed: the whole point of
  // this layout). The Welcome plan drawer's rows use natural vertical expansion
  // instead, since drawer rows aren't laid out side by side — see PlanChooserList.
  const [modelsExpanded, setModelsExpanded] = useState(false)

  const sortedFeatureRows = sortFeatureRows(buildFeatureRows(pkg))

  const isPopular = emphasis === 'popular'
  const isSubtle = emphasis === 'subtle'

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border bg-white text-left',
        isPopular ? 'border-2 border-primary shadow-lg shadow-primary/10' : isSubtle ? 'border-primary/20 bg-primary/5' : 'border-neutral-200'
      )}
    >
      {isPopular && (
        <div className="bg-primary py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
          Most Popular
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold text-neutral-900">{pkg.name}</h3>
        <p className="mt-1 text-xs text-neutral-500">{pkg.description}</p>

        {teamPricing ? (
          <>
            <p className="mt-3 text-xs font-medium text-neutral-500">Per seat, monthly</p>
            <p className="text-2xl font-bold tracking-tight text-neutral-900">
              <CompactPrice amount={teamPricing.perSeat} currency={displayCurrency} />
              <span className="ml-1 text-xs font-medium text-neutral-400">/seat/mo</span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTeamSeats((s) => Math.max(teamPricing.minSeats, s - 1))}
                className={cn('flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 hover:bg-neutral-50', teamSeats <= teamPricing.minSeats && 'opacity-40')}
                disabled={teamSeats <= teamPricing.minSeats}
                aria-label="Fewer seats"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-xs font-medium text-neutral-700">{teamSeats} seat{teamSeats === 1 ? '' : 's'}</span>
              <button
                type="button"
                onClick={() => setTeamSeats((s) => s + 1)}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 hover:bg-neutral-50"
                aria-label="More seats"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              <CompactPrice amount={teamPricing.perSeat * teamSeats} currency={displayCurrency} />/mo total · minimum {teamPricing.minSeats} seats
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 text-xs font-medium text-neutral-500">Starts from</p>
            <p className="text-2xl font-bold tracking-tight text-neutral-900">
              <CompactPrice amount={displayPrice} currency={displayCurrency} />
              <span className="ml-1 text-xs font-medium text-neutral-400">/mo</span>
            </p>
          </>
        )}
        {/* A reference number, not a literal cap — admin-editable and stored on the
            package (pkg.token_value), pre-filled from an internal baseline formula
            so every package starts apples-to-apples, but an admin's override always
            wins. Falls back to a live calc only if the stored value is somehow
            missing (e.g. stale cached data from before this field existed).
            Deliberately names no model — by explicit request, customers only ever
            see the resulting token count, never what it was calibrated against. */}
        <p className="mt-1 text-[11px] text-neutral-500" title="A reference number for how much AI usage this plan covers — your real usage varies by which models you actually use.">
          Up to {formatTokenCount(pkg.token_value ?? computeTokenEquivalent(pkg.price.usd))} tokens{teamPricing ? '/seat' : ''}
        </p>

        <div className="mt-4">{cta}</div>

        {modelInfos.length > 0 && (
          <div className="relative mt-4">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">AI Models</span>
                <span className="text-[11px] font-semibold text-primary">
                  {allModelsIncluded ? 'All Models Included' : `Up to ${modelInfos.length} Models`}
                </span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {visibleModels.map((m) => (
                  <li key={m.model_id} className="flex items-center gap-1.5 text-xs text-neutral-700">
                    <ModelIcon provider={m.provider} className="h-4 w-4" />
                    {m.name}
                  </li>
                ))}
              </ul>
              {remainingModels > 0 && (
                // A real button, not static text — opens the overlay below.
                // Absolutely-positioned floating panel (not natural expansion)
                // so this card's rendered height never changes and every card in
                // the row stays aligned — see PricingSection's own grid.
                <button
                  type="button"
                  onClick={() => setModelsExpanded(true)}
                  className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-primary"
                >
                  {remainingModels}+ More
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
            </div>

            {modelsExpanded && (
              <div className="absolute inset-x-0 top-0 z-20 max-h-72 overflow-y-auto rounded-xl border border-primary/30 bg-white p-3 shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">AI Models</span>
                  <button
                    type="button"
                    onClick={() => setModelsExpanded(false)}
                    aria-label="Close"
                    className="text-neutral-400 hover:text-neutral-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {modelInfos.map((m) => (
                    <li key={m.model_id} className="flex items-center gap-1.5 text-xs text-neutral-700">
                      <ModelIcon provider={m.provider} className="h-4 w-4" />
                      {m.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <ul className="mt-4 space-y-2 text-xs text-neutral-600">
          {sortedFeatureRows.map((row) => (
            <li key={row.key} className={cn('flex items-center gap-2', !row.available && 'text-neutral-400')}>
              {row.available ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
              )}
              {row.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
