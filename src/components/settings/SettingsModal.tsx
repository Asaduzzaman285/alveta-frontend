'use client'

import { useEffect, useState } from 'react'
import { BarChart3, CreditCard, Receipt, User as UserIcon, Users, Wallet as WalletIcon } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { Logo } from '@/components/Logo'
import { ProfileView } from '@/components/profile/ProfileView'
import { BillingView } from '@/components/settings/BillingView'
import { WalletView } from '@/components/settings/WalletView'
import { UsageView } from '@/components/settings/UsageView'
import { PlansView } from '@/components/settings/PlansView'
import { ManageTeamView } from '@/components/settings/ManageTeamView'
import { useCurrentSubscription } from '@/hooks/useCurrentSubscription'
import { TEAM_FEATURE_ENABLED } from '@/lib/plan-features'
import { cn } from '@/lib/utils'

type Tab = 'account' | 'billing' | 'wallet' | 'usage' | 'plans' | 'team'

const BASE_TABS: { id: Tab; label: string; icon: typeof UserIcon }[] = [
  { id: 'account', label: 'Account', icon: UserIcon },
  { id: 'billing', label: 'Billing', icon: Receipt },
  { id: 'wallet', label: 'AI Credit', icon: WalletIcon },
  { id: 'usage', label: 'Usage', icon: BarChart3 },
  { id: 'plans', label: 'Plans', icon: CreditCard },
]

/**
 * Consolidates what were four separate routed pages (/profile, /billing, /wallet,
 * /pricing) into one modal, ChatGPT-settings-style — internal left mini-nav, content
 * on the right. Each tab's content is unchanged, just relocated (BillingView/WalletView/
 * PlansView were extracted from those pages verbatim, ProfileView already existed as a
 * standalone component from an earlier session).
 */
export function SettingsModal({ open, onOpenChange, defaultTab = 'account' }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: Tab
}) {
  const [tab, setTab] = useState<Tab>(defaultTab)

  // Drives whether the "Team" tab shows at all — only an org's own admin
  // manages it (see ManageTeamView's own docblock); a plain member has
  // nothing to do here even though they inherit the org's plan via
  // GET /subscription's own org-membership fallback.
  const { data: subscriptionData } = useCurrentSubscription({ enabled: open })
  const isOrgAdmin = subscriptionData?.organization_role === 'admin'
  const organizationId = subscriptionData?.subscription?.organization_id ?? null
  const TABS = TEAM_FEATURE_ENABLED && isOrgAdmin && organizationId
    ? [...BASE_TABS, { id: 'team' as const, label: 'Team', icon: Users }]
    : BASE_TABS

  // Radix's onOpenChange only fires for its OWN internally-triggered close/open
  // gestures (Escape, outside click) — never when a parent flips the controlled
  // `open` prop directly, which is the only way this modal ever opens in this app
  // (there's no <DialogTrigger> anywhere; every call site uses openSettings() to set
  // `open`/`defaultTab` state directly). Confirmed by reading @radix-ui/react-use-
  // controllable-state's actual source: onChange only fires from an internal setValue
  // call, not from the controlled prop itself changing. The old `if (next) setTab
  // (defaultTab)` inside onOpenChange below was therefore dead code — `tab` stayed
  // locked to whatever it was at first mount ('account', the initial default) no
  // matter which tab a caller actually requested, unless the user happened to click
  // through tabs manually first. This effect is what actually keeps them in sync.
  useEffect(() => {
    if (open) setTab(defaultTab)
  }, [open, defaultTab])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* w-[94vw] + an explicit height at every breakpoint (not just sm:h-[80vh], which
          left mobile with no height bound at all — the dialog just grew to fit every
          tab's full content instead of scrolling internally, the actual cause of the
          "settings looks broken on mobile" screenshot together with the issues below).
          flex-col (stacks nav above content) below sm, grid-cols at sm+ restores the
          original side-by-side layout — same breakpoint grid/flex swap used elsewhere
          in this responsive pass. */}
      <DialogContent className="flex h-[85vh] w-[94vw] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:h-[80vh] sm:w-full sm:grid sm:grid-cols-[180px_1fr]">
        <div className="flex shrink-0 flex-col sm:border-r sm:border-border sm:bg-muted/30">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:border-b-0 sm:px-5 sm:pb-0 sm:pt-4">
            <Logo iconOnly className="h-4 w-4" />
            <span className="font-display text-sm font-bold">Settings</span>
          </div>
          {/* Horizontal, scrollable strip below sm — a phone-width vertical list of
              5-6 full-width buttons (the original layout, unconditionally) pushed the
              actual tab content below the fold before a user ever saw any of it.
              Reverts to the original vertical list at sm and up, where there's width
              to spare for one. */}
          <div className="flex gap-1 overflow-x-auto border-b border-border p-2 sm:flex-col sm:overflow-visible sm:border-b-0 sm:p-3 sm:pt-2">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                    tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === 'account' && <ProfileView />}
          {tab === 'billing' && <BillingView />}
          {tab === 'wallet' && <WalletView />}
          {tab === 'usage' && <UsageView />}
          {tab === 'plans' && <PlansView />}
          {tab === 'team' && organizationId && <ManageTeamView organizationId={organizationId} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export type { Tab as SettingsTab }
