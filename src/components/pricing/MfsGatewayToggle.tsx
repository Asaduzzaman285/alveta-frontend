'use client'

import { cn } from '@/lib/utils'

export type MfsGateway = 'bkash' | 'upay'

/**
 * Shown only when the payment currency is BDT — bKash and Upay are both live
 * MFS options now (previously bKash was the only BDT path, auto-picked with
 * no user choice at all — card/bKash was deliberately a single path per
 * currency, see PlansView's own comment on that decision), so the customer
 * needs to say which wallet app they'll actually pay with. Shared by every
 * BDT checkout entry point (subscribe, upgrade, team purchase, seat increase,
 * manual renew, wallet top-up) rather than duplicating this toggle five times.
 */
export function MfsGatewayToggle({ value, onChange, className }: { value: MfsGateway; onChange: (v: MfsGateway) => void; className?: string }) {
  return (
    <div className={cn('flex gap-1 rounded-full border border-border p-0.5 text-xs font-medium', className)}>
      {(['bkash', 'upay'] as const).map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onChange(g)}
          className={cn(
            'flex-1 rounded-full px-3 py-1 transition-colors',
            value === g ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
          )}
        >
          {g === 'bkash' ? 'bKash' : 'Upay'}
        </button>
      ))}
    </div>
  )
}
