'use client'

import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { detectInAppBrowser } from '@/lib/in-app-browser'

/** Shown above the login/register card (via AuthShell, so both pages get it for
 * free) only when the page is actually running inside one of those in-app
 * browsers — checked client-side after mount since navigator.userAgent isn't
 * available during SSR, and rendering nothing until then avoids a hydration
 * mismatch. Silent no-op for the overwhelming majority of visitors who are on a
 * real browser. */
export function InAppBrowserWarning() {
  const [appName, setAppName] = useState<string | null>(null)

  useEffect(() => {
    setAppName(detectInAppBrowser())
  }, [])

  if (!appName) return null

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied — paste it into Chrome or Safari.')
    } catch {
      toast.error("Couldn't copy automatically — please copy the address bar link manually.")
    }
  }

  return (
    <div className="mb-4 w-full max-w-[420px] rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-900">
      <div className="flex gap-2.5">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Google and Microsoft sign-in won&apos;t work here</p>
          <p className="mt-1 text-amber-800">
            You&apos;re viewing this inside {appName}&apos;s built-in browser, which blocks
            those sign-in methods. Tap the <span className="font-medium">•••</span> menu and
            choose <span className="font-medium">&quot;Open in Browser&quot;</span> — or copy the
            link below into Chrome or Safari. Email sign-in still works fine here.
          </p>
          <button
            type="button"
            onClick={copyLink}
            className="mt-2 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100"
          >
            Copy link
          </button>
        </div>
      </div>
    </div>
  )
}
