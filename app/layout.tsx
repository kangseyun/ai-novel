import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AnalyticsProvider from "@/components/AnalyticsProvider";
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
    default: "Luminovel.ai - AI Interactive Chat Novel Platform",
    template: "%s | Luminovel.ai",
  },
  description: "Experience immersive AI-powered interactive stories. Chat with unique AI characters, make meaningful choices, and shape your own narrative adventure. Start your story today!",

  // Keywords for SEO
  keywords: [
    "AI chat novel",
    "interactive fiction",
    "AI characters",
    "chat story",
    "visual novel",
    "AI storytelling",
    "interactive narrative",
    "choice-based games",
    "AI roleplay",
    "text adventure",
    "AI companion",
    "story game",
  ],

  // Author and creator
  authors: [{ name: "Luminovel.ai" }],
  creator: "Luminovel.ai",
  publisher: "Luminovel.ai",

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
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Luminovel.ai',
    title: 'Luminovel.ai - AI Interactive Chat Novel Platform',
    description: 'Experience immersive AI-powered interactive stories. Chat with unique AI characters, make meaningful choices, and shape your own narrative adventure.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Luminovel.ai - AI Interactive Chat Novel Platform',
        type: 'image/png',
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'Luminovel.ai - AI Interactive Chat Novel Platform',
    description: 'Experience immersive AI-powered interactive stories. Chat with unique AI characters and shape your own narrative adventure.',
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
