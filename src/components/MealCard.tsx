import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from './Card'
import { supabase } from '../lib/supabase'
import { addIngredients, describeResult } from '../lib/shopping'
import { cookingQuery, failureMessage, play, savedDevice } from '../lib/playback'

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
  const [music, setMusic] = useState<string | null>(null)

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

  /** Öğüne uygun bir mutfak listesi başlatır; hedef cihaz Müzik kartından. */
  async function playKitchen() {
    setMusic('…')
    const result = await play(cookingQuery(meal), savedDevice()?.id)
    setMusic(result.ok ? result.playlist.name : failureMessage(result))
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
        <div className="flex flex-1 flex-col gap-4">
          <div>
            <h3 className="text-lg leading-tight font-semibold">
              {suggestion.name}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {suggestion.summary}
            </p>
          </div>

          {/* Künye: süre öne çıksın, diğer ikisi bağlam. */}
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-accent-soft py-2">
              <dt className="text-[11px] text-accent/70">Süre</dt>
              <dd className="text-sm font-semibold text-accent tabular-nums">
                {suggestion.minutes} dk
              </dd>
            </div>
            <div className="rounded-lg bg-panel py-2">
              <dt className="text-[11px] text-muted">Öğün</dt>
              <dd className="truncate px-1 text-sm font-medium capitalize">
                {meal}
              </dd>
            </div>
            <div className="rounded-lg bg-panel py-2">
              <dt className="text-[11px] text-muted">Malzeme</dt>
              <dd className="text-sm font-medium tabular-nums">
                {suggestion.ingredients.length}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void save()}
              disabled={saved}
              className="rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent disabled:border-edge disabled:bg-transparent disabled:text-muted disabled:opacity-60"
            >
              {saved ? '★ Kaydedildi' : '☆ Beğendim'}
            </button>
            <button
              onClick={() => void addToShopping()}
              className="rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
            >
              {added ? `✓ ${added}` : '🛒 Malzemeleri ekle'}
            </button>
            <button
              onClick={() => void playKitchen()}
              title="Öğüne uygun bir çalma listesi başlatır"
              className="rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
            >
              🎵 Mutfak müziği
            </button>
          </div>

          {music && <p className="text-xs text-muted">{music}</p>}

          {/* Tarif ayrı bir düğmeye alındı: diğer eylemlerin arasında
              kaybolan bir bağlantıydı, oysa kartın asıl içeriği bu. */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center justify-between rounded-xl border border-edge px-3 py-2.5 text-sm font-medium transition-colors hover:bg-panel"
          >
            {open ? 'Tarifi gizle' : 'Tarifi gör'}
            <span
              aria-hidden
              className={`text-xs text-muted transition-transform ${open ? 'rotate-180' : ''}`}
            >
              ▾
            </span>
          </button>

          {open && (
            <div className="flex flex-col gap-4 text-sm">
              <div>
                <p className="mb-2 text-xs font-semibold text-muted uppercase">
                  Malzemeler
                </p>
                {/* İki sütun: malzemeler kısa satırlar, tek sütunda kartı
                    gereksiz uzatıyorlardı. */}
                <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                  {suggestion.ingredients.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-accent" aria-hidden>
                        ·
                      </span>
                      <span className="min-w-0">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-muted uppercase">
                  Hazırlanışı
                </p>
                <ol className="flex flex-col gap-2.5">
                  {suggestion.steps.map((step, i) => (
                    <li key={step} className="flex gap-2.5">
                      <span
                        aria-hidden
                        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent tabular-nums"
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          <p className="mt-auto flex items-center justify-between border-t border-edge pt-3 text-xs text-muted">
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
