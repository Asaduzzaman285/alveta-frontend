'use client'

import Link from 'next/link'
import * as Accordion from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'

// Final content and order per the user's own numbered list (2026-09-21) — six items
// now, not five, in this exact sequence; wording is verbatim except for trivial
// punctuation cleanup. Layout (2-column grid, one shared single-open accordion)
// unchanged from the prior pass. #6's answer links to the real /refund-policy page
// (frontend/src/app/refund-policy/page.tsx already exists) rather than a bare
// mention of "our refund policy" with nothing to click.
const FAQS = [
  {
    q: 'What is Alveta?',
    a: 'Alveta is an all-in-one AI platform that brings multiple AI models together in one place. Instead of managing different AI tools and subscriptions, you can access and use them through Alveta.',
  },
  {
    q: 'Do I need separate subscriptions for different AI models?',
    a: 'No. You can just subscribe to any Alveta plan that suits and you get tokens following your package. Use any AI tool or models you want with the tokens. As simple as that.',
  },
  {
    q: "How does Alveta's token system work?",
    a: "You purchase tokens through Alveta and use them based on your AI activity. Your usage is clearly tracked, so you always know how many tokens you've used and have remaining.",
  },
  {
    q: 'Are there any hidden charges?',
    a: "No. Alveta believes in transparent pricing. You'll know what you're paying for and how you're using your tokens, with no hidden charges added along the way.",
  },
  {
    q: 'Which payment methods and currencies does Alveta support?',
    a: 'Alveta is designed to support both local and international payments, making it convenient to purchase tokens and access AI regardless of where you are.',
  },
  {
    q: 'Can I ask for a refund?',
    a: 'refund-link',
  },
]

export function FaqSection() {
  return (
    <section className="px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Frequently Asked Questions
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-neutral-500">
          Here are some common queries that comes in your mind.
        </p>

        {/* One shared Accordion.Root across the whole grid (not one per item) —
            single-open across all six, matching both the earlier reference screenshot
            (exactly one item expanded at a time) and the static landing/index.html
            mirror's own hand-written toggle JS, which closes every other item
            before opening the clicked one regardless of which column it's in. */}
        <Accordion.Root type="single" collapsible className="mt-10 grid gap-3 text-left sm:grid-cols-2">
          {FAQS.map((item, i) => (
            <Accordion.Item
              key={item.q}
              value={item.q}
              className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
            >
              <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-neutral-900">
                  <span>{String(i + 1).padStart(2, '0')}. {item.q}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="px-5 pb-4 text-sm text-neutral-600 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                {/* The refund item is the one answer with a real link in it (to the
                    actual /refund-policy page) rather than plain text — everything
                    else in FAQS is a plain string rendered as-is. */}
                {item.a === 'refund-link' ? (
                  <>
                    Yes, obviously you can. We are offering a lifetime refund policy that others
                    don&apos;t even dare to offer. You can refund your unused AI credit anytime
                    based on our{' '}
                    <Link href="/refund-policy" className="font-medium text-primary underline underline-offset-2 hover:opacity-80">
                      refund policy
                    </Link>
                    .
                  </>
                ) : (
                  item.a
                )}
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  )
}
