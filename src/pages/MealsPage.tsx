import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { addIngredients, describeResult } from '../lib/shopping'
import { BackIcon } from '../components/icons'

type SavedMeal = {
  id: number
  name: string
  summary: string | null
  minutes: number | null
  ingredients: string[]
  steps: string[]
  created_at: string
}

const stamp = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function MealsPage() {
  const [meals, setMeals] = useState<SavedMeal[] | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!supabase) {
      setError('Supabase yapılandırılmadı.')
      return
    }

    let cancelled = false

    supabase
      .from('saved_meals')
      .select('id, name, summary, minutes, ingredients, steps, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setMeals(data as SavedMeal[])
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function remove(id: number) {
    if (!supabase) return

    const previous = meals
    setMeals((prev) => prev?.filter((m) => m.id !== id) ?? null)

    const { error } = await supabase.from('saved_meals').delete().eq('id', id)
    if (error) {
      setError(error.message)
      setMeals(previous)
    }
  }

  async function addToShopping(meal: SavedMeal) {
    try {
      const result = await addIngredients(meal.ingredients)
      setAdded((prev) => ({ ...prev, [meal.id]: describeResult(result) }))
    } catch {
      setError('Malzemeler listeye eklenemedi.')
    }
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl p-4 sm:p-6">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to="/"
          aria-label="Panele dön"
          className="flex size-9 items-center justify-center rounded-xl border border-edge/80 bg-card text-muted transition-colors hover:text-ink"
        >
          <BackIcon />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kayıtlı Tarifler</h1>
          <p className="mt-0.5 text-sm text-muted">
            {meals ? `${meals.length} tarif` : 'Yükleniyor…'}
          </p>
        </div>
      </header>

      {error && <p className="mb-3 text-sm text-down">{error}</p>}

      {meals?.length === 0 && (
        <p className="rounded-xl border border-dashed border-edge py-10 text-center text-sm text-muted">
          Henüz tarif kaydetmedin. Paneldeki öneriyi beğenince “Beğendim”e bas —
          sonraki öneriler zevkine göre şekillenir.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {meals?.map((meal) => (
          <li
            key={meal.id}
            className="rounded-xl border border-edge bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{meal.name}</p>
                {meal.summary && (
                  <p className="mt-1 text-sm text-muted">{meal.summary}</p>
                )}
                <p className="mt-2 flex flex-wrap gap-2 text-xs">
                  {meal.minutes && (
                    <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent">
                      {meal.minutes} dk
                    </span>
                  )}
                  <span className="rounded-full bg-panel px-2.5 py-1 text-muted">
                    {stamp.format(new Date(meal.created_at))}
                  </span>
                </p>
              </div>
              <button
                onClick={() => void remove(meal.id)}
                aria-label="Tarifi sil"
                className="shrink-0 rounded-md px-1.5 py-1 text-muted hover:bg-panel hover:text-down"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setOpen(open === meal.id ? null : meal.id)}
                className="rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium hover:bg-panel"
              >
                {open === meal.id ? 'Tarifi gizle' : 'Tarifi gör'}
              </button>
              <button
                onClick={() => void addToShopping(meal)}
                className="rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium hover:bg-panel"
              >
                {added[meal.id]
                  ? `✓ ${added[meal.id]}`
                  : '🛒 Malzemeleri listeye ekle'}
              </button>
            </div>

            {open === meal.id && (
              <div className="mt-3 flex flex-col gap-3 border-t border-edge pt-3 text-sm">
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted uppercase">
                    Malzemeler
                  </p>
                  <ul className="flex flex-col gap-1">
                    {meal.ingredients.map((item) => (
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
                    {meal.steps.map((step, i) => (
                      <li key={step} className="flex gap-2">
                        <span className="text-muted tabular-nums">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
