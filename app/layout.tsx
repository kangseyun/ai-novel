import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import { UtmCapture } from "@/components/UtmCapture";
import { FirebaseProvider } from "@/components/providers/FirebaseProvider";
import { TutorialProvider } from "@/components/tutorial";
import { WelcomeOfferProvider } from "@/components/providers/WelcomeOfferProvider";
import { Toaster } from "sonner";
import { WebsiteJsonLd, OrganizationJsonLd, SoftwareApplicationJsonLd, FAQJsonLd } from "@/components/seo/JsonLd";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://luminovel.ai';

export const metadata: Metadata = {
  // Basic metadata
  title: {
    default: "Luminovel — LUMIN: 7명의 K-pop 아이돌과 함께하는 인터랙티브 스토리",
    template: "%s | Luminovel",
  },
  description:
    "K-pop 가상 그룹 LUMIN 7명과 매일 DM·시나리오·컴백 이벤트를 함께. 클린 PG-13, 단일 PASS 구독으로 모든 멤버 풀 액세스.",

  // Keywords for SEO — LUMIN clean K-pop IP
  keywords: [
    "LUMIN",
    "K-pop interactive story",
    "K-pop chat novel",
    "AI K-pop boy group",
    "K-pop fan experience",
    "LUMIN PASS",
    "interactive fan fiction",
    "K-pop DM simulator",
    "K-pop visual novel",
    "Luminovel",
    "AI interactive story",
    "boy group chat",
  ],

  // Author and creator
  authors: [{ name: "Luminovel" }],
  creator: "Luminovel",
  publisher: "Luminovel",

  // Robots and indexing
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Canonical URL
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: '/',
  },

  // Open Graph (Facebook, LinkedIn, Discord, etc.)
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    alternateLocale: ['en_US'],
    url: siteUrl,
    siteName: 'Luminovel',
    title: 'Luminovel — LUMIN 7명과 함께하는 K-pop 인터랙티브 스토리',
    description:
      'K-pop 가상 그룹 LUMIN 7명과 DM·시나리오·컴백 이벤트. 클린 PG-13, 단일 PASS 구독.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Luminovel — LUMIN K-pop interactive story',
        type: 'image/png',
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'Luminovel — LUMIN 7명과 함께하는 K-pop 인터랙티브 스토리',
    description:
      'K-pop 가상 그룹 LUMIN 7명과 DM·시나리오·컴백 이벤트. 클린 PG-13.',
    images: ['/twitter-image'],
    creator: '@luminovel',
    site: '@luminovel',
  },

  // App links
  manifest: "/manifest.webmanifest",

  // Icons
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    apple: [
      { url: '/apple-touch-icon.svg', type: 'image/svg+xml' },
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
    shortcut: '/favicon.ico',
  },

  // Apple Web App
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Luminovel",
    startupImage: [
      '/apple-touch-icon.svg',
    ],
  },

  // Verification (add your verification codes)
  verification: {
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  },

  // Category
  category: 'entertainment',

  // Other metadata
  applicationName: 'Luminovel.ai',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0F172A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <WebsiteJsonLd />
        <OrganizationJsonLd />
        <SoftwareApplicationJsonLd />
        <FAQJsonLd />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
      >
        <AnalyticsProvider />
        <UtmCapture />
        <FirebaseProvider>
          <TutorialProvider>
            <WelcomeOfferProvider>
              {children}
            </WelcomeOfferProvider>
          </TutorialProvider>
        </FirebaseProvider>
        <Toaster
          position="top-center"
          theme="dark"
          richColors
          closeButton
        />
      </body>
    </html>
  );
}
