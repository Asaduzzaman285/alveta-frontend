'use client'

import { useRef, useState, type ComponentPropsWithoutRef } from 'react'
import { Check, Copy } from 'lucide-react'

/**
 * Custom ReactMarkdown `pre` renderer (pass as `components={{ pre: CodeBlock }}`)
 * — adds a copy button to every fenced code block, which had none before
 * (confirmed missing in testing). rehype-highlight only wraps real fenced code
 * blocks in <pre><code class="hljs ...">, never inline `code` spans, so this
 * naturally only appears where it should. Reads the block's own rendered
 * .textContent for the actual copy rather than re-deriving it from markdown/AST
 * — simpler and correct regardless of how deeply rehype-highlight nests
 * syntax-highlighting spans inside.
 */
export function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<'pre'>) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = preRef.current?.textContent ?? ''
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API unavailable (non-HTTPS context, permissions) — not worth
      // surfacing an error over for a nice-to-have copy button.
    }
  }

  return (
    <div className="group relative">
      <pre ref={preRef} {...props}>{children}</pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy code"
        title="Copy code"
        className="absolute right-2 top-2 rounded-md border border-border/50 bg-background/80 p-1.5 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}
