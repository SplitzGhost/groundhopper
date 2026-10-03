// Entwickler-Ansicht aller Stadiongrafiken: http://localhost:5174/#stadien (nur im Dev-Modus)

import { STADIUMS } from '../lib/stadiums.ts'
import { StadiumArt } from '../components/StadiumArt.tsx'

export function ArtGallery() {
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, background: 'var(--bg)' }}>
      {STADIUMS.map((s) => (
        <div key={s.id} style={{ background: 'var(--bg-elev)', borderRadius: 16, padding: 8 }}>
          <StadiumArt stadiumId={s.id} className="gallery-art" />
          <StadiumArt stadiumId={s.id} mono className="gallery-art small" />
          <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
        </div>
      ))}
      <style>{'.gallery-art{width:100%;height:150px;display:block}.gallery-art.small{height:70px}'}</style>
    </div>
  )
}
