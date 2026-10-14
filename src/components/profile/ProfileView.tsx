'use client'

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { CheckCircle2, KeyRound, Mail, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import apiClient from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { describeError } from '@/lib/errors'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'
import { useCurrentSubscription } from '@/hooks/useCurrentSubscription'
import { useAvailableModels } from '@/hooks/useAvailableModels'
import type { User, WalletBalance } from '@/types'

const passwordSchema = z.object({
  current_password: z.string().optional(),
  new_password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  new_password_confirmation: z.string(),
}).refine((d) => d.new_password === d.new_password_confirmation, {
  message: 'Passwords do not match',
  path: ['new_password_confirmation'],
})

type PasswordForm = z.infer<typeof passwordSchema>

/**
 * Shared between the consumer /profile route and the admin /admin/profile route —
 * account settings apply the same way to both, and admins need a reachable copy of
 * this page inside their own shell since /profile itself redirects admins to /admin.
 */
export function ProfileView() {
  const queryClient = useQueryClient()
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('')

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => (await apiClient.get<User>('/api/v1/auth/me')).data,
  })

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: async () => (await apiClient.get<WalletBalance>('/api/v1/wallet')).data,
  })
  const { format } = useDisplayCurrency()

  const { data: subscriptionData, isLoading: subLoading } = useCurrentSubscription()
  const subscription = subscriptionData?.subscription ?? null
  const { availableModels } = useAvailableModels()

  // Overrides the plan's own admin-set default model for new chats AND the
  // Wallet tab's token-purchase estimate (see ai-gateway's ModelController for
  // where this and the package default actually get resolved into one
  // effective value) — null clears it back to "use the plan's default."
  const updateDefaultModel = useMutation({
    mutationFn: async (modelId: string | null) =>
      apiClient.patch<{ default_model_id: string | null }>('/api/v1/auth/me/default-model', { model_id: modelId }),
    onSuccess: () => {
      toast.success('Default model updated.')
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['models'] })
    },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — try again.").message),
  })

  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const setPassword = useMutation({
    mutationFn: async (data: PasswordForm) =>
      apiClient.post('/api/v1/auth/password/set', {
        current_password: data.current_password || undefined,
        new_password: data.new_password,
        new_password_confirmation: data.new_password_confirmation,
      }),
    onSuccess: () => {
      toast.success(me?.has_password ? 'Password updated.' : 'Password set — you can now also sign in with email/password.')
      reset()
      setShowPasswordForm(false)
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — try again in a moment.").message),
  })

  const changeEmail = useMutation({
    mutationFn: async () =>
      apiClient.post<{ message: string }>('/api/v1/auth/email/change', {
        new_email: newEmail,
        current_password: me?.has_password ? emailCurrentPassword : undefined,
      }),
    onSuccess: ({ data }) => {
      // Deliberately not invalidating ['auth','me'] — the email hasn't actually
      // changed yet, it only will once the confirmation link (sent to the new
      // address) is clicked.
      toast.success(data.message)
      setShowEmailForm(false)
      setNewEmail('')
      setEmailCurrentPassword('')
    },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — try again in a moment.").message),
  })

  const submitEmailChange = (e: FormEvent) => {
    e.preventDefault()
    if (!newEmail) return
    changeEmail.mutate()
  }

  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false)

  const unlinkGoogle = useMutation({
    mutationFn: async () => apiClient.delete('/api/v1/auth/social/google'),
    onSuccess: () => {
      toast.success('Google account unlinked.')
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      setUnlinkConfirmOpen(false)
    },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — try again in a moment.").message),
  })

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account, plan, and AI credit at a glance.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {meLoading ? (
            <>
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3.5 w-44" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                <div className="space-y-1.5"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-4 w-16" /></div>
                <div className="space-y-1.5"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-4 w-16" /></div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                  {me?.email?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-medium">{me?.name}</p>
                  <p className="text-sm text-muted-foreground">{me?.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 pt-2 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Preferred currency</p>
                  <p className="font-medium">{me?.preferred_currency ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email verified</p>
                  <p className="font-medium flex items-center gap-1">
                    {me?.email_verified_at ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Verified
                      </>
                    ) : 'Not verified'}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI Credit</CardTitle>
          </CardHeader>
          <CardContent>
            {walletLoading ? (
              <div className="space-y-1.5">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-3 w-28" />
              </div>
            ) : wallet ? (
              <div className="space-y-1">
                {/* Always USD, ignoring wallet.currency — see WalletView.tsx's matching
                    comment for why that field can't be trusted for display. Shows
                    available_balance, not raw balance — same reasoning as WalletView.tsx. */}
                <p className="text-2xl font-bold">{format(wallet.available_balance)}</p>
                <p className="text-xs text-muted-foreground">AI credit</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">AI credit not found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
          </CardHeader>
          <CardContent>
            {subLoading ? (
              <div className="space-y-1.5">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-3 w-24" />
              </div>
            ) : subscription ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-2xl font-bold flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {subscription.package?.name ?? 'Unknown'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {subscription.cancelled_at
                      ? `Ends ${formatDate(subscription.renews_at)}`
                      : `Renews ${formatDate(subscription.renews_at)}`}
                  </p>
                </div>

                {availableModels.length > 0 && (
                  <div className="space-y-1 border-t border-border pt-3">
                    <label className="text-xs font-medium text-muted-foreground">
                      Default model for new chats
                    </label>
                    {/* Also drives the Wallet tab's token-purchase estimate — see that
                        mutation's own comment. Empty value = "use the plan's own
                        default" (me?.default_model_id is null in that case); only ever
                        lists models THIS plan actually includes (availableModels is
                        already filtered to available:true), so there's no way to pick
                        something you can't actually chat with. */}
                    <select
                      value={me?.default_model_id ?? ''}
                      onChange={(e) => updateDefaultModel.mutate(e.target.value || null)}
                      disabled={updateDefaultModel.isPending}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Use plan default</option>
                      {availableModels.map((m) => (
                        <option key={m.id} value={m.model_id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active plan.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign-in &amp; security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">Google account</p>
              <p className="text-xs text-muted-foreground">
                {me?.google_connected ? 'Connected — you can sign in with Google.' : 'Not connected.'}
              </p>
            </div>
            {me?.google_connected && me?.has_password && (
              <>
                <Button variant="outline" disabled={unlinkGoogle.isPending} onClick={() => setUnlinkConfirmOpen(true)}>
                  {unlinkGoogle.isPending ? 'Unlinking…' : 'Unlink'}
                </Button>
                <ConfirmDialog
                  open={unlinkConfirmOpen}
                  onOpenChange={setUnlinkConfirmOpen}
                  title="Unlink Google account"
                  description="You won't be able to sign in with Google anymore — you'll need your email and password instead."
                  confirmLabel="Unlink"
                  pendingLabel="Unlinking…"
                  isPending={unlinkGoogle.isPending}
                  onConfirm={() => unlinkGoogle.mutate()}
                />
              </>
            )}
          </div>

          <div className="flex items-center justify-between text-sm border-t border-border pt-4">
            <div>
              <p className="font-medium">Email address</p>
              <p className="text-xs text-muted-foreground">{me?.email}</p>
            </div>
            {!showEmailForm && (
              <Button variant="outline" className="gap-1.5" onClick={() => setShowEmailForm(true)}>
                <Mail className="h-4 w-4" />
                Change email
              </Button>
            )}
          </div>

          {showEmailForm && (
            <form onSubmit={submitEmailChange} className="space-y-3 border-t border-border pt-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">New email</label>
                <input
                  type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {me?.has_password && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Current password</label>
                  <input
                    type="password" required value={emailCurrentPassword} onChange={(e) => setEmailCurrentPassword(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                We&apos;ll send a confirmation link to the new address — your sign-in email won&apos;t change until you click it.
              </p>
              <div className="flex gap-2">
                <Button type="submit" disabled={changeEmail.isPending}>
                  {changeEmail.isPending ? 'Sending…' : 'Send confirmation link'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowEmailForm(false); setNewEmail(''); setEmailCurrentPassword('') }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          <div className="flex items-center justify-between text-sm border-t border-border pt-4">
            <div>
              <p className="font-medium">Password</p>
              <p className="text-xs text-muted-foreground">
                {me?.has_password ? 'Password sign-in is enabled.' : "You signed up with Google — set a password to also sign in with email."}
              </p>
            </div>
            {!showPasswordForm && (
              <Button variant="outline" className="gap-1.5" onClick={() => setShowPasswordForm(true)}>
                <KeyRound className="h-4 w-4" />
                {me?.has_password ? 'Change password' : 'Set password'}
              </Button>
            )}
          </div>

          {showPasswordForm && (
            <form
              onSubmit={handleSubmit((data) => setPassword.mutate(data))}
              className="space-y-3 border-t border-border pt-4"
            >
              {me?.has_password && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Current password</label>
                  <input type="password" {...register('current_password')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  {errors.current_password && <p className="text-xs text-destructive">{errors.current_password.message}</p>}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-sm font-medium">New password</label>
                <input type="password" placeholder="Min 8 chars, 1 uppercase, 1 number" {...register('new_password')}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                {errors.new_password && <p className="text-xs text-destructive">{errors.new_password.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Confirm new password</label>
                <input
                  type="password"
                  // Catches a genuine typo — pasting the same clipboard value in would
                  // just match whatever was (possibly mistyped) copied above, defeating
                  // the point of a second field.
                  onPaste={(e) => e.preventDefault()}
                  {...register('new_password_confirmation')}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {errors.new_password_confirmation && <p className="text-xs text-destructive">{errors.new_password_confirmation.message}</p>}
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting || setPassword.isPending}>
                  {setPassword.isPending ? 'Saving…' : 'Save password'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowPasswordForm(false); reset() }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
