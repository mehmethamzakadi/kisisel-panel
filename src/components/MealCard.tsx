import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from './Card'
import { supabase } from '../lib/supabase'
import { addIngredients, describeResult } from '../lib/shopping'

type Suggestion = {
  name: string
  summary: string
  minutes: number
  ingredients: string[]
  steps: string[]
}

const CACHE = 'panel:meal'
const SEEN = 'panel:meal-seen'

type Cached = { meal: string; suggestion: Suggestion }

/**
 * Öneri localStorage'da tutuluyor: panel her açılışında Gemini'ye gitmek hem
 * gereksiz hem de ücretsiz kotayı tüketiyor. Yeni istek yalnızca "Başka öner"
 * ile yapılır.
 */
function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Bozuk/eski kayıt kartı kilitlemesin.
    return parsed?.suggestion?.name ? (parsed as Cached) : null
  } catch {
    return null
  }
}

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function MealCard() {
  const cached = useRef(readCache()).current

  const [meal, setMeal] = useState(cached?.meal ?? '')
  const [suggestion, setSuggestion] = useState<Suggestion | null>(
    cached?.suggestion ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!cached)
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [added, setAdded] = useState<string | null>(null)

  // Görülen tarifler de saklanıyor; yenilemeden sonra "Başka öner" aynı
  // tarifleri tekrar önermesin.
  const seen = useRef<string[]>(readSeen())

  // StrictMode effect'i iki kez çalıştırıyor; bu olmadan önbellek boşken
  // Gemini'ye iki istek gidiyor.
  const requested = useRef(false)

  const ask = useCallback(async () => {
    if (!supabase) {
      setError('Supabase yapılandırılmadı.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Kaydedilmiş tarifler zevk sinyali olarak gönderilir.
    const { data: likedRows } = await supabase
      .from('saved_meals')
      .select('name')
      .order('created_at', { ascending: false })
      .limit(8)

    const liked = (likedRows ?? []).map((r) => r.name)

    const { data, error } = await supabase.functions.invoke('suggest-meal', {
      body: { avoid: [...seen.current, ...liked].slice(-8), liked },
    })

    setLoading(false)

    if (error || !data?.suggestion) {
      setError('Öneri alınamadı. Tekrar deneyin.')
      return
    }

    setMeal(data.meal)
    setSuggestion(data.suggestion)
    setOpen(false)
    setSaved(false)
    setAdded(null)

    seen.current = [...seen.current, data.suggestion.name].slice(-8)

    try {
      localStorage.setItem(
        CACHE,
        JSON.stringify({ meal: data.meal, suggestion: data.suggestion }),
      )
      localStorage.setItem(SEEN, JSON.stringify(seen.current))
    } catch {
      // Depolama dolu/kapalıysa öneri yine de gösterilir, sadece kalıcı olmaz.
    }
  }, [])

  useEffect(() => {
    // Kayıtlı öneri varsa istek yapılmaz; yenilemek "Başka öner"e bağlı.
    if (cached || requested.current) return
    requested.current = true
    void ask()
  }, [ask, cached])

  async function save() {
    if (!supabase || !suggestion) return

    // ignoreDuplicates: aynı tarif zaten kayıtlıysa dokunma. Güncelleme
    // yapmıyoruz; saved_meals'da UPDATE politikası da bilinçli olarak yok.
    const { error } = await supabase.from('saved_meals').upsert(
      {
        name: suggestion.name,
        summary: suggestion.summary,
        minutes: suggestion.minutes,
        ingredients: suggestion.ingredients,
        steps: suggestion.steps,
      },
      { onConflict: 'user_id,name', ignoreDuplicates: true },
    )

    if (!error) setSaved(true)
  }

  async function addToShopping() {
    if (!suggestion) return

    try {
      setAdded(describeResult(await addIngredients(suggestion.ingredients)))
    } catch {
      setError('Malzemeler listeye eklenemedi.')
    }
  }

  return (
    <Card
      title="Bugün Ne Yesem?"
      icon="🍳"
      loading={loading && !suggestion}
      error={error}
      action={
        <button
          onClick={() => void ask()}
          disabled={loading}
          className="rounded-lg border border-edge px-2.5 py-1 text-xs font-medium text-muted hover:bg-panel hover:text-ink disabled:opacity-40"
        >
          {loading ? '…' : 'Başka öner'}
        </button>
      }
    >
      {suggestion && (
        <div className="flex flex-col gap-3">
          <div>
            <p className="font-semibold">{suggestion.name}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {suggestion.summary}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent">
              {suggestion.minutes} dk
            </span>
            <span className="rounded-full bg-panel px-2.5 py-1 text-muted">
              {meal}
            </span>
            <span className="rounded-full bg-panel px-2.5 py-1 text-muted">
              {suggestion.ingredients.length} malzeme
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void save()}
              disabled={saved}
              className="rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium hover:bg-panel disabled:opacity-60"
            >
              {saved ? '★ Kaydedildi' : '☆ Beğendim'}
            </button>
            <button
              onClick={() => void addToShopping()}
              className="rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium hover:bg-panel"
            >
              {added ? `✓ ${added}` : '🛒 Malzemeleri ekle'}
            </button>
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-accent hover:underline"
            >
              {open ? 'Tarifi gizle' : 'Tarifi gör'}
            </button>
          </div>

          {open && (
            <div className="flex flex-col gap-3 border-t border-edge pt-3 text-sm">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted uppercase">
                  Malzemeler
                </p>
                <ul className="flex flex-col gap-1">
                  {suggestion.ingredients.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-muted">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted uppercase">
                  Hazırlanışı
                </p>
                <ol className="flex flex-col gap-1.5">
                  {suggestion.steps.map((step, i) => (
                    <li key={step} className="flex gap-2">
                      <span className="text-muted tabular-nums">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          <p className="flex items-center justify-between text-xs text-muted">
            <span>Gemini tarafından öneriliyor</span>
            <Link to="/tarifler" className="hover:text-accent hover:underline">
              Kayıtlı tarifler →
            </Link>
          </p>
        </div>
      )}
    </Card>
  )
}
