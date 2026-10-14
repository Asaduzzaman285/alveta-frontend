/**
 * The real API host to call — resolved at runtime from the browser's own
 * hostname rather than trusted from Next's build-time NEXT_PUBLIC_API_URL
 * alone, so ONE frontend build/image can correctly serve two fully
 * independent backend stacks (see docker-compose.prod.yml's STAGING section
 * and the Caddyfile): loading the app from staging.alveta.ai calls
 * staging-api.alveta.ai, loading it from anywhere else (app.alveta.ai, local
 * dev, a preview URL) calls whatever NEXT_PUBLIC_API_URL was baked in at
 * build time. Next.js inlines NEXT_PUBLIC_* vars into the client bundle at
 * build time, so that alone can never differ per request the way this needs
 * to — this is the one function every API call in the app should go through
 * instead of reading process.env.NEXT_PUBLIC_API_URL directly.
 */
export function getApiUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'staging.alveta.ai') {
    return 'https://staging-api.alveta.ai'
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
}
