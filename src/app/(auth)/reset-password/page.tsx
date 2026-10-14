'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import apiClient from '@/lib/api-client'
import { describeError } from '@/lib/errors'

const resetSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  password_confirmation: z.string(),
}).refine((d) => d.password === d.password_confirmation, {
  message: 'Passwords do not match',
  path: ['password_confirmation'],
})

type ResetForm = z.infer<typeof resetSchema>

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ResetForm>({ resolver: zodResolver(resetSchema) })

  const onSubmit = async (data: ResetForm) => {
    setServerError(null)
    try {
      await apiClient.post('/api/v1/auth/password/reset', { token, ...data })
      setSuccess(true)
      setTimeout(() => router.replace('/login'), 2000)
    } catch (err: unknown) {
      setServerError(describeError(err, "We didn't hear back in time — check your email before requesting another link.").message)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <h2 className="text-xl font-semibold">Invalid link</h2>
          <p className="text-sm text-muted-foreground">This reset link is missing its token. Request a new one.</p>
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">Request a new link</Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl font-semibold">Password reset</h2>
          <p className="text-sm text-muted-foreground">Redirecting you to sign in...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Reset password</h1>
          <p className="mt-2 text-sm text-muted-foreground">Choose a new password for your account.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError}</div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">New password</label>
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
            <label className="text-sm font-medium">Confirm new password</label>
            <div className="relative">
              <input
                type={showPasswordConfirmation ? 'text' : 'password'}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                // Catches a genuine typo — pasting the same clipboard value in would
                // just match whatever was (possibly mistyped) copied above, defeating
                // the point of a second field.
                onPaste={(e) => e.preventDefault()}
                {...register('password_confirmation')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPasswordConfirmation((v) => !v)}
                aria-label={showPasswordConfirmation ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPasswordConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password_confirmation && <p className="text-xs text-destructive">{errors.password_confirmation.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {isSubmitting ? 'Resetting...' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  )
}
