'use client'

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Users, Mail, X, Minus, Plus, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CompactPrice } from '@/components/pricing/CompactPrice'
import { MfsGatewayToggle, type MfsGateway } from '@/components/pricing/MfsGatewayToggle'
import apiClient from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { describeError } from '@/lib/errors'
import type { OrganizationDetail, OrganizationMember, TopupRequest } from '@/types'

/**
 * Only ever rendered for an org's admin (see SettingsModal, gated on
 * organization_role === 'admin' from GET /subscription) — a regular member
 * has nothing to manage here, just their own inherited plan access.
 */
export function ManageTeamView({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient()
  const [inviteEmail, setInviteEmail] = useState('')
  const [newSeatCount, setNewSeatCount] = useState('')
  // Which MFS app to actually charge a BDT seat increase through — mirrors
  // PlansView's own mfsGateway state; MfsGatewayToggle's own docblock already
  // named "seat increase" as one of its intended call sites, it just never
  // got wired in here (confirmed live, 2026-10-13: this always hardcoded
  // 'bkash' with no way to pick Upay, even though the backend endpoint has
  // accepted payment_source: 'upay' for seat increases all along).
  const [mfsGateway, setMfsGateway] = useState<MfsGateway>('bkash')
  const [removeTarget, setRemoveTarget] = useState<OrganizationMember | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<OrganizationMember | null>(null)
  const [topupAction, setTopupAction] = useState<{ request: TopupRequest; type: 'approve' | 'deny' } | null>(null)

  // Both queries below override the app-wide 60s staleTime/no-refocus-refetch
  // (query-provider.tsx) — seat count, member status, and pending top-up requests
  // are exactly the kind of thing that changes from a DIFFERENT browser/session
  // (a member accepting an invite, submitting a request) with no way for this
  // admin's own tab to know to invalidate; serving a minute-old cached view here
  // reads as "stuck," not just slow. Same reasoning as useCurrentSubscription.ts.
  const { data, isLoading } = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: async () => (await apiClient.get<OrganizationDetail>(`/api/v1/organizations/${organizationId}`)).data,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['organization', organizationId] })

  const { data: topupData } = useQuery({
    queryKey: ['organization', organizationId, 'topup-requests'],
    queryFn: async () => (await apiClient.get<{ requests: TopupRequest[] }>(`/api/v1/organizations/${organizationId}/topup-requests`)).data.requests,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
  const pendingTopups = (topupData ?? []).filter((r) => r.status === 'pending')

  const approveTopup = useMutation({
    mutationFn: async (requestId: string) => apiClient.post(`/api/v1/organizations/${organizationId}/topup-requests/${requestId}/approve`),
    onSuccess: () => {
      toast.success('Credit purchase approved.')
      queryClient.invalidateQueries({ queryKey: ['organization', organizationId, 'topup-requests'] })
      setTopupAction(null)
    },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — check the request list before retrying.").message),
  })

  const denyTopup = useMutation({
    mutationFn: async (requestId: string) => apiClient.post(`/api/v1/organizations/${organizationId}/topup-requests/${requestId}/deny`),
    onSuccess: () => {
      toast.success('Request denied.')
      queryClient.invalidateQueries({ queryKey: ['organization', organizationId, 'topup-requests'] })
      setTopupAction(null)
    },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — check the request list before retrying.").message),
  })

  const invite = useMutation({
    mutationFn: async (email: string) => apiClient.post(`/api/v1/organizations/${organizationId}/invites`, { email }),
    onSuccess: () => {
      toast.success('Invite sent.')
      setInviteEmail('')
      invalidate()
    },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — check the pending invites list before retrying.").message),
  })

  const revoke = useMutation({
    mutationFn: async (memberId: string) => apiClient.delete(`/api/v1/organizations/${organizationId}/invites/${memberId}`),
    onSuccess: () => { toast.success('Invite revoked.'); invalidate(); setRevokeTarget(null) },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — check the pending invites list before retrying.").message),
  })

  const remove = useMutation({
    mutationFn: async (memberId: string) => apiClient.post(`/api/v1/organizations/${organizationId}/members/${memberId}/remove`),
    onSuccess: () => { toast.success('Member removed.'); invalidate(); setRemoveTarget(null) },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — check the member list before retrying.").message),
  })

  // Seat increases bill a real prorated charge and redirect to checkout, same
  // shape as a fresh purchase — a $0 increase (rare) activates immediately
  // instead (see OrganizationController::increaseSeats()'s own branch).
  // payment_source/currency must follow the org's OWN subscription currency,
  // not be hardcoded — confirmed live: a BDT team's seat increase was opening
  // a USD Stripe checkout regardless, breaking the platform-wide rule that a
  // BDT account only ever pays via a mobile wallet, never a card.
  const increaseSeats = useMutation({
    mutationFn: async (seats: number) => {
      const isBdt = data?.currency === 'BDT'
      return (await apiClient.post<{ checkout_url?: string; message?: string }>(`/api/v1/organizations/${organizationId}/seats/increase`, {
        new_seat_count: seats,
        payment_source: isBdt ? mfsGateway : 'card',
        currency: isBdt ? 'BDT' : 'USD',
      })).data
    },
    onSuccess: (res) => {
      if (res.checkout_url) {
        window.location.href = res.checkout_url
        return
      }
      toast.success(res.message ?? 'Seats increased.')
      setNewSeatCount('')
      invalidate()
    },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — check your seat count before trying again.").message),
  })

  const decreaseSeats = useMutation({
    mutationFn: async (seats: number) => apiClient.post<{ message: string }>(`/api/v1/organizations/${organizationId}/seats/decrease`, { new_seat_count: seats }),
    onSuccess: (res) => {
      toast.success(res.data.message)
      setNewSeatCount('')
      invalidate()
    },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — check your seat count before trying again.").message),
  })

  const submitInvite = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = inviteEmail.trim()
    if (!trimmed) return
    invite.mutate(trimmed)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t load your team.</p>
  }

  const activeMembers = data.members.filter((m: OrganizationMember) => m.status === 'active')
  const pendingInvites = data.members.filter((m: OrganizationMember) => m.status === 'invited')
  const seatCount = data.seat_count ?? 0
  const seatsFull = data.occupied_seats >= seatCount

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Users className="h-4.5 w-4.5" />
          {data.organization.name ?? 'Your team'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.occupied_seats} of {seatCount} seat{seatCount === 1 ? '' : 's'} in use
          {data.pending_seat_count !== null && (
            <> · seats will drop to {data.pending_seat_count} at your next renewal</>
          )}
        </p>
      </div>

      {/* Seat management */}
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Manage seats</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Increasing seats charges the prorated remainder of your current cycle right away. Decreasing only takes effect at your next renewal, and only once you&apos;re at or under the new count.
        </p>
        {data.currency === 'BDT' && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Pay seat increases with</span>
            <MfsGatewayToggle value={mfsGateway} onChange={setMfsGateway} />
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="number"
            min={1}
            placeholder="New total seats"
            value={newSeatCount}
            onChange={(e) => setNewSeatCount(e.target.value)}
            className="max-w-[160px]"
          />
          <Button
            variant="outline"
            disabled={!newSeatCount || increaseSeats.isPending || Number(newSeatCount) <= seatCount}
            onClick={() => increaseSeats.mutate(Number(newSeatCount))}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Increase
          </Button>
          <Button
            variant="outline"
            disabled={!newSeatCount || decreaseSeats.isPending || Number(newSeatCount) >= seatCount}
            onClick={() => decreaseSeats.mutate(Number(newSeatCount))}
          >
            <Minus className="mr-1 h-3.5 w-3.5" /> Schedule decrease
          </Button>
        </div>
      </div>

      {/* Invite form */}
      <div className="rounded-lg border border-border p-4">
        <Label htmlFor="invite-email">Invite a teammate</Label>
        <form onSubmit={submitInvite} className="mt-1.5 flex items-center gap-2">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="invite-email"
              type="email"
              placeholder={seatsFull ? 'No seats available' : 'teammate@company.com'}
              value={inviteEmail}
              disabled={seatsFull}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button type="submit" disabled={!inviteEmail.trim() || seatsFull || invite.isPending}>
            {invite.isPending ? 'Sending…' : 'Send invite'}
          </Button>
        </form>
        {seatsFull && (
          <p className="mt-1.5 text-xs text-muted-foreground">Remove a member or increase seats before inviting another.</p>
        )}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div>
          <p className="text-sm font-medium">Pending invites</p>
          <div className="mt-2 space-y-2">
            {pendingInvites.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm">{m.invited_email ?? m.email}</p>
                  <p className="text-xs text-muted-foreground">Invited {formatDate(m.invited_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="warning">pending</Badge>
                  <Button
                    variant="outline"
                    className="px-2.5 py-1.5 text-xs"
                    disabled={revoke.isPending}
                    onClick={() => setRevokeTarget(m)}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending top-up requests — always stored/credited in USD internally
          (see WalletView's matching comment on why the request form converts
          a BDT amount before sending it), so shown here in USD regardless of
          the org's own display currency. */}
      {pendingTopups.length > 0 && (
        <div>
          <p className="text-sm font-medium">Pending credit purchase requests</p>
          <div className="mt-2 space-y-2">
            {pendingTopups.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm">
                    {r.name ?? r.email ?? r.user_id} — <CompactPrice amount={parseFloat(r.amount)} currency="USD" />
                  </p>
                  {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                  <p className="text-xs text-muted-foreground">Requested {formatDate(r.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    className="px-2.5 py-1.5 text-xs"
                    disabled={approveTopup.isPending}
                    onClick={() => setTopupAction({ request: r, type: 'approve' })}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="px-2.5 py-1.5 text-xs"
                    disabled={denyTopup.isPending}
                    onClick={() => setTopupAction({ request: r, type: 'deny' })}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Deny
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active members */}
      <div>
        <p className="text-sm font-medium">Members</p>
        <div className="mt-2 space-y-2">
          {activeMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm">{m.name ?? m.email ?? m.user_id}</p>
                <p className="text-xs text-muted-foreground">
                  {m.email} {m.joined_at && <>· joined {formatDate(m.joined_at)}</>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.role === 'admin' ? 'success' : 'neutral'}>{m.role}</Badge>
                {m.role !== 'admin' && (
                  <Button
                    variant="destructive"
                    className="px-2.5 py-1.5 text-xs"
                    disabled={remove.isPending}
                    onClick={() => setRemoveTarget(m)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title="Remove team member"
        description={`Remove ${removeTarget?.name ?? removeTarget?.email ?? 'this member'} from the team? They'll lose access immediately, and this can't be undone from here.`}
        confirmLabel="Remove"
        pendingLabel="Removing…"
        isPending={remove.isPending}
        onConfirm={() => removeTarget && remove.mutate(removeTarget.id)}
      />

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title="Revoke invite"
        description={`Revoke the pending invite to ${revokeTarget?.invited_email ?? revokeTarget?.email ?? 'this address'}? They won't be able to join using that invite anymore.`}
        confirmLabel="Revoke"
        pendingLabel="Revoking…"
        isPending={revoke.isPending}
        onConfirm={() => revokeTarget && revoke.mutate(revokeTarget.id)}
      />

      <ConfirmDialog
        open={!!topupAction}
        onOpenChange={(o) => !o && setTopupAction(null)}
        title={topupAction?.type === 'approve' ? 'Approve credit purchase' : 'Deny credit purchase'}
        description={
          topupAction
            ? `${topupAction.type === 'approve' ? 'Approve' : 'Deny'} the credit purchase request for ${topupAction.request.name ?? topupAction.request.email ?? 'this member'}`
              + ` ($${parseFloat(topupAction.request.amount).toFixed(2)})`
              + (topupAction.type === 'approve' ? ' — this moves real money into the organization wallet.' : '?')
            : ''
        }
        confirmLabel={topupAction?.type === 'approve' ? 'Approve' : 'Deny'}
        pendingLabel="Working…"
        destructive={topupAction?.type === 'deny'}
        isPending={approveTopup.isPending || denyTopup.isPending}
        onConfirm={() => {
          if (!topupAction) return
          if (topupAction.type === 'approve') approveTopup.mutate(topupAction.request.id)
          else denyTopup.mutate(topupAction.request.id)
        }}
      />
    </div>
  )
}
