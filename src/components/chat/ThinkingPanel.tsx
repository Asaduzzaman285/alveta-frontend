'use client'

import { useState } from 'react'
import { BrainCircuit, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Deep Think's reasoning trace — collapsed by default once finished, auto-expanded
 * while it's still streaming in (so there's something to see while the answer itself
 * hasn't started yet, matching how the model actually produces it: reasoning first,
 * then the visible answer).
 *
 * Only ever rendered when the backend actually sent reasoning-delta events — see
 * ModelCapabilityResolver's own notes on which providers this is even possible for.
 * Anthropic, Gemini and xAI/DeepSeek/Kimi can produce this; OpenAI cannot (the
 * library only extracts reasoning from the Responses API, which this app doesn't use)
 * — for those, Deep Think still runs and still improves the answer, there's just
 * nothing here to show, and no ThinkingPanel renders at all rather than an empty one.
 */
export function ThinkingPanel({ text, done }: { text: string; done: boolean }) {
  const [open, setOpen] = useState(!done)

  if (!text) return null

  return (
    <div className="mb-2 rounded-lg border border-border bg-muted/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground"
      >
        <BrainCircuit className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left">{done ? 'Thought process' : 'Thinking…'}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto whitespace-pre-wrap px-3 pb-2 text-xs leading-relaxed text-muted-foreground">
          {text}
        </div>
      )}
    </div>
  )
}
