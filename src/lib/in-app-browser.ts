/**
 * Detects the common "in-app browsers" embedded inside social apps (Facebook,
 * Messenger, Instagram, LinkedIn, TikTok, Line) — these are WebViews the host
 * app opens links in instead of handing off to the phone's real browser, and
 * several of them (confirmed live: Facebook/Messenger) restrict or wipe
 * sessionStorage between page navigations. Firebase's Microsoft/Google
 * sign-in relies on that storage surviving the redirect round-trip to the
 * provider and back, so it fails there with a "missing initial state" error
 * no matter what the user does — a real limitation of the embedded browser,
 * not something fixable in our own code. Detecting it lets us warn the user
 * before they hit that dead end, rather than after.
 */
const PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'Facebook or Messenger', regex: /FBAN|FBAV|FB_IAB|FBIOS|FB4A/i },
  { name: 'Instagram', regex: /Instagram/i },
  { name: 'LinkedIn', regex: /LinkedInApp/i },
  { name: 'TikTok', regex: /musical_ly|TikTok/i },
  { name: 'Line', regex: /\bLine\//i },
  { name: 'WeChat', regex: /MicroMessenger/i },
  { name: 'Snapchat', regex: /Snapchat/i },
]

export function detectInAppBrowser(): string | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  const match = PATTERNS.find((p) => p.regex.test(ua))
  return match ? match.name : null
}
