import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function og() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#09000f',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Subtle radial glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 700,
            height: 400,
            background:
              'radial-gradient(ellipse at center, rgba(109,40,217,0.35) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Logo mark: two overlapping rectangles */}
        <div style={{ position: 'relative', width: 96, height: 96, marginBottom: 40, display: 'flex' }}>
          {/* Back rect */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 60,
              height: 60,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #2e1065, #09000f)',
              border: '2.5px solid #6d28d9',
            }}
          />
          {/* Front rect */}
          <div
            style={{
              position: 'absolute',
              top: 34,
              left: 34,
              width: 60,
              height: 60,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #c4b5fd, #6d28d9)',
            }}
          />
        </div>

        {/* Wordmark */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            color: '#f5f3ff',
            letterSpacing: '-3px',
            lineHeight: 1,
            marginBottom: 20,
          }}
        >
          Overframe
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 30,
            color: '#a78bfa',
            fontWeight: 400,
            letterSpacing: '-0.5px',
          }}
        >
          Browser overlay for PC gamers · Free &amp; open source
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
