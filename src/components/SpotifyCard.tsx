import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from './Card'
import { supabase } from '../lib/supabase'
import { connectSpotify, fetchNowPlaying } from '../lib/spotify'
import type { NowPlaying, Play } from '../lib/spotify'
import { currentWeather, onWeatherChange } from '../lib/bus'
import type { WeatherNow } from '../lib/bus'
import { describeWeather } from '../lib/weatherCodes'
import {
  PRESETS,
  failureMessage,
  pause,
  play,
  rememberDevice,
  savedDevice,
  weatherVibe,
} from '../lib/playback'
import type { Device } from '../lib/playback'

// Çalan şarkı sık değişir ama kart da her saniye sorulmamalı.
const POLL_MS = 20_000

const timeFormat = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** Yerel saate göre YYYY-MM-DD — hatırlatma sorgusu için. */
function today() {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function SpotifyCard() {
  const [now, setNow] = useState<NowPlaying | null>(null)
  const [last, setLast] = useState<Play | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const [weather, setWeather] = useState<WeatherNow | null>(currentWeather)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [devices, setDevices] = useState<Device[] | null>(null)
  // Cihaz seçimi hangi düğme için soruldu — seçimden sonra o çalma sürdürülür.
  const [pending, setPending] = useState<'weather' | 'morning'>('weather')

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

  useEffect(() => onWeatherChange(setWeather), [])

  async function connect() {
    setConnecting(true)
    const message = await connectSpotify()
    if (message) {
      setError(message)
      setConnecting(false)
    }
  }

  /** Günaydın özeti: hava + bugüne düşen hatırlatma sayısı. */
  async function morningBrief() {
    const parts: string[] = ['Günaydın']

    if (weather) {
      parts.push(`${weather.temp}° ${describeWeather(weather.code).label}`)
    }

    if (supabase) {
      const { count } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .not('remind_on', 'is', null)
        .lte('remind_on', today())

      if (count) parts.push(`${count} hatırlatma bugün`)
    }

    return parts.join(' · ')
  }

  async function start(kind: 'weather' | 'morning', deviceId?: string) {
    const vibe =
      kind === 'morning'
        ? PRESETS.morning
        : weatherVibe(weather?.code ?? null)

    setBusy(kind)
    setNotice(null)

    const result = await play(vibe.query, deviceId ?? savedDevice())
    setBusy(null)

    if (result.ok) {
      setDevices(null)
      if (deviceId) rememberDevice(deviceId)

      const brief = kind === 'morning' ? await morningBrief() : null
      setNotice(
        brief
          ? `${brief} · ${result.playlist.name}`
          : `Çalıyor: ${result.playlist.name}`,
      )

      // Spotify'ın çalmaya başlaması bir an sürüyor; kart hemen sorarsa
      // hâlâ eski parçayı görür.
      setTimeout(() => void refresh(), 1500)
      return
    }

    if (result.reason === 'no-device') {
      // Kayıtlı cihaz kapanmış olabilir; seçim yeniden sorulur.
      rememberDevice(null)
      setPending(kind)
      setDevices(result.devices)
      setNotice(
        result.devices.length
          ? 'Hangi cihazda çalsın?'
          : 'Açık bir Spotify istemcisi yok. Telefonda veya masaüstünde Spotify’ı aç.',
      )
      return
    }

    setNotice(failureMessage(result))
  }

  const playing = now?.playing ?? null
  const vibe = weatherVibe(weather?.code ?? null)

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

          <div className="flex flex-wrap gap-2 border-t border-edge pt-3">
            <button
              onClick={() => void start('weather')}
              disabled={busy !== null}
              title={`Arama: ${vibe.query}`}
              className="rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium hover:bg-panel disabled:opacity-40"
            >
              {weather ? describeWeather(weather.code).icon : '🎵'}{' '}
              {busy === 'weather' ? 'Aranıyor…' : vibe.label}
            </button>

            <button
              onClick={() => void start('morning')}
              disabled={busy !== null}
              className="rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium hover:bg-panel disabled:opacity-40"
            >
              ☀️ {busy === 'morning' ? 'Aranıyor…' : PRESETS.morning.label}
            </button>

            {now.is_playing && (
              <button
                onClick={() => {
                  void pause().then((result) => {
                    if (!result.ok) setNotice(result.message ?? null)
                    setTimeout(() => void refresh(), 800)
                  })
                }}
                className="rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium hover:bg-panel"
              >
                ❚❚ Duraklat
              </button>
            )}
          </div>

          {notice && <p className="text-xs text-muted">{notice}</p>}

          {devices && devices.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {devices.map((device) => (
                <li key={device.id}>
                  <button
                    onClick={() => void start(pending, device.id)}
                    className="rounded-lg bg-panel px-2.5 py-1.5 text-xs hover:bg-accent-soft hover:text-accent"
                  >
                    {device.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-baseline justify-between gap-3">
            {total !== null && total > 0 ? (
              <p className="text-xs text-muted">
                Arşivde {total.toLocaleString('tr-TR')} çalma kayıtlı.
              </p>
            ) : (
              <span />
            )}

            {/* İzin listesi büyüdüğünde yeniden yetki vermek gerekiyor;
                bağlıyken bunun başka yolu yok. Yeniden bağlanmak mevcut
                kaydı ezer, önce bağlantıyı koparmaya gerek kalmaz. */}
            <button
              onClick={() => void connect()}
              disabled={connecting}
              className="shrink-0 text-xs text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-40"
            >
              {connecting ? 'Yönlendiriliyor…' : 'Bağlantıyı yenile'}
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
