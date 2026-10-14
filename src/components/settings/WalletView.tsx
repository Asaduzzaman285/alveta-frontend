'use client'

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton, SkeletonTableRows } from '@/components/ui/Skeleton'
import { PaymentMethodsView } from '@/components/settings/PaymentMethodsView'
import { AutoDebitView } from '@/components/settings/AutoDebitView'
import { MfsGatewayToggle, type MfsGateway } from '@/components/pricing/MfsGatewayToggle'
import apiClient from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { describeError } from '@/lib/errors'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'
import { useCurrentSubscription } from '@/hooks/useCurrentSubscription'
import { useAuthStore } from '@/stores/auth-store'
import { useAvailableModels } from '@/hooks/useAvailableModels'
import { computeTokensForAmount, formatTokenCount } from '@/lib/plan-features'
import { TakaIcon } from '@/components/ui/TakaIcon'
import type { LedgerEntry, WalletBalance } from '@/types'

const MIN_USD = 1
const MIN_BDT = 20

// Local to this modal, deliberately not the shared formatCurrency() (which spells
// out "BDT " instead of ৳, and always shows 2 decimals — see utils.ts's own
// comment on why) — this modal's own spec calls for ৳ with 0 decimals specifically.
function formatTopupAmount(value: number, currency: 'USD' | 'BDT'): string {
  return currency === 'USD' ? `$${value.toFixed(2)}` : `৳${Math.round(value).toLocaleString('en-US')}`
}

/** Shared by the Settings modal's Wallet tab — extracted from the old standalone /wallet route,
 * now also hosts saved payment methods and auto-debit settings underneath the ledger. */
export function WalletView() {
  const user = useAuthStore((s) => s.user)
  const { format, formatPrecise } = useDisplayCurrency()

  // Locked to the account's own preferred currency now, not a free-switching
  // tab — at explicit request (2026-09-16): a BDT-preferring account can no
  // longer pay by card, a USD-preferring account can no longer pay by bKash,
  // in every payment surface (top-up, subscribe, upgrade, auto-debit). Each
  // currency maps to exactly one real gateway (BDT -> bKash, USD -> Card/
  // Stripe), so this is really "which one gateway this account can ever use,"
  // not a preference to toggle per top-up.
  const activeCurrency: 'BDT' | 'USD' = user?.preferred_currency === 'USD' ? 'USD' : 'BDT'
  // Which MFS app to actually pay through for a BDT top-up — bKash and Upay
  // are both live now, a real choice (unlike card/MFS, which stays fully
  // automatic per currency, see the comment above).
  const [mfsGateway, setMfsGateway] = useState<MfsGateway>('bkash')
  const [amount, setAmount] = useState(() => (user?.preferred_currency === 'USD' ? '10' : '500'))

  // Still needed for the BDT path itself (converting a bKash amount to the
  // USD-equivalent the backend's /api/v1/topup always stores in) — no longer
  // needed for cross-currency conversion on tab-switch, since there's no
  // switching anymore.
  const { data: rateData } = useQuery({
    queryKey: ['currency-rate', 'BDT'],
    queryFn: async () => (await apiClient.get<{ effective_rate: number }>('/api/v1/subscription/currencies/BDT/rate')).data,
    staleTime: 5 * 60_000,
    retry: false,
  })
  const bdtPerUsd = rateData?.effective_rate ?? null

  // Token-purchase estimate — "with X, you get ~Y tokens" — computed against
  // whichever model is actually this user's effective default (their own
  // Account-tab override if set, else the plan's admin-set default; see
  // ai-gateway's ModelController), not a generic reference rate. Falls back to
  // availableModels[0] the same way chat/page.tsx's own auto-create does, so
  // this still shows something sensible before the user has ever configured
  // anything.
  const { availableModels, defaultModelId } = useAvailableModels()
  const estimateModel = (defaultModelId && availableModels.find((m) => m.model_id === defaultModelId)) || availableModels[0]
  const typedAmount = parseFloat(amount)
  const amountUsd = typedAmount > 0 ? (activeCurrency === 'BDT' && bdtPerUsd ? typedAmount / bdtPerUsd : typedAmount) : 0
  const estimatedTokens = (estimateModel?.pricing && amountUsd > 0)
    ? computeTokensForAmount(amountUsd, parseFloat(estimateModel.pricing.input_rate_per_million), parseFloat(estimateModel.pricing.output_rate_per_million))
    : null

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: async () => (await apiClient.get<WalletBalance>('/api/v1/wallet')).data,
    // Overrides the app-wide 60s staleTime/no-refocus-refetch (query-provider.tsx) —
    // same reasoning as useCurrentSubscription.ts: a balance is exactly the kind of
    // thing that genuinely changes out from under a viewer (another team member
    // spending, an admin approving a top-up, a removal sweeping money back), so
    // showing a minute-old cached number here is actively misleading, not just slow.
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  // A team member (not the org's own admin) gets the option to ask their
  // admin to fund their wallet instead of paying themselves — see
  // ManageTeamView's matching "pending top-up requests" section.
  const { data: subscriptionData } = useCurrentSubscription()
  const isOrgMember = subscriptionData?.organization_role === 'member'
  const [requestAmount, setRequestAmount] = useState('')
  const [requestNote, setRequestNote] = useState('')

  const requestTopup = useMutation({
    // Wallet balances are always stored/credited in USD internally (see
    // RegisterController's own wallet-creation call and WalletService's own
    // docs) — the self-serve top-up form above converts a BDT amount to its
    // USD equivalent before ever sending it anywhere, and this does the same,
    // rather than letting a BDT figure get credited as if it were USD (500x
    // too much). The original BDT figure is folded into the note purely so
    // the admin sees a sensible number, not an opaque converted one.
    mutationFn: async () => {
      const typed = parseFloat(requestAmount)
      const amountUsd = activeCurrency === 'BDT' && bdtPerUsd ? typed / bdtPerUsd : typed
      const note = activeCurrency === 'BDT'
        ? [requestNote, `(Requested as ৳${typed})`].filter(Boolean).join(' ')
        : (requestNote || null)
      return apiClient.post('/api/v1/wallet/topup-requests', { amount: amountUsd, note })
    },
    onSuccess: () => {
      toast.success("Sent — your team admin will see this request.")
      setRequestAmount('')
      setRequestNote('')
    },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — check with your admin before sending another request.").message),
  })

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ['wallet', 'ledger'],
    queryFn: async () => (await apiClient.get<{ ledger: LedgerEntry[] }>('/api/v1/wallet/ledger')).data.ledger,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const topup = useMutation({
    mutationFn: async ({ amountUsd, gateway }: { amountUsd: number; gateway: 'stripe' | 'bkash' | 'upay' }) => {
      return apiClient.post<{ checkout_url: string }>('/api/v1/topup', {
        amount: amountUsd,
        currency: 'USD',
        gateway,
      })
    },
    onSuccess: (res) => {
      // No wallet credit happens here — the gateway's hosted page collects payment, and
      // /billing/checkout-callback verifies + credits once payment actually completes.
      window.location.href = res.data.checkout_url
    },
    onError: (err: unknown) => {
      const { message } = describeError(err, "We didn't hear back from the server in time. Please try again.")
      toast.error(message)
    },
  })

  const handleTopup = (e: FormEvent) => {
    e.preventDefault()
    const value = parseFloat(amount)
    if (!value || value <= 0) {
      toast.error('Enter an amount.')
      return
    }
    // Each gateway's own floor, checked and shown in ITS OWN currency, never
    // converted first — converting a minimum into the viewer's currency before
    // formatting (e.g. "$1 minimum" shown as "BDT 122.00") was the actual bug
    // being fixed here.
    if (activeCurrency === 'USD') {
      if (value < MIN_USD) {
        toast.error(`Minimum credit purchase is ${formatTopupAmount(MIN_USD, 'USD')}.`)
        return
      }
      topup.mutate({ amountUsd: value, gateway: 'stripe' })
    } else {
      if (value < MIN_BDT) {
        toast.error(`Minimum credit purchase is ${formatTopupAmount(MIN_BDT, 'BDT')}.`)
        return
      }
      topup.mutate({ amountUsd: bdtPerUsd ? value / bdtPerUsd : value, gateway: mfsGateway })
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI Credit</CardTitle>
          </CardHeader>
          <CardContent>
            {walletLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3.5 w-40" />
              </div>
            ) : wallet ? (
              <div className="space-y-1">
                {/* wallet.balance is always real USD in storage — every dollar that moves
                    through this wallet is a raw USD-equivalent number with no conversion
                    anywhere in the ledger (wallet.currency itself is ignored, not used
                    here — it can be a leftover mislabel from before RegisterController.php
                    stopped setting it from preferred_currency, confirmed live as a genuine
                    $10 balance literally relabeled "BDT 10.00" with no real conversion).
                    useDisplayCurrency() converts using the live admin-configured rate for
                    display only, the correct fix for that old bug rather than repeating it.
                    Headline is available_balance, not raw balance — the credit buffer is
                    gone (no more overdraft), but a wallet can still carry debt from before
                    it was removed; available_balance (Wallet::availableBalance()) is the
                    one number that's honest about that, same figure reserve()'s own
                    affordability check uses. (protected_floor — locking part of a team
                    admin's balance away for unfilled seats — was also removed as of
                    2026-10-06; a team admin's available_balance is simply their full
                    balance now, same as an individual account.) */}
                <p className="text-3xl font-bold">{format(wallet.available_balance)}</p>
                <p className="text-sm text-muted-foreground">AI credit</p>
                <p className="text-sm text-muted-foreground">
                  {format(wallet.available_balance)} available to spend
                  {wallet.reserved_balance > 0 && ` · ${format(wallet.reserved_balance)} reserved`}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">AI credit not found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credit Purchase</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleTopup}>
              {/* No currency choice anymore — this account's preferred_currency fixes
                  which real gateway family it can ever use (BDT -> an MFS app,
                  USD -> Card). Within BDT, bKash vs. Upay is a real choice now. */}
              <p className="text-xs text-muted-foreground">
                Paying in <span className="font-medium text-foreground">{activeCurrency}</span> via{' '}
                {activeCurrency === 'USD' ? 'Card (Stripe)' : mfsGateway === 'bkash' ? 'bKash' : 'Upay'}
              </p>
              {activeCurrency === 'BDT' && <MfsGatewayToggle value={mfsGateway} onChange={setMfsGateway} />}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{activeCurrency === 'USD' ? '$' : <TakaIcon />}</span>
                <input
                  type="number"
                  // A soft hint only (real gating happens in handleTopup() + the
                  // backend) — matches that gateway's own real floor.
                  min={activeCurrency === 'USD' ? 1 : 20}
                  step={activeCurrency === 'USD' ? '0.01' : '1'}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {estimateModel && estimatedTokens !== null && (
                <p className="text-xs text-muted-foreground">
                  ≈ <span className="font-medium text-foreground">{formatTokenCount(estimatedTokens)} tokens</span> with {estimateModel.name}
                  {!defaultModelId && ' (plan default — set your own in Account)'}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={topup.isPending}>
                {topup.isPending ? 'Processing…' : activeCurrency === 'USD' ? 'Pay with Card (Stripe)' : `Pay with ${mfsGateway === 'bkash' ? 'bKash' : 'Upay'}`}
              </Button>
              <p className="text-xs text-muted-foreground">
                {activeCurrency === 'USD' ? 'Minimum $1.00.' : 'Minimum ৳20.'}
              </p>
            </form>

            {isOrgMember && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-sm font-medium">Or ask your team admin</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Send a request instead of paying yourself — your admin sees it in Manage Team.
                </p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{activeCurrency === 'USD' ? '$' : <TakaIcon />}</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Amount"
                      value={requestAmount}
                      onChange={(e) => setRequestAmount(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={!requestAmount || parseFloat(requestAmount) <= 0 || requestTopup.isPending}
                    onClick={() => requestTopup.mutate()}
                  >
                    {requestTopup.isPending ? 'Sending…' : 'Send request'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PaymentMethodsView />

      <AutoDebitView />

      {/* Hidden for now at explicit request (2026-09-16) — not removed, the ledger
          query above and formatDate import stay in place so this is a one-line
          re-enable later, not a rebuild. */}
      {false && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction history</CardTitle>
          </CardHeader>
          <CardContent>
            {ledgerLoading ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody><SkeletonTableRows columns={5} /></tbody>
                </table>
              </div>
            ) : !ledger?.length ? (
              <p className="text-sm text-muted-foreground">No AI credit activity yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium">Description</th>
                      <th className="px-4 py-2 font-medium text-right">Amount</th>
                      <th className="py-2 pl-4 font-medium text-right">AI credit after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger?.map((entry) => (
                      <tr key={entry.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 pr-4">{formatDate(entry.created_at)}</td>
                        <td className="px-4 py-2.5 capitalize">{entry.type}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{entry.description}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${entry.type === 'credit' || entry.type === 'refund' ? 'text-green-600' : 'text-destructive'}`}>
                          {entry.type === 'credit' || entry.type === 'refund' ? '+' : '−'}
                          {formatPrecise(entry.amount)}
                        </td>
                        <td className="py-2.5 pl-4 text-right tabular-nums">{formatPrecise(entry.balance_after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
