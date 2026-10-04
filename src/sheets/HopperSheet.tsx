// Mein Hopper: oben die Figur (antippen = hüpfen), darunter Aussehen (Hautfarbe, Haarfarbe, Augenform)
// und der Kleiderschrank mit allen gesammelten Heimtrikots. Ohne Hopper startet der Editor mit einem
// zufälligen Vorschlag, gespeichert wird erst mit „Hopper erstellen“. Danach wirkt jede Änderung sofort.

import { useState } from 'react'
import { motion } from 'motion/react'
import { Check, Shirt, Shuffle } from 'lucide-react'
import { Sheet } from '../components/Sheet.tsx'
import { useSheet } from '../components/sheetContext.ts'
import { HopperArt } from '../components/HopperArt.tsx'
import { Empty, PillButton, Segmented } from '../components/ui.tsx'
import { EYE_SHAPES, HAIR_COLORS, SKINS, randomLook, type HopperLook } from '../lib/hopper/look.ts'
import { seasonLabel } from '../lib/hopper/kit.ts'
import { shortClub } from '../lib/matchCards.ts'
import { setLook, useHopper, useWardrobe, wearKit, wornKit } from '../state/hopper.ts'
import { notify } from '../state/toast.ts'

type Tab = 'look' | 'kits'

export function HopperSheet({ tab: initialTab = 'look' }: { tab?: Tab }) {
  const hopper = useHopper()
  const wardrobe = useWardrobe()
  const { close } = useSheet()
  const [tab, setTab] = useState<Tab>(hopper ? initialTab : 'look')
  // Ohne Hopper: Entwurf, der erst mit dem Knopf gespeichert wird
  const [draft, setDraft] = useState<HopperLook>(() => hopper?.look ?? randomLook())
  const creating = !hopper
  const look = hopper?.look ?? draft
  const kit = wornKit(hopper, wardrobe)

  const change = (patch: Partial<HopperLook>) => {
    const next = { ...look, ...patch }
    if (creating) setDraft(next)
    else setLook(next)
  }

  const create = () => {
    setLook(draft)
    notify({ kind: 'info', title: 'Dein Hopper ist da', subtitle: 'Er steht ab jetzt auf deinen Sammelkarten', icon: 'check' })
    if (wardrobe.length) setTab('kits')
    else close()
  }

  return (
    <Sheet title={creating ? 'Dein Hopper' : 'Mein Hopper'} full>
      <div className="hopper-stage">
        <span className="hopper-stage-floor" />
        <HopperStage look={look} kit={kit} />
        {tab === 'look' && (
          <button type="button" className="glass hopper-shuffle" aria-label="Zufällig"
            onClick={() => change(randomLook())}>
            <Shuffle size={18} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {!creating && (
        <div className="sheet-pad" style={{ marginBottom: 6 }}>
          <Segmented id="hopper-tab" value={tab} onChange={setTab}
            options={[{ value: 'look', label: 'Aussehen' }, { value: 'kits', label: `Trikots${wardrobe.length ? ` · ${wardrobe.length}` : ''}` }]} />
        </div>
      )}

      {tab === 'look' ? <LookEditor look={look} onChange={change} /> : <Wardrobe look={look} current={kit} />}

      {creating && (
        <div className="hopper-create">
          <PillButton block onClick={create}><Check size={19} strokeWidth={2.6} /> Hopper erstellen</PillButton>
          <p className="muted">Du startest im weißen Basis-Trikot. Für jedes Spiel bekommst du das Heimtrikot des Gastgebers.</p>
        </div>
      )}
    </Sheet>
  )
}

/** Große Figur: wippt leise, hüpft beim Antippen und bei jeder Änderung */
function HopperStage({ look, kit }: { look: HopperLook; kit: string | null }) {
  const [hops, setHops] = useState(0)
  const key = JSON.stringify(look) + kit
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setHops((n) => n + 1)
  }
  return (
    <motion.button type="button" className="hopper-stage-figure" aria-label="Hopper" onClick={() => setHops((n) => n + 1)}
      key={hops} initial={hops ? { y: 0, scaleY: 1 } : false}
      animate={hops ? { y: [0, 6, -26, 0, 0], scaleY: [1, 0.94, 1.04, 0.97, 1] } : undefined}
      transition={{ duration: 0.55, times: [0, 0.15, 0.5, 0.85, 1], ease: 'easeOut' }}>
      <HopperArt look={look} kit={kit} eager className="hopper-stage-art" />
    </motion.button>
  )
}

// ---------- Aussehen ----------

function Swatches({ colors, value, onPick, label }: { colors: readonly string[]; value: number; onPick: (i: number) => void; label: string }) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {colors.map((c, i) => (
        <button key={c} type="button" role="radio" aria-checked={i === value} className={`swatch ${i === value ? 'on' : ''}`}
          style={{ '--c': c } as React.CSSProperties} onClick={() => onPick(i)}>
          {i === value && <motion.span layoutId={`sw-${label}`} className="swatch-ring" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />}
        </button>
      ))}
    </div>
  )
}

function LookEditor({ look, onChange }: { look: HopperLook; onChange: (p: Partial<HopperLook>) => void }) {
  return (
    <div className="hopper-editor">
      <section>
        <h4>Hautfarbe</h4>
        <Swatches label="Hautfarbe" colors={SKINS} value={look.skin} onPick={(skin) => onChange({ skin })} />
      </section>
      <section>
        <h4>Haarfarbe</h4>
        <Swatches label="Haarfarbe" colors={HAIR_COLORS} value={look.hairColor} onPick={(hairColor) => onChange({ hairColor })} />
      </section>
      <section>
        <h4>Augenform</h4>
        <div className="eye-grid" role="radiogroup" aria-label="Augenform">
          {EYE_SHAPES.map((e) => (
            <motion.button key={e.id} type="button" role="radio" aria-checked={look.eyes === e.id}
              className={`eye-tile ${look.eyes === e.id ? 'on' : ''}`} whileTap={{ scale: 0.92 }} onClick={() => onChange({ eyes: e.id })}>
              <span className="eye-tile-art"><HopperArt look={{ ...look, eyes: e.id }} kit={null} framing="bust" fit="cover" /></span>
              <small>{e.label}</small>
              {look.eyes === e.id && <motion.span layoutId="eye-on" className="kit-tile-ring" transition={{ type: 'spring', stiffness: 480, damping: 34 }} />}
            </motion.button>
          ))}
        </div>
      </section>
    </div>
  )
}

// ---------- Kleiderschrank ----------

function Wardrobe({ look, current }: { look: HopperLook; current: string | null }) {
  const wardrobe = useWardrobe()
  const items = wardrobe

  return (
    <div className="wardrobe">
      <p className="muted wardrobe-hint">
        Für jedes Spiel bekommst du das Heimtrikot des Gastgebers aus dieser Saison. Dein Hopper trägt es auf all deinen Karten.
      </p>
      <div className="wardrobe-grid">
        <KitTile on={current === null} onClick={() => wearKit(null)} title="Basis-Trikot" sub="Start-Outfit">
          <HopperArt look={look} kit={null} framing="kit" fit="cover" />
        </KitTile>
        {items.map((w, i) => (
          <KitTile key={w.id} on={current === w.id} onClick={() => wearKit(w.id)} index={i}
            title={shortClub(w.club)} sub={`${seasonLabel(w.season)}${w.count > 1 ? ` · ${w.count}×` : ''}`}>
            <HopperArt look={look} kit={w.id} framing="kit" fit="cover" />
          </KitTile>
        ))}
      </div>
      {!items.length && (
        <Empty icon={<Shirt size={30} />} title="Noch keine Trikots" text="Hake ein Spiel ab, bei dem du warst – dann liegt das Heimtrikot hier." />
      )}
    </div>
  )
}

function KitTile({ on, onClick, title, sub, children, index = 0 }: {
  on: boolean; onClick: () => void; title: string; sub: string; children: React.ReactNode; index?: number
}) {
  return (
    <motion.button type="button" className={`kit-tile ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}
      initial={{ opacity: 0, y: 10, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} whileTap={{ scale: 0.93 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28, delay: Math.min(index, 14) * 0.025 }}>
      <span className="kit-tile-art">{children}</span>
      <b className="truncate">{title}</b>
      <small className="truncate">{sub}</small>
      {on && <motion.span layoutId="kit-on" className="kit-tile-ring" transition={{ type: 'spring', stiffness: 480, damping: 34 }} />}
    </motion.button>
  )
}
