import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 100,
          background: 'linear-gradient(135deg, #0F172A 0%, #1e293b 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 36,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#10b981', fontFamily: 'monospace', fontSize: 80 }}>$_</span>
          <span style={{ color: 'white', fontFamily: 'monospace', fontSize: 60, marginLeft: 8 }}>L</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
