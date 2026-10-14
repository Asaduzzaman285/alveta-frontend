'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { Menu } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import apiClient from '@/lib/api-client'
import { Sidebar } from '@/components/layout/Sidebar'
import { SettingsModal, type SettingsTab } from '@/components/settings/SettingsModal'
import { ChatSessionProvider, useChatSession } from '@/contexts/ChatSessionContext'
import type { User } from '@/types'

/**
 * ChatGPT-style shell — chat history is the sidebar's primary content (moved up from
 * chat/page.tsx into ChatSessionContext so it's the same list regardless of which page
 * renders), Settings lives in a modal opened from the bottom of the sidebar rather than
 * /billing, /wallet, /pricing, /profile being separate routed pages.
 *
 * JWTs live in localStorage (via zustand persist), not cookies, so real Next.js
 * middleware can't see them — this client-side guard is the Phase 1 substitute.
 */
function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { user, clearAuth } = useAuthStore()
  const { sessions, activeSessionId } = useChatSession()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('account')
  // Sidebar itself renders the actual mobile drawer (see Sidebar.tsx) since it needs
  // the same session/project/user data already loaded there — this shell only owns
  // the open/closed boolean and the button that flips it, so every dashboard page
  // (not just chat) gets a way back to the sidebar below the sm breakpoint, where the
  // desktop aside renders nothing at all.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Sidebar goes dark alongside the chat panel's own incognito palette when the active
  // session is private — previously only chat/page.tsx's content area re-themed, so
  // the sidebar stayed light right next to a dark private chat.
  const isActiveSessionPrivate = sessions?.find((s) => s.id === activeSessionId)?.is_private ?? false

  // A brand-new account's very first login lands on /welcome instead of showing a
  // popup — welcome_seen_at is null exactly once (Google or password login both hit
  // this, since email/password registration doesn't auto-login). Guarded by pathname
  // so it doesn't fight /welcome's own render once there.
  //
  // Excludes admins — this whole (dashboard) layout also wraps /admin, and an admin
  // account's welcome_seen_at is very often still null (most admins are promoted from
  // an existing account rather than ever going through the consumer onboarding flow
  // themselves). Without this check, logging in as an admin correctly landed on
  // /admin for an instant, then this same effect immediately overrode that and bounced
  // to /welcome — a consumer-only onboarding page (pricing cards, wallet balance) that
  // makes no sense for an admin-only account. Confirmed live: a real platform_admin
  // login ended up on /welcome instead of the admin dashboard.
  useEffect(() => {
    if (user && !user.is_admin && !user.welcome_seen_at && pathname !== '/welcome') router.replace('/welcome')
  }, [user, pathname, router])

  const openSettings = (tab: SettingsTab) => {
    setSettingsTab(tab)
    setSettingsOpen(true)
  }

  // Old standalone routes (/billing, /wallet, /pricing, /profile) now redirect to
  // /chat?settings=<tab> — this opens the right Settings modal tab instead of 404ing
  // old bookmarks/links now that those pages no longer exist as their own routes.
  useEffect(() => {
    const settingsParam = searchParams.get('settings')
    if (settingsParam && ['account', 'billing', 'wallet', 'usage', 'plans'].includes(settingsParam)) {
      openSettings(settingsParam as SettingsTab)
      router.replace('/chat')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleLogout = async () => {
    try {
      await apiClient.post('/api/v1/auth/logout')
    } catch {
      // Even if the server call fails, clear local state so the user isn't stuck.
    }
    // React Query's cache is a long-lived singleton independent of which user is
    // logged in — ['chat','sessions']/['projects']/etc. carry no user id in their
    // query key, and the default staleTime (60s, see query-provider.tsx) means a
    // same-tab remount after login often serves the cache as "fresh" without
    // refetching. Confirmed live: logging out of User A and into User B kept
    // showing User A's sidebar chats until a full page reload (which builds a
    // brand-new QueryClient). clear() wipes every cached query on logout so the
    // next user who logs in in this tab starts from nothing but their own data.
    queryClient.clear()
    clearAuth()
    router.replace('/login')
  }

  return (
    // h-screen (capped at exactly the viewport), not min-h-screen (only a floor) —
    // with min-h-screen, a sidebar taller than the viewport (many chats) just grew
    // the whole page past 100vh and the *page* scrolled, so the "+ New chat" button
    // and the user row at the bottom scrolled away with everything else instead of
    // staying put. h-screen caps this container so Sidebar's own `nav` (already
    // flex-1 overflow-y-auto) is what scrolls instead, keeping its header/footer fixed.
    <div className="flex h-screen">
      <Sidebar
        openSettings={openSettings}
        onLogout={handleLogout}
        isPrivate={isActiveSessionPrivate}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />

      {/* Only affordance back to the sidebar below sm, where the desktop aside (both
          its collapsed and expanded forms) renders nothing — fixed/floating rather
          than inline so it works identically on every dashboard page regardless of
          whether that page has its own header (chat does; Images/Designs don't). */}
      {/* top-2.5 + h-9 centers this at 28px from the viewport top — matching chat/
          page.tsx's own header row, which is a fixed h-14 (56px) with items-center,
          so its content sits centered at the same 28px. Previously top-3 (12px),
          which put this button's center 8px below that row's — confirmed live as a
          visibly uneven top bar (hamburger sitting lower than the model-selector/
          lock/wallet buttons beside it). Pages without their own header (Images/
          Designs) just show this floating at that same height with nothing to
          align against, which reads fine on its own. */}
      <button
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open menu"
        className="fixed left-3 top-2.5 z-30 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-sm sm:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="flex-1 overflow-hidden">{children}</div>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} defaultTab={settingsTab} />
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, accessToken, isAuthenticated, hasHydrated, setUser, clearAuth } = useAuthStore()
  const [checking, setChecking] = useState(true)
  // Bumped on an ambiguous (non-401) /auth/me failure to trigger one more
  // attempt — this call alone times out roughly 1 in 5 times in this
  // environment, so a single failure shouldn't leave the profile blank for
  // the rest of the session.
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    // Not a real "logged out" reading yet — zustand-persist hasn't finished
    // reading localStorage. Matters most right after a full page reload (e.g.
    // returning from an external redirect like Stripe Checkout), where this
    // effect can otherwise run before rehydration completes and wrongly bounce
    // an actually-logged-in user to /login.
    if (!hasHydrated) return

    if (!isAuthenticated || !accessToken) {
      router.replace('/login')
      return
    }

    if (user) {
      if (user.is_admin) {
        router.replace('/admin')
        return
      }
      setChecking(false)
      return
    }

    let cancelled = false

    apiClient
      .get<User>('/api/v1/auth/me')
      .then(({ data }) => {
        setUser(data)
        if (data.is_admin) {
          router.replace('/admin')
        }
      })
      .catch((err: unknown) => {
        // A real 401 means the token itself was rejected — that's a genuine
        // "not logged in," clear it and send them to /login. Anything else
        // (network error, timeout, 5xx) is this environment being slow, not
        // an authentication failure. Wiping a valid token over infrastructure
        // flakiness was bouncing people to /login mid-session, most visibly
        // right after returning from Stripe Checkout when the backend is
        // under fresh load.
        const isRealAuthFailure = err instanceof AxiosError && err.response?.status === 401
        if (isRealAuthFailure) {
          clearAuth()
          router.replace('/login')
          return
        }

        if (retryTick < 3) {
          setTimeout(() => {
            if (!cancelled) setRetryTick((n) => n + 1)
          }, 2000)
        }
        // Otherwise (retries exhausted): leave isAuthenticated/tokens alone
        // and let the dashboard render anyway — `user` just stays null, the
        // header falls back to a placeholder (see below) instead of forcing
        // a login the person doesn't actually need.
      })
      .finally(() => setChecking(false))

    return () => {
      cancelled = true
    }
  }, [hasHydrated, isAuthenticated, accessToken, user, retryTick, setUser, clearAuth, router])

  if (checking || !isAuthenticated || user?.is_admin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <ChatSessionProvider>
      <DashboardShell>{children}</DashboardShell>
    </ChatSessionProvider>
  )
}
