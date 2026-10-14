'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, Lock, Sparkles } from 'lucide-react'
import apiClient from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { useChatSession } from '@/contexts/ChatSessionContext'
import { useAvailableModels } from '@/hooks/useAvailableModels'
import { PrivateChatPopover } from '@/components/chat/PrivateChatPopover'
import { WalletBalanceChip } from '@/components/wallet/WalletBalanceChip'
import { WelcomeFeatureGrid } from '@/components/onboarding/WelcomeFeatureGrid'
import { WelcomePricingSection } from '@/components/onboarding/WelcomePricingSection'

/**
 * Replaces the old WelcomeModal popup — shown once, as a full page rather than a modal
 * (see (dashboard)/layout.tsx's redirect: `!user.welcome_seen_at` sends here instead of
 * opening a modal on top of /chat). A full page has no natural "close" gesture, so
 * welcome_seen_at is marked on mount, matching the modal's own original logic: "shown"
 * counts as "seen," not "read to completion." Every real exit from this screen (the
 * composer below, a session row in the sidebar, a plan in the panel, Private Chat)
 * already routes to /chat or opens the plan panel, both of which work immediately
 * since the field is already set by the time any of those fire.
 *
 * Rebuilt (2026-09-16) from a chat-first layout the user designed in Claude Design
 * (composer up top, compact feature pills, a slim plan-picker banner) — replacing
 * the previous feature-cards + inline-pricing-cards layout. See
 * WelcomePricingSection/PlanChooserPanel for where pricing moved to.
 */
export default function WelcomePage() {
  const router = useRouter()
  const { user, setUser } = useAuthStore()
  const { createSession } = useChatSession()
  const { availableModels } = useAvailableModels()
  const markedSeen = useRef(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (markedSeen.current || !user || user.welcome_seen_at) return
    markedSeen.current = true
    apiClient.post('/api/v1/auth/welcome-seen').catch(() => {})
    setUser({ ...user, welcome_seen_at: new Date().toISOString() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const firstName = user?.name?.split(' ')[0]

  // "Auto model" — same simplification PrivateChatPopover already uses for its
  // own start button (first available model) rather than a real recommendation
  // engine; there's no such backend capability today (chat model choice is
  // always explicit everywhere else in the app). The composer here exists to
  // get a first message moving immediately, not to add a second model-picker
  // UI on this page.
  const startChat = () => {
    const text = draft.trim()
    if (!text || availableModels.length === 0 || createSession.isPending) return
    createSession.mutate({ modelId: availableModels[0].id })
    // The freshly-created session becomes chat/page.tsx's active one via
    // useChatSession's own onCreated callback; the draft text rides along as a
    // query param that page reads once on mount to prefill (not auto-send —
    // see its own comment) its composer, so nothing is charged before the
    // user hits send themselves there.
    router.push(`/chat?draft=${encodeURIComponent(text)}`)
  }

  return (
    <div className="h-screen overflow-y-auto">
      {/* Widened from a flat 720px at explicit request — the page read as a narrow
          landing-page column floating inside the much wider main workspace panel
          (the chat view beside it has no max-width cap at all, just p-4 padding).
          Stepped responsive max-width instead of matching chat's full fluid width —
          "premium, controlled," not edge-to-edge — with every section (heading,
          composer, chips, plan banner) sharing this one wrapper's width so nothing
          is arbitrarily wider/narrower than its neighbors. */}
      <div className="mx-auto max-w-2xl px-6 py-10 sm:max-w-3xl lg:max-w-4xl lg:px-10">
        <div className="flex items-start justify-end gap-2">
          <PrivateChatPopover
            trigger={
              <button className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <Lock className="h-3 w-3" />
                Private Chat
              </button>
            }
          />
          <WalletBalanceChip />
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {firstName ? `Hi ${firstName}, ` : ''}welcome to Alveta.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One workspace for the world&apos;s leading AI models — GPT, Claude, Gemini, DeepSeek,
          Grok, Mistral and more. Start typing below, or pick a plan when you are ready to top up.
        </p>

        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-card p-2 pl-4 shadow-sm">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); startChat() } }}
            placeholder="Ask anything, or describe your goal…"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <span className="hidden shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground sm:flex">
            <Sparkles className="h-3 w-3" />
            Auto model
          </span>
          <button
            type="button"
            onClick={startChat}
            disabled={!draft.trim() || availableModels.length === 0 || createSession.isPending}
            aria-label="Start chat"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <WelcomeFeatureGrid />
        </div>

        <div className="mt-6">
          <WelcomePricingSection />
        </div>
      </div>
    </div>
  )
}
