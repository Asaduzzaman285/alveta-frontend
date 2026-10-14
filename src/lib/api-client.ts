import axios, { type AxiosInstance, type AxiosError } from 'axios'
import { useAuthStore } from '@/stores/auth-store'
import { getApiUrl } from '@/lib/api-url'

// ─── Axios instance ────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  // Cold Docker/WSL2 starts can push a single request (incl. CORS preflight) past 15-20s —
  // see HANDOFF.md "Environment gotchas". Kept below the gateway's own 45s proxy timeout so a
  // truly hung request still resolves before the user gives up waiting.
  timeout: 40000,
})

// ─── Request interceptor — attach JWT ──────────────────────────────────────

apiClient.interceptors.request.use((config) => {
  // Don't clobber a caller-supplied Authorization header — the login page fetches
  // /auth/me with the just-issued token explicitly, before setAuth() writes it to
  // the store. If the store still holds a stale token from an earlier session,
  // this used to overwrite the fresh one with the stale (possibly expired) one.
  if (!config.headers.Authorization) {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// ─── Response interceptor — handle 401 + token refresh ────────────────────

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token as string)
  )
  failedQueue = []
}

// Shares isRefreshing/failedQueue with the interceptor below so a concurrent 401 from
// an apiClient call and one from refreshAccessToken()'s own callers (the raw-fetch SSE
// streams, which bypass this interceptor entirely) can't both kick off their own
// independent refresh at once and race each other's token writes.
export async function refreshAccessToken(): Promise<string> {
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject })
    })
  }

  isRefreshing = true
  const refreshToken = useAuthStore.getState().refreshToken

  if (!refreshToken) {
    isRefreshing = false
    useAuthStore.getState().clearAuth()
    window.location.href = '/login'
    throw new Error('Not authenticated.')
  }

  try {
    const { data } = await axios.post(`${getApiUrl()}/api/v1/auth/refresh`, { refresh_token: refreshToken })
    useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
    processQueue(null, data.access_token)
    return data.access_token
  } catch (refreshError) {
    processQueue(refreshError, null)
    useAuthStore.getState().clearAuth()
    window.location.href = '/login'
    throw refreshError
  } finally {
    isRefreshing = false
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      try {
        const token = await refreshAccessToken()
        original.headers!.Authorization = `Bearer ${token}`
        return apiClient(original)
      } catch (refreshError) {
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient

/**
 * For the two SSE streaming endpoints (chat/page.tsx's send()/sendCompareTurn()) —
 * they use a raw fetch() instead of this apiClient instance (fetch's native streaming
 * body reader; axios doesn't expose one), which means they never went through the
 * response interceptor above. An access token that expired from the tab just sitting
 * idle (confirmed reported: /chat crashing after 20+ minutes idle, fixed by a manual
 * reload) hit these two calls as a plain unhandled 401 with no retry, unlike every
 * other request in the app. Mirrors the interceptor's own refresh-and-retry-once,
 * reusing refreshAccessToken() above so a concurrent 401 from a normal apiClient call
 * can't race it.
 */
export async function authFetch(url: string, init: RequestInit): Promise<Response> {
  const withAuth = (token: string | null): RequestInit => ({
    ...init,
    headers: { ...init.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })

  const res = await fetch(url, withAuth(useAuthStore.getState().accessToken))
  if (res.status !== 401) return res

  const token = await refreshAccessToken()
  return fetch(url, withAuth(token))
}
