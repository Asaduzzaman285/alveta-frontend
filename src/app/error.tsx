'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/Logo'

/**
 * Root error boundary — without this, Next.js has nothing to catch a thrown render
 * error with anywhere in the app, and falls back to its own completely generic
 * "Application error: a client-side exception has occurred" page with no way to
 * recover short of a manual hard reload (confirmed live: reported on /chat after a
 * tab sat idle for 20+ minutes — an expired access token is the leading suspect,
 * since most of this app's data fetching refreshes it transparently via apiClient's
 * response interceptor, but the two raw-fetch SSE streaming calls in chat/page.tsx
 * don't go through that interceptor at all). This won't fix whatever specific thing
 * throws, but it turns "dead page, must reload" into a recoverable screen, and — once
 * NEXT_PUBLIC_SENTRY_DSN is actually set (it's currently unconfigured, see
 * sentry.client.config.ts's own comment) — captureException here starts actually
 * reporting what's throwing instead of that being invisible.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
      <Logo iconOnly className="h-10 w-10" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This page hit an unexpected error — often from sitting idle too long.
          Reloading usually fixes it.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    </div>
  )
}
