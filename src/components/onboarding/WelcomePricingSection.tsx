'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
import apiClient from '@/lib/api-client'
import { consumeIntendedPackage } from '@/lib/intended-package'
import { PlanChooserPanel } from '@/components/pricing/PlanChooserPanel'
import { MfsGatewayToggle, type MfsGateway } from '@/components/pricing/MfsGatewayToggle'
import type { AppliedCoupon } from '@/components/pricing/CouponInput'
import { Button } from '@/components/ui/Button'
import { describeError } from '@/lib/errors'
import { formatCompactPrice } from '@/lib/plan-features'
import { useAuthStore } from '@/stores/auth-store'
import type { Package } from '@/types'

/** A slim banner (matches the Claude Design mockup's Welcome-screen "Plans start
 * at…" bar) that opens PlanChooserPanel — replaces the old inline 4-card grid
 * this component used to render directly on the page. Payment logic (currency
 * lock, checkout mutation) is unchanged from before, just relocated into the
 * panel's per-row CTA instead of a per-card CTA. */
export function WelcomePricingSection() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const displayCurrency = user?.preferred_currency === 'USD' ? 'USD' : 'BDT'
  // Which MFS app to actually pay through for a BDT subscribe — bKash and
  // Upay are both live now, a real choice (unlike card/MFS, which stays fully
  // automatic per currency).
  const [mfsGateway, setMfsGateway] = useState<MfsGateway>('bkash')
  const [panelOpen, setPanelOpen] = useState(false)
  // Pre-selects whatever package the visitor clicked before registering (see
  // register/page.tsx and intended-package.ts) by opening straight into the
  // panel with that plan already expanded — one-shot read.
  const [intendedSlug] = useState<string | null>(() => consumeIntendedPackage())
  useEffect(() => {
    if (intendedSlug) setPanelOpen(true)
  }, [intendedSlug])

  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const { data: packages, isLoading } = useQuery({
    queryKey: ['packages', 'public'],
    queryFn: async () => (await apiClient.get<{ packages: Package[] }>('/api/v1/packages')).data.packages,
  })

  const cheapestPrice = useMemo(() => {
    if (!packages?.length) return null
    const prices = packages.map((p) => (displayCurrency === 'BDT' && p.price.bdt !== null ? p.price.bdt : p.price.usd))
    return Math.min(...prices)
  }, [packages, displayCurrency])

  const subscribe = useMutation({
    mutationFn: async (
      { slug, source, currency, key, couponCode }: { slug: string; source: 'card' | 'bkash' | 'upay'; currency: 'USD' | 'BDT'; key: string; couponCode?: string }
    ) => {
      setPendingKey(key)
      return apiClient.post<{ checkout_url?: string }>('/api/v1/subscription/subscribe', {
        package_slug: slug,
        payment_source: source,
        currency,
        // Re-validated server-side regardless (SubscriptionController::subscribe()
        // calls CouponService::resolve() again before charging anything) — this is
        // only ever advisory, the same "preview isn't the source of truth" rule the
        // preview endpoint's own docblock states.
        ...(couponCode ? { coupon_code: couponCode } : {}),
      })
    },
    onSuccess: (res) => {
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url
        return
      }
      // Free ($0) package — activates synchronously, nothing to redirect to.
      router.push('/chat')
    },
    onError: (err: unknown) => {
      const { message, code } = describeError(err, "We couldn't start checkout — please try again.")
      // Already subscribed (e.g. re-opening this popup after subscribing once) isn't a
      // real error from this screen's point of view — just get them into the app. Other
      // 409s (plan still running out, access through a team) need their message shown.
      if (code === 'already_subscribed') {
        router.push('/chat')
        return
      }
      toast.error(message)
    },
    onSettled: () => setPendingKey(null),
  })

  // Card vs. MFS is still tied strictly to preferred_currency — at explicit
  // request (2026-09-16): a BDT-preferring account can no longer pay by card, a
  // USD-preferring account can no longer pay by MFS. Within BDT, bKash vs.
  // Upay IS a real choice now (MfsGatewayToggle below).
  const renderCta = (pkg: Package, isCurrent: boolean, appliedCoupon: AppliedCoupon | null) => {
    if (isCurrent) {
      return (
        <Button className="w-full rounded-full" variant="outline" disabled>
          Current plan
        </Button>
      )
    }
    const useMfs = displayCurrency === 'BDT'
    const key = useMfs ? `${mfsGateway}-BDT` : 'card-USD'
    const isPending = subscribe.isPending && pendingKey === key
    const basePrice = useMfs ? (pkg.price.bdt ?? pkg.price.usd) : pkg.price.usd
    // finalPrice came back from THIS package's own preview call (CouponInput passes
    // packageSlug down), so it's already priced in the right currency — no
    // conversion needed here, just a straight substitution for the base figure.
    const displayPrice = appliedCoupon ? appliedCoupon.finalPrice : basePrice
    return (
      <div className="space-y-1.5">
        {useMfs && <MfsGatewayToggle value={mfsGateway} onChange={setMfsGateway} />}
        <Button
          className="w-full rounded-full"
          disabled={subscribe.isPending}
          onClick={() => subscribe.mutate(
            useMfs
              ? { slug: pkg.slug, source: mfsGateway, currency: 'BDT', key, couponCode: appliedCoupon?.code }
              : { slug: pkg.slug, source: 'card', currency: 'USD', key, couponCode: appliedCoupon?.code }
          )}
        >
          {isPending
            ? 'Starting checkout…'
            : `Pay ${formatCompactPrice(displayPrice, useMfs ? 'BDT' : 'USD')} with ${useMfs ? (mfsGateway === 'bkash' ? 'bKash' : 'Upay') : 'Card (Stripe)'}`}
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {cheapestPrice !== null ? `Plans start at ${formatCompactPrice(cheapestPrice, displayCurrency)}/mo` : 'Flexible plans for every stage'}
            , then pay as you go
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Change or cancel any time.</p>
        </div>
        <Button onClick={() => setPanelOpen(true)} className="gap-1.5 rounded-full">
          <Sparkles className="h-3.5 w-3.5" />
          View plans
        </Button>
      </div>

      <PlanChooserPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        packages={packages}
        isLoading={isLoading}
        currency={displayCurrency}
        renderCta={renderCta}
        defaultExpandedSlug={intendedSlug ?? undefined}
      />
    </div>
  )
}
