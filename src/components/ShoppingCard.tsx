import { useEffect, useState } from 'react'
import { Card } from './Card'
import { supabase } from '../lib/supabase'
import { onShoppingChange } from '../lib/bus'

type Item = { id: number; body: string; checked: boolean }

export function ShoppingCard() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!supabase) {
      setError('Supabase yapılandırılmadı.')
      return
    }

    const { data, error } = await supabase
      .from('shopping_items')
      .select('id, body, checked')
      .order('checked')
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setItems(data)
  }

  useEffect(() => {
    void load()
    // Yemek kartı malzeme eklediğinde liste kendini tazelesin.
    return onShoppingChange(() => void load())
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !supabase) return

    const { data, error } = await supabase
      .from('shopping_items')
      .insert({ body })
      .select('id, body, checked')
      .single()

    if (error) return setError(error.message)

    setItems((prev) => [data, ...(prev ?? [])])
    setDraft('')
  }

  async function toggle(item: Item) {
    if (!supabase) return

    const previous = items
    setItems(
      (prev) =>
        prev
          ?.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i))
          .sort((a, b) => Number(a.checked) - Number(b.checked)) ?? null,
    )

    const { error } = await supabase
      .from('shopping_items')
      .update({ checked: !item.checked })
      .eq('id', item.id)

    if (error) {
      setError(error.message)
      setItems(previous)
    }
  }

  async function remove(id: number) {
    if (!supabase) return

    const previous = items
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? null)

    const { error } = await supabase.from('shopping_items').delete().eq('id', id)
    if (error) {
      setError(error.message)
      setItems(previous)
    }
  }

  async function clearChecked() {
    if (!supabase) return

    const previous = items
    setItems((prev) => prev?.filter((i) => !i.checked) ?? null)

    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('checked', true)

    if (error) {
      setError(error.message)
      setItems(previous)
    }
  }

  const done = items?.filter((i) => i.checked).length ?? 0

  return (
    <Card
      title="Alışveriş"
      icon="🛒"
      loading={!items && !error}
      error={error}
      action={
        done > 0 ? (
          <button
            onClick={() => void clearChecked()}
            className="rounded-lg border border-edge px-2.5 py-1 text-xs font-medium text-muted hover:bg-panel hover:text-ink"
          >
            Alınanları temizle ({done})
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <form onSubmit={add} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ürün ekle…"
            className="min-w-0 flex-1 rounded-lg border border-edge bg-panel/60 px-3 py-2 text-sm outline-none focus:border-accent focus:bg-card"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Ekle
          </button>
        </form>

        {items?.length === 0 ? (
          <p className="py-1 text-sm text-muted">Liste boş.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {items?.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => void toggle(item)}
                  className="size-4 shrink-0 accent-accent"
                />
                <span
                  className={`min-w-0 flex-1 truncate ${
                    item.checked ? 'text-muted line-through' : ''
                  }`}
                >
                  {item.body}
                </span>
                <button
                  onClick={() => void remove(item.id)}
                  aria-label="Kaldır"
                  className="shrink-0 px-1 text-muted hover:text-down"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
