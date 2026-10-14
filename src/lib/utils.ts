import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import apiClient from '@/lib/api-client'
import { describeError } from '@/lib/errors'
import type { ApiError } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Forces a real "Save As" download instead of a browser navigation.
 *
 * Previously fetched the attachment's `storage_url` directly — a signed R2 URL on
 * a different origin than the app. That looked fine at first click but broke
 * intermittently in exactly the way reported live: FileAttachment::storageUrl()'s
 * own comment documents the real mechanism — the signed URL expires (60 minutes),
 * and an expired one makes R2 return 403 with no CORS header at all, which
 * fetch() can't tell apart from a genuine CORS failure. The old catch block then
 * fell back to window.open(), i.e. exactly "clicking download opens a new tab
 * instead of saving." A page left open past that window (completely normal) hit
 * this on every single download attempt afterward.
 *
 * Now takes the attachment's id and goes through this app's own same-origin
 * `/upload/{id}/download` proxy (chat-service's FileAttachmentController::download())
 * instead — a server-to-server storage read has no signed URL and nothing to
 * expire, and the request is same-origin from the browser's point of view, so
 * there is no CORS involved at any point regardless of how long the page has
 * been open. apiClient (not a bare fetch) is what attaches the JWT this
 * authenticated endpoint requires.
 */
export async function downloadFile(attachmentId: string, filename: string): Promise<void> {
  try {
    const response = await apiClient.get(`/api/v1/upload/${attachmentId}/download`, { responseType: 'blob' })
    const blobUrl = URL.createObjectURL(response.data as Blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(blobUrl)
  } catch (err) {
    // No cross-origin URL left to fall back to (that was the whole point) — a real
    // failure here means the file's actually gone or the request itself failed, so
    // say so instead of silently doing nothing. responseType: 'blob' means axios
    // never parses an error response body as JSON on its own (it comes back as a
    // Blob even for a 404/500) — decode it ourselves before handing it to
    // describeError(), or every download failure would show the same generic
    // fallback regardless of cause.
    const axiosErr = err as AxiosError<Blob>
    const blob = axiosErr?.response?.data
    let data: ApiError | undefined
    if (blob instanceof Blob) {
      try {
        data = JSON.parse(await blob.text())
      } catch {
        // Not JSON (e.g. an HTML error page from a proxy) — fall through with no data.
      }
    }
    const status = axiosErr?.response?.status
    toast.error(describeError(
      status ? { response: { status, data } } : axiosErr,
      "We couldn't download that file — please try again."
    ).message)
  }
}

// en-US's Intl currency data doesn't reliably carry a native symbol for every
// ISO code — this map only needs to cover currencies the app actually charges
// in. BDT deliberately spells out "BDT" rather than using the "৳" glyph
// (inconsistent font support made it look broken in some places).
const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', BDT: 'BDT ' }

export function formatCurrency(amount: number | string, currency = 'USD'): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount
  const symbol = CURRENCY_SYMBOLS[currency]
  if (symbol) {
    return `${symbol}${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
}

/** AI usage costs are fractions of a cent — Intl's 2-decimal rounding collapses
 * them to $0.00. Shows the full 6-decimal figure matching the database's
 * decimal(12,6) wallet/cost columns instead of rounding it away. */
export function formatPreciseCurrency(amount: number | string, currency = 'USD'): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `
  return `${symbol}${value.toFixed(6)}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * For a CALENDAR-DATE field (an admin picked "this day," not a precise
 * instant) — e.g. a coupon's valid_from/valid_until, stored as UTC midnight
 * or end-of-day. formatDate()'s toLocaleDateString() re-interprets the
 * timestamp in the VIEWER's own browser timezone, which rolls the displayed
 * day forward or back depending on their offset (confirmed live: an admin in
 * UTC+6 viewing a valid_until stored at 23:59:59 UTC saw "Sep 29" for a date
 * they picked as "Sep 28," since 23:59:59 UTC + 6h lands after local
 * midnight). Reading the date components directly off the UTC ISO string
 * instead — the same thing the edit form's own valid_until.slice(0, 10)
 * already does — shows the same calendar day to every admin regardless of
 * where they are.
 */
export function formatDateUTC(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function formatNumber(n: number | string): string {
  const value = typeof n === 'string' ? parseFloat(n) : n
  return new Intl.NumberFormat('en-US').format(value)
}

/** Shared formatting for every place tokens/cost show up (single chat messages, live
 * compare cards, persisted compare cards, aggregate totals) — one format, not several
 * slightly-different ones. Returns null when there's nothing real to show yet (e.g. a
 * still-streaming message, or a user turn, which never has usage data). `cost` accepts
 * string|number because it arrives as both depending on path: the REST API
 * (ChatMessage.cost) serializes Laravel's decimal:6 cast as a JSON STRING
 * ("0.016709"); the live SSE compare stream sends a genuine PHP float. Reuses
 * formatPreciseCurrency, same as every other cost display in the app (Wallet/Usage/
 * Profile views), instead of a one-off .toFixed() that doesn't handle the string case. */
export function formatUsage(promptTokens?: number | null, completionTokens?: number | null, cost?: string | number | null): string | null {
  // Reversed back at explicit request (2026-09-02) — cost commented out (not
  // removed), token counts shown again. This function's only remaining callers
  // are compare cards and their aggregate total line.
  if (promptTokens != null && completionTokens != null) {
    return `${promptTokens.toLocaleString()} in · ${completionTokens.toLocaleString()} out`
  }
  return null
  // return cost != null ? formatPreciseCurrency(cost) : null
}
