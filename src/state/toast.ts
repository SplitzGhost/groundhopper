// Mitteilungen im Stil der Dynamic Island (z. B. „Neues Stadion gesammelt“).

import { useSyncExternalStore } from 'react'

export type ToastIcon = 'stadium' | 'club' | 'derby' | 'trophy' | 'star' | 'check' | 'info' | 'country'

export interface Toast {
  id: number
  kind: 'unlock' | 'info'
  title: string
  subtitle?: string
  icon: ToastIcon
}

let current: Toast | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function notify(t: Omit<Toast, 'id'>) {
  current = { ...t, id: ++seq }
  emit()
  clearTimeout(timer)
  timer = setTimeout(dismissToast, t.kind === 'unlock' ? 3400 : 2200)
}

export function dismissToast() {
  current = null
  emit()
}

export function useToast(): Toast | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
