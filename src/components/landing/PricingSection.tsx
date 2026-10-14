'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import { PricingCard } from '@/components/pricing/PricingCard'
import { cn } from '@/lib/utils'
import type { Package } from '@/types'

export function PricingSection() {
  const [mode, setMode] = useState<'individual' | 'team'>('individual')
  // Public, unauthenticated fetch — see api-gateway/routes/api.php's explicit
  // GET /packages route carved out of the auth-required group for this reason.
  // detected_currency comes from the visitor's IP (Cloudflare's CF-IPCountry
  // header, read server-side in subscription-service's PackageController) —
  // 'BDT' for a Bangladeshi visitor, 'USD' for everyone else. Purely
  // informational display for an anonymous visitor; an authenticated user's
  // stored preferred_currency (set at registration, same geo logic) takes
  // over once they're logged in — see WelcomePricingSection/PlansView.
  const { data, isLoading } = useQuery({
    queryKey: ['packages', 'public'],
    queryFn: async () => (await apiClient.get<{ packages: Package[]; detected_currency: 'USD' | 'BDT' }>('/api/v1/packages')).data,
  })
  const packages = data?.packages
  const currency = data?.detected_currency ?? 'USD'
  const hasTeamPlans = (packages ?? []).some((p) => p.is_team_enabled)

  return (
    <section id="pricing" className="px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Pay for AI. Not Subscriptions.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-neutral-500">
          Choose the plan that suits you best and unlock the power of AI. Confused about the plan? Then start with the Play package.
        </p>

        {hasTeamPlans && (
          <div className="mx-auto mt-8 flex w-fit gap-1 rounded-full border border-neutral-200 bg-neutral-50 p-1">
            {(['individual', 'team'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  mode === m ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                )}
              >
                {m === 'individual' ? 'Individual' : 'Team/Organization'}
              </button>
            ))}
          </div>
        )}

        {mode === 'individual' ? (
          // All 4 real packages in one compact row (Basic, Play, Standard, Pro) — Play
          // sits second and is the "Most Popular" card, Pro gets the subtle lavender
          // treatment, matching the current Figma pricing layout.
          <div className="mx-auto mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-96 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />
              ))
            ) : (
              // Explicit order rather than however the API happens to return them.
              // Note: "Play" is the one slug that isn't lowercase in the actual data
              // (confirmed via GET /packages) — matched case-insensitively so this
              // doesn't silently break if that's ever corrected server-side.
              ['basic', 'play', 'standard', 'pro']
                .map((slug) => packages?.find((pkg) => pkg.slug.toLowerCase() === slug))
                .filter((pkg): pkg is Package => !!pkg)
                .map((pkg) => {
                  const slug = pkg.slug.toLowerCase()
                  const emphasis: 'popular' | 'subtle' | 'none' = slug === 'play' ? 'popular' : slug === 'pro' ? 'subtle' : 'none'
                  return (
                    <PricingCard
                      key={pkg.id}
                      pkg={pkg}
                      emphasis={emphasis}
                      currency={currency}
                      cta={
                        <Link
                          href={`/register?package=${pkg.slug}`}
                          className={cn(
                            'flex h-9 w-full items-center justify-center rounded-full text-sm font-semibold transition-colors',
                            emphasis === 'popular'
                              ? 'bg-primary text-primary-foreground hover:opacity-90'
                              : 'border border-neutral-300 text-neutral-900 hover:bg-neutral-50'
                          )}
                        >
                          Get Started
                        </Link>
                      }
                    />
                  )
                })
            )}
          </div>
        ) : (
          // Marketing/browsing view only — an anonymous visitor can't actually check
          // out yet (subscribing needs an account). Register first, then pick the
          // real package + seat count in the post-signup Welcome screen, where
          // TeamPlanChooser does the actual purchase. Same PricingCard as the
          // individual grid (models/features/badges included) so the two tabs read
          // as the same product — only the price block differs (see teamPricing prop).
          <div className="mx-auto mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-96 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />
              ))
            ) : (
              ['basic', 'play', 'standard', 'pro']
                .map((slug) => packages?.find((pkg) => pkg.slug.toLowerCase() === slug && pkg.is_team_enabled))
                .filter((pkg): pkg is Package => !!pkg)
                .map((pkg) => {
                  const slug = pkg.slug.toLowerCase()
                  const emphasis: 'popular' | 'subtle' | 'none' = slug === 'play' ? 'popular' : slug === 'pro' ? 'subtle' : 'none'
                  const perSeat = currency === 'BDT' && pkg.per_seat_price.bdt !== null ? pkg.per_seat_price.bdt : (pkg.per_seat_price.usd ?? 0)
                  return (
                    <PricingCard
                      key={pkg.id}
                      pkg={pkg}
                      emphasis={emphasis}
                      currency={currency}
                      teamPricing={{ perSeat, minSeats: pkg.min_team_seats }}
                      cta={
                        <Link
                          href={`/register?package=${pkg.slug}&team=1`}
                          className={cn(
                            'flex h-9 w-full items-center justify-center rounded-full text-sm font-semibold transition-colors',
                            emphasis === 'popular'
                              ? 'bg-primary text-primary-foreground hover:opacity-90'
                              : 'border border-neutral-300 text-neutral-900 hover:bg-neutral-50'
                          )}
                        >
                          Get Started
                        </Link>
                      }
                    />
                  )
                })
            )}
          </div>
        )}
      </div>
    </section>
  )
}
