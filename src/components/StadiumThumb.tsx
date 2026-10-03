// Kleine Stadiongrafik als Vorschaubild in Listen und Sheets.

import { StadiumArt } from './StadiumArt.tsx'

export function StadiumThumb({ stadiumId, collected, size = 52 }: { stadiumId: string; collected: boolean; size?: number }) {
  return (
    <span className={`stadium-thumb ${collected ? 'got' : ''}`} style={{ width: size, height: size * 0.78 }}>
      <StadiumArt stadiumId={stadiumId} mono={!collected} />
    </span>
  )
}
