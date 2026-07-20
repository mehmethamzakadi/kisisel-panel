import type { ReactNode } from 'react'
import { WeatherCard } from '../components/WeatherCard'
import { RatesCard } from '../components/RatesCard'
import { GoldCard } from '../components/GoldCard'
import { NewsCard } from '../components/NewsCard'
import { QuoteCard } from '../components/QuoteCard'
import { MealCard } from '../components/MealCard'
import { QuickNoteCard } from '../components/QuickNoteCard'
import { ShoppingCard } from '../components/ShoppingCard'
import { SpotifyCard } from '../components/SpotifyCard'

export type CardId =
  | 'weather'
  | 'meal'
  | 'shopping'
  | 'rates'
  | 'quicknote'
  | 'gold'
  | 'quote'
  | 'news'
  | 'spotify'

export const CARDS: { id: CardId; label: string; render: () => ReactNode }[] = [
  { id: 'weather', label: 'Hava Durumu', render: () => <WeatherCard /> },
  { id: 'meal', label: 'Bugün Ne Yesem?', render: () => <MealCard /> },
  { id: 'quicknote', label: 'Hızlı Not', render: () => <QuickNoteCard /> },
  { id: 'spotify', label: 'Müzik', render: () => <SpotifyCard /> },
  { id: 'shopping', label: 'Alışveriş', render: () => <ShoppingCard /> },
  { id: 'rates', label: 'Döviz', render: () => <RatesCard /> },
  { id: 'gold', label: 'Altın', render: () => <GoldCard /> },
  { id: 'quote', label: 'Günün Sözü', render: () => <QuoteCard /> },
  { id: 'news', label: 'Gündem', render: () => <NewsCard /> },
]

export const DEFAULT_ORDER = CARDS.map((c) => c.id)

export type CardPrefs = { order: CardId[]; hidden: CardId[] }

/**
 * Kayıtlı tercihi geçerli kart listesiyle uzlaştırır: bilinmeyen id'ler atılır,
 * sonradan eklenen kartlar sona eklenir. Böylece yeni kart geldiğinde eski
 * tercih kartı gizlemiş olmaz.
 */
export function reconcile(saved: Partial<CardPrefs> | null | undefined): CardPrefs {
  const known = new Set(DEFAULT_ORDER)
  const order = (saved?.order ?? []).filter((id) => known.has(id))
  const missing = DEFAULT_ORDER.filter((id) => !order.includes(id))
  const hidden = (saved?.hidden ?? []).filter((id) => known.has(id))

  return { order: [...order, ...missing], hidden }
}
