'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, Loader2, Tag, X } from 'lucide-react'
import apiClient from '@/lib/api-client'
import { formatCompactPrice } from '@/lib/plan-features'
import { cn } from '@/lib/utils'

export interface AppliedCoupon {
  code: string
  discount: number
  finalPrice: number
}

interface PreviewResponse {
  valid: boolean
  message?: string
  coupon?: { code: string; description: string | null; discount_type: string }
  currency?: 'USD' | 'BDT'
  original_price?: number
  discount?: number
  final_price?: number
}

/**
 * Sits above a plan's CTA in its expanded row — the coupon backend
 * (CouponController::preview / SubscriptionController::subscribe) has existed since
 * the coupon feature was built, but nothing in the customer-facing checkout ever
 * called it: only the admin management page existed. This is the missing other half.
 *
 * Deliberately per-package, not one global field for the whole plan list — a coupon
 * preview needs a package_slug (the discount depends on the plan's own price), and
 * PlanChooserList already only ever has one row expanded at a time, so "the coupon
 * field for the currently open plan" maps directly onto the existing UI shape rather
 * than needing a new one.
 */
export function CouponInput({
  packageSlug,
  currency,
  onApplied,
}: {
  packageSlug: string
  currency: 'USD' | 'BDT'
  onApplied: (coupon: AppliedCoupon | null) => void
}) {
  const [code, setCode] = useState('')
  const [applied, setApplied] = useState<AppliedCoupon | null>(null)
  const [error, setError] = useState<string | null>(null)

  const preview = useMutation({
    mutationFn: async (rawCode: string) =>
      (await apiClient.post<PreviewResponse>('/api/v1/subscription/coupons/preview', {
        code: rawCode,
        package_slug: packageSlug,
        currency,
      })).data,
    onSuccess: (data) => {
      if (!data.valid || data.discount == null || data.final_price == null) {
        setError(data.message ?? 'That coupon code is not valid for this plan.')
        setApplied(null)
        onApplied(null)
        return
      }
      const result: AppliedCoupon = { code, discount: data.discount, finalPrice: data.final_price }
      setApplied(result)
      setError(null)
      onApplied(result)
    },
    onError: () => {
      // A 422 from the preview endpoint still carries a real message — axios
      // routes that through the response body, not this branch, so this is only
      // genuine transport failures (offline, timeout).
      setError("Couldn't check that code — please try again.")
      setApplied(null)
      onApplied(null)
    },
  })

  const apply = () => {
    const trimmed = code.trim()
    if (!trimmed) return
    preview.mutate(trimmed)
  }

  const clear = () => {
    setCode('')
    setApplied(null)
    setError(null)
    onApplied(null)
  }

  if (applied) {
    return (
      <div className="mb-3 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 text-primary">
          <Check className="h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-medium">{applied.code}</span> applied — save {formatCompactPrice(applied.discount, currency)}
          </span>
        </div>
        <button type="button" onClick={clear} aria-label="Remove coupon" className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Tag className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              if (error) setError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), apply())}
            placeholder="Have a coupon code?"
            className={cn(
              'w-full rounded-lg border bg-background py-1.5 pl-8 pr-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
              error ? 'border-destructive' : 'border-input'
            )}
          />
        </div>
        <button
          type="button"
          onClick={apply}
          disabled={!code.trim() || preview.isPending}
          className="shrink-0 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
        >
          {preview.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
