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
    <div className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
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

      {/* Kartlar farklı yükseklikte; grid yerine sütun akışı kullanılıyor ki
          kısa kartların altında boşluk kalmasın. */}
      <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5 [&>*]:break-inside-avoid">
        {visible.map((id) => {
          const card = CARDS.find((c) => c.id === id)
          return card ? <div key={id}>{card.render()}</div> : null
        })}
      </div>
    </div>
  )
}
