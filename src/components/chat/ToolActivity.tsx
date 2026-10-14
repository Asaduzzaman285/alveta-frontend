'use client'

import { Check, Loader2, Search, X } from 'lucide-react'
import { toolActivityLabel, type ActiveToolCall } from '@/lib/tool-activity'
import { cn } from '@/lib/utils'

/**
 * One row per tool call this turn — a spinner while it's running, a check once it's
 * done, an X if it failed. Rendered above the message content, and kept visible even
 * after text starts streaming (not just while the bubble is otherwise empty): the
 * model's final answer often cites what it found, so "Found 5 sources" staying put
 * above the answer gives that context rather than disappearing the instant the first
 * token arrives.
 */
export function ToolActivity({ calls }: { calls: ActiveToolCall[] }) {
  if (calls.length === 0) return null

  return (
    <div className="mb-2 space-y-1">
      {calls.map((call) => (
        <div
          key={call.id}
          className={cn(
            'flex items-center gap-2 text-xs',
            call.status === 'error' ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {call.status === 'running' && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
          {call.status === 'done' && <Check className="h-3 w-3 shrink-0" />}
          {call.status === 'error' && <X className="h-3 w-3 shrink-0" />}
          {call.name === 'WebSearchTool' && <Search className="h-3 w-3 shrink-0" />}
          <span>{toolActivityLabel(call)}</span>
        </div>
      ))}
    </div>
  )
}
