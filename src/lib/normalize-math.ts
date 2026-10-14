/**
 * Converts the LaTeX delimiters models actually emit into the ones remark-math
 * understands.
 *
 * remark-math only recognises `$…$` and `$$…$$`. Models routinely emit `\(…\)` and
 * `\[…\]` instead — and those are actively harmful when left alone, because
 * CommonMark treats `\[` as an escaped bracket: the backslash is consumed and a bare
 * `[` is rendered, while `\frac`/`\sqrt` survive as literal text (`\f` isn't a valid
 * escape). That is exactly the "[ … ] with visible \frac" output seen in production.
 *
 * The hard part is doing this WITHOUT touching regions where a `$` or a backslash is
 * meaningful as literal text:
 *
 *   - fenced code blocks (```…```) and inline code (`…`) must pass through verbatim,
 *     or a JS snippet containing "\\frac{1}{2}" gets silently rewritten
 *   - prose prices like "$80" and "$100 to $200" must not be read as a math span
 *
 * So this is a small scanner rather than a set of global regexes: it walks the string
 * once, tracks whether it is inside a fence or inline code, and only rewrites in the
 * regions that are genuinely prose.
 */

/** Matches a currency-ish `$` — a dollar immediately followed by a digit. */
function looksLikeCurrency(text: string, dollarIndex: number): boolean {
  return /\d/.test(text[dollarIndex + 1] ?? '')
}

/**
 * Rewrites `\(…\)` → `$…$` and `\[…\]` → `$$…$$` in the prose regions of a markdown
 * string, leaving code untouched.
 */
export function normalizeMathDelimiters(markdown: string): string {
  if (!markdown) return markdown

  let out = ''
  let i = 0
  const len = markdown.length

  while (i < len) {
    // ---- fenced code block: copy through to the closing fence untouched ----
    if (markdown.startsWith('```', i)) {
      const close = markdown.indexOf('```', i + 3)
      const end = close === -1 ? len : close + 3
      out += markdown.slice(i, end)
      i = end
      continue
    }

    // ---- inline code: copy through to the closing backtick untouched ----
    if (markdown[i] === '`') {
      const close = markdown.indexOf('`', i + 1)
      const end = close === -1 ? len : close + 1
      out += markdown.slice(i, end)
      i = end
      continue
    }

    // ---- an escaped backslash consumes BOTH characters ----
    // `\\` is a line break in LaTeX and appears constantly inside cases/aligned/matrix
    // blocks — often as `\\[6pt]` with a spacing argument. Without this, the scanner
    // sees `\[` starting at the SECOND backslash, mistakes it for an opening display
    // delimiter, and emits a stray `$$`. That unbalances the pairing, so the math span
    // never closes where it should and swallows every heading, list and paragraph that
    // follows it — confirmed live as a wall of red KaTeX error text with the rest of
    // the reply trapped inside it.
    if (markdown.startsWith('\\\\', i)) {
      out += '\\\\'
      i += 2
      continue
    }

    // ---- display math: \[ … \]  →  $$ … $$ ----
    if (markdown.startsWith('\\[', i)) {
      const close = markdown.indexOf('\\]', i + 2)
      if (close !== -1) {
        const body = markdown.slice(i + 2, close).trim()
        // Kept on its own lines so remark-math treats it as a display block rather
        // than an inline span that happens to use $$.
        out += `\n\n$$\n${body}\n$$\n\n`
        i = close + 2
        continue
      }
    }

    // ---- existing $$ … $$ : force the delimiters onto their own lines ----
    // remark-math treats display math as a FENCED BLOCK, like a code fence: the closing
    // `$$` only closes it when it sits on a line of its own. Models overwhelmingly emit
    // the closer inline instead (`… \end{cases}$$`), so the fence never closes and
    // swallows every heading, list and paragraph to the end of the message — verified
    // against the real remark pipeline, where an inline closer yields heading:0 and an
    // own-line closer yields heading:1. Reflowing here is idempotent: correctly
    // formatted blocks come out unchanged.
    if (markdown.startsWith('$$', i)) {
      const close = markdown.indexOf('$$', i + 2)
      if (close !== -1) {
        const body = markdown.slice(i + 2, close).trim()
        out += `\n\n$$\n${body}\n$$\n\n`
        i = close + 2
        continue
      }
    }

    // ---- inline math: \( … \)  →  $ … $ ----
    if (markdown.startsWith('\\(', i)) {
      const close = markdown.indexOf('\\)', i + 2)
      if (close !== -1) {
        out += `$${markdown.slice(i + 2, close).trim()}$`
        i = close + 2
        continue
      }
    }

    // A lone `$` in prose is left exactly as-is. remark-math already requires a
    // closing delimiter to form a math span, so "$80" on its own stays literal —
    // this check exists to document the case and to avoid ever "helpfully"
    // escaping or pairing it.
    if (markdown[i] === '$' && looksLikeCurrency(markdown, i)) {
      out += '$'
      i += 1
      continue
    }

    out += markdown[i]
    i += 1
  }

  return out
}
