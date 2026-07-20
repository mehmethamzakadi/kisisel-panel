import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CARDS, reconcile, type CardPrefs } from '../lib/cards'
import { CardSettings } from '../components/CardSettings'
import { TopBar } from '../components/TopBar'

type DashboardPageProps = {
  email?: string
  demo?: boolean
}

export function DashboardPage({ email, demo }: DashboardPageProps) {
  const [prefs, setPrefs] = useState<CardPrefs>(() => reconcile(null))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!supabase || demo) return

    let cancelled = false

    supabase
      .from('prefs')
      .select('cards')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPrefs(reconcile(data?.cards))
      })

    return () => {
      cancelled = true
    }
  }, [demo])

  async function savePrefs(next: CardPrefs) {
    setPrefs(next)
    if (!supabase || demo) return

    const { data } = await supabase.auth.getUser()
    if (!data.user) return

    // upsert: prefs tablosunda kullanıcı başına tek satır var.
    await supabase
      .from('prefs')
      .upsert(
        { user_id: data.user.id, cards: next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
  }

  const visible = prefs.order.filter((id) => !prefs.hidden.includes(id))

  return (
    <div className="mx-auto min-h-dvh w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <TopBar
        email={email}
        demo={demo}
        editing={editing}
        onToggleEditing={() => setEditing((v) => !v)}
      />

      {editing && (
        <CardSettings
          prefs={prefs}
          onChange={(next) => void savePrefs(next)}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Grid, sütun akışı (masonry) değil.
          Sütun akışında içerik yukarıdan aşağı akıp bir sonraki sütuna
          sarıyor; bir kart büyüdüğünde (Müzik kartında cihaz listesi açılınca
          gibi) ondan sonraki bütün kartlar yeniden akıyor ve sütun değiştirip
          ekranda zıplıyordu. Grid'de her kart kendi hücresinde kalır, büyüyen
          kart yalnızca kendi satırını uzatır.

          items-start: kartlar satırın en uzununa göre gerilmesin, kendi
          doğal yükseklikleri kadar dursun. */}
      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3 sm:gap-6">
        {visible.map((id) => {
          const card = CARDS.find((c) => c.id === id)
          return card ? <div key={id}>{card.render()}</div> : null
        })}
      </div>
    </div>
  )
}
