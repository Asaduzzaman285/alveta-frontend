'use client'

import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import type { Package } from '@/types'

export function IntegrationsSection() {
  // Same public, unauthenticated fetch and query key as PricingSection — reuses
  // that same cache entry (React Query dedupes by key), so mounting both on one
  // page still only fires one real network request. detected_currency comes
  // from the visitor's IP (Cloudflare's CF-IPCountry header, read server-side
  // in subscription-service's PackageController), 'BDT' for a Bangladeshi
  // visitor, 'USD' for everyone else (including geolocation being off/blocked —
  // the backend's own fallback, not something this component decides). The two
  // graphics differ only in which currency's pricing they show painted into the
  // image itself, so the image needs to track the same signal the real pricing
  // cards below it already do.
  const { data } = useQuery({
    queryKey: ['packages', 'public'],
    queryFn: async () => (await apiClient.get<{ packages: Package[]; detected_currency: 'USD' | 'BDT' }>('/api/v1/packages')).data,
  })
  const isBd = (data?.detected_currency ?? 'USD') === 'BDT'

  return (
    <section className="px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            One Subscription.
            <br />
            Save Up To 90%.
          </h2>
          <p className="max-w-sm text-sm text-neutral-500 sm:text-base">
            Replace multiple AI subscriptions with one simple plan and access the AI models you need, all from Alveta.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border border-neutral-100 bg-gradient-to-b from-primary/5 to-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static marketing
              graphic already exported at its final size; next/image's optimization
              pipeline buys nothing extra for a single fixed asset like this. */}
          <img
            src={isBd ? '/Integrations.png' : '/Integrationsusd.png'}
            alt="Claude, Perplexity, Gemini, DeepSeek, ChatGPT, and Grok all unified into one Alveta subscription"
            className="w-full"
          />
        </div>
      </div>
    </section>
  )
}
