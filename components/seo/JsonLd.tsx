export function WebsiteJsonLd() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://luminovel.ai'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Luminovel',
    alternateName: ['Luminovel.ai', 'LUMIN', 'LUMIN PASS'],
    url: siteUrl,
    description: 'K-pop 가상 그룹 LUMIN 7명과 함께하는 인터랙티브 스토리. DM, 시나리오, 컴백 이벤트, 멤버 생일 — 클린 PG-13 단일 PASS 구독.',
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
    name: 'Luminovel',
    url: siteUrl,
    logo: `${siteUrl}/logo.svg`,
    description: 'K-pop 가상 아이돌 그룹 LUMIN(7인조)과 팬을 잇는 인터랙티브 스토리 플랫폼.',
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
    name: 'Luminovel',
    applicationCategory: 'EntertainmentApplication',
    applicationSubCategory: 'K-pop Interactive Story',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: '무료 가입 + LUMIN PASS $99/월 (전 멤버 풀 액세스)',
    },
    description: 'K-pop 가상 그룹 LUMIN의 7명 멤버와 매일 DM·시나리오·컴백 이벤트로 교류하는 인터랙티브 스토리 플랫폼.',
    url: siteUrl,
    screenshot: `${siteUrl}/opengraph-image`,
    featureList: [
      'LUMIN 7명 멤버 개별 DM',
      '클린 PG-13 K-pop 인터랙티브 스토리',
      '컴백 시즌 D-day 이벤트',
      '멤버 생일 합창 메시지',
      'PASS 단일 구독 (전 멤버 풀 액세스)',
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
        name: 'Luminovel은 무엇인가요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Luminovel은 K-pop 가상 아이돌 그룹 LUMIN(7인조 보이그룹, 자체 IP)과 매일 DM·시나리오·컴백 이벤트로 교류할 수 있는 인터랙티브 스토리 플랫폼이에요. 모든 콘텐츠는 클린 PG-13입니다.',
        },
      },
      {
        '@type': 'Question',
        name: 'LUMIN PASS는 어떤 구독인가요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'LUMIN PASS($99/월 또는 $990/년)는 7명 멤버 모두와의 무제한 DM, 그룹 단톡방, 컴백 D-day 이벤트, 멤버 생일 합창 메시지 등 모든 프리미엄 기능을 포함하는 단일 구독이에요. 가입 후 24시간 내 50% 할인 Welcome Offer 제공, 7일 무조건 환불 보장.',
        },
      },
      {
        '@type': 'Question',
        name: 'LUMIN 멤버는 실제 K-pop 아이돌인가요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '아니요, LUMIN(해온/카엘/렌/준/에이드리언/솔/노아)은 Luminovel이 만든 자체 가상 아이돌 그룹이에요. 실제 아이돌·소속사·곡명은 일절 등장하지 않습니다.',
        },
      },
      {
        '@type': 'Question',
        name: '모바일에서도 사용할 수 있나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '네! Luminovel은 모바일 우선 디자인이에요. 브라우저에서 바로 시작할 수 있고 별도 앱 설치가 필요 없어요.',
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
