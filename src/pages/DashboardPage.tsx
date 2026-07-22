import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CARDS, reconcile, type CardPrefs } from '../lib/cards'
import { currentFocus, onFocusChange } from '../lib/bus'
import type { FocusNow } from '../lib/bus'
import { CardSettings } from '../components/CardSettings'
import { TopBar } from '../components/TopBar'

type DashboardPageProps = {
  email?: string
  demo?: boolean
}

export function DashboardPage({ email, demo }: DashboardPageProps) {
  const [prefs, setPrefs] = useState<CardPrefs>(() => reconcile(null))
  const [editing, setEditing] = useState(false)
  const [focus, setFocus] = useState<FocusNow | null>(currentFocus)

  useEffect(() => {
    // Abone olmadan önce durumu bir kez oku: React çocuk efektlerini önce
    // çalıştırdığı için FocusCard yayınını buraya gelmeden yapmış olabilir.
    setFocus(currentFocus())
    return onFocusChange(setFocus)
  }, [])

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

          En fazla iki sütun: üç sütunda kartlar okunamayacak kadar daralıyor.

          items-start bilerek YOK: kartlar satırın en uzununa göre gerilsin.
          Doğal yükseklikte bırakıldıklarında alt kenarlar hizalanmıyor ve
          düzen tırtıklı görünüyordu. Boşluk yok olmuyor, kartın içine
          taşınıyor — dışarıda düzensiz aralık olarak durmasından iyi. */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 sm:gap-6">
        {visible.map((id) => {
          const card = CARDS.find((c) => c.id === id)
          if (!card) return null

          // Soluk ama erişilemez değil: üstüne gelince ya da içindeki bir
          // öğe klavyeyle odaklanınca kart tam görünürlüğe döner. Seans
          // sırasında dövize bakmak isteyen engellenmemeli, sadece göz ucuyla
          // sürekli okumamalı.
          const dimmed = focus !== null && card.distracting
          const className = [
            card.wide && 'md:col-span-2',
            'transition duration-700',
            dimmed &&
              'opacity-40 grayscale hover:opacity-100 hover:grayscale-0 focus-within:opacity-100 focus-within:grayscale-0',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div key={id} className={className}>
              {card.render()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
