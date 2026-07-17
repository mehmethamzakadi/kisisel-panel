import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type SnapshotState<T> = {
  data: T | null
  updatedAt: string | null
  error: string | null
}

/**
 * snapshots tablosundaki tek bir satırı okur. Veriyi Edge Function tazeler;
 * panel yalnızca okuyucudur.
 */
export function useSnapshot<T>(key: string): SnapshotState<T> {
  const [state, setState] = useState<SnapshotState<T>>({
    data: null,
    updatedAt: null,
    error: null,
  })

  useEffect(() => {
    if (!supabase) {
      setState({ data: null, updatedAt: null, error: 'Supabase yapılandırılmadı.' })
      return
    }

    let cancelled = false

    supabase
      .from('snapshots')
      .select('payload, updated_at')
      .eq('key', key)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return

        if (error) {
          setState({ data: null, updatedAt: null, error: error.message })
        } else if (!data) {
          setState({
            data: null,
            updatedAt: null,
            error: 'Henüz veri yok — refresh-snapshot fonksiyonunu çalıştır.',
          })
        } else {
          setState({
            data: data.payload as T,
            updatedAt: data.updated_at,
            error: null,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [key])

  return state
}

const timeFormat = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
})

export function formatUpdatedAt(iso: string | null) {
  return iso ? `${timeFormat.format(new Date(iso))} itibarıyla` : undefined
}
