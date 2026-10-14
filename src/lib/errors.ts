import type { AxiosError } from 'axios'
import type { ApiError } from '@/types'

// Toast wording convention (applies to every toast.error/toast.success in the app, not
// just this file's own fallback strings): full sentences, sentence case, friendly-but-plain
// tone. Say what happened, and — for errors — what to do next where that's useful
// ("...check X before trying again" rather than a bare "Failed."). Prefer describeError()'s
// ambiguousMessage param over a hand-rolled string so ambiguous network failures (see below)
// get consistent, non-alarmist wording across pages.

export interface ErrorInfo {
  // True when the client never got a response (timeout, dropped connection) — the request
  // may have still succeeded server-side. Seen live during registration: axios timed out
  // while the auth-service had already committed the user row. Never tell the user it
  // "failed" outright in this case, or they'll retry into a duplicate.
  ambiguous: boolean
  message: string
  // Stable machine code from the backend's `error` field (e.g. "already_subscribed",
  // "no_seats_available", "internal_error"), when the service returned one. Lets a caller
  // branch on the cause (e.g. show a specific CTA) without discarding the real `message`.
  code?: string
}

// No-response failures (axios never got a response at all) aren't all the same cause —
// a client-side timeout, a real network outage, and a request the user/app cancelled are
// each distinguishable via axios's own `error.code`. Falling back to one generic sentence
// for all of them hides useful information from the user.
const NO_RESPONSE_DEFAULTS: Record<string, string> = {
  ECONNABORTED: "That took too long to respond — check your connection and try again.",
  ERR_NETWORK: "You appear to be offline — check your connection and try again.",
}

export function describeError(err: unknown, ambiguousMessage?: string): ErrorInfo {
  const axiosErr = err as AxiosError<ApiError>

  if (!axiosErr?.response) {
    const code = axiosErr?.code
    return {
      ambiguous: true,
      message: ambiguousMessage ?? (code ? NO_RESPONSE_DEFAULTS[code] : undefined) ?? "We didn't hear back in time — please try again.",
      code,
    }
  }

  const { status, data } = axiosErr.response

  if (status === 422 && data?.errors) {
    const firstField = Object.values(data.errors)[0]
    return { ambiguous: false, message: Array.isArray(firstField) ? firstField[0] : (data.message ?? 'Please check your input.'), code: data?.error }
  }

  if (status === 409) {
    return { ambiguous: false, message: data?.message ?? 'This already exists.', code: data?.error }
  }

  return { ambiguous: false, message: data?.message ?? 'Something went wrong. Please try again.', code: data?.error }
}
