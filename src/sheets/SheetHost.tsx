import { AnimatePresence } from 'motion/react'
import { closeSheet, sheetStore, type SheetSpec } from '../state/ui.ts'
import { SheetContext } from '../components/sheetContext.ts'
import { StadiumSheet } from './StadiumSheet.tsx'
import { MatchSheet, VisitSheet } from './MatchSheet.tsx'
import { FilterSheet } from './FilterSheet.tsx'
import { SearchSheet } from './SearchSheet.tsx'
import { ProfileSheet } from './ProfileSheet.tsx'
import { AddVisitSheet } from './AddVisitSheet.tsx'
import { AlbumSheet } from './AlbumSheet.tsx'

function Content({ spec }: { spec: SheetSpec }) {
  switch (spec.kind) {
    case 'stadium': return <StadiumSheet id={spec.id} />
    case 'match': return <MatchSheet id={spec.id} />
    case 'visit': return <VisitSheet id={spec.id} />
    case 'filter': return <FilterSheet />
    case 'search': return <SearchSheet />
    case 'profile': return <ProfileSheet />
    case 'add': return <AddVisitSheet />
    case 'album': return <AlbumSheet section={spec.section} />
  }
}

export function SheetHost() {
  const sheets = sheetStore.use()
  return (
    <AnimatePresence>
      {sheets.map((s, i) => (
        <SheetContext.Provider key={s.key} value={{ close: () => closeSheet(s.key), depth: sheets.length - 1 - i }}>
          <Content spec={s.spec} />
        </SheetContext.Provider>
      ))}
    </AnimatePresence>
  )
}
