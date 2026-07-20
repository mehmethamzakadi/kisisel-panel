import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Point = { bucket: string; value: number }

/** Kod başına noktalar, eskiden yeniye sıralı. */
export type Series = Record<string, Point[]>

const DEFAULT_DAYS = 7

/**
 * rate_history'yi tek sorguda okur ve koda göre gruplar.
 *
 * Kart başına ayrı sorgu atmak yerine tek istek: altı altın kalemi için altı
 * ayrı sorgu, aynı veriyi altı kez dolaşmak olurdu. Satırlar saatlik olduğu
 * için 7 gün ≈ kod başına 168 nokta; grafiğe fazlasıyla yeter.
 */
export function useHistory(kind: 'rate' | 'gold', days = DEFAULT_DAYS) {
  const [series, setSeries] = useState<Series>({})

  useEffect(() => {
    if (!supabase) return

    let cancelled = false
    const since = new Date(Date.now() - days * 86_400_000).toISOString()

    supabase
      .from('rate_history')
      .select('code, bucket, value')
      .eq('kind', kind)
      .gte('bucket', since)
      .order('bucket')
      .then(({ data }) => {
        if (cancelled || !data) return

        const grouped: Series = {}
        for (const row of data as (Point & { code: string })[]) {
          ;(grouped[row.code] ??= []).push({
            bucket: row.bucket,
            value: Number(row.value),
          })
        }

        setSeries(grouped)
      })

    return () => {
      cancelled = true
    }
  }, [kind, days])

  return series
}

/**
 * Penceredeki ilk ve son nokta arasındaki yüzde değişim.
 * Tek nokta varsa trend yok demektir — null döner, kart da göstermez.
 */
export function changePct(points: Point[] | undefined): number | null {
  if (!points || points.length < 2) return null

  const first = points[0].value
  const last = points[points.length - 1].value
  if (!first) return null

  return ((last - first) / first) * 100
}
