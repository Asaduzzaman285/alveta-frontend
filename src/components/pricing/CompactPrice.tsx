import { TakaIcon } from '@/components/ui/TakaIcon'
import { formatCompactPrice } from '@/lib/plan-features'

/**
 * JSX wrapper around formatCompactPrice() for STANDALONE price displays
 * (pricing cards, plan rows, table cells) — swaps the "৳" character for a real
 * TakaIcon glyph. Reuses formatCompactPrice()'s own number formatting (just
 * strips its leading ৳ for BDT) rather than duplicating that logic, so the two
 * can't silently drift apart.
 *
 * Deliberately NOT used inside a button label or sentence built from a
 * template string (e.g. "Pay ৳499 with bKash") — a React icon can't be
 * embedded in a plain string, so those keep calling formatCompactPrice()
 * directly and keep the ৳ character, by explicit decision.
 */
export function CompactPrice({ amount, currency, className }: { amount: number; currency: 'USD' | 'BDT'; className?: string }) {
  const formatted = formatCompactPrice(amount, currency)

  if (currency !== 'BDT') {
    return <span className={className}>{formatted}</span>
  }

  return (
    <span className={className}>
      <TakaIcon className="mr-0.5" />
      {formatted.slice('৳'.length)}
    </span>
  )
}
