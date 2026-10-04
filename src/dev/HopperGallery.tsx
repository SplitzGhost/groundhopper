// Entwickler-Ansicht der Hopper (nur im Dev-Modus):
//   #hopper            alle Frisuren
//   #hopper/big/3      eine Figur groß (Index in LOOKS), optional /<Drehung>
//   #hopper/kits/<Verein>  Trikots aus kits.json, gefiltert
//   #hopper/card       Sammelkarten mit 1–5 Hoppern
//   #hopper/peek/<Breite>/<Anzahl>  viele Karten mit Abstand, um Orte und Posen der Hopper zu prüfen
//   #hopper/review/<Filter>  Wikipedia-Vorlage neben dem nachgebauten Trikot (nach npm run kits)
import { useEffect, useState } from 'react'
import { HopperArt } from '../components/HopperArt.tsx'
import { EYE_SHAPES, HAIR_COLORS, SKINS, type HopperLook } from '../lib/hopper/look.ts'
import { kitId, loadKits, seasonLabel } from '../lib/hopper/kit.ts'
import { MatchCardFront } from '../components/cards/MatchCard.tsx'
import { buildCards } from '../lib/matchCards.ts'
import type { CrewMember } from '../state/crew.ts'
import type { Visit } from '../shared/types.ts'
import type { KitSpec } from '../lib/hopper/kit.ts'
import { KitIcon } from '../components/KitIcon.tsx'

interface ReviewItem { id: string; label: string; base: string; body: string | null; arm: string | null; spec: KitSpec; fixed: boolean; share: number }
const img = (f: string) => '/.cache/kits/img/' + f.replace(/[^\w.-]/g, '_')

function Review({ filter, page }: { filter: string; page: number }) {
  const [items, setItems] = useState<ReviewItem[]>([])
  useEffect(() => {
    void fetch('/.cache/kits/review.json').then((r) => r.json()).then(setItems)
  }, [])
  const shown = items.filter((i) => !filter || i.label.toLowerCase().includes(filter.toLowerCase())).slice(page * 40, page * 40 + 40)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, color: '#111' }}>
      {shown.map((i) => (
        <div key={i.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: 9, fontWeight: 700, background: i.fixed ? '#e6f7e6' : '#fff', borderRadius: 6, padding: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ position: 'relative', width: 100, height: 60 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, width: 31, height: 59, background: i.base, imageRendering: 'pixelated' }}>{i.arm && <img src={img(i.arm)} style={{ width: '100%', height: '100%' }} />}</div>
              <div style={{ position: 'absolute', left: 31, top: 0, width: 38, height: 59, background: i.base }}>{i.body && <img src={img(i.body)} style={{ width: '100%', height: '100%' }} />}</div>
              <div style={{ position: 'absolute', left: 69, top: 0, width: 31, height: 59, background: i.base, transform: 'scaleX(-1)' }}>{i.arm && <img src={img(i.arm)} style={{ width: '100%', height: '100%' }} />}</div>
            </div>
            <div style={{ width: 60, height: 60 }}><KitIcon kit={i.spec} /></div>
          </div>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%' }}>{i.label}</span>
          <span style={{ color: '#888' }}>{i.spec.p?.k ?? 'plain'}{i.spec.p && 'n' in i.spec.p ? i.spec.p.n : ''} {i.share}</span>
        </div>
      ))}
    </div>
  )
}

const VISITS: Visit[] = [
  ['FC Bayern München', 'Borussia Dortmund', 4, 2, '2025-03-08'],
  ['FC Schalke 04', 'Borussia Dortmund', 1, 1, '2024-10-19'],
  ['Liverpool FC', 'Everton FC', 2, 0, '2026-09-20'],
  ['Real Madrid CF', 'FC Barcelona', 3, 2, '2023-04-21'],
  ['AC Milan', 'FC Internazionale Milano', 0, 0, '2026-02-02'],
].map(([h, a, hs, as, date], i) => ({
  id: 'v' + i, matchId: null, date: date as string, league: null, competition: 'Testspiel', homeTeam: h as string, awayTeam: a as string,
  homeScore: hs as number, awayScore: as as number, stadiumId: null, customStadium: null, rating: null, notes: '', createdAt: '2020-01-01',
}))

const LOOKS: HopperLook[] = EYE_SHAPES.map((e, i) => ({ skin: i % SKINS.length, hairColor: (i * 2) % HAIR_COLORS.length, eyes: e.id }))

export function HopperGallery() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  const parts = hash.split('/')
  const mode = parts[1] ?? ''
  const [kits, setKits] = useState<[string, string][]>([])
  const filter = mode === 'kits' ? decodeURIComponent(parts[2] ?? '') : ''
  useEffect(() => {
    if (mode !== 'kits') return
    void loadKits().then((t) => {
      const out: [string, string][] = []
      for (const [club, seasons] of Object.entries(t)) {
        if (filter && !club.toLowerCase().includes(filter.toLowerCase())) continue
        for (const s of Object.keys(seasons)) out.push([kitId(club, Number(s)), `${club} ${seasonLabel(Number(s))}`])
      }
      setKits(out)
    })
  }, [mode, filter])

  const base = LOOKS[0]
  const cards = buildCards(VISITS)
  const crewFor = (n: number, card: number): CrewMember[] => Array.from({ length: n }, (_, i) => ({
    key: 'k' + i, username: 'u' + i, look: LOOKS[(i * 3 + card) % LOOKS.length], kit: null, owner: i === 0,
  }))
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16, background: 'linear-gradient(180deg,#e9f2fd,#f8fbff)' }}>
      {mode === '' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {LOOKS.map((l, i) => (
            <a key={i} href={`#hopper/big/${i}`} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600 }}>
              <HopperArt look={l} kit={null} />
              {l.eyes}
            </a>
          ))}
        </div>
      )}
      {mode === 'big' && (
        <div style={{ display: 'flex', gap: 0, height: '100%' }}>
          {[0].map((t) => (
            <HopperArt key={t} look={LOOKS[Number(parts[2] ?? 0)]} kit={parts[4] ? decodeURIComponent(parts[4]) : null} className="big" />
          ))}
        </div>
      )}
      {mode === 'card' && (
        <div style={{ display: 'grid', gridTemplateColumns: parts[2] ? '380px 380px' : 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
          {cards.map((c, i) => <MatchCardFront key={c.id} card={c} crew={crewFor(i + 1, i)} size={parts[2] ? 'lg' : 'sm'} />)}
        </div>
      )}
      {mode === 'peek' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 70, padding: 60 }}>
          {Array.from({ length: 12 }, (_, k) => {
            const c = { ...cards[k % cards.length], id: 'peek' + k }
            return (
              <div key={k} style={{ width: Number(parts[2] ?? 240) }}>
                <MatchCardFront card={c} crew={crewFor(Number(parts[3] ?? (k % 3) + 1), k)} size="lg" />
              </div>
            )
          })}
        </div>
      )}
      {mode === 'review' && <Review filter={decodeURIComponent(parts[2] ?? '')} page={Number(parts[3] ?? 0)} />}
      {mode === 'kits' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
          {kits.map(([id, label]) => (
            <div key={id} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600 }}>
              <HopperArt look={base} kit={id} />
              {label}
            </div>
          ))}
        </div>
      )}
      <style>{'.hopper-art{width:100%;display:block}.hopper-art.full{aspect-ratio:718/1594}.hopper-art.bust{aspect-ratio:1}.hopper-art.big{height:100%;width:auto;min-width:0;flex:1;object-fit:contain}'}</style>
    </div>
  )
}
