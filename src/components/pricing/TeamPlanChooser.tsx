'use client'

import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Check, Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CompactPrice } from '@/components/pricing/CompactPrice'
import { MfsGatewayToggle, type MfsGateway } from '@/components/pricing/MfsGatewayToggle'
import { ModelIcon } from '@/components/chat/ModelIcon'
import apiClient from '@/lib/api-client'
import { usePublicModels } from '@/hooks/usePublicModels'
import {
  buildFeatureRows, sortFeatureRows, computeTokenEquivalent, formatTokenCount, formatCompactPrice,
  PLAN_ORDER, emphasisFor, HIGHLIGHT_PRIORITY, getModelsFor,
} from '@/lib/plan-features'
import { describeError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { Package, PublicAiModel } from '@/types'

/**
 * The Team/Organization half of the plan chooser — only ever rendered for an
 * authenticated user with no existing subscription (the same gate the
 * individual PlanChooserList's currentSlug check enforces implicitly, since a
 * team purchase 409s on the same "already subscribed" rule). Mirrors
 * PlanChooserList's accordion shell (badges, model chips, feature checklist,
 * expand/collapse) so the two tabs read as the same product — only the
 * price/CTA area differs (per-seat price + seat stepper instead of a flat
 * monthly price + coupon input, which team purchases don't support).
 */
export function TeamPlanChooser({
  packages,
  isLoading,
  currency,
}: {
  packages: Package[] | undefined
  isLoading: boolean
  currency: 'USD' | 'BDT'
}) {
  const router = useRouter()
  const { models } = usePublicModels()
  const orderedTeamPackages = useMemo(
    () => PLAN_ORDER
      .map((slug) => packages?.find((p) => p.slug.toLowerCase() === slug && p.is_team_enabled))
      .filter((p): p is Package => !!p),
    [packages]
  )
  // Hardcoded to 'play' rather than derived from orderedTeamPackages — same
  // convention PlanChooserList's defaultExpandedSlug uses, and it has to be a
  // fixed slug (not computed from the async package list) since useState's
  // initializer only runs once, before packages have necessarily loaded.
  const [expandedSlug, setExpandedSlug] = useState('play')
  const [seats, setSeats] = useState<Record<string, number>>({})
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)
  // Which MFS app to actually pay through for a BDT team purchase — bKash and
  // Upay are both live now, a real choice shared across every row (unlike
  // card/MFS, which stays fully automatic per currency).
  const [mfsGateway, setMfsGateway] = useState<MfsGateway>('bkash')

  const seatsFor = (pkg: Package) => seats[pkg.slug] ?? pkg.min_team_seats

  const purchase = useMutation({
    mutationFn: async ({ pkg, seatCount }: { pkg: Package; seatCount: number }) => {
      setPendingSlug(pkg.slug)
      const useMfs = currency === 'BDT'
      return apiClient.post<{ checkout_url?: string; message?: string }>('/api/v1/subscription/team', {
        package_slug: pkg.slug,
        seat_count: seatCount,
        payment_source: useMfs ? mfsGateway : 'card',
        currency: useMfs ? 'BDT' : 'USD',
      })
    },
    onSuccess: (res) => {
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url
        return
      }
      // Fully free team package (e.g. an internal test tier) — activates synchronously.
      router.push('/chat')
    },
    onError: (err: unknown) => {
      // describeError() already surfaces the real message for a 409 (falling back to
      // a generic one only if the backend somehow sent none), so the same "already
      // subscribed" condition reads identically here and on the individual chooser.
      toast.error(describeError(err, "We couldn't start checkout — please try again.").message)
    },
    onSettled: () => setPendingSlug(null),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-card" />)}
      </div>
    )
  }

  if (orderedTeamPackages.length === 0) {
    return <p className="text-sm text-muted-foreground">No team plans are available right now.</p>
  }

  return (
    <div className="space-y-2">
      {orderedTeamPackages.map((pkg) => (
        <TeamPlanRow
          key={pkg.id}
          pkg={pkg}
          currency={currency}
          isExpanded={expandedSlug === pkg.slug.toLowerCase()}
          onToggle={() => setExpandedSlug((prev) => (prev === pkg.slug.toLowerCase() ? '' : pkg.slug.toLowerCase()))}
          allModels={models}
          seatCount={seatsFor(pkg)}
          onSeatsChange={(count) => setSeats((s) => ({ ...s, [pkg.slug]: count }))}
          onPurchase={(seatCount) => purchase.mutate({ pkg, seatCount })}
          isPending={purchase.isPending && pendingSlug === pkg.slug}
          purchaseDisabled={purchase.isPending}
          mfsGateway={mfsGateway}
          onMfsGatewayChange={setMfsGateway}
        />
      ))}
    </div>
  )
}

function TeamPlanRow({
  pkg, currency, isExpanded, onToggle, allModels, seatCount, onSeatsChange, onPurchase, isPending, purchaseDisabled,
  mfsGateway, onMfsGatewayChange,
}: {
  pkg: Package
  currency: 'USD' | 'BDT'
  isExpanded: boolean
  onToggle: () => void
  allModels: PublicAiModel[]
  seatCount: number
  onSeatsChange: (count: number) => void
  onPurchase: (seatCount: number) => void
  isPending: boolean
  purchaseDisabled: boolean
  mfsGateway: MfsGateway
  onMfsGatewayChange: (v: MfsGateway) => void
}) {
  const perSeat = currency === 'BDT' && pkg.per_seat_price.bdt !== null ? pkg.per_seat_price.bdt : (pkg.per_seat_price.usd ?? 0)
  const total = perSeat * seatCount
  const emphasis = emphasisFor(pkg.slug)
  const { visible: visibleModels, all: allPlanModels, total: totalModels, allIncluded } = useMemo(() => getModelsFor(pkg, allModels), [pkg, allModels])
  const hiddenModelCount = totalModels - visibleModels.length

  // Independent of isExpanded, same "second level" pattern as PlanChooserList's
  // PlanRow — not reset on collapse here since a team row's seat/price state
  // already persists across collapse via the parent, so there's no strong reason
  // to force this back to compact too (kept simple; can add a reset effect later
  // if this reads as a bug in practice).
  const [showAllModels, setShowAllModels] = useState(false)

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
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{pkg.description}</p>
        </div>
        <div className="shrink-0 text-right">
          <div>
            <span className="text-base font-bold text-foreground"><CompactPrice amount={perSeat} currency={currency} /></span>
            <span className="text-xs text-muted-foreground">/seat/mo</span>
          </div>
          <p className="text-[10px] text-muted-foreground" title="A reference number for how much AI usage this plan covers per seat — real usage varies by which models are actually used.">
            Up to {formatTokenCount(pkg.token_value ?? computeTokenEquivalent(pkg.price.usd))} tokens/seat
          </p>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border/60 px-3.5 pb-3.5 pt-3">
          {!showAllModels && (
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
                    // Stops propagation so this only expands the model list, never
                    // toggles the row itself closed (matches PlanChooserList's PlanRow).
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
          )}

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSeatsChange(Math.max(pkg.min_team_seats, seatCount - 1))}
                className={cn('flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent', seatCount <= pkg.min_team_seats && 'opacity-40')}
                disabled={seatCount <= pkg.min_team_seats}
                aria-label="Fewer seats"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-16 text-center text-sm font-medium">{seatCount} seat{seatCount === 1 ? '' : 's'}</span>
              <button
                type="button"
                onClick={() => onSeatsChange(seatCount + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent"
                aria-label="More seats"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Minimum {pkg.min_team_seats} seats</p>
          </div>

          {currency === 'BDT' && <MfsGatewayToggle value={mfsGateway} onChange={onMfsGatewayChange} className="mt-3" />}
          <Button
            className="mt-2 w-full rounded-full"
            disabled={purchaseDisabled}
            onClick={() => onPurchase(seatCount)}
          >
            {isPending ? 'Starting checkout…' : `Pay ${formatCompactPrice(total, currency)} with ${currency === 'BDT' ? (mfsGateway === 'bkash' ? 'bKash' : 'Upay') : 'Card (Stripe)'}`}
          </Button>

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
