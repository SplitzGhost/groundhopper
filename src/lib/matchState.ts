import type { Match } from '../shared/types.ts'

/** Spiel hat schon begonnen (dann kann man „dabei gewesen“ sein). */
export const hasStarted = (m: Match) => m.status === 'finished' || m.status === 'live' || Date.parse(m.kickoff) < Date.now()
