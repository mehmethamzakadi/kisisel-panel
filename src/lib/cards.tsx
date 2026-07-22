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
import { FocusCard } from '../components/FocusCard'

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
  | 'focus'

type CardDef = {
  id: CardId
  label: string
  /** Tüm satırı kaplar. Listesi uzun olan kartlar dikey yerine yatay yayılır. */
  wide?: boolean
  /**
   * Odak seansı sürerken soluklaşır. Yalnızca takip edilen sayılar ve gündem
   * işaretli: not, alışveriş ve müzik seansın parçası, hava ile günün sözü
   * zaten sakin. Gizlemek yerine soluklaştırmak bilinçli — kart yerinde
   * kalırsa düzen seans başlayınca zıplamıyor.
   */
  distracting?: boolean
  render: () => ReactNode
}

/**
 * Sıra bilinçli: önce o anki ortam (hava, müzik, yemek), sonra takip edilen
 * sayılar (altın, döviz), sonra kişisel iş kartları (not, alışveriş, odak),
 * kapanışta günün sözü. Gündem en altta ve tam genişlikte: sekiz başlık
 * dar bir sütuna dizilince kart diğerlerinin iki katı uzuyordu.
 *
 * Bu yalnızca **varsayılan**; kullanıcının kayıtlı tercihi varsa o kazanır
 * (bkz. reconcile). Varsayılana dönmek "Kartları düzenle" panelinden yapılır.
 */
export const CARDS: CardDef[] = [
  { id: 'weather', label: 'Hava Durumu', render: () => <WeatherCard /> },
  { id: 'spotify', label: 'Müzik', render: () => <SpotifyCard /> },
  { id: 'meal', label: 'Bugün Ne Yesem?', render: () => <MealCard /> },
  { id: 'gold', label: 'Altın', distracting: true, render: () => <GoldCard /> },
  { id: 'rates', label: 'Döviz', distracting: true, render: () => <RatesCard /> },
  { id: 'quicknote', label: 'Hızlı Not', render: () => <QuickNoteCard /> },
  { id: 'shopping', label: 'Alışveriş', render: () => <ShoppingCard /> },
  { id: 'focus', label: 'Odak', render: () => <FocusCard /> },
  // Bu ikisi tam genişlikte: geriye kalan sekiz kart tam dört satır yapıyor,
  // böylece tek başına kalıp yanında boşluk bırakan kart olmuyor.
  { id: 'quote', label: 'Günün Sözü', wide: true, render: () => <QuoteCard /> },
  {
    id: 'news',
    label: 'Gündem',
    wide: true,
    distracting: true,
    render: () => <NewsCard />,
  },
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
