'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import apiClient from '@/lib/api-client'
import { describeError } from '@/lib/errors'
import type { InviteInfo } from '@/types'

// Two different shapes depending on whether the invited email already has an
// account: a brand-new invitee sets a password (same rules as registration);
// an existing account just confirms its own password — proving control of the
// account either way, never accepted on the invite link alone (see
// UserInviteController::accept()'s docblock on the backend).
const setPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  password_confirmation: z.string(),
}).refine((d) => d.password === d.password_confirmation, {
  message: 'Passwords do not match',
  path: ['password_confirmation'],
})

const confirmPasswordSchema = z.object({
  password: z.string().min(1, 'Enter your password'),
})

type SetPasswordForm = z.infer<typeof setPasswordSchema>
type ConfirmPasswordForm = z.infer<typeof confirmPasswordSchema>

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>()
  const token = params.token

  const { data: invite, isLoading } = useQuery({
    queryKey: ['invite', token],
    queryFn: async () => (await apiClient.get<InviteInfo>(`/api/v1/auth/invites/${token}`)).data,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!invite?.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm space-y-3 text-center">
          <h2 className="text-xl font-semibold">Invite link invalid</h2>
          <p className="text-sm text-muted-foreground">
            This invite link is invalid or has expired. Ask whoever invited you to send a new one.
          </p>
        </div>
      </div>
    )
  }

  return invite.has_password
    ? <ConfirmPasswordCard token={token} email={invite.email} />
    : <SetPasswordCard token={token} email={invite.email} />
}

function SetPasswordCard({ token, email }: { token: string; email?: string }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<SetPasswordForm>({ resolver: zodResolver(setPasswordSchema) })

  const onSubmit = async (data: SetPasswordForm) => {
    setServerError(null)
    try {
      await apiClient.post(`/api/v1/auth/invites/${token}/accept`, data)
      router.replace('/login?joined=1')
    } catch (err: unknown) {
      setServerError(describeError(err, "We didn't hear back in time — check whether your account was activated before trying again.").message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">You&apos;re invited 🎉</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {email ? <>Set a password for <span className="font-medium text-foreground">{email}</span> to join the team.</> : 'Set a password to join the team.'}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError}</div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                autoComplete="new-password"
                {...register('password')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Confirm password</label>
            <div className="relative">
              <input
                type={showConfirmation ? 'text' : 'password'}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                onPaste={(e) => e.preventDefault()}
                {...register('password_confirmation')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowConfirmation((v) => !v)}
                aria-label={showConfirmation ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password_confirmation && <p className="text-xs text-destructive">{errors.password_confirmation.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {isSubmitting ? 'Joining…' : 'Set password & join'}
          </button>
        </form>
      </div>
    </div>
  )
}

function ConfirmPasswordCard({ token, email }: { token: string; email?: string }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ConfirmPasswordForm>({ resolver: zodResolver(confirmPasswordSchema) })

  const onSubmit = async (data: ConfirmPasswordForm) => {
    setServerError(null)
    try {
      await apiClient.post(`/api/v1/auth/invites/${token}/accept`, data)
      router.replace('/login?joined=1')
    } catch (err: unknown) {
      setServerError(describeError(err, "We didn't hear back in time — check whether your account joined the team before trying again.").message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">You&apos;re invited 🎉</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {email ? <>Confirm your password for <span className="font-medium text-foreground">{email}</span> to join the team.</> : 'Confirm your password to join the team.'}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError}</div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {isSubmitting ? 'Joining…' : 'Confirm & join'}
          </button>
        </form>
      </div>
    </div>
  )
}
