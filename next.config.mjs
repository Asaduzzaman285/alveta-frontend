import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for the Dockerfile's production build — it copies .next/standalone
  // into the final image (a self-contained server bundle, no node_modules needed
  // at runtime). Without this, `next build` never produces that directory at all,
  // and the Docker build fails at the COPY step — never caught before now since
  // this is the first real (non-dev-mode) build this app has ever gone through.
  output: 'standalone',

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_GATEWAY_URL || 'http://localhost:8000'}/api/:path*`,
      },
    ]
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'http',  hostname: 'localhost' },
    ],
  },

  // Dev-only: file changes made on the HOST were silently not triggering Fast
  // Refresh at all inside the container — confirmed live, editing Hero.tsx sat
  // uncompiled until a manual `docker compose restart frontend`. Docker Desktop
  // on Windows doesn't reliably forward native filesystem change events (inotify)
  // across the bind mount into the container, so webpack's default watcher never
  // fires. Polling instead (a periodic stat() check per file) works regardless of
  // that boundary, at the cost of up to ~1s latency and a little extra CPU —
  // acceptable for local dev, and this branch never touches the production
  // standalone build (webpack only runs its watcher in `next dev`, never during
  // `next build`, so `dev` is always false there).
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = { poll: 1000, aggregateTimeout: 300 }
    }
    return config
  },
}

// No NEXT_PUBLIC_SENTRY_DSN set locally — the SDK just no-ops, this wrapper is safe
// to leave on unconditionally rather than branching dev vs prod config.
export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
})
