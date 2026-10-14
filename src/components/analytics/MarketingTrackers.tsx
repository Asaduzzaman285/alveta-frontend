'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'

// Marketing/ad tracking (GA4, Meta Pixel, MS Clarity, AdRoll) — scoped to the
// pre-signup funnel only (landing, login, register), not the authenticated app.
// Wiring these into the root layout unconditionally would also start Meta
// Pixel/AdRoll/Clarity recording logged-in users inside real chat sessions —
// mouse movement, clicks, session replay of actual product usage — which is a
// materially bigger privacy footprint than what was asked for (tracking the
// marketing conversion funnel). Rendered once from the root layout; gates itself
// by path instead of needing a second layout file, since "/" (landing) and
// "/login"/"/register" (route groups — no URL segment of their own) don't share
// a common layout ancestor other than the root.
const MARKETING_PATHS = ['/', '/login', '/register']

// IDs supplied directly by the marketing team, confirmed authentic — not sourced
// or guessed. Keep this file as the one place they're recorded if they ever change.
const GA4_MEASUREMENT_ID = 'G-GVB7XQKDBK'
const META_PIXEL_ID = '1072706265344816'
const CLARITY_PROJECT_ID = 'yjpu8h1iep'
const ADROLL_ADV_ID = 'MFGH3JQQIJHT5IER5OUGFB'
const ADROLL_PIX_ID = '3UAI2BDPBVCVBMWJP3JUJL'

export function MarketingTrackers() {
  const pathname = usePathname()
  if (!MARKETING_PATHS.includes(pathname)) return null

  return (
    <>
      {/* Google tag (gtag.js) / GA4 */}
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA4_MEASUREMENT_ID}');
        `}
      </Script>

      {/* Meta Pixel — noscript fallback is inert here since this whole component only
          renders once client JS has run; an acceptable gap given the vast majority of
          real traffic runs JS, not worth a server-side (middleware/header-based) path
          check just to cover it. */}
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${META_PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img
          height={1} width={1} style={{ display: 'none' }} alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>

      {/* MS Clarity — session recording. If a payment/wallet field is ever added to
          one of these three pages, mask it in Clarity's own dashboard settings before
          that ships; nothing on landing/login/register today collects card data. */}
      <Script id="ms-clarity" strategy="afterInteractive">
        {`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
        `}
      </Script>

      {/* AdRoll retargeting pixel */}
      <Script id="adroll" strategy="afterInteractive">
        {`
          adroll_adv_id = "${ADROLL_ADV_ID}"; adroll_pix_id = "${ADROLL_PIX_ID}"; adroll_version = "2.0";
          (function(w, d, e, o, a) {
            w.adroll_tag_source = w.adroll_tag_source || "manual";
            w.__adroll_loaded = true;
            w.adroll = w.adroll || [];
            w.adroll.f = ['setProperties', 'identify', 'track', 'identify_email', 'get_cookie'];
            var roundtripUrl = "https://s.adroll.com/j/" + adroll_adv_id + "/roundtrip.js";
            for (a = 0; a < w.adroll.f.length; a++) {
              w.adroll[w.adroll.f[a]] = w.adroll[w.adroll.f[a]] || (function(n) { return function() { w.adroll.push([n, arguments]) } })(w.adroll.f[a])
            }
            e = d.createElement('script'); o = d.getElementsByTagName('script')[0]; e.async = 1; e.src = roundtripUrl; o.parentNode.insertBefore(e, o);
          })(window, document);
          adroll.track("pageView");
        `}
      </Script>
    </>
  )
}
