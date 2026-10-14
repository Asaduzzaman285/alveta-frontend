'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { SkeletonTableRows } from '@/components/ui/Skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import apiClient from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { buildQueryString } from '@/lib/query-string'
import { useListFilters } from '@/hooks/useListFilters'
import type { AdminMeta, Transaction, TopupSummary } from '@/types'

interface Filters {
  user_search: string
  from: string
  to: string
}

/**
 * t.amount/t.currency are always the internal USD bookkeeping value, even for
 * a bKash/Upay top-up — see Transaction's own type comment. Shows the real
 * amount the customer actually paid as the PRIMARY figure (not a secondary
 * annotation next to a USD number nobody paid) — same logic as
 * BillingView.tsx's own transactionAmount(), duplicated locally since these
 * are separate UI surfaces with no shared parent worth introducing for one
 * six-line function.
 */
function transactionAmount(t: Transaction): string {
  if ((t.gateway === 'bkash' || t.gateway === 'upay') && t.metadata?.amount_bdt != null) {
    return formatCurrency(t.metadata.amount_bdt, 'BDT')
  }
  return formatCurrency(t.amount, t.currency)
}

/**
 * The drill-down the summary table's "View details" opens into — every individual
 * wallet_topup transaction for one user, reusing the existing /transactions/admin
 * endpoint (already enriched with name/email) rather than a second bespoke endpoint.
 * The aggregate table exists precisely because that endpoint has no per-user total
 * anywhere in a flat list of rows; the detail view has no such gap to fill.
 */
function TopupDetailDialog({ userId, userLabel, onClose }: { userId: string; userLabel: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'topup-detail', userId],
    queryFn: async () => {
      const qs = buildQueryString({ user_id: userId, type: 'wallet_topup', per_page: 50 })
      return (await apiClient.get<{ transactions: Transaction[] }>(`/api/v1/transactions/admin${qs}`)).data
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Token Purchases — {userLabel}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2 py-2">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : !data?.transactions.length ? (
          <p className="py-4 text-sm text-muted-foreground">No completed token purchases found for this user.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Gateway</th>
                  <th className="pb-2 font-medium">Reference</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="py-2">{transactionAmount(t)}</td>
                    <td className="py-2 capitalize text-muted-foreground">{t.gateway}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">{t.gateway_reference ?? '—'}</td>
                    <td className="py-2 text-muted-foreground">{formatDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function AdminTopupsPage() {
  const [detailUser, setDetailUser] = useState<{ id: string; label: string } | null>(null)

  const { filters, setFilters, applied, page, setPage, applyFilters, clearFilters, hasActiveFilters } =
    useListFilters<Filters>({ user_search: '', from: '', to: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'topup-summary', applied, page],
    queryFn: async () => {
      const qs = buildQueryString({ ...applied, page, per_page: 20 })
      return (await apiClient.get<{ summaries: TopupSummary[]; meta: AdminMeta }>(`/api/v1/transactions/admin/topups/summary${qs}`)).data
    },
  })

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Token Purchases</h1>
        <p className="mt-1 text-sm text-muted-foreground">Total token purchase history, grouped by user.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={applyFilters} className="grid items-start gap-3 sm:grid-cols-4">
            <Input placeholder="Name or email" value={filters.user_search} onChange={(e) => setFilters({ ...filters, user_search: e.target.value })} />
            <Input type="date" aria-label="Date from" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            <Input type="date" aria-label="Date to" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            <div className="flex gap-2">
              <Button type="submit" variant="outline">Apply filters</Button>
              <Button type="button" variant="secondary" disabled={!hasActiveFilters} onClick={clearFilters}>Clear</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{data?.meta.total ?? '…'} users with a completed token purchase</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody><SkeletonTableRows columns={5} /></tbody>
              </table>
            </div>
          ) : !data?.summaries.length ? (
            <p className="text-sm text-muted-foreground">No token purchases match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">User</th>
                    <th className="pb-2 font-medium text-right">Total topped up</th>
                    <th className="pb-2 font-medium text-right">Token Purchases</th>
                    <th className="pb-2 font-medium">Last token purchase</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.summaries.map((s) => (
                    <tr key={s.user_id} className="border-b border-border last:border-0">
                      <td className="py-2">
                        {s.user ? (
                          <div className="leading-tight">
                            <div className="font-medium text-foreground">{s.user.name ?? '—'}</div>
                            <div className="text-xs text-muted-foreground">{s.user.email}</div>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">{s.user_id}</span>
                        )}
                      </td>
                      <td className="py-2 text-right font-medium">{formatCurrency(s.total_amount)}</td>
                      <td className="py-2 text-right text-muted-foreground">{s.topup_count}</td>
                      <td className="py-2 text-muted-foreground">{formatDate(s.last_topup_at)}</td>
                      <td className="py-2 text-right">
                        <Button
                          variant="outline"
                          className="px-3 py-1 text-xs"
                          onClick={() => setDetailUser({ id: s.user_id, label: s.user?.name ?? s.user?.email ?? s.user_id })}
                        >
                          View details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination currentPage={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      {detailUser && (
        <TopupDetailDialog userId={detailUser.id} userLabel={detailUser.label} onClose={() => setDetailUser(null)} />
      )}
    </div>
  )
}
