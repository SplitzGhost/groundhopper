import { readFileSync } from 'node:fs'
import type { Stadium } from '../src/shared/types.ts'
import { createTeamMatcher } from '../src/shared/teamMatch.ts'

function loadStadiums(): Stadium[] {
  try {
    return JSON.parse(readFileSync(new URL('../src/data/stadiums.json', import.meta.url), 'utf8')) as Stadium[]
  } catch {
    console.warn('src/data/stadiums.json fehlt – bitte `npm run stadiums` ausführen.')
    return []
  }
}

export const stadiums = loadStadiums()
export const matchTeam = createTeamMatcher(stadiums)
