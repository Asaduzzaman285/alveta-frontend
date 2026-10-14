'use client'

import Link from 'next/link'
import { Layers, PieChart, Coins, Headset, UserCircle2 } from 'lucide-react'

// Value-proposition framing (what a visitor gets), not the product-mechanics framing
// this array held before — same card/badge visual system, five items now instead of
// four. Card/badge color pairs follow the same emerald/rose/amber/violet convention
// already used elsewhere in this file; sky is new, for the fifth card.
const FEATURES = [
  {
    icon: Layers,
    card: 'bg-emerald-50 border-emerald-100',
    badge: 'bg-emerald-100 text-emerald-600',
    title: 'Explore Multi-Model AI',
    body: 'Access leading AI engines in one unified interface. Seamlessly switch between top models to get the best output for every task.',
  },
  {
    icon: PieChart,
    card: 'bg-rose-50 border-rose-100',
    badge: 'bg-rose-100 text-rose-600',
    title: 'Clarity at Every Step',
    body: "Know what you're using and how much you're spending with clear token usage tracking and transparent pricing.",
  },
  {
    icon: Coins,
    card: 'bg-amber-50 border-amber-100',
    badge: 'bg-amber-100 text-amber-600',
    title: 'Stop Paying for Unused AI',
    body: 'Forget recurring plans you barely use. Buy tokens and use only AI models you actually need.',
  },
  {
    icon: Headset,
    card: 'bg-violet-50 border-violet-100',
    badge: 'bg-violet-100 text-violet-600',
    title: 'Exclusive Support for You',
    body: 'Get a premium experience backed by responsive customer support whenever you need a hand.',
  },
  {
    icon: UserCircle2,
    card: 'bg-sky-50 border-sky-100',
    badge: 'bg-sky-100 text-sky-600',
    title: 'Everything in One Account',
    body: "Keep your access, AI credit, usage, and payments organized centrally. It's simple, convenient, and secure.",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="px-6 py-12 sm:py-20">
      <div className="mx-auto grid max-w-[1200px] gap-12 md:grid-cols-2 md:items-start">
        {/* Sticky too, matching the right column's cards — without this the text just
            scrolled away normally while the cards did their stacking animation, when
            it should stay put in a fixed spot for the whole scroll-through instead.
            md:-scoped: below md the grid collapses to one column (see the wrapper's
            own md:grid-cols-2), so this text and the cards stack sequentially in the
            same column — leaving both sticky there made them fight for the same
            top-of-viewport slot, with the first card's sticky `top` (88px) landing
            just above this text's own (96px) and covering it mid-scroll (reported
            live: the heading cut off under an overlapping card). Sticky only makes
            sense once they're actually side by side. */}
        <div className="md:sticky md:top-24 self-start">
          <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Everything you need to work smarter with AI.
          </h2>
          <p className="mt-4 max-w-md text-neutral-500">
            Chat with leading AI models, work with any type of content, compare responses, and keep
            your AI usage always under control — all from Alveta.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/register"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get AI Access
            </Link>
          </div>
        </div>

        {/* Sticky-stack scroll effect, pure CSS — each card gets an increasing `top`
            offset and z-index, so as the page scrolls, each one "sticks" in place
            and the next card scrolls up to overlap it, cascading on top rather than
            just scrolling past underneath. md:-scoped for the same reason as the
            text column above — below md the inline `top`/`zIndex` become inert
            no-ops (position defaults to static), so cards just stack in normal
            document flow instead of overlapping the sticky heading. */}
        <div id="models" className="grid gap-4 pb-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`md:sticky rounded-xl border p-5 shadow-lg ${f.card}`}
              style={{ top: `${88 + i * 20}px`, zIndex: i + 1 }}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${f.badge}`}>
                <f.icon className="h-4.5 w-4.5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-neutral-900">{f.title}</h3>
              <p className="mt-1 text-sm text-neutral-600">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
