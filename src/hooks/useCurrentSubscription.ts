import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import type { Subscription } from '@/types'

export interface CurrentSubscription {
  subscription: Subscription | null
  organization_role: 'admin' | 'member' | null
}

// The only definition of the ['subscription','current'] query. Five components used to
// each declare their own queryFn under this shared key, split between caching the full
// response and caching just `.subscription` — React Query keeps one cache entry per key,
// so whichever fetched last silently handed every other component the wrong shape
// ("Unknown" plan / "Invalid Date" in Profile, "no plan" in Settings → Plans).
export function useCurrentSubscription(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: async () => (await apiClient.get<CurrentSubscription>('/api/v1/subscription')).data,
    enabled: options?.enabled ?? true,
    // Overrides the app-wide 60s staleTime/no-refocus-refetch defaults
    // (query-provider.tsx) — this query gates real access/money decisions
    // (can this account buy a plan, are they still covered by a team), so a
    // stale cached answer isn't just a cosmetic lag, it's actively wrong
    // information. Confirmed live: a just-removed team member's Plans tab
    // kept showing "You have access through your team's plan" — with no
    // purchasable package list — for up to a minute after removal, because
    // this query was still serving its pre-removal cached response and
    // nothing ever told it to refetch sooner.
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
}
