import { createContext, useContext } from 'react'

interface SheetCtx {
  close: () => void
  /** 0 = oberstes Sheet, 1 = eins darunter … */
  depth: number
}

export const SheetContext = createContext<SheetCtx>({ close: () => {}, depth: 0 })
export const useSheet = () => useContext(SheetContext)
