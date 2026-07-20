import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from './Card'
import { supabase } from '../lib/supabase'
import { connectSpotify, fetchNowPlaying } from '../lib/spotify'
import type { NowPlaying, Play } from '../lib/spotify'

// Çalan şarkı sık değişir ama kart da her saniye sorulmamalı.
const POLL_MS = 20_000

const timeFormat = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function SpotifyCard() {
  const [now, setNow] = useState<NowPlaying | null>(null)
  const [last, setLast] = useState<Play | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const refresh = useCallback(async () => {
    const state = await fetchNowPlaying()
    setNow(state)

    if (!state.connected || !supabase) return

    // Hiçbir şey çalmıyorken kart boş kalmasın: arşivdeki son kayıt gösterilir.
    const [lastRes, countRes] = await Promise.all([
      supabase
        .from('plays')
        .select('played_at, track, artist, art, url')
        .order('played_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('plays').select('*', { count: 'exact', head: true }),
    ])

    if (lastRes.data) setLast(lastRes.data as Play)
    if (typeof countRes.count === 'number') setTotal(countRes.count)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setError('Supabase yapılandırılmadı.')
      return
    }

    // Yetkilendirme dönüşünde adres çubuğunda ?spotify=... kalır; okunup
    // temizlenmezse her yenilemede aynı sonuç gösterilir.
    const result = new URLSearchParams(window.location.search).get('spotify')
    if (result) {
      if (result === 'hata') setError('Spotify bağlanamadı. Tekrar deneyin.')
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (result === 'ok') {
      // Yeni bağlanmış hesabın arşivi boştur ve cron'un ilk turu 15 dakikayı
      // bulabilir. O aralıkta kart "hiçbir şey yok" der ve bozuk görünür;
      // bu yüzden dönüşte senkron bir kez elle tetiklenir.
      void supabase.functions.invoke('spotify-sync').then(() => void refresh())
    } else {
      void refresh()
    }

    // Arka plandaki sekme boşuna sorgu atmasın.
    const timer = setInterval(() => {
      if (!document.hidden) void refresh()
    }, POLL_MS)

    return () => clearInterval(timer)
  }, [refresh])

  async function connect() {
    setConnecting(true)
    const message = await connectSpotify()
    if (message) {
      setError(message)
      setConnecting(false)
    }
  }

  const playing = now?.playing ?? null

  return (
    <Card
      title="Müzik"
      icon="🎧"
      loading={!now && !error}
      error={error}
      action={
        now?.connected ? (
          <Link
            to="/muzik"
            className="rounded-lg border border-edge px-2.5 py-1 text-xs font-medium text-muted hover:bg-panel hover:text-ink"
          >
            Arşiv
          </Link>
        ) : undefined
      }
    >
      {!now?.connected ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted">
            Dinlediklerini panelde topla: çalan şarkı, dinleme arşivi ve
            notlarına şarkı damgası.
          </p>
          <button
            onClick={() => void connect()}
            disabled={connecting}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {connecting ? 'Yönlendiriliyor…' : "Spotify'ı bağla"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {playing ? (
            <a
              href={playing.url ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3"
            >
              {playing.art && (
                <img
                  src={playing.art}
                  alt=""
                  className="size-14 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium group-hover:text-accent">
                  {playing.track}
                </p>
                <p className="truncate text-xs text-muted">{playing.artist}</p>
                <p className="mt-1 text-xs text-accent">
                  {now.is_playing ? '● çalıyor' : '❚❚ duraklatıldı'}
                </p>
              </div>
            </a>
          ) : last ? (
            <div className="flex items-center gap-3">
              {last.art && (
                <img
                  src={last.art}
                  alt=""
                  className="size-14 shrink-0 rounded-lg object-cover opacity-60"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm">{last.track}</p>
                <p className="truncate text-xs text-muted">{last.artist}</p>
                <p className="mt-1 text-xs text-muted">
                  son dinlenen · {timeFormat.format(new Date(last.played_at))}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Şu an bir şey çalmıyor. Arşiv, senkron çalıştıkça dolacak.
            </p>
          )}

          {total !== null && total > 0 && (
            <p className="text-xs text-muted">
              Arşivde {total.toLocaleString('tr-TR')} çalma kayıtlı.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
