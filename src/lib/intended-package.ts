/**
 * Remembers which package a visitor clicked on a pricing page *before* they had an
 * account — register (and, for an unverified account, the email round-trip after it)
 * is a real multi-page detour, so the click itself can't carry this as simple in-memory
 * React state the way a same-page interaction could. localStorage survives that whole
 * detour as long as it's the same browser, which covers the common case (the same
 * device/browser that started registering is what opens the verification email and
 * logs in) without needing any backend changes to thread it through the
 * register → verify → login chain.
 *
 * One-shot by design: WelcomePricingSection consumes (reads + clears) this on mount,
 * so a returning visitor's next pricing-page visit starts with a clean slate rather
 * than re-selecting a plan they looked at once, weeks ago.
 */
const KEY = 'alveta_intended_package'

export function setIntendedPackage(slug: string): void {
  try {
    localStorage.setItem(KEY, slug)
  } catch {
    // Private browsing / storage disabled — the click still navigates normally,
    // it just won't pre-select anything on the welcome screen. Not worth surfacing.
  }
}

export function consumeIntendedPackage(): string | null {
  try {
    const value = localStorage.getItem(KEY)
    if (value) localStorage.removeItem(KEY)
    return value
  } catch {
    return null
  }
}
