import { useState } from 'react'
import { signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider, microsoftProvider } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth-store'
import { getApiUrl } from '@/lib/api-url'

interface AuthResult {
  access_token:  string
  refresh_token: string
  token_type:    string
  expires_in:    number
  user: {
    id:                  string
    name:                string
    email:               string
    avatar_url:          string | null
    preferred_currency:  string
    status:              string
    is_admin:            boolean
    admin_role:          string | null
    admin_permissions:   string[]
    welcome_seen_at:     string | null
  }
  is_new_user: boolean
}

export function useFirebaseAuth() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const { setAuth }           = useAuthStore()

  // Shared by Google and Microsoft — both are plain Firebase-popup providers
  // exchanged for our own JWT through the same provider-agnostic
  // /api/v1/auth/firebase endpoint (FirebaseAuthController::detectProvider()
  // reads the token's own sign_in_provider claim, so the backend needed zero
  // changes to support a second provider).
  const signInWithProvider = async (provider: Parameters<typeof signInWithPopup>[1]): Promise<AuthResult | null> => {
    setLoading(true)
    setError(null)

    try {
      // 1. Firebase popup
      const result  = await signInWithPopup(auth, provider)
      const idToken = await result.user.getIdToken()

      // 2. Exchange Firebase token for our platform JWT
      const response = await fetch(
        `${getApiUrl()}/api/v1/auth/firebase`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ id_token: idToken }),
        }
      )

      if (! response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Authentication failed')
      }

      const data: AuthResult = await response.json()

      // 3. Persist to Zustand store (handles localStorage via persist middleware) —
      // the user is fully logged in from this point on.
      setAuth(data.user as never, data.access_token, data.refresh_token)

      // 4. Sign out of Firebase — we use our own JWT from here on. Best-effort only:
      // this call is known to hang under third-party-cookie blocking, flaky networks,
      // or certain browser extensions, and it must never be able to block navigation
      // for a user who is already fully authenticated per step 3 above (confirmed live:
      // an awaited hang here left the button stuck on "Signing in…" indefinitely even
      // though the session was already valid — a reload was the only way out).
      signOut(auth).catch(() => {})

      return data
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      if (message.includes('popup-closed-by-user') || message.includes('cancelled-popup-request')) {
        setError(null)
      } else if (message.includes('missing initial state') || message.includes('sessionStorage')) {
        // Firebase's own text for this (not a stable error.code we could match on
        // instead) — happens when the redirect round-trip to Microsoft/Google
        // loses its state, almost always because the page is open inside an
        // in-app browser (Facebook/Messenger/Instagram) that restricts storage.
        // InAppBrowserWarning above the button already warns for the browsers we
        // can detect ahead of time; this is the fallback for anything that slips
        // through, or a user who proceeded past that warning anyway.
        setError('Sign-in isn\'t supported in this app\'s built-in browser. Please open this page in Chrome or Safari and try again.')
      } else {
        setError(message)
      }
      return null
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = () => signInWithProvider(googleProvider)
  const signInWithMicrosoft = () => signInWithProvider(microsoftProvider)

  return { signInWithGoogle, signInWithMicrosoft, loading, error }
}
