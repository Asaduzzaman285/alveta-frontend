'use client'

import { useRouter } from 'next/navigation'
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth'
import { postLoginPath } from '@/lib/post-login-redirect'

interface Props {
  onSuccess?: () => void
  label?: string
  /** Cosmetic only for now — Firebase's Microsoft popup flow is identical either way. */
  mode?: 'signin' | 'signup'
}

// Mirrors GoogleSignInButton exactly (same Firebase-popup flow, same platform-JWT
// exchange) — see useFirebaseAuth's signInWithProvider for why the two share one
// implementation. Kept as a separate component rather than a `provider` prop on
// GoogleSignInButton since each has its own brand logo/name baked into its markup.
export function MicrosoftSignInButton({ onSuccess, label = 'Continue with Microsoft' }: Props) {
  const router                                 = useRouter()
  const { signInWithMicrosoft, loading, error } = useFirebaseAuth()

  const handleClick = async () => {
    const result = await signInWithMicrosoft()
    if (result) {
      onSuccess ? onSuccess() : router.push(postLoginPath(result.user))
    }
  }

  return (
    <div className="w-full">
      <button
        onClick={handleClick}
        disabled={loading}
        className="
          w-full flex items-center justify-center gap-2.5
          px-4 py-2.5 rounded-full border border-gray-300
          bg-white hover:bg-gray-50 active:bg-gray-100
          text-gray-700 font-medium text-sm
          transition-colors duration-150
          disabled:opacity-60 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        "
        aria-label="Sign in with Microsoft"
      >
        {loading ? (
          <svg className="animate-spin h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          /* Official Microsoft four-square logo */
          <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
        )}
        <span>{loading ? 'Signing in…' : label}</span>
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-600 text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
