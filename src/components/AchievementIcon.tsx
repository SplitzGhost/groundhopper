// Symbole der Erfolge (statt Emojis).

import { Crown, Earth, Flame, House, Landmark, Lightbulb, Medal, PartyPopper, Plane, Snowflake, Star, Ticket, Tickets, TrainFront, Trophy, Zap } from 'lucide-react'
import type { ComponentType } from 'react'
import { StadiumIcon } from './icons.tsx'

const ICONS: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  first: Ticket,
  ten: Tickets,
  fifty: Medal,
  grounds10: StadiumIcon,
  regular: House,
  goals: PartyPopper,
  nil: Snowflake,
  double: Zap,
  tour: TrainFront,
  floodlight: Lightbulb,
  derby: Flame,
  europe: Plane,
  world: Earth,
  grounds50: Landmark,
  cup: Trophy,
  europecup: Star,
  complete: Crown,
}

export function AchievementIcon({ id, size = 22, strokeWidth = 2.1 }: { id: string; size?: number; strokeWidth?: number }) {
  const Icon = ICONS[id] ?? Medal
  return <Icon size={size} strokeWidth={strokeWidth} />
}
