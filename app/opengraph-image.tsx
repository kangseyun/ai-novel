import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Luminovel.ai - AI Interactive Chat Novel Platform'
export const size = {
  width: 1200,
  height: 630,
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
        {/* Decorative elements */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#ef4444',
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#eab308',
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#22c55e',
            }}
          />
        </div>

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
              fontSize: 72,
              fontFamily: 'monospace',
              color: '#10b981',
              marginRight: 16,
            }}
          >
            $_
          </span>
          <span
            style={{
              fontSize: 72,
              fontFamily: 'monospace',
              color: 'white',
              fontWeight: 400,
            }}
          >
            luminovel
          </span>
          <span
            style={{
              fontSize: 72,
              fontFamily: 'monospace',
              color: '#10b981',
              fontWeight: 700,
            }}
          >
            .ai
          </span>
          <div
            style={{
              width: 20,
              height: 50,
              backgroundColor: '#10b981',
              marginLeft: 8,
            }}
          />
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 36,
            color: '#94a3b8',
            marginBottom: 48,
            fontFamily: 'sans-serif',
          }}
        >
          AI Interactive Chat Novel Platform
        </div>

        {/* Features */}
        <div
          style={{
            display: 'flex',
            gap: 48,
          }}
        >
          {['Chat with AI Characters', 'Immersive Stories', 'Your Choices Matter'].map((feature) => (
            <div
              key={feature}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 24px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderRadius: 12,
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                }}
              />
              <span
                style={{
                  fontSize: 20,
                  color: '#10b981',
                  fontFamily: 'sans-serif',
                }}
              >
                {feature}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom decoration */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 18,
              color: '#64748b',
              fontFamily: 'monospace',
            }}
          >
            luminovel.ai
          </span>
          <span
            style={{
              fontSize: 18,
              color: '#475569',
            }}
          >
            •
          </span>
          <span
            style={{
              fontSize: 18,
              color: '#64748b',
              fontFamily: 'sans-serif',
            }}
          >
            Start Your Story Today
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
