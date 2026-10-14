'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import { CodeBlock } from '@/components/chat/CodeBlock'
import { normalizeMathDelimiters } from '@/lib/normalize-math'

/**
 * The single renderer for every model response in the app.
 *
 * Previously this exact plugin configuration was duplicated in three places (the chat
 * message bubble and both of CompareCard's views), which is how the app ended up with
 * no math support anywhere: there was no one place to add it. Every surface that shows
 * model output should render through this component so a rendering capability is added
 * once rather than three times — and so two models never render the same markdown
 * differently.
 *
 * Plugin order matters:
 *  - remarkMath runs BEFORE remarkBreaks, so `$$…$$` blocks are tokenised as math
 *    before single newlines get turned into hard line breaks inside them.
 *  - rehypeKatex turns those math nodes into real typeset markup; rehypeHighlight
 *    only touches code nodes, so the two don't compete.
 *
 * Note there is no sanitizer in this pipeline: react-markdown does not render raw HTML
 * by default (no rehype-raw here), and KaTeX emits hast nodes directly rather than an
 * HTML string, so its output isn't at risk of being stripped.
 */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      // Normalised first: models emit \( \) and \[ \], which remark-math doesn't
      // recognise and CommonMark actively mangles. See normalize-math.ts.
      remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
      rehypePlugins={[
        // strict:false — KaTeX's strict mode rejects things models emit routinely
        // (unicode inside math, \text quirks, non-standard spacing commands) and each
        // rejection renders as loud red error text. Lenient parsing keeps a slightly
        // unusual expression readable instead of turning it into a wall of red.
        // throwOnError:false so one bad expression can never take down the message.
        [rehypeKatex, { strict: false, throwOnError: false, errorColor: '#b45309' }],
        rehypeHighlight,
      ]}
      components={{ pre: CodeBlock }}
    >
      {normalizeMathDelimiters(content)}
    </ReactMarkdown>
  )
}
