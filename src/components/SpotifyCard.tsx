import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from './Card'
import { supabase } from '../lib/supabase'
import { connectSpotify, fetchNowPlaying } from '../lib/spotify'
import type { NowPlaying, Play } from '../lib/spotify'
import {
  currentFocus,
  currentWeather,
  onFocusChange,
  onWeatherChange,
} from '../lib/bus'
import type { FocusNow, WeatherNow } from '../lib/bus'
import { describeWeather } from '../lib/weatherCodes'
import { albumAccent, applyAccent } from '../lib/albumColor'
import {
  GENRES,
  PRESETS,
  failureMessage,
  genreQuery,
  listDevices,
  pause,
  play,
  presetQuery,
  rememberDevice,
  savedDevice,
  weatherVibe,
} from '../lib/playback'
import type { ChosenDevice, Device, Genre } from '../lib/playback'

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

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

type Tab = 'oneri' | 'tur'

export function SpotifyCard() {
  const [now, setNow] = useState<NowPlaying | null>(null)
  const [last, setLast] = useState<Play | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const [weather, setWeather] = useState<WeatherNow | null>(currentWeather)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('oneri')
  const [focus, setFocus] = useState<FocusNow | null>(currentFocus)

  const [devices, setDevices] = useState<Device[] | null>(null)
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [chosen, setChosen] = useState<ChosenDevice | null>(savedDevice)
  // Liste "aktif cihaz yok" hatasıyla açıldıysa seçim aynı zamanda çalmayı
  // sürdürür; kullanıcı listeyi kendi açtıysa yalnızca cihaz kaydedilir.
  const pending = useRef<(() => void) | null>(null)

  // İlerleme ayrı state: uç 20 saniyede bir sorulduğu için aradaki saniyeleri
  // panel kendi sayıyor, yoksa çubuk yirmi saniyede bir sıçrardı.
  const [progress, setProgress] = useState(0)

  const refresh = useCallback(async () => {
    const state = await fetchNowPlaying()
    setNow(state)
    setProgress(state.progress_ms ?? 0)

    if (!state.connected || !supabase) return

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

    const result = new URLSearchParams(window.location.search).get('spotify')
    if (result) {
      if (result === 'hata') setError('Spotify bağlanamadı. Tekrar deneyin.')
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (result === 'ok') {
      // Yeni bağlanmış hesabın arşivi boştur ve cron'un ilk turu 15 dakikayı
      // bulabilir; o aralıkta kart bozuk görünmesin diye senkron tetiklenir.
      void supabase.functions.invoke('spotify-sync').then(() => void refresh())
    } else {
      void refresh()
    }

    const timer = setInterval(() => {
      if (!document.hidden) void refresh()
    }, POLL_MS)

    return () => clearInterval(timer)
  }, [refresh])

  useEffect(() => onWeatherChange(setWeather), [])

  useEffect(() => {
    setFocus(currentFocus())

    // Odak listesini FocusCard başlatıyor. Yoklama yirmi saniyede bir olduğu
    // için kart o kadar süre eski parçayı gösterebilirdi; seans haberi gelir
    // gelmez tazeleyince çalan şarkı anında görünüyor.
    return onFocusChange((next) => {
      setFocus(next)
      if (next) void refresh()
    })
  }, [refresh])

  const playing = now?.playing ?? null
  const duration = playing?.duration_ms ?? 0

  // Saniye sayacı yalnızca çalarken işler; duraklatılmışsa çubuk da durur.
  useEffect(() => {
    if (!now?.is_playing || !duration) return

    const timer = setInterval(() => {
      setProgress((p) => Math.min(duration, p + 1000))
    }, 1000)

    return () => clearInterval(timer)
  }, [now?.is_playing, duration, playing?.id])

  // Panelin vurgu rengi çalan şarkının kapağından türesin. Renk çıkarılamayan
  // kapaklarda (gri tonlu ya da CORS'a kapalı) tema varsayılanı korunur.
  const art = playing?.art ?? null

  useEffect(() => {
    if (!art) return

    let cancelled = false
    void albumAccent(art).then((accent) => {
      if (!cancelled && accent) applyAccent(accent)
    })

    return () => {
      cancelled = true
    }
  }, [art])

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

  /**
   * Tek çalma yolu: etiket, sorgu ve bitişte gösterilecek metin dışarıdan
   * gelir. Hava/sabah/tür düğmelerinin hepsi buradan geçer.
   */
  async function start(
    id: string,
    query: string,
    deviceId?: string,
    after?: () => Promise<string | null>,
  ) {
    setBusy(id)
    setNotice(null)

    const result = await play(query, deviceId ?? chosen?.id)
    setBusy(null)

    if (result.ok) {
      setDevices(null)
      pending.current = null

      const extra = after ? await after() : null
      setNotice(extra ? `${extra} · ${result.playlist.name}` : result.playlist.name)

      // Spotify'ın çalmaya başlaması bir an sürüyor.
      setTimeout(() => void refresh(), 1500)
      return
    }

    if (result.reason === 'no-device') {
      rememberDevice(null)
      setChosen(null)
      // Cihaz seçilince aynı çalma denemesi sürdürülsün.
      pending.current = () => void start(id, query, undefined, after)
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

  function playWeather() {
    const vibe = weatherVibe(weather?.code ?? null)
    void start('weather', vibe.query)
  }

  function playMorning() {
    void start('morning', presetQuery('morning'), undefined, morningBrief)
  }

  function playGenre(genre: Genre) {
    void start(genre.label, genreQuery(genre))
  }

  async function toggleDevices() {
    if (devices) {
      setDevices(null)
      return
    }

    setLoadingDevices(true)
    const list = await listDevices()
    setLoadingDevices(false)

    pending.current = null
    setDevices(list)

    if (list.length === 0) {
      // Spotify yalnızca uyanık istemcileri listeler; kapalı telefon görünmez.
      setNotice(
        'Açık cihaz bulunamadı. Telefonunda Spotify’ı açıp bir şey çal, sonra tekrar dene.',
      )
    }
  }

  function chooseDevice(device: Device) {
    const next = { id: device.id, name: device.name }

    rememberDevice(next)
    setChosen(next)
    setDevices(null)

    const resume = pending.current
    pending.current = null

    if (resume) resume()
    else setNotice(`Çalma hedefi: ${device.name}`)
  }

  const vibe = weatherVibe(weather?.code ?? null)
  const pct = duration ? Math.min(100, (progress / duration) * 100) : 0

  return (
    <Card
      title="Müzik"
      icon="🎧"
      loading={!now && !error}
      error={error}
      action={
        focus || now?.connected ? (
          <div className="flex items-center gap-2">
            {/* Çalanın rastgele değil, süren seansın müziği olduğunu belli
                eder: seans FocusCard'da başlıyor, çalan parça burada. */}
            {focus && (
              <span className="rounded-lg bg-accent-soft px-2 py-1 text-xs font-medium text-accent">
                🎯 Odak
              </span>
            )}
            {now?.connected && (
              <Link
                to="/muzik"
                className="rounded-lg border border-edge px-2.5 py-1 text-xs font-medium text-muted hover:bg-panel hover:text-ink"
              >
                Arşiv
              </Link>
            )}
          </div>
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
        <div className="flex flex-1 flex-col gap-4">
          {/* Çalan şarkı */}
          {playing ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3.5">
                {playing.art ? (
                  <img
                    src={playing.art}
                    alt=""
                    className="size-16 shrink-0 rounded-xl object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-panel text-xl">
                    🎵
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <a
                    href={playing.url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate font-medium hover:text-accent"
                  >
                    {playing.track}
                  </a>
                  <p className="truncate text-sm text-muted">{playing.artist}</p>
                  {playing.album && (
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {playing.album}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    void pause().then((result) => {
                      if (!result.ok) setNotice(result.message ?? null)
                      setTimeout(() => void refresh(), 800)
                    })
                  }}
                  disabled={!now.is_playing}
                  aria-label="Duraklat"
                  title="Duraklat"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-edge text-xs transition-colors hover:bg-panel disabled:opacity-40"
                >
                  {now.is_playing ? '❚❚' : '▶'}
                </button>
              </div>

              {duration > 0 && (
                <div className="flex items-center gap-2 text-[11px] text-muted tabular-nums">
                  <span>{clock(progress)}</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-panel">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span>{clock(duration)}</span>
                </div>
              )}
            </div>
          ) : last ? (
            <div className="flex items-center gap-3.5">
              {last.art && (
                <img
                  src={last.art}
                  alt=""
                  className="size-16 shrink-0 rounded-xl object-cover opacity-60"
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

          {/* Sekmeler: bağlama göre öneri mi, tür mü */}
          <div className="flex gap-1 rounded-xl bg-panel p-1 text-xs font-medium">
            {(
              [
                ['oneri', 'Öneri'],
                ['tur', 'Tür'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
                className={`flex-1 rounded-lg py-1.5 transition-colors ${
                  tab === id
                    ? 'bg-card text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'oneri' ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={playWeather}
                disabled={busy !== null}
                title="Havaya ve saate uygun bir çalma listesi bulup başlatır"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-edge px-2.5 py-2 text-xs font-medium transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent disabled:opacity-40"
              >
                <span aria-hidden>
                  {weather ? describeWeather(weather.code).icon : '🎵'}
                </span>
                {busy === 'weather' ? 'Aranıyor…' : vibe.label}
              </button>

              <button
                onClick={playMorning}
                disabled={busy !== null}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-edge px-2.5 py-2 text-xs font-medium transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent disabled:opacity-40"
              >
                <span aria-hidden>☀️</span>
                {busy === 'morning' ? 'Aranıyor…' : PRESETS.morning.label}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map((genre) => (
                <button
                  key={genre.label}
                  onClick={() => playGenre(genre)}
                  disabled={busy !== null}
                  className="rounded-full border border-edge px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent disabled:opacity-40"
                >
                  {busy === genre.label ? 'Aranıyor…' : genre.label}
                </button>
              ))}
            </div>
          )}

          {notice && <p className="text-xs text-muted">{notice}</p>}

          {devices && devices.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {devices.map((device) => (
                <li key={device.id}>
                  <button
                    onClick={() => chooseDevice(device)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-accent-soft hover:text-accent ${
                      chosen?.id === device.id
                        ? 'bg-accent-soft text-accent'
                        : 'bg-panel'
                    }`}
                  >
                    {device.name}
                    {device.is_active && ' ●'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Alt bilgi çubuğu */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-edge pt-3 text-xs text-muted">
            <button
              onClick={() => void toggleDevices()}
              disabled={loadingDevices}
              className="font-medium transition-colors hover:text-ink disabled:opacity-40"
            >
              {loadingDevices ? 'Cihazlar aranıyor…' : `▾ ${chosen?.name ?? 'aktif cihaz'}`}
            </button>

            <div className="flex items-center gap-3">
              {total !== null && total > 0 && (
                <span>{total.toLocaleString('tr-TR')} çalma</span>
              )}
              <button
                onClick={() => void connect()}
                disabled={connecting}
                className="transition-colors hover:text-ink disabled:opacity-40"
              >
                {connecting ? 'Yönlendiriliyor…' : 'Yenile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
