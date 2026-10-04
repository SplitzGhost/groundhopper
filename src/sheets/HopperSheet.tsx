// Mein Hopper: oben die drehbare Figur, darunter Aussehen (Haut, Frisur, Haar, Augen, Bart, Brille)
// und der Kleiderschrank mit allen gesammelten Heimtrikots. Ohne Hopper startet der Editor mit einem
// zufälligen Vorschlag, gespeichert wird erst mit „Hopper erstellen“. Danach wirkt jede Änderung sofort.

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Shirt, Shuffle } from 'lucide-react'
import { Sheet } from '../components/Sheet.tsx'
import { useSheet } from '../components/sheetContext.ts'
import { Hopper3D } from '../components/Hopper3D.tsx'
import { KitIcon } from '../components/KitIcon.tsx'
import { Chip, Empty, PillButton, Segmented } from '../components/ui.tsx'
import {
  BEARDS, EYE_COLORS, GLASSES, HAIR_COLORS, HAIR_STYLES, SKINS, randomLook, type HopperLook,
} from '../lib/hopper/look.ts'
import { BASIC_KIT, hasRealKit, kitSpec, loadKits, seasonLabel } from '../lib/hopper/kit.ts'
import { crestFor } from '../lib/crests.ts'
import { shortClub } from '../lib/matchCards.ts'
import { setLook, useHopper, useWardrobe, wearKit, wornKit } from '../state/hopper.ts'
import { notify } from '../state/toast.ts'

type Tab = 'look' | 'kits'

/** Trikotdaten laden und danach neu zeichnen */
function useKitsReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void loadKits().then(() => setReady(true))
  }, [])
  return ready
}

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
        <Hopper3D look={look} kit={kit} className="hopper-stage-figure" />
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

      {tab === 'look' ? <LookEditor look={look} onChange={change} /> : <Wardrobe current={kit} />}

      {creating && (
        <div className="hopper-create">
          <PillButton block onClick={create}><Check size={19} strokeWidth={2.6} /> Hopper erstellen</PillButton>
          <p className="muted">Du startest im Basis-Shirt. Für jedes Spiel bekommst du das Heimtrikot des Gastgebers.</p>
        </div>
      )}
    </Sheet>
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

function Options<T extends string>({ options, value, onPick, id }: { options: { id: T; label: string }[]; value: T; onPick: (v: T) => void; id: string }) {
  return (
    <div className="chips wrap">
      {options.map((o) => <Chip key={o.id} on={o.id === value} layoutId={id} onClick={() => onPick(o.id)}>{o.label}</Chip>)}
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
        <h4>Frisur</h4>
        <Options id="hair" options={HAIR_STYLES} value={look.hair} onPick={(hair) => onChange({ hair })} />
      </section>
      {look.hair !== 'bald' || look.beard !== 'none' ? (
        <section>
          <h4>Haarfarbe</h4>
          <Swatches label="Haarfarbe" colors={HAIR_COLORS} value={look.hairColor} onPick={(hairColor) => onChange({ hairColor })} />
        </section>
      ) : null}
      <section>
        <h4>Augen</h4>
        <Swatches label="Augenfarbe" colors={EYE_COLORS} value={look.eyes} onPick={(eyes) => onChange({ eyes })} />
      </section>
      <section>
        <h4>Bart</h4>
        <Options id="beard" options={BEARDS} value={look.beard} onPick={(beard) => onChange({ beard })} />
      </section>
      <section>
        <h4>Brille</h4>
        <Options id="glasses" options={GLASSES} value={look.glasses} onPick={(glasses) => onChange({ glasses })} />
      </section>
    </div>
  )
}

// ---------- Kleiderschrank ----------

function Wardrobe({ current }: { current: string | null }) {
  const wardrobe = useWardrobe()
  const ready = useKitsReady()
  const items = useMemo(() => wardrobe.map((w) => ({ ...w, spec: kitSpec(w.id), real: hasRealKit(w.id) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wardrobe, ready])

  return (
    <div className="wardrobe">
      <p className="muted wardrobe-hint">
        Für jedes Spiel bekommst du das Heimtrikot des Gastgebers aus dieser Saison. Dein Hopper trägt es auf all deinen Karten.
      </p>
      <div className="wardrobe-grid">
        <KitTile on={current === null} onClick={() => wearKit(null)} title="Basis-Shirt" sub="Start-Outfit">
          <KitIcon kit={BASIC_KIT} />
        </KitTile>
        {items.map((w, i) => (
          <KitTile key={w.id} on={current === w.id} onClick={() => wearKit(w.id)} index={i}
            title={shortClub(w.club)} sub={`${seasonLabel(w.season)}${w.count > 1 ? ` · ${w.count}×` : ''}`}>
            <KitIcon kit={w.spec} crest={crestFor(w.club, 'sm')} className={w.real ? '' : 'plain'} />
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
