import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type SnapshotState<T> = {
  data: T | null
  updatedAt: string | null
  error: string | null
}

// Panel PWA olarak açılıyor ama snapshot her açılışta ağdan geliyordu: kartlar
// istek dönene kadar iskelet gösteriyordu. Son cevap yerelde tutuluyor, açılışta
// anında basılıyor, taze veri arkadan gelince yerine geçiyor. Çevrimdışıyken de
// panel boş açılmıyor.
const CACHE_PREFIX = 'panel:snapshot:'

/**
 * Bayat veri iskeletten iyidir ama sınırsız değil: bir günü aşan snapshot
 * gösterilmez. Kur ve gündem o yaşta bilgi değil yanıltma olur; kartın
 * "veri yok" demesi daha dürüst.
 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

type CachedSnapshot = { payload: unknown; updatedAt: string; cachedAt: number }

function readCache<T>(key: string): { data: T; updatedAt: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null

    const parsed = JSON.parse(raw) as CachedSnapshot
    // Bozuk ya da eski biçimli kayıt kartı kilitlemesin.
    if (!parsed?.updatedAt || typeof parsed.cachedAt !== 'number') return null
    if (Date.now() - parsed.cachedAt > MAX_AGE_MS) return null

    return { data: parsed.payload as T, updatedAt: parsed.updatedAt }
  } catch {
    return null
  }
}

function writeCache(key: string, payload: unknown, updatedAt: string) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ payload, updatedAt, cachedAt: Date.now() }),
    )
  } catch {
    // Kota dolu ya da depolama kapalı — önbelleksiz de çalışır.
  }
}

/**
 * snapshots tablosundaki tek bir satırı okur. Veriyi Edge Function tazeler;
 * panel yalnızca okuyucudur.
 */
export function useSnapshot<T>(key: string): SnapshotState<T> {
  // Başlangıç değeri önbellekten okunuyor: useState'in tembel biçimi ilk
  // boyamadan önce çalıştığı için iskelet hiç görünmüyor.
  const [state, setState] = useState<SnapshotState<T>>(() => {
    const cached = readCache<T>(key)
    return {
      data: cached?.data ?? null,
      updatedAt: cached?.updatedAt ?? null,
      error: null,
    }
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
          // Önbellekte veri varsa kartı boşaltma: eski ama okunabilir veri hata
          // metninden iyidir ve ne kadar eski olduğu "... itibarıyla" ile zaten
          // yazıyor. Çevrimdışı açılışın işe yaradığı yer burası.
          setState((prev) =>
            prev.data
              ? prev
              : { data: null, updatedAt: null, error: error.message },
          )
        } else if (!data) {
          // Satır dönmediğinde de önbelleği koru. Oturum tazelenirken istek
          // RLS'e takılıp hatasız biçimde boş dönebiliyor; kart o anda elindeki
          // geçerli veriyi bırakıp "veri yok"a düşüyordu. Bu mesaj yalnızca
          // gösterilecek hiçbir şey yokken doğru.
          setState((prev) =>
            prev.data
              ? prev
              : {
                  data: null,
                  updatedAt: null,
                  error:
                    'Henüz veri yok — refresh-snapshot fonksiyonunu çalıştır.',
                },
          )
        } else {
          writeCache(key, data.payload, data.updated_at)
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

// Gün + saat. Önbellekten gelen veri düne ait olabiliyor; yalnızca saat
// yazıldığında "14:30 itibarıyla" bugünmüş gibi okunuyordu.
const dayTimeFormat = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatUpdatedAt(iso: string | null) {
  if (!iso) return undefined

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return undefined

  const today = date.toDateString() === new Date().toDateString()
  return `${(today ? timeFormat : dayTimeFormat).format(date)} itibarıyla`
}
