'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PlanChooserList } from '@/components/pricing/PlanChooserList'
import { TeamPlanChooser } from '@/components/pricing/TeamPlanChooser'
import { MfsGatewayToggle, type MfsGateway } from '@/components/pricing/MfsGatewayToggle'
import type { AppliedCoupon } from '@/components/pricing/CouponInput'
import apiClient from '@/lib/api-client'
import { formatDate, cn } from '@/lib/utils'
import { formatCompactPrice, TEAM_FEATURE_ENABLED } from '@/lib/plan-features'
import { describeError } from '@/lib/errors'
import { useAuthStore } from '@/stores/auth-store'
import { useCurrentSubscription } from '@/hooks/useCurrentSubscription'
import type { Package } from '@/types'

/** Shared by the Settings modal's Plans tab — extracted from the old standalone /pricing route.
 * Presentation is the same PlanChooserList used by the Welcome screen's plan panel (compact
 * expandable rows + a comparison table), rendered inline here rather than in a slide-over —
 * this tab is already inside its own Settings modal, so a second overlay on top would be one
 * modal too many. */
export function PlansView() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  // Card always charges USD, bKash always charges BDT — see renderCta() below,
  // which now only ever offers the one path this account's preferred_currency
  // maps to (2026-09-16: card blocked for BDT, bKash blocked for USD).
  const displayCurrency = user?.preferred_currency === 'USD' ? 'USD' : 'BDT'
  // Which MFS app to actually pay through for a BDT checkout — bKash and Upay
  // are both live now, so this is a real choice (unlike card vs. MFS, which
  // stays fully automatic per currency, see the comment below).
  const [mfsGateway, setMfsGateway] = useState<MfsGateway>('bkash')
  // Identifies exactly which package/action is in flight — not just the package,
  // since only the one actually clicked should ever show its own "…ing" loading
  // text; other packages' rows stay interactive.
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  // Mirrors PlanChooserPanel's own toggle — this tab is the only *recurring* place
  // an already-registered user can reach a team purchase at all, since the Welcome
  // page's identical toggle only ever shows once (see (dashboard)/welcome/page.tsx's
  // own doc comment: it redirects there only when !user.welcome_seen_at, and marks
  // it seen on mount). Without this, team plans became permanently unreachable for
  // anyone past their first sign-in.
  const [mode, setMode] = useState<'individual' | 'team'>('individual')

  const { data: packages, isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: async () => (await apiClient.get<{ packages: Package[] }>('/api/v1/packages')).data.packages,
  })

  const { data: subscriptionData, isLoading: subscriptionLoading } = useCurrentSubscription()
  const subscription = subscriptionData?.subscription
  // A team MEMBER's /subscription resolves to the ADMIN's own row (see
  // resolveSubscription()'s org-membership fallback on the backend) — it's
  // not theirs to upgrade/cancel/coupon. cancel()/upgrade() are already
  // own-row-only server-side so a member's click would just 404, but showing
  // the full chooser+CTA here at all would be confusing regardless — a plain
  // read-only summary is what actually matches what they can do.
  const isOrgMember = subscriptionData?.organization_role === 'member'
  const hasTeamPlans = TEAM_FEATURE_ENABLED && (packages ?? []).some((p) => p.is_team_enabled)

  // Wallet is deliberately not a payment_source here — wallet balance (topped
  // up directly or granted as a plan allowance) is meant for AI-usage
  // spending, not for funding the subscription itself. A $0 package still
  // activates with no payment step at all — that's handled entirely
  // server-side, not a client-visible "source" choice.
  const subscribe = useMutation({
    mutationFn: async ({ slug, source, currency, couponCode }: { slug: string; source: 'card' | 'bkash' | 'upay'; currency: 'USD' | 'BDT'; couponCode?: string }) => {
      setPendingSlug(slug)
      return apiClient.post<{ checkout_url?: string }>('/api/v1/subscription/subscribe', {
        package_slug: slug,
        payment_source: source,
        currency,
        // Re-validated server-side regardless — see WelcomePricingSection's
        // identical comment on this same call shape.
        ...(couponCode ? { coupon_code: couponCode } : {}),
      })
    },
    onSuccess: (res) => {
      if (res.data.checkout_url) {
        // Card/bKash path — nothing is activated yet, /billing/checkout-callback
        // verifies the payment and activates the package once the gateway confirms it.
        window.location.href = res.data.checkout_url
        return
      }
      toast.success('Subscribed! Your AI credit has been credited.')
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      // Without this, chat/page.tsx's useAvailableModels() kept serving the pre-purchase
      // model list from cache — the newly-unlocked models (and the chat access that
      // depends on there being at least one available model) only showed up after a
      // full reload, which creates a brand-new React Query client from scratch.
      // Confirmed live: purchasing a plan left chat unusable until a manual reload.
      queryClient.invalidateQueries({ queryKey: ['models'] })
    },
    onError: (err: unknown) => {
      const { ambiguous, message } = describeError(
        err,
        "We didn't hear back in time — check your current plan below before subscribing again."
      )
      toast.error(message)
      if (ambiguous) {
        queryClient.invalidateQueries({ queryKey: ['subscription'] })
        queryClient.invalidateQueries({ queryKey: ['wallet'] })
        queryClient.invalidateQueries({ queryKey: ['models'] })
      }
    },
    onSettled: () => setPendingSlug(null),
  })

  // Upgrade charges the full new plan price immediately via a real gateway (card
  // or bKash) — wallet is deliberately not an option here, unlike a fresh
  // subscribe: wallet balance (topped up directly or granted as a plan
  // allowance) is meant for AI-usage spending, not for self-funding an upgrade
  // with credit that was itself a free perk.
  const changePlan = useMutation({
    mutationFn: async ({ slug, source, currency }: { slug: string; source: 'card' | 'bkash' | 'upay'; currency: 'USD' | 'BDT' }) => {
      setPendingSlug(slug)
      return apiClient.post<{ checkout_url?: string; message?: string }>('/api/v1/subscription/upgrade', {
        package_slug: slug,
        payment_source: source,
        currency,
      })
    },
    onSuccess: (res) => {
      if (res.data.checkout_url) {
        // Card/bKash upgrade — nothing applied yet, /billing/checkout-callback
        // verifies the payment and applies the upgrade once the gateway confirms it.
        window.location.href = res.data.checkout_url
        return
      }
      toast.success('Upgraded successfully.')
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      queryClient.invalidateQueries({ queryKey: ['models'] })
    },
    onError: (err: unknown) => {
      const { ambiguous, message } = describeError(
        err,
        "We didn't hear back in time — check your current plan below before trying again."
      )
      toast.error(message)
      if (ambiguous) {
        queryClient.invalidateQueries({ queryKey: ['subscription'] })
        queryClient.invalidateQueries({ queryKey: ['wallet'] })
        queryClient.invalidateQueries({ queryKey: ['models'] })
      }
    },
    onSettled: () => setPendingSlug(null),
  })

  const cancelSubscription = useMutation({
    mutationFn: async () => apiClient.post<{ access_until: string }>('/api/v1/subscription/cancel', {}),
    onSuccess: (res) => {
      toast.success(`Your plan will end on ${formatDate(res.data.access_until)}. You'll keep access until then.`)
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      setCancelConfirmOpen(false)
    },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — check your plan status before trying again.").message),
  })

  // Auto-renewal only ever charges a saved card — bKash/MFS has no recurring
  // auto-debit yet, so a BDT subscriber hits past_due on literally every
  // cycle with nothing to retry. This opens a real checkout instead (same
  // card-or-bKash path a fresh subscribe uses), rather than waiting on the
  // background job's own 24h-apart saved-card retries. Only ever called while
  // status === 'past_due' — see renderCta()'s own branch below.
  const retryRenewal = useMutation({
    mutationFn: async ({ source, currency }: { source: 'card' | 'bkash' | 'upay'; currency: 'USD' | 'BDT' }) =>
      apiClient.post<{ checkout_url?: string }>('/api/v1/subscription/retry-renewal', {
        payment_source: source,
        currency,
      }),
    onSuccess: (res) => {
      if (res.data.checkout_url) {
        // Nothing renewed yet — /billing/checkout-callback verifies the payment
        // and extends the subscription once the gateway confirms it, same as
        // every other checkout-funded flow in this view.
        window.location.href = res.data.checkout_url
        return
      }
    },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — check your plan status before trying again.").message),
  })

  // Card vs. MFS is still tied strictly to the account's preferred_currency
  // (2026-09-16 request) — no USD-vs-BDT gateway picker, the row's own expand
  // (PlanChooserList) already serves as the "see details before committing"
  // step. Within BDT specifically, bKash vs. Upay IS a real user choice now
  // (MfsGatewayToggle, rendered below) — both are live MFS options, unlike
  // card/MFS which stays fully automatic.
  const renderCta = (pkg: Package, isCurrent: boolean, appliedCoupon: AppliedCoupon | null) => {
    if (isCurrent) {
      // Renewal failed (no saved card, decline, MFS auto-debit not built yet —
      // see retryRenewal's own comment) — offer a real checkout instead of a
      // dead "Current plan" button and silent waiting for the next 24h
      // background retry.
      if (subscription?.status === 'past_due') {
        const useMfsRenew = displayCurrency === 'BDT'
        return (
          <div className="space-y-1.5">
            {useMfsRenew && <MfsGatewayToggle value={mfsGateway} onChange={setMfsGateway} />}
            <Button
              className="w-full rounded-full"
              disabled={retryRenewal.isPending}
              onClick={() => retryRenewal.mutate(useMfsRenew ? { source: mfsGateway, currency: 'BDT' } : { source: 'card', currency: 'USD' })}
            >
              {retryRenewal.isPending ? 'Starting checkout…' : 'Renew now'}
            </Button>
          </div>
        )
      }

      return (
        <Button className="w-full rounded-full" variant="outline" disabled>
          Current plan
        </Button>
      )
    }

    const currentPrice = subscription?.package?.monthly_price_usd
    const isUpgrade = currentPrice !== undefined && pkg.price.usd > currentPrice
    // Downgrade UI removed for now (2026-09-02) — changePlan and the backend
    // endpoint are untouched, this just hides the entry point for a lower-priced
    // plan than the current one.
    if (subscription && !isUpgrade) return null

    const useMfs = displayCurrency === 'BDT'
    const mutation = subscription ? changePlan : subscribe
    const isBusy = mutation.isPending && pendingSlug === pkg.slug
    const verb = subscription ? 'Upgrading' : 'Subscribing'
    const basePrice = useMfs ? (pkg.price.bdt ?? pkg.price.usd) : pkg.price.usd
    // appliedCoupon only ever arrives here for a genuine subscribe (PlanChooserList
    // only renders CouponInput when couponsEnabled, which is passed below as
    // !subscription) — an upgrade row never has one to begin with.
    const displayPrice = appliedCoupon ? appliedCoupon.finalPrice : basePrice

    // Two distinct mutate() calls rather than one through the shared `mutation`
    // variable — subscribe's payload takes an optional couponCode, changePlan's
    // doesn't, and calling through a union-typed variable with a coupon-shaped
    // object literal doesn't type-check cleanly against both signatures at once.
    const doMutate = () => {
      if (subscription) {
        changePlan.mutate(useMfs ? { slug: pkg.slug, source: mfsGateway, currency: 'BDT' } : { slug: pkg.slug, source: 'card', currency: 'USD' })
      } else {
        subscribe.mutate(
          useMfs
            ? { slug: pkg.slug, source: mfsGateway, currency: 'BDT', couponCode: appliedCoupon?.code }
            : { slug: pkg.slug, source: 'card', currency: 'USD', couponCode: appliedCoupon?.code }
        )
      }
    }

    return (
      <div className="space-y-1.5">
        {useMfs && <MfsGatewayToggle value={mfsGateway} onChange={setMfsGateway} />}
        <Button
          className="w-full rounded-full"
          disabled={mutation.isPending}
          onClick={doMutate}
        >
          {isBusy
            ? `${verb}…`
            : useMfs
              ? `Pay ${formatCompactPrice(displayPrice, 'BDT')} with ${mfsGateway === 'bkash' ? 'bKash' : 'Upay'}`
              : `Pay ${formatCompactPrice(displayPrice, 'USD')} with Card (Stripe)`}
        </Button>
      </div>
    )
  }

  // Rendering the chooser before this resolves shows a subscriber the brand-new-user
  // view (no "Current plan", a coupon field, a plain "Pay" button) for a beat — and
  // PlanChooserList used to lock its expanded row onto that wrong transient state.
  if (subscriptionLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    )
  }

  if (isOrgMember) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your plan</h2>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm">
            You have access through your team&apos;s <strong>{subscription?.package?.name}</strong> plan.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Only your team&apos;s admin can change or cancel this subscription, add seats, or invite more members.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Subscribing and upgrading always charge the full plan price right away — never from your AI
        credit, which is reserved for AI usage.
      </p>

      {subscription?.scheduled_package && (
        <div className="rounded-md border border-border bg-accent/50 p-4 text-sm">
          You&apos;re switching to <strong>{subscription.scheduled_package.name}</strong> on{' '}
          {formatDate(subscription.renews_at)}. You keep your current plan&apos;s access until then.
        </div>
      )}

      {/* Team purchase only makes sense before someone has any individual
          subscription — a team purchase 409s on the same "already subscribed"
          rule once they do, same precondition TeamPlanChooser's own doc comment
          states. Hiding the toggle in that case avoids a guaranteed dead end. */}
      {!subscription && hasTeamPlans && (
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(['individual', 'team'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {m === 'individual' ? 'Individual' : 'Team/Organization'}
            </button>
          ))}
        </div>
      )}

      {mode === 'team' && !subscription && hasTeamPlans ? (
        <TeamPlanChooser packages={packages} isLoading={isLoading} currency={displayCurrency} />
      ) : (
        <PlanChooserList
          packages={packages}
          isLoading={isLoading}
          currency={displayCurrency}
          currentSlug={subscription?.package?.slug ?? null}
          renderCta={renderCta}
          defaultExpandedSlug={subscription?.package?.slug?.toLowerCase() ?? 'play'}
          couponsEnabled={!subscription}
        />
      )}

      {subscription && !subscription.cancelled_at && (
        <div className="flex items-center justify-between rounded-md border border-border p-4">
          <div>
            <p className="text-sm font-medium">Cancel subscription</p>
            <p className="text-xs text-muted-foreground">
              You&apos;ll keep access until the end of your current billing cycle ({formatDate(subscription.renews_at)}).
              {subscription.organization_id && ' Everyone on your team loses access on that date too.'}
            </p>
          </div>
          <Button variant="destructive" disabled={cancelSubscription.isPending} onClick={() => setCancelConfirmOpen(true)}>
            {cancelSubscription.isPending ? 'Cancelling…' : 'Cancel'}
          </Button>
          <ConfirmDialog
            open={cancelConfirmOpen}
            onOpenChange={setCancelConfirmOpen}
            title="Cancel subscription"
            description={`You'll keep access until ${formatDate(subscription.renews_at)}, then lose it.${subscription.organization_id ? ' Everyone on your team loses access on that date too.' : ''} This can't be undone.`}
            confirmLabel="Cancel subscription"
            pendingLabel="Cancelling…"
            isPending={cancelSubscription.isPending}
            onConfirm={() => cancelSubscription.mutate()}
          />
        </div>
      )}

      {subscription?.cancelled_at && (
        <p className="text-sm text-muted-foreground">
          Your subscription is set to end on {formatDate(subscription.renews_at)}.
          {subscription.organization_id
            ? ' Everyone on your team loses access then too.'
            : hasTeamPlans && ' Want a team plan instead? You can start one once this plan ends.'}
        </p>
      )}
    </div>
  )
}
