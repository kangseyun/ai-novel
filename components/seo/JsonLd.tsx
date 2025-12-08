export function WebsiteJsonLd() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://luminovel.ai'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Luminovel.ai',
    alternateName: ['Luminovel', 'Luminovel AI'],
    url: siteUrl,
    description: 'Experience immersive AI-powered interactive stories. Chat with unique AI characters, make meaningful choices, and shape your own narrative adventure.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export function OrganizationJsonLd() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://luminovel.ai'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Luminovel.ai',
    url: siteUrl,
    logo: `${siteUrl}/logo.svg`,
    description: 'AI Interactive Chat Novel Platform - Experience immersive AI-powered interactive stories.',
    sameAs: [
      'https://twitter.com/luminovel',
      // Add other social media links as needed
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['English', 'Korean'],
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export function SoftwareApplicationJsonLd() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://luminovel.ai'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Luminovel.ai',
    applicationCategory: 'GameApplication',
    applicationSubCategory: 'Interactive Fiction',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free to start with optional premium features',
    },
    description: 'AI Interactive Chat Novel Platform - Chat with unique AI characters and shape your own narrative adventure.',
    url: siteUrl,
    screenshot: `${siteUrl}/opengraph-image`,
    featureList: [
      'AI-powered character conversations',
      'Interactive storytelling',
      'Multiple story paths',
      'Character customization',
      'Premium story content',
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '1000',
      bestRating: '5',
      worstRating: '1',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export function FAQJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is Luminovel.ai?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Luminovel.ai is an AI-powered interactive chat novel platform where you can chat with unique AI characters, make meaningful choices, and shape your own narrative adventure.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is Luminovel.ai free to use?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes! Luminovel.ai is free to start. You can enjoy basic stories and interactions at no cost. Premium content and features are available for users who want more exclusive experiences.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does the AI character interaction work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Our AI characters are powered by advanced language models that create natural, engaging conversations. Each character has a unique personality and backstory, and they respond dynamically to your choices and messages.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I play on mobile devices?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Absolutely! Luminovel.ai is designed as a mobile-first experience. You can play directly in your browser on any smartphone, tablet, or computer without downloading any apps.',
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://luminovel.ai'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${siteUrl}${item.url}`,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
