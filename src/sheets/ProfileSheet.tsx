import { useMemo, useRef } from 'react'
import { motion } from 'motion/react'
import { Download, Upload } from 'lucide-react'
import { collect, levelOf } from '../lib/album.ts'
import { computeStats } from '../lib/collection.ts'
import { exportUserData, importUserData } from '../lib/storage.ts'
import { useMatches } from '../state/matches.ts'
import { replaceUserData, useUserData } from '../state/userData.ts'
import { notify } from '../state/toast.ts'
import { Sheet } from '../components/Sheet.tsx'
import { ProgressRing } from '../components/ui.tsx'

export function ProfileSheet() {
  const data = useUserData()
  const matches = useMatches()
  const file = useRef<HTMLInputElement>(null)
  const stats = useMemo(() => computeStats(data.visits), [data.visits])
  const c = useMemo(() => collect(data.visits), [data.visits])
  const level = levelOf(c.points)

  const tiles: [string | number, string][] = [
    [stats.games, 'Spiele'],
    [stats.stadiums, 'Stadien'],
    [stats.countries, 'Länder'],
    [stats.goals, 'Tore'],
    [stats.goalsPerGame.toLocaleString('de-DE', { maximumFractionDigits: 1 }), 'Tore/Spiel'],
    [c.derbies.size, 'Derbys'],
  ]

  const doExport = () => {
    const url = URL.createObjectURL(exportUserData(data))
    const a = document.createElement('a')
    a.href = url
    a.download = `groundhopper-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const doImport = async (f: File) => {
    try {
      replaceUserData(await importUserData(f))
      notify({ kind: 'info', title: 'Backup geladen', subtitle: 'Deine Sammlung ist wiederhergestellt', icon: 'check' })
    } catch {
      notify({ kind: 'info', title: 'Import fehlgeschlagen', subtitle: 'Keine gültige Groundhopper-Datei', icon: 'info' })
    }
  }

  return (
    <Sheet title="Profil">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '4px 20px 18px' }}>
        <ProgressRing value={level.progress} size={76} stroke={5}>
          <span style={{ fontSize: 26, fontWeight: 800 }}>{level.level}</span>
        </ProgressRing>
        <div>
          <div style={{ font: '800 24px/1.1 var(--font-display)', letterSpacing: -0.5 }}>{level.name}</div>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            {c.points} Punkte{level.next ? ` · noch ${level.toNext} bis ${level.next}` : ''}
          </div>
        </div>
      </div>

      <div className="stat-grid">
        {tiles.map(([value, label], i) => (
          <motion.div key={label} className="stat-tile" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26, delay: i * 0.04 }}>
            <b>{value}</b><span>{label}</span>
          </motion.div>
        ))}
      </div>

      <div className="section-head"><h3 className="section-title">Daten</h3></div>
      <div className="card inset list">
        <button type="button" className="list-row row-press" onClick={doExport}>
          <Download size={20} style={{ color: 'var(--accent)' }} />
          <div className="row-main"><div className="row-title">Backup exportieren</div><div className="row-sub">Sammlung als Datei sichern</div></div>
        </button>
        <button type="button" className="list-row row-press" onClick={() => file.current?.click()}>
          <Upload size={20} style={{ color: 'var(--accent)' }} />
          <div className="row-main"><div className="row-title">Backup importieren</div><div className="row-sub">Ersetzt die aktuelle Sammlung</div></div>
        </button>
        <input ref={file} type="file" accept="application/json,.json" hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void doImport(f)
            e.target.value = ''
          }} />
      </div>

      <p className="muted sheet-pad" style={{ fontSize: 12.5, marginTop: 16, lineHeight: 1.5 }}>
        Spielplan: {matches.provider === 'football-data' ? 'football-data.org' : matches.provider === 'demo' ? 'freie Demo-Quellen' : '–'}
        {matches.status === 'ready' && ` · ${matches.matches.length.toLocaleString('de-DE')} Spiele`}<br />
        Karte © OpenFreeMap, OpenMapTiles, OpenStreetMap-Mitwirkende. Deine Daten bleiben auf diesem Gerät.
      </p>
    </Sheet>
  )
}
