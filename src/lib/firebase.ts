import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

// Prevent duplicate initialization in Next.js dev mode
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Always prompt account selection
googleProvider.setCustomParameters({ prompt: 'select_account' })

// Microsoft 365 / Azure AD sign-in — same Firebase-popup mechanism as Google,
// just a generic OAuthProvider configured for Microsoft's OIDC endpoint rather
// than a dedicated GoogleAuthProvider-style class (Firebase has no separate
// MicrosoftAuthProvider). Must be enabled in the Firebase Console (Authentication
// → Sign-in method → Microsoft) with a real Azure AD app registration's
// Application (client) ID + client secret before this actually works — Firebase
// rejects the popup with an "operation-not-allowed" error until that's done.
export const microsoftProvider = new OAuthProvider('microsoft.com')
microsoftProvider.setCustomParameters({ prompt: 'select_account' })
