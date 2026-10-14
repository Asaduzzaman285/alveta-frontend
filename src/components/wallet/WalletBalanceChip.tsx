'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowUp } from 'lucide-react'
import apiClient from '@/lib/api-client'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'
import type { WalletBalance } from '@/types'

/** Same query key WalletView.tsx already uses — shares its cache instead of a second
 * independent fetch. */
export function WalletBalanceChip() {
  const { data: wallet } = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: async () => (await apiClient.get<WalletBalance>('/api/v1/wallet')).data,
    // Same override as WalletView.tsx's own fetch of this exact key — a header
    // chip showing a stale balance for up to a minute (the app-wide default) is
    // worse here, not better, since it's meant to be the at-a-glance live figure.
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
  const { format } = useDisplayCurrency()

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <ArrowUp className="h-3 w-3" />
      {/* available_balance, not raw balance — the credit buffer is gone, but a
          wallet can still carry debt from before it was removed, or (for a team
          admin) have money reserved for unfilled seats; available_balance is
          the honest "what can actually be spent" figure. See WalletView.tsx's
          matching comment. The real ledger value is always USD — this only
          converts for display. */}
      {wallet ? format(wallet.available_balance) : '—'}
    </div>
  )
}
