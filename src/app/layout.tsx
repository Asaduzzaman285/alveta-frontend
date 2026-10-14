import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import localFont from 'next/font/local'
import { Toaster } from 'sonner'
import { config as fontAwesomeConfig } from '@fortawesome/fontawesome-svg-core'
import { QueryProvider } from '@/lib/query-provider'
import { ImageLightboxProvider } from '@/components/ui/ImageLightbox'
import { MarketingTrackers } from '@/components/analytics/MarketingTrackers'
import 'highlight.js/styles/github.css'
// KaTeX's own stylesheet — rehype-katex emits markup that is unreadable without it
// (fractions, radicals and scripts all collapse into inline text). Imported globally
// here alongside the syntax-highlighting theme rather than inside MarkdownMessage, so
// it is bundled once rather than per-render.
import 'katex/dist/katex.min.css'
// FontAwesome (free tier only — no Pro Kit/license on this account) is used just
// for TakaIcon (BDT price displays); the stylesheet imported directly here (rather
// than relying on FontAwesome's default JS-injected CSS) is the standard Next.js
// integration, avoiding a hydration-mismatch flash.
import '@fortawesome/fontawesome-svg-core/styles.css'
import './globals.css'

fontAwesomeConfig.autoAddCss = false

const inter = Inter({ subsets: ['latin'], variable: '--font-body' })
// Headings/titles use this instead of Inter — a distinct display face gives cards and
// page titles more visual weight without touching every page's body copy. Was Plus
// Jakarta Sans (a Google font); switched to Inter Display's own local files per the
// updated landing-page design — self-hosted via next/font/local rather than
// next/font/google since there's no Google-hosted "Inter Display" family (it's
// distributed as a standalone static download, not on Google Fonts).
const interDisplay = localFont({
  src: [
    { path: '../fonts/inter-display/InterDisplay-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../fonts/inter-display/InterDisplay-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: '../fonts/inter-display/InterDisplay-Bold.ttf', weight: '700', style: 'normal' },
    { path: '../fonts/inter-display/InterDisplay-ExtraBold.ttf', weight: '800', style: 'normal' },
  ],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://app.alveta.ai'),
  title: 'Alveta.ai — All the Best AI Models, One Place',
  description: 'Access, compare, and use the world\'s leading AI models all from one powerful workspace. Stop jumping between AI tools.',
  openGraph: {
    title: 'All Your AI Tools in One Subscription',
    description: 'Access, compare, and use the world\'s leading AI models all from one powerful workspace.',
    siteName: 'Alveta.ai',
    type: 'website',
    images: [{ url: '/OpenGraphbanner.png', width: 1200, height: 630, alt: 'Alveta.ai — All Your AI Tools in One Subscription' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'All Your AI Tools in One Subscription',
    description: 'Access, compare, and use the world\'s leading AI models all from one powerful workspace.',
    images: ['/OpenGraphbanner.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${interDisplay.variable} font-sans`}>
        <MarketingTrackers />
        <QueryProvider>
          <ImageLightboxProvider>
            {children}
            {/* closeButton so a toast can always be dismissed by hand — sonner pauses
                its auto-dismiss timer while the tab is unfocused or the toast is
                hovered, which is how an error notification ends up apparently stuck
                on screen across page navigations. */}
            <Toaster position="top-right" richColors closeButton />
          </ImageLightboxProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
