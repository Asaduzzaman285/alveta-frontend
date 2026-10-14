'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import apiClient from '@/lib/api-client'
import { describeError } from '@/lib/errors'
import { useAuthStore } from '@/stores/auth-store'
import type { AutoDebitSettings, PaymentMethod } from '@/types'

/** Shared by the Settings modal's Wallet tab. Stripe-only for now — bKash has no saved-token/
 * re-charge equivalent in this codebase, deferred to Phase 2 (see HANDOFF.md). */
export function AutoDebitView() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [enabled, setEnabled] = useState(false)
  const [threshold, setThreshold] = useState('1.00')
  const [topupAmount, setTopupAmount] = useState('10.00')
  const [methodId, setMethodId] = useState<string>('')

  const { data: settings, isLoading } = useQuery({
    queryKey: ['auto-debit'],
    queryFn: async () => (await apiClient.get<{ auto_debit: AutoDebitSettings }>('/api/v1/wallet/auto-debit')).data.auto_debit,
  })

  const { data: methods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => (await apiClient.get<{ payment_methods: PaymentMethod[] }>('/api/v1/payment-methods')).data.payment_methods,
  })

  useEffect(() => {
    if (!settings) return
    setEnabled(settings.enabled)
    setThreshold(settings.threshold_usd.toFixed(2))
    setTopupAmount(settings.topup_amount_usd.toFixed(2))
    setMethodId(settings.payment_method_id ?? '')
  }, [settings])

  const save = useMutation({
    mutationFn: async () =>
      apiClient.put('/api/v1/wallet/auto-debit', {
        enabled,
        threshold_usd: parseFloat(threshold),
        topup_amount_usd: parseFloat(topupAmount),
        payment_method_id: methodId || null,
      }),
    onSuccess: () => {
      toast.success('Auto-debit settings saved.')
      queryClient.invalidateQueries({ queryKey: ['auto-debit'] })
    },
    onError: (err: unknown) => toast.error(describeError(err).message),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = parseFloat(threshold)
    const a = parseFloat(topupAmount)
    if (!t || t <= 0) { toast.error('Please enter a threshold greater than $0.'); return }
    if (!a || a < 1) { toast.error('Please enter a credit purchase amount of at least $1.'); return }
    save.mutate()
  }

  if (isLoading) return null

  // Auto-debit only ever charges the saved card above (Stripe) — there's no
  // bKash re-charge equivalent in this codebase. At explicit request
  // (2026-09-16), card is blocked entirely for a BDT-preferring account (same
  // rule as top-up/subscribe/upgrade), so there's no real payment method left
  // for auto-debit to use here — block the whole feature rather than show a
  // form that would only ever fail at charge time.
  if (user?.preferred_currency === 'BDT') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Auto-debit</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Auto-debit isn&apos;t available for BDT accounts yet — it only supports card
            (Stripe) recharges, and card payments are reserved for USD accounts. Use manual
            credit purchase with bKash or Upay instead.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-debit</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Automatically purchase tokens when my AI credit runs low
          </label>

          {enabled && (
            <div className="space-y-3 border-t border-border pt-3">
              {!methods?.length ? (
                <p className="text-xs text-muted-foreground">
                  Add a payment method above first — auto-debit needs a saved card to charge.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">When AI credit drops below</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-muted-foreground">$</span>
                        <input
                          type="number" min="0.01" step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Add this much</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-muted-foreground">$</span>
                        <input
                          type="number" min="1" step="1" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Charge which card</label>
                    <Select value={methodId} onChange={(e) => setMethodId(e.target.value)}>
                      <option value="">Use my default card</option>
                      {methods.map((m) => (
                        <option key={m.id} value={m.id}>{m.card_brand} •••• {m.last_four}</option>
                      ))}
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}

          <Button type="submit" variant="outline" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save auto-debit settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
