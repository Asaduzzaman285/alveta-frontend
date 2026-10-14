'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ChevronDown, Mic, Paperclip, SlidersHorizontal, Telescope, X } from 'lucide-react'
import { Header } from './Header'
import { ClaudeIcon, GeminiIcon, OpenAIIcon } from './ProviderIcons'

const TYPEWRITER_PROMPTS = [
  'Write a marketing email for our product launch',
  'Debug this Python function',
  'Compare GPT-5.6 and Claude Sonnet 5 for coding',
  'Summarize this PDF in three bullet points',
]

// Cycles through example prompts with a type/pause/backspace rhythm — a small,
// self-contained animation rather than a CSS-only fixed-text typewriter, since it
// needs to cycle through several different phrases, not just reveal one.
// `paused` stops it once the visitor's real input has content: the cycling text is
// now the composer's `placeholder`, which HTML already hides the instant there's a
// value, so this isn't needed for correctness — just to stop ticking a timer whose
// output nobody can see anymore.
function useTypewriter(phrases: string[], paused = false) {
  const [text, setText] = useState('')
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (paused) return
    const current = phrases[phraseIndex]
    let delay = deleting ? 35 : 55

    if (!deleting && text === current) {
      delay = 1400
    } else if (deleting && text === '') {
      delay = 400
    }

    const timeout = setTimeout(() => {
      if (!deleting && text === current) {
        setDeleting(true)
        return
      }
      if (deleting && text === '') {
        setDeleting(false)
        setPhraseIndex((i) => (i + 1) % phrases.length)
        return
      }
      setText(current.slice(0, deleting ? text.length - 1 : text.length + 1))
    }, delay)

    return () => clearTimeout(timeout)
  }, [text, deleting, phraseIndex, phrases, paused])

  return text
}

// Decorative only — deliberately NOT the shared ModelIcon component. ModelIcon's palette
// (emerald/orange/blue/etc.) is a real, established convention used elsewhere for
// compare-mode cards; reusing it here would mean either changing that shared meaning or
// fighting it, for a marketing mockup that isn't tied to any real app state.
// Real brand marks (supplied directly, not sourced/guessed) — see ProviderIcons.tsx.
// Only 3 logos on hand (no Grok/xAI yet); "4+" reads as "more available", not a literal
// count, matching how it's used in the reference.
const MOCK_PROVIDERS = [OpenAIIcon, ClaudeIcon, GeminiIcon]

export function Hero() {
  const router = useRouter()
  // A visitor here has no session, so there's nothing a "send" action could actually
  // do — every path out of this composer (typing then pressing Enter, or the Get
  // Started button) leads to /register instead. Kept as real, focusable input state
  // rather than the previous decorative div specifically so this box can be clicked
  // into and typed in, matching how the reference chat composer behaves.
  const [draft, setDraft] = useState('')
  const typed = useTypewriter(TYPEWRITER_PROMPTS, draft.length > 0)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  function goToRegister() {
    router.push('/register')
  }

  return (
    // A Fragment, NOT a wrapping div — that distinction is load-bearing. A `<div>`
    // here was tried during this same 2026-09-21 pass and broke the nav's sticky
    // behavior site-wide: `position: sticky`'s effective range is bounded by its
    // element's containing block, and a wrapping div here would make that containing
    // block just this component's own short subtree (banner + nav + hero card) —
    // once the page scrolls past THAT, not past the whole page, the nav stops
    // sticking and scrolls away, confirmed live as exactly the "disappears once the
    // hero section ends" symptom. A Fragment renders no DOM node at all, so the nav
    // div below is a direct child of whatever page.tsx's own <main> is — a true
    // sibling of FeaturesSection/PricingSection/etc., with the whole page as its
    // containing block, sticky for the full scroll. This is also why the original,
    // pre-2026-09-21 version of this file used a Fragment here too; the requested
    // "wrapper around navbar + hero" from that day's task is achieved a different
    // way now (the sibling margin relationship below), not by literally introducing
    // a shared parent element.
    <>
      {/* Announcement banner — dismissible, sits in normal page flow above everything
          else. Updated 2026-09-21 for the official launch: "Beta"/integration-teaser
          copy replaced with a real launch announcement, and the badge itself is now a
          link (previously purely decorative) — both it and "Try it now" point to the
          same /register destination. */}
      {!bannerDismissed && (
        <div className="mx-auto max-w-[1392px] px-6 pt-4 sm:px-8">
          {/* w-full — without it this box shrinks to fit its own content and centers
              within the 1392px column, leaving plain page-white visible on both sides
              instead of the lavender strip spanning edge-to-edge like the reference. */}
          <div className="flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl bg-[#F5F3FF] px-4 py-3 text-center text-xs text-neutral-700 sm:text-sm">
            <a
              href="/register"
              className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Live
            </a>
            <span>Alveta.ai is now officially live! Enjoy all your favorite AI tools and models in one subscription.</span>
            <a href="/register" className="font-semibold text-primary underline underline-offset-2 hover:opacity-80">
              Try it now →
            </a>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss announcement"
              className="ml-1 text-neutral-400 transition-colors hover:text-neutral-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Page-level sticky nav — previously the purple card's own first in-flow child
          below, which meant it scrolled away with the hero and vanished once the page
          scrolled into FeaturesSection ("dissolves while scrolling," reported live on
          mobile). Stays a separate sticky sibling for that same reason (a child of the
          hero card's own fixed-height box would stop being sticky the moment that box
          scrolls out of view — this isn't an overflow/z-index quirk, it's how sticky
          positioning works by definition). What changes here: mt-[27px] pushes the nav
          down to start 27px into where the hero's purple background will be, and
          -mb-[103px] (27+76, the nav's own height) pulls the hero section that follows
          up by the same total amount — the combination is what makes the purple render
          both above and around the floating white pill, instead of the nav sitting on
          the plain page background with hero starting fresh below it. */}
      <div className="sticky top-3 z-40 mx-auto mt-[27px] max-w-[1392px] -mb-[103px] px-6 sm:px-8">
        <Header />
      </div>

      <section className="px-6 pb-6 sm:px-8">
      {/* Inset rounded card, not full-bleed — matches the Figma export exactly (the "Bg"
          frame sits inside the page canvas with real margins, not edge-to-edge).
          bg-cover, not bg-contain — this card's height is content-driven, not locked to
          the image's native 1392x741 aspect ratio, so bg-contain was letterboxing:
          whenever the rendered box was proportionally taller/narrower than the image,
          it fit to one axis and left visible gaps on the other (confirmed live —
          reported as "left and right has gaps"). bg-cover always fills the box
          completely with no gaps, at the cost of cropping a little off whichever edge
          doesn't fit — a smaller, less noticeable defect than an outright gap. */}
      <div
        // pt-[143px]/sm:pt-[151px] = 103px (the nav+gap overlap this card's own top
        // edge now absorbs, per the wrapper's own comment above) + 40px/48px of actual
        // breathing room before the heading — the same 40/48px this card used before
        // the overlap technique existed, just re-based against the card's new,
        // earlier-starting top edge instead of a stale absolute value.
        className="relative mx-auto max-w-[1392px] overflow-hidden rounded-[32px] border border-[#21B8CD]/20 bg-cover bg-center bg-no-repeat px-6 pb-12 pt-[143px] text-center sm:px-10 sm:pt-[151px]"
        style={{ backgroundColor: '#1a1030', backgroundImage: 'url(/Bg.png)' }}
      >
        <div className="mx-auto max-w-[780px]">
          {/* Figma's own text-layer inspector for this exact layer: 588x101px box,
              Inter Display / weight 500 / size 52px / line-height 100% / letter-spacing
              1%, centered — verified numbers, not an estimate. Not literally "Inter
              Display" (never loaded — layout.tsx only loads plain Inter + Plus Jakarta
              Sans via next/font), so this inherits the body's real Inter instead of
              faking a font-family that would silently no-op. Fixed at 52px rather than
              scaling up on larger breakpoints (was 44/64/80px) since that's the design's
              actual desktop size, not a floor to scale from. tracking-tight was reversed
              from what Figma wants (that's negative spacing; 1% is positive). */}
          {/* max-w widened from the Figma-measured 588px, and the forced <br/> removed —
              at that width, this renders as 4 wrapped lines instead of 2 (confirmed live
              via screenshot: "Bringing the / Power of AI, / All Together in One /
              Platform"). Originally attributed to Inter Display never having loaded, so
              plain Inter measuring wider at the same point size — that's since been
              fixed (layout.tsx now self-hosts real Inter Display .ttf files, confirmed
              live), but the wider max-w stays: text-balance choosing its own break point
              inside more room is what actually guarantees 2 lines regardless of exactly
              how a given font measures, which is a more robust fix than a hardcoded
              <br/> either way. */}
          <h1 className="mx-auto max-w-[720px] text-balance text-[36px] font-medium leading-none tracking-[0.01em] text-white sm:text-[52px]">
            Bringing the Power of AI, All Together in One Platform
          </h1>
          <p className="mx-auto mt-3 max-w-[620px] text-balance text-sm leading-relaxed text-white/70 sm:text-base">
            Access all the leading AI models from one dashboard. Create, compare, and get more done without switching between multiple AI tools
          </p>

          {/* Static composer mockup — not a real input, just previews what the product
              looks like before signing in. White surface (not dark) per the Figma
              reference — this sits on the purple hero, and a dark composer on a dark/
              purple backdrop had almost no separation from the background.
              max-w-[560px] (was 520px) and mt-14 (was mt-12) per a later reference
              screenshot showing this card sitting noticeably wider relative to the
              heading above it, and a little lower/further from the subtitle, than the
              first pass had it — still narrower than the 720px heading's own max-w,
              just less so than before. */}
          <div className="mx-auto mt-14 w-full max-w-[560px] rounded-2xl border border-black/5 bg-white p-4 text-left shadow-2xl">
            <div className="flex items-center gap-1 text-[13px] font-medium text-neutral-500">
              General Assistance
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
            {/* A real, typeable input now, not the previous plain div — the typewriter
                animation still runs as its `placeholder` (a real HTML attribute, so
                it disappears the instant the visitor types anything, with no extra
                logic needed) rather than a separate always-visible overlay. Nothing
                the visitor types here is submitted anywhere; pressing Enter just
                takes the same route as the Get Started button below. */}
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') goToRegister()
              }}
              placeholder={typed}
              aria-label="Ask me anything"
              className="mt-2 h-[22px] w-full border-0 bg-transparent p-0 text-[15px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
            />

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 shrink-0 text-neutral-400" />
                {/* Decorative only, like the rest of this static mockup — no real
                    "explore/discover" feature behind it yet. Hidden below sm: on a
                    narrow phone this whole row (paperclip, telescope, 3 avatars, the
                    "4+" pill, a divider, and the sliders icon, all before the mic/send
                    on the right) had no room and was cramming/overlapping — dropping
                    the two purely decorative icons here first, before anything that
                    carries real information (the avatar stack), fixes that without
                    losing anything functional. */}
                <Telescope className="hidden h-4 w-4 shrink-0 text-neutral-400 sm:block" />

                {/* Overlapping avatar stack, matching the reference — each icon rides a
                    white ring so it stays legible against its neighbor instead of the
                    previous evenly-spaced circles. */}
                <div className="ml-1 flex items-center">
                  {MOCK_PROVIDERS.map((Icon, i) => (
                    <span
                      key={i}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-white ${i === 0 ? '' : '-ml-2'}`}
                    >
                      <Icon className="h-full w-full" />
                    </span>
                  ))}
                  <button
                    type="button"
                    className="-ml-1 flex items-center gap-0.5 rounded-full border border-neutral-200 bg-white py-0.5 pl-2 pr-1.5 text-[10px] font-medium text-neutral-500"
                  >
                    4+
                    <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </div>

                <span className="mx-1.5 hidden h-4 w-px bg-neutral-200 sm:block" />
                <SlidersHorizontal className="hidden h-4 w-4 shrink-0 text-neutral-400 sm:block" />
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Mic className="h-4 w-4 shrink-0 text-neutral-400" />
                {/* Replaces what was a plain round send icon. A signed-out visitor's
                    "send" here can't actually do anything — the real destination for
                    every path out of this composer is /register — so the button
                    says that outright instead of pretending to submit. Same pill
                    styling as Header's own "Get Started" CTA for consistency.
                    Text hidden below sm — confirmed live on a real phone: this row
                    (paperclip, 3-avatar stack, "4+" badge, mic, then this button)
                    has no room for the full "Get Started" label on a narrow screen,
                    and the button was overflowing past the card's own right edge.
                    Icon-only + smaller horizontal padding on mobile keeps it a real,
                    tappable button without the row needing to wrap. */}
                <button
                  type="button"
                  onClick={goToRegister}
                  aria-label="Get Started"
                  className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:px-4"
                >
                  <span className="hidden sm:inline">Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </section>
    </>
  )
}
