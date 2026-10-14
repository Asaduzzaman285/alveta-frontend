'use client'

import { useState } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { PlanChooserList } from './PlanChooserList'
import { TeamPlanChooser } from './TeamPlanChooser'
import { TEAM_FEATURE_ENABLED } from '@/lib/plan-features'
import { cn } from '@/lib/utils'
import type { AppliedCoupon } from './CouponInput'
import type { Package } from '@/types'
import type { ReactNode } from 'react'

/** Right-anchored slide-over hosting PlanChooserList — matches the Claude Design
 * mockup's "Choose your plan" panel shape (slides in from the right over a dimmed
 * backdrop, rather than a centered modal). Used by the Welcome screen's "View
 * plans" entry point; Settings → Plans renders PlanChooserList directly inline
 * instead (it's already inside its own modal — nesting a second slide-over there
 * would be one modal too many). */
export function PlanChooserPanel({
  open,
  onOpenChange,
  packages,
  isLoading,
  currency,
  currentSlug,
  renderCta,
  defaultExpandedSlug,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  packages: Package[] | undefined
  isLoading: boolean
  currency: 'USD' | 'BDT'
  currentSlug?: string | null
  renderCta: (pkg: Package, isCurrent: boolean, appliedCoupon: AppliedCoupon | null) => ReactNode
  defaultExpandedSlug?: string
}) {
  const [mode, setMode] = useState<'individual' | 'team'>('individual')
  const hasTeamPlans = TEAM_FEATURE_ENABLED && (packages ?? []).some((p) => p.is_team_enabled)

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <RadixDialog.Content
          className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-hidden bg-background shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between border-b border-border p-5">
            <div>
              <RadixDialog.Title className="text-lg font-semibold text-foreground">Choose your plan</RadixDialog.Title>
              <p className="mt-0.5 text-xs text-muted-foreground">Monthly floor plus usage. Change or cancel any time.</p>
            </div>
            <RadixDialog.Close
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </RadixDialog.Close>
          </div>

          {hasTeamPlans && (
            <div className="flex gap-1 border-b border-border p-2">
              {(['individual', 'team'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  {m === 'individual' ? 'Individual' : 'Team/Organization'}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5">
            {mode === 'individual' ? (
              <PlanChooserList
                packages={packages}
                isLoading={isLoading}
                currency={currency}
                currentSlug={currentSlug}
                renderCta={renderCta}
                {...(defaultExpandedSlug ? { defaultExpandedSlug } : {})}
              />
            ) : (
              <TeamPlanChooser packages={packages} isLoading={isLoading} currency={currency} />
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
