import { useEffect, useState } from 'react'
import { Card } from './Card'
import { supabase } from '../lib/supabase'

type Quote = { id: number; body: string; author: string | null }

/** Gün numarası — aynı gün içinde hep aynı söz gösterilsin diye. */
function dayIndex() {
  const start = new Date(new Date().getFullYear(), 0, 0)
  const diff = Date.now() - start.getTime()
  return Math.floor(diff / 86_400_000)
}

export function QuoteCard() {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setError('Supabase yapılandırılmadı.')
      return
    }

    let cancelled = false

    supabase
      .from('quotes')
      .select('id, body, author')
      .order('id')
      .then(({ data, error }) => {
        if (cancelled) return

        if (error) setError(error.message)
        else if (!data?.length) setError('Söz havuzu boş.')
        else setQuote(data[dayIndex() % data.length])
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card title="Günün Sözü" icon="✨" loading={!quote && !error} error={error}>
      {quote && (
        <figure className="flex h-full flex-col justify-center">
          <blockquote className="text-base leading-relaxed text-balance">
            “{quote.body}”
          </blockquote>
          {quote.author && (
            <figcaption className="mt-3 text-xs text-muted">
              — {quote.author}
            </figcaption>
          )}
        </figure>
      )}
    </Card>
  )
}
