'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import analytics from '@/lib/analytics';

// 환경변수
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
const AIRBRIDGE_APP = process.env.NEXT_PUBLIC_AIRBRIDGE_APP || '';
const AIRBRIDGE_WEB_TOKEN = process.env.NEXT_PUBLIC_AIRBRIDGE_WEB_TOKEN || '';

// 페이지뷰 추적 (SPA 라우팅)
function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    analytics.trackPageView(pathname);
  }, [pathname, searchParams]);

  return null;
}

export default function AnalyticsProvider() {
  // 클라이언트 사이드에서만 초기화
  useEffect(() => {
    analytics.init();
  }, []);

  return (
    <>
      {/* ===== Meta Pixel ===== */}
      {META_PIXEL_ID && (
        <>
          <Script
            id="meta-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
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
              `,
            }}
          />
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}

      {/* ===== Airbridge (MMP) ===== */}
      {AIRBRIDGE_APP && AIRBRIDGE_WEB_TOKEN && (
        <Script
          id="airbridge-sdk"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(a,i,r,b,R,I,D,g,e){a[R]=a[R]||function(){(a[R].q=a[R].q||[]).push(arguments)};
              g=i.createElement(r);e=i.getElementsByTagName(r)[0];g.async=1;g.src=b;
              e.parentNode.insertBefore(g,e)})(window,document,'script','https://static.airbridge.io/sdk/latest/airbridge.min.js','airbridge');
              airbridge.init({
                app: '${AIRBRIDGE_APP}',
                webToken: '${AIRBRIDGE_WEB_TOKEN}',
                utmParsing: true,
                cookieWindow: 90,
              });
            `,
          }}
        />
      )}

      {/* SPA 페이지뷰 추적 */}
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </>
  );
}
