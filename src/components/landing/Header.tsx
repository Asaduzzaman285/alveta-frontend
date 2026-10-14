'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, ChevronDown, Lock, Menu, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ModelsPopup } from '@/components/models/ModelsPopup'
import { usePublicModels } from '@/hooks/usePublicModels'

const NAV_LINKS = [
  { label: 'Features', href: '#features', hasChevron: true },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Contact', href: '/contact' },
]

// Pixel-accurate reproduction of the Figma "Navigation Bar" component: a SOLID WHITE
// floating pill (fill #FFFFFF, not glass/translucent) sitting over the purple hero
// background — width 1020px / height 76px / radius 24px / 16px padding / space-between,
// per the design's own property panel. CONFIRMED a second time, 2026-09-21, by
// decoding the actual raw pixels of the master export (01_ Home.png) — the white
// pill spans x≈210–1228 of a 1440px-wide canvas (≈1020px) at a height of exactly
// 76px. A prior pass in this same file briefly shrank this to 880px/64px/rounded-full
// based on a rough visual read of two lower-resolution reference screenshots — that
// was wrong, confirmed wrong by this pixel measurement, and reverted. The real
// problem those screenshots were pointing at was never this pill's own size — see
// Hero.tsx's own comment for what the real gap/composition issue actually was.
// Every child uses dark text/icons instead of the previous white-on-dark treatment
// now that the background is white; only "Get Started" keeps the purple accent
// (white text on a purple fill) as the one CTA color.
export function Header() {
  const router = useRouter()
  const { models } = usePublicModels()
  // Below md, the desktop nav links + Sign In + Get Started have no room in a single
  // 76px-tall pill — they were cramping/overlapping (reported live on a real phone
  // screen). Collapsed into one hamburger + a dropdown panel instead of shrinking
  // everything further, which was already at its readable floor.
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="relative mx-auto flex h-[76px] w-full max-w-[1020px] items-center justify-between rounded-3xl bg-white px-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
      <Logo className="h-6 w-auto text-neutral-900" />

      <nav className="hidden items-center gap-8 text-sm font-medium text-neutral-700 md:flex">
        {/* Hover-triggered popup (not a click/scroll anchor like the other links) —
            matches the Figma "Navigation Bar" spec: hovering "Models" reveals the same
            Flagship/More Models grid as the rest of that design. A visitor here isn't
            logged in yet, so selecting a model can't start a chat session — it routes
            to /register instead, same as the "Get Started" CTA. */}
        <ModelsPopup
          trigger={
            <button type="button" className="flex items-center gap-1 transition-colors hover:text-neutral-900">
              Models
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          }
          models={models}
          onSelectModel={() => router.push('/register')}
        />
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href} className="flex items-center gap-1 transition-colors hover:text-neutral-900">
            {link.label}
            {link.hasChevron && <ChevronDown className="h-3.5 w-3.5" />}
          </a>
        ))}
      </nav>

      <div className="hidden items-center gap-4 md:flex">
        <Link
          href="/login"
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 transition-colors hover:text-neutral-900"
        >
          Sign In
          <Lock className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/register"
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Get Started
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <button
        type="button"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 md:hidden"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Anchored off the header's own `relative` (same trick ModelsPopup uses) so it
          spans the pill's full width rather than floating off the hamburger button. */}
      {mobileOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 flex flex-col gap-1 rounded-2xl border border-neutral-100 bg-white p-3 text-sm font-medium text-neutral-700 shadow-[0_8px_30px_rgba(0,0,0,0.12)] md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
            >
              {link.label}
            </a>
          ))}
          <div className="my-1 h-px bg-neutral-100" />
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
          >
            Sign In
            <Lock className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/register"
            onClick={() => setMobileOpen(false)}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Get Started
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </header>
  )
}
