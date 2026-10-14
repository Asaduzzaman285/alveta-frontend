import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBangladeshiTakaSign } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/utils'

/**
 * The Bangladeshi Taka glyph, as a real icon rather than the "৳" Unicode
 * character (which renders inconsistently across fonts/platforms — see
 * formatCurrency()'s own comment on that). Free-tier Solid style only; this
 * account has no FontAwesome Pro Kit, so Sharp/Light styles aren't available.
 *
 * Only used for STANDALONE price displays (pricing cards, plan rows, table
 * cells) — a button label or sentence built from a template string (e.g.
 * "Pay ৳499 with bKash") can't embed a React icon inside a plain string, so
 * those keep the ৳ character from formatCompactPrice()/formatCurrency()
 * unchanged, by explicit decision.
 */
export function TakaIcon({ className }: { className?: string }) {
  return <FontAwesomeIcon icon={faBangladeshiTakaSign} className={cn('inline-block', className)} />
}
