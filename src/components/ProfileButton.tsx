// Profil-Knopf oben rechts: zeigt statt eines Platzhalter-Avatars das eigene Level.

import { useMemo } from 'react'
import { collect, levelOf } from '../lib/album.ts'
import { useUserData } from '../state/userData.ts'
import { openSheet } from '../state/ui.ts'
import { GlassButton } from './ui.tsx'

export function ProfileButton() {
  const data = useUserData()
  const level = useMemo(() => levelOf(collect(data.visits).points), [data.visits])
  const r = 15
  const len = 2 * Math.PI * r
  return (
    <GlassButton
      label={`Profil – Level ${level.level}`}
      onClick={() => openSheet({ kind: 'profile' })}
      icon={
        <span className="lvl-btn">
          <svg viewBox="0 0 36 36" aria-hidden>
            <circle cx="18" cy="18" r={r} className="lvl-track" />
            <circle cx="18" cy="18" r={r} className="lvl-fill" strokeDasharray={len}
              strokeDashoffset={len * (1 - Math.max(0.04, level.progress))} />
          </svg>
          <b className="tnum">{level.level}</b>
        </span>
      }
    />
  )
}
