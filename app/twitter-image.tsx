import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Luminovel.ai - AI Interactive Chat Novel Platform'
export const size = {
  width: 1200,
  height: 600,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0F172A',
          backgroundImage: 'radial-gradient(circle at 25% 25%, #1e293b 0%, transparent 50%), radial-gradient(circle at 75% 75%, #1e1b4b 0%, transparent 50%)',
        }}
      >
        {/* Terminal-style logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <span
            style={{
              fontSize: 64,
              fontFamily: 'monospace',
              color: '#10b981',
              marginRight: 16,
            }}
          >
            $_
          </span>
          <span
            style={{
              fontSize: 64,
              fontFamily: 'monospace',
              color: 'white',
              fontWeight: 400,
            }}
          >
            luminovel
          </span>
          <span
            style={{
              fontSize: 64,
              fontFamily: 'monospace',
              color: '#10b981',
              fontWeight: 700,
            }}
          >
            .ai
          </span>
          <div
            style={{
              width: 16,
              height: 44,
              backgroundColor: '#10b981',
              marginLeft: 8,
            }}
          />
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            color: '#94a3b8',
            marginBottom: 32,
            fontFamily: 'sans-serif',
          }}
        >
          AI Interactive Chat Novel Platform
        </div>

        {/* CTA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 32px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderRadius: 16,
            border: '2px solid rgba(16, 185, 129, 0.4)',
          }}
        >
          <span
            style={{
              fontSize: 24,
              color: '#10b981',
              fontFamily: 'sans-serif',
              fontWeight: 600,
            }}
          >
            Chat with AI Characters • Immersive Stories • Your Choices Matter
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
