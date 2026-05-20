import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function appleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#09000f',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Logo mark: two overlapping rectangles */}
        <div style={{ position: 'relative', width: 130, height: 130, display: 'flex' }}>
          {/* Back rect */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 84,
              height: 84,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #2e1065, #09000f)',
              border: '3px solid #6d28d9',
            }}
          />
          {/* Front rect */}
          <div
            style={{
              position: 'absolute',
              top: 44,
              left: 44,
              width: 84,
              height: 84,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #c4b5fd, #6d28d9)',
            }}
          />
        </div>
      </div>
    ),
    { width: 180, height: 180 },
  )
}
