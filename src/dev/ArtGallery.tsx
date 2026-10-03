// Entwickler-Ansicht aller Stadiongrafiken: http://localhost:5174/#stadien (nur im Dev-Modus)
// Antippen öffnet das Stadion groß und drehbar.

import { useState } from 'react'
import { STADIUMS } from '../lib/stadiums.ts'
import { StadiumArt } from '../components/StadiumArt.tsx'
import { Stadium3D } from '../components/Stadium3D.tsx'

export function ArtGallery() {
  const [open, setOpen] = useState<{ id: string; mono: boolean } | null>(null)
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, background: 'var(--bg)' }}>
      {STADIUMS.map((s) => (
        <div key={s.id} style={{ background: 'var(--bg-elev)', borderRadius: 16, padding: 8 }}>
          <button type="button" style={{ display: 'block', width: '100%' }} onClick={() => setOpen({ id: s.id, mono: false })}>
            <StadiumArt stadiumId={s.id} className="gallery-art" />
          </button>
          <button type="button" style={{ display: 'block', width: '100%' }} onClick={() => setOpen({ id: s.id, mono: true })}>
            <StadiumArt stadiumId={s.id} mono size="sm" className="gallery-art small" />
          </button>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
        </div>
      ))}
      {open && (
        <div className="gallery-big" onDoubleClick={() => setOpen(null)}>
          <Stadium3D stadiumId={open.id} mono={open.mono} className="gallery-big-art" />
          <button type="button" className="gallery-close" onClick={() => setOpen(null)}>Schließen</button>
        </div>
      )}
      <style>{`
        .gallery-art{width:100%;height:170px;display:block;object-fit:contain}
        .gallery-art.small{height:80px}
        .gallery-big{position:fixed;inset:0;z-index:50;background:linear-gradient(180deg,#e9f2fd,#f8fbff)}
        .gallery-big-art{inset:0}
        .gallery-close{position:fixed;top:12px;right:12px;padding:8px 14px;border-radius:99px;background:#fff;font-weight:600}
      `}</style>
    </div>
  )
}
