'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * Catches an error thrown by the root layout itself (app/layout.tsx) — the one
 * case app/error.tsx can't cover, since that boundary lives inside the layout it
 * would need to replace. Next.js requires this to render its own <html>/<body>
 * (it fully replaces the document when it activates), so — unlike error.tsx — it
 * can't rely on globals.css/Tailwind actually being loaded and sticks to inline
 * styles rather than risk an unstyled crash screen on top of a crash.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '1.5rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          color: '#111827',
          background: '#ffffff',
        }}
      >
        <h1 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: '24rem', fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
          This usually clears up with a reload.
        </p>
        <button
          onClick={() => reset()}
          style={{
            borderRadius: '0.375rem',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            backgroundColor: '#7c3aed',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
